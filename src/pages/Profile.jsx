import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import { useProfile } from "@/contexts/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3,
  GraduationCap,
  Layers,
  TrendingUp,
  Building2,
  Check,
  Save,
} from "lucide-react";

const MODULES = [
  { key: "overview", label: "Overview", icon: BarChart3, available: true },
  { key: "college", label: "College", icon: GraduationCap, available: true },
  { key: "alts", label: "Alts", icon: Layers, available: true },
  { key: "equity", label: "Equity", icon: TrendingUp, available: false },
  { key: "property", label: "Property", icon: Building2, available: false },
];

export function Profile() {
  const { profile, patchProfile } = useProfile();

  const [age, setAge] = useState("");
  const [retirementYear, setRetirementYear] = useState("");
  const [activeModules, setActiveModules] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | "saved" | "error"
  const [error, setError] = useState(null);

  // Sync form from profile when loaded
  useEffect(() => {
    if (profile) {
      setAge(profile.age != null ? String(profile.age) : "");
      setRetirementYear(
        profile.targetRetirementYear != null ? String(profile.targetRetirementYear) : ""
      );
      setActiveModules(profile.activeModules ?? []);
    }
  }, [profile]);

  const currentYear = new Date().getFullYear();
  const ageNum = parseInt(age, 10);
  const yearNum = parseInt(retirementYear, 10);
  const ageValid = age !== "" && ageNum >= 18 && ageNum <= 100;
  const yearValid =
    retirementYear !== "" && yearNum >= currentYear && yearNum <= currentYear + 60;
  const formValid = ageValid && yearValid;

  function toggleModule(key) {
    setActiveModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleSave() {
    if (!formValid) return;
    setSaving(true);
    setError(null);
    setSaveStatus(null);
    try {
      const fn = httpsCallable(functions, "updateProfile");
      const result = await fn({
        age: ageNum,
        targetRetirementYear: yearNum,
        activeModules,
      });
      if (result.data.ok) {
        patchProfile(result.data.data.profile);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        setError(result.data.error?.message ?? "Save failed.");
        setSaveStatus("error");
      }
    } catch (err) {
      setError(err.message ?? "Save failed.");
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 md:px-6">
      {/* Page title */}
      <div className="mb-8">
        <h1
          className="font-heading font-bold tracking-tight text-foreground"
          style={{ fontSize: "clamp(26px, 4vw, 38px)", lineHeight: 1.15 }}
        >
          Profile
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your settings drive every projection in the suite.
        </p>
      </div>

      {/* Identity (read-only from Google) */}
      {profile && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              {profile.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt={profile.displayName}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm font-heading">
                  {profile.displayName?.[0] ?? "?"}
                </div>
              )}
              <div>
                <p className="font-medium text-foreground text-sm">
                  {profile.displayName}
                </p>
                <p className="text-muted-foreground text-xs">{profile.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Planning inputs */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base">Planning inputs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="age">Current age</Label>
            <Input
              id="age"
              type="number"
              min={18}
              max={100}
              placeholder="e.g. 42"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="max-w-[180px]"
            />
            {age !== "" && !ageValid && (
              <p className="text-xs text-destructive">Enter an age between 18 and 100.</p>
            )}
          </div>

          <Separator />

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
              className="max-w-[180px]"
            />
            {retirementYear !== "" && !yearValid && (
              <p className="text-xs text-destructive">
                Enter a year between {currentYear} and {currentYear + 60}.
              </p>
            )}
            {ageValid && yearValid && (
              <p className="text-xs text-muted-foreground">
                {yearNum - currentYear} years away — you'll be{" "}
                {ageNum + (yearNum - currentYear)} at retirement.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active modules */}
      <Card className="mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base">Active modules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {MODULES.map(({ key, label, icon: Icon, available }) => {
              const active = activeModules.includes(key);
              return (
                <div
                  key={key}
                  className={[
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                    !available && "opacity-50",
                    available && active
                      ? "border-primary bg-primary/5"
                      : available
                        ? "border-border hover:bg-accent/50 cursor-pointer"
                        : "border-border cursor-default",
                  ].join(" ")}
                  onClick={available ? () => toggleModule(key) : undefined}
                  role={available ? "checkbox" : undefined}
                  aria-checked={available ? active : undefined}
                  tabIndex={available ? 0 : undefined}
                  onKeyDown={
                    available ? (e) => e.key === " " && toggleModule(key) : undefined
                  }
                >
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-heading font-medium text-foreground text-sm flex-1">
                    {label}
                  </span>
                  {!available && (
                    <Badge variant="outline" className="text-xs">
                      Coming soon
                    </Badge>
                  )}
                  {available && (
                    <div
                      className={[
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                        active
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/30",
                      ].join(" ")}
                    >
                      {active && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-xs text-destructive mb-4">{error}</p>}

      <Button
        size="lg"
        className="gap-2"
        onClick={handleSave}
        disabled={!formValid || saving}
      >
        {saving ? (
          "Saving…"
        ) : saveStatus === "saved" ? (
          <>
            <Check className="h-4 w-4" /> Saved
          </>
        ) : (
          <>
            <Save className="h-4 w-4" /> Save changes
          </>
        )}
      </Button>
    </div>
  );
}
