import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  BarChart3,
  GraduationCap,
  Layers,
  TrendingUp,
  Building2,
  Check,
  Save,
  X,
} from "lucide-react";

const MODULES = [
  { key: "retirement", label: "Retirement", icon: BarChart3, available: true },
  { key: "college", label: "College", icon: GraduationCap, available: true },
  { key: "alts", label: "Alts", icon: Layers, available: true },
  { key: "equity", label: "Equity", icon: TrendingUp, available: false },
  { key: "property", label: "Property", icon: Building2, available: false },
];

export function Profile() {
  const { profile, patchProfile } = useProfile();
  const navigate = useNavigate();

  const [age, setAge] = useState("");
  const [retirementAge, setRetirementAge] = useState("");
  const [activeModules, setActiveModules] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | "saved" | "error"
  const [error, setError] = useState(null);

  const isDirty =
    profile != null &&
    (String(profile.age ?? "") !== age ||
      String(profile.targetRetirementAge ?? "") !== retirementAge ||
      JSON.stringify([...(profile.activeModules ?? [])].sort()) !==
        JSON.stringify([...activeModules].sort()));

  function resetForm() {
    if (!profile) return;
    setAge(profile.age != null ? String(profile.age) : "");
    setRetirementAge(
      profile.targetRetirementAge != null ? String(profile.targetRetirementAge) : ""
    );
    setActiveModules(profile.activeModules ?? []);
    setError(null);
    setSaveStatus(null);
  }
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Sync form from profile when loaded
  useEffect(() => {
    if (profile) {
      setAge(profile.age != null ? String(profile.age) : "");
      setRetirementAge(
        profile.targetRetirementAge != null ? String(profile.targetRetirementAge) : ""
      );
      setActiveModules(profile.activeModules ?? []);
    }
  }, [profile]);

  const currentYear = new Date().getFullYear();
  const ageNum = parseInt(age, 10);
  const retirementAgeNum = parseInt(retirementAge, 10);
  const ageValid = age === "" || (ageNum >= 18 && ageNum <= 100);
  const retirementAgeValid =
    retirementAge === "" ||
    (retirementAgeNum >= 40 && retirementAgeNum <= 80 && retirementAgeNum > ageNum);
  const formValid = ageValid && retirementAgeValid;

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
      const payload = { activeModules };
      if (age !== "") payload.age = ageNum;
      if (retirementAge !== "") payload.targetRetirementAge = retirementAgeNum;
      const result = await fn(payload);
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

  async function handleResetProfile() {
    setResetting(true);
    try {
      const fn = httpsCallable(functions, "updateProfile");
      const result = await fn({
        age: null,
        targetRetirementAge: null,
        activeModules: [],
        initializedModules: [],
      });
      if (result.data.ok) {
        patchProfile(result.data.data.profile);
      }
    } catch (err) {
      console.error("Reset failed:", err);
    } finally {
      setResetting(false);
      setResetDialogOpen(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 md:px-6">
      {/* Page title */}
      <div className="relative mb-8">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-0 right-0"
          onClick={() => navigate(-1)}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Button>
        <h1
          className="font-heading font-bold tracking-tight text-foreground pr-10"
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
            <Label htmlFor="retirementAge">Target retirement age</Label>
            <Input
              id="retirementAge"
              type="number"
              min={40}
              max={80}
              placeholder="e.g. 65"
              value={retirementAge}
              onChange={(e) => setRetirementAge(e.target.value)}
              className="max-w-[180px]"
            />
            {retirementAge !== "" && !retirementAgeValid && (
              <p className="text-xs text-destructive">
                Enter an age between 40 and 80, greater than your current age.
              </p>
            )}
            {ageValid && retirementAgeValid && age !== "" && retirementAge !== "" && (
              <p className="text-xs text-muted-foreground">
                {retirementAgeNum - ageNum} years away — retirement in{" "}
                {currentYear + (retirementAgeNum - ageNum)}.
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

      <div className="flex items-center gap-3">
        <Button
          size="lg"
          className="gap-2"
          onClick={handleSave}
          disabled={!formValid || saving || !isDirty}
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
        {isDirty && (
          <Button variant="ghost" size="lg" onClick={resetForm} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>

      {/* Developer tools */}
      <Separator className="my-10" />
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Developer tools
        </p>
        <p className="text-xs text-muted-foreground">
          Clears age, retirement year, and active modules — returns to onboarding.
        </p>
        <Button variant="outline" size="sm" onClick={() => setResetDialogOpen(true)}>
          Reset profile
        </Button>
      </div>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Reset profile?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will clear your age, retirement year, and active modules, and return you
            to the onboarding flow. Use this to test the new user experience.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetProfile}
              disabled={resetting}
            >
              {resetting ? "Resetting…" : "Reset profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
