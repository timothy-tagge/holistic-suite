import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import { useProfile } from "@/contexts/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  GraduationCap,
  Layers,
  TrendingUp,
  Building2,
  ArrowRight,
  Check,
} from "lucide-react";

const MODULES = [
  {
    key: "overview",
    label: "Overview",
    icon: BarChart3,
    description:
      "Retirement income projection across every sleeve. See the crossover year where passive income meets your target.",
    available: true,
  },
  {
    key: "college",
    label: "College",
    icon: GraduationCap,
    description:
      "Endowment-style funding plan for multiple children. Model contributions, cost tiers, and year-by-year projections.",
    available: true,
  },
  {
    key: "alts",
    label: "Alts",
    icon: Layers,
    description:
      "One place for all your alternative investments. Track capital calls, distributions, and compute IRR.",
    available: true,
  },
  {
    key: "equity",
    label: "Equity",
    icon: TrendingUp,
    description: "Portfolio modeling across stocks, index funds, and mutual funds.",
    available: false,
  },
  {
    key: "property",
    label: "Property",
    icon: Building2,
    description: "Real estate equity, income, and appreciation over time.",
    available: false,
  },
];

const TOTAL_STEPS = 2;

export function Onboarding() {
  const { patchProfile } = useProfile();

  const [step, setStep] = useState(1);
  const [age, setAge] = useState("");
  const [retirementYear, setRetirementYear] = useState("");
  const [selectedModules, setSelectedModules] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const currentYear = new Date().getFullYear();

  // ── Step 1 validation ──────────────────────────────────────────────────────
  const ageNum = parseInt(age, 10);
  const yearNum = parseInt(retirementYear, 10);
  const ageValid = age !== "" && ageNum >= 18 && ageNum <= 100;
  const yearValid =
    retirementYear !== "" && yearNum >= currentYear && yearNum <= currentYear + 60;
  const step1Valid = ageValid && yearValid;

  function toggleModule(key) {
    setSelectedModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleFinish() {
    setSaving(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, "updateProfile");
      const result = await fn({
        age: ageNum,
        targetRetirementYear: yearNum,
        activeModules: selectedModules,
      });
      if (result.data.ok) {
        patchProfile(result.data.data.profile);
        // isOnboarded will flip true → AppRoutes redirects away from /onboarding automatically
      } else {
        setError(result.data.error?.message ?? "Something went wrong.");
      }
    } catch (err) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-svh bg-background flex flex-col">
      {/* Header */}
      <div className="border-b px-6 h-14 flex items-center">
        <span className="font-heading font-bold text-lg tracking-tight text-foreground">
          Holistic
        </span>
      </div>

      {/* Progress */}
      <div className="w-full h-1 bg-muted">
        <div
          className="h-1 bg-primary transition-all duration-300"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Step indicator */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Step {step} of {TOTAL_STEPS}
          </p>

          {/* ── Step 1: Personal info ─────────────────────────────────────── */}
          {step === 1 && (
            <div>
              <h1
                className="font-heading font-bold tracking-tight text-foreground mb-2"
                style={{ fontSize: "clamp(24px, 4vw, 36px)", lineHeight: 1.15 }}
              >
                Let's build your picture
              </h1>
              <p className="text-muted-foreground text-sm mb-8">
                Two numbers are all we need to start modeling your financial future.
              </p>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="age">Your current age</Label>
                  <Input
                    id="age"
                    type="number"
                    min={18}
                    max={100}
                    placeholder="e.g. 42"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="text-lg h-12"
                    autoFocus
                  />
                  {age !== "" && !ageValid && (
                    <p className="text-xs text-destructive">
                      Please enter an age between 18 and 100.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retirementYear">Target retirement year</Label>
                  <Input
                    id="retirementYear"
                    type="number"
                    min={currentYear}
                    max={currentYear + 60}
                    placeholder={`e.g. ${currentYear + 20}`}
                    value={retirementYear}
                    onChange={(e) => setRetirementYear(e.target.value)}
                    className="text-lg h-12"
                  />
                  {retirementYear !== "" && !yearValid && (
                    <p className="text-xs text-destructive">
                      Please enter a year between {currentYear} and {currentYear + 60}.
                    </p>
                  )}
                  {ageValid && yearValid && (
                    <p className="text-xs text-muted-foreground">
                      That's{" "}
                      {yearNum - currentYear + (currentYear - (currentYear - ageNum))}{" "}
                      years away — you'll be {ageNum + (yearNum - currentYear)} at
                      retirement.
                    </p>
                  )}
                </div>
              </div>

              <Button
                className="w-full mt-8 gap-2"
                size="lg"
                disabled={!step1Valid}
                onClick={() => setStep(2)}
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* ── Step 2: Module selection ──────────────────────────────────── */}
          {step === 2 && (
            <div>
              <h1
                className="font-heading font-bold tracking-tight text-foreground mb-2"
                style={{ fontSize: "clamp(24px, 4vw, 36px)", lineHeight: 1.15 }}
              >
                What are you planning for?
              </h1>
              <p className="text-muted-foreground text-sm mb-8">
                Choose the modules that apply to your situation. You can add or remove
                them any time.
              </p>

              <div className="space-y-3">
                {MODULES.map(({ key, label, icon: Icon, description, available }) => {
                  const selected = selectedModules.includes(key);
                  return (
                    <Card
                      key={key}
                      className={[
                        "border transition-all cursor-pointer select-none",
                        !available && "opacity-50 cursor-default",
                        available && selected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : available
                            ? "hover:border-primary/40 hover:bg-accent/50"
                            : "",
                      ].join(" ")}
                      onClick={available ? () => toggleModule(key) : undefined}
                      role={available ? "checkbox" : undefined}
                      aria-checked={available ? selected : undefined}
                      tabIndex={available ? 0 : undefined}
                      onKeyDown={
                        available ? (e) => e.key === " " && toggleModule(key) : undefined
                      }
                    >
                      <CardContent className="p-4 flex items-start gap-4">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-heading font-semibold text-foreground text-sm">
                              {label}
                            </span>
                            {!available && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                Coming soon
                              </Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground text-xs leading-relaxed">
                            {description}
                          </p>
                        </div>
                        {available && (
                          <div
                            className={[
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                              selected
                                ? "border-primary bg-primary"
                                : "border-muted-foreground/30",
                            ].join(" ")}
                          >
                            {selected && (
                              <Check className="h-3 w-3 text-primary-foreground" />
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {error && <p className="text-xs text-destructive mt-4">{error}</p>}

              <div className="flex gap-3 mt-8">
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={() => setStep(1)}
                  disabled={saving}
                >
                  Back
                </Button>
                <Button
                  size="lg"
                  className="flex-1 gap-2"
                  onClick={handleFinish}
                  disabled={saving}
                >
                  {saving
                    ? "Saving…"
                    : selectedModules.length === 0
                      ? "Skip for now"
                      : "Let's go"}
                  {!saving && <ArrowRight className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
