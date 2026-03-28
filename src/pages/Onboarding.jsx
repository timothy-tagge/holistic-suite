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
    key: "retirement",
    label: "Retirement",
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

export function Onboarding() {
  const { patchProfile } = useProfile();

  const [step, setStep] = useState(1);
  const [selectedModules, setSelectedModules] = useState([]);

  // Retirement inputs
  const [age, setAge] = useState("");
  const [retirementAge, setRetirementAge] = useState("65");

  // College inputs
  const [numberOfKids, setNumberOfKids] = useState("");
  const [monthlyCollegeBudget, setMonthlyCollegeBudget] = useState("");

  // Alts inputs
  const [numberOfAltsInvestments, setNumberOfAltsInvestments] = useState("");
  const [totalCommittedCapital, setTotalCommittedCapital] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const currentYear = new Date().getFullYear();

  const needsRetirement = selectedModules.includes("retirement");
  const needsCollege = selectedModules.includes("college");
  const needsAlts = selectedModules.includes("alts");
  const hasStep2 = needsRetirement || needsCollege || needsAlts;

  // Step 2 validation
  const ageNum = parseInt(age, 10);
  const retirementAgeNum = parseInt(retirementAge, 10);
  const numberOfKidsNum = parseInt(numberOfKids, 10);
  const monthlyCollegeBudgetNum = parseFloat(monthlyCollegeBudget);
  const numberOfAltsInvestmentsNum = parseInt(numberOfAltsInvestments, 10);
  const totalCommittedCapitalNum = parseFloat(totalCommittedCapital);

  const ageValid = !needsRetirement || (age !== "" && ageNum >= 18 && ageNum <= 100);
  const retirementAgeValid =
    !needsRetirement ||
    (retirementAge !== "" &&
      retirementAgeNum >= 40 &&
      retirementAgeNum <= 80 &&
      (!ageValid || retirementAgeNum > ageNum));
  const numberOfKidsValid =
    !needsCollege || (numberOfKids !== "" && numberOfKidsNum >= 1 && numberOfKidsNum <= 20);
  const monthlyCollegeBudgetValid =
    !needsCollege ||
    (monthlyCollegeBudget !== "" && monthlyCollegeBudgetNum >= 0);
  const numberOfAltsInvestmentsValid =
    !needsAlts ||
    (numberOfAltsInvestments !== "" && numberOfAltsInvestmentsNum >= 0 && numberOfAltsInvestmentsNum <= 500);
  const totalCommittedCapitalValid =
    !needsAlts || (totalCommittedCapital !== "" && totalCommittedCapitalNum >= 0);
  const step2Valid =
    ageValid &&
    retirementAgeValid &&
    numberOfKidsValid &&
    monthlyCollegeBudgetValid &&
    numberOfAltsInvestmentsValid &&
    totalCommittedCapitalValid;

  function toggleModule(key) {
    setSelectedModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function handleContinue() {
    if (hasStep2) {
      setStep(2);
    } else {
      handleFinish([]);
    }
  }

  async function handleFinish() {
    setSaving(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, "updateProfile");
      const payload = { activeModules: selectedModules };
      if (needsRetirement) {
        payload.age = ageNum;
        payload.targetRetirementAge = retirementAgeNum;
      }
      if (needsCollege) {
        payload.numberOfKids = numberOfKidsNum;
        payload.monthlyCollegeBudget = monthlyCollegeBudgetNum;
      }
      if (needsAlts) {
        payload.numberOfAltsInvestments = numberOfAltsInvestmentsNum;
        payload.totalCommittedCapital = totalCommittedCapitalNum;
      }
      const result = await fn(payload);
      if (result.data.ok) {
        patchProfile(result.data.data.profile);
        // isOnboarded flips true → AppRoutes redirects automatically
      } else {
        setError(result.data.error?.message ?? "Something went wrong.");
      }
    } catch (err) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const totalSteps = hasStep2 ? 2 : 1;

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
          style={{ width: `${(step / totalSteps) * 100}%` }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Step {step} of {totalSteps}
          </p>

          {/* ── Step 1: Module selection ───────────────────────────────────── */}
          {step === 1 && (
            <div>
              <h1
                className="font-heading font-bold tracking-tight text-foreground mb-2"
                style={{ fontSize: "clamp(24px, 4vw, 36px)", lineHeight: 1.15 }}
              >
                What's part of your holistic money view?
              </h1>
              <p className="text-muted-foreground text-sm mb-16">
                Pick what matters to you. Each piece sharpens your picture of money.
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

              <Button
                className="w-full mt-8 gap-2"
                size="lg"
                disabled={saving}
                onClick={handleContinue}
              >
                {saving
                  ? "Saving…"
                  : selectedModules.length === 0
                    ? "Skip for now"
                    : "Continue"}
                {!saving && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          )}

          {/* ── Step 2: Module-driven questions ───────────────────────────── */}
          {step === 2 && (
            <div>
              <h1
                className="font-heading font-bold tracking-tight text-foreground mb-2"
                style={{ fontSize: "clamp(24px, 4vw, 36px)", lineHeight: 1.15 }}
              >
                A few quick details
              </h1>
              <p className="text-muted-foreground text-sm mb-8">
                These drive the projections for the modules you selected.
              </p>

              <div className="space-y-6">
                {needsRetirement && (
                  <>
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
                        className="text-lg h-12 max-w-[180px]"
                        autoFocus
                      />
                      {age !== "" && !ageValid && (
                        <p className="text-xs text-destructive">Enter an age between 18 and 100.</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="retirementAge">Target retirement age</Label>
                      <Input
                        id="retirementAge"
                        type="number"
                        min={40}
                        max={80}
                        value={retirementAge}
                        onChange={(e) => setRetirementAge(e.target.value)}
                        className="text-lg h-12 max-w-[180px]"
                      />
                      {retirementAge !== "" && !retirementAgeValid && (
                        <p className="text-xs text-destructive">
                          Enter an age between 40 and 80, greater than your current age.
                        </p>
                      )}
                      {ageValid && retirementAgeValid && (
                        <p className="text-xs text-muted-foreground">
                          {retirementAgeNum - ageNum} years away — retirement in{" "}
                          {currentYear + (retirementAgeNum - ageNum)}.
                        </p>
                      )}
                    </div>
                  </>
                )}

                {needsCollege && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="numberOfKids">Number of children to plan for</Label>
                      <Input
                        id="numberOfKids"
                        type="number"
                        min={1}
                        max={20}
                        placeholder="e.g. 2"
                        value={numberOfKids}
                        onChange={(e) => setNumberOfKids(e.target.value)}
                        className="text-lg h-12 max-w-[180px]"
                        autoFocus={!needsRetirement}
                      />
                      {numberOfKids !== "" && !numberOfKidsValid && (
                        <p className="text-xs text-destructive">Enter a number between 1 and 20.</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="monthlyCollegeBudget">Monthly college savings budget ($)</Label>
                      <Input
                        id="monthlyCollegeBudget"
                        type="number"
                        min={0}
                        placeholder="e.g. 500"
                        value={monthlyCollegeBudget}
                        onChange={(e) => setMonthlyCollegeBudget(e.target.value)}
                        className="text-lg h-12 max-w-[180px]"
                      />
                      {monthlyCollegeBudget !== "" && !monthlyCollegeBudgetValid && (
                        <p className="text-xs text-destructive">Enter a positive amount.</p>
                      )}
                    </div>
                  </>
                )}

                {needsAlts && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="numberOfAltsInvestments">Number of alternative investments</Label>
                      <Input
                        id="numberOfAltsInvestments"
                        type="number"
                        min={0}
                        max={500}
                        placeholder="e.g. 4"
                        value={numberOfAltsInvestments}
                        onChange={(e) => setNumberOfAltsInvestments(e.target.value)}
                        className="text-lg h-12 max-w-[180px]"
                        autoFocus={!needsRetirement && !needsCollege}
                      />
                      {numberOfAltsInvestments !== "" && !numberOfAltsInvestmentsValid && (
                        <p className="text-xs text-destructive">Enter a number between 0 and 500.</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="totalCommittedCapital">Approximate total committed capital ($)</Label>
                      <Input
                        id="totalCommittedCapital"
                        type="number"
                        min={0}
                        placeholder="e.g. 250000"
                        value={totalCommittedCapital}
                        onChange={(e) => setTotalCommittedCapital(e.target.value)}
                        className="text-lg h-12 max-w-[180px]"
                      />
                      {totalCommittedCapital !== "" && !totalCommittedCapitalValid && (
                        <p className="text-xs text-destructive">Enter a positive amount.</p>
                      )}
                    </div>
                  </>
                )}
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
                  disabled={saving || !step2Valid}
                >
                  {saving ? "Saving…" : "Let's go"}
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
