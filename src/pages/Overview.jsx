import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import { useProfile } from "@/contexts/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  GraduationCap,
  BarChart3,
  Layers,
  TrendingUp,
  ArrowRight,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null) return "—";
  return "$" + Math.abs(Math.round(n)).toLocaleString();
}

function fmtPct(rate) {
  if (rate == null) return null;
  return Math.round(rate * 100) + "%";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricRow({ label, value, sub, valueClass, rowClass }) {
  return (
    <div className={["flex items-start justify-between gap-4 py-3 px-3 -mx-3 rounded-md", rowClass].filter(Boolean).join(" ")}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className={["text-sm font-medium font-mono tabular-nums", valueClass].filter(Boolean).join(" ")}>
          {value}
        </span>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── College section ───────────────────────────────────────────────────────────

function CollegeSection({ initialized }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!initialized) return;
    setLoading(true);
    const fn = httpsCallable(functions, "collegeGetSummary");
    fn()
      .then((result) => {
        if (result.data.ok) setSummary(result.data.data.summary);
        else setError(result.data.error?.message ?? "Failed to load college data.");
      })
      .catch((err) => setError(err.message ?? "Failed to load college data."))
      .finally(() => setLoading(false));
  }, [initialized]);

  const m = summary?.metrics;
  const netWorth = summary?.netWorthContribution ?? 0;
  const isNetAsset = netWorth > 0;
  const isNetLiability = netWorth < 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <GraduationCap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="font-heading text-base">College</CardTitle>
              {summary?.planName && (
                <p className="text-xs text-muted-foreground">{summary.planName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" asChild>
              <Link to="/college">
                Details <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!initialized && (
          <div className="flex items-center justify-between py-2">
            <p className="text-sm text-muted-foreground">Set up your college plan to see it here.</p>
            <Button size="sm" variant="outline" asChild>
              <Link to="/college">Set up</Link>
            </Button>
          </div>
        )}

        {initialized && loading && (
          <p className="text-sm text-muted-foreground py-3">Loading…</p>
        )}

        {initialized && error && (
          <p className="text-sm text-destructive py-3">{error}</p>
        )}

        {initialized && m && (
          <div className="divide-y divide-border">
            {/* Headline: net holistic impact */}
            <MetricRow
              label="Post-college residual"
              value={
                netWorth === 0
                  ? "—"
                  : (isNetAsset ? "+" : "−") + fmt(Math.abs(netWorth))
              }
              sub={
                isNetAsset
                  ? "Flows into retirement savings after last graduation"
                  : isNetLiability
                  ? "Planned loans exceed projected balance — net liability"
                  : "Plan exactly covers costs"
              }
              valueClass={
                isNetAsset
                  ? "text-green-700 dark:text-green-400"
                  : isNetLiability
                  ? "text-destructive"
                  : undefined
              }
            />

            {/* Current allocation */}
            <MetricRow
              label="Monthly allocation"
              value={m.monthlyContribution > 0 ? fmt(m.monthlyContribution) + "/mo" : "—"}
              sub="Currently going to college savings"
            />

            {/* Timeline */}
            <MetricRow
              label="Active years"
              value={
                m.firstCollegeYear && m.lastGraduationYear
                  ? `${m.firstCollegeYear} – ${m.lastGraduationYear}`
                  : "—"
              }
              sub={
                m.lastGraduationYear
                  ? `Residual available from ${m.lastGraduationYear}`
                  : undefined
              }
            />

            {/* Confidence */}
            {m.successRate != null && (
              <MetricRow
                label="Funding confidence"
                value={fmtPct(m.successRate)}
                sub={
                  m.successRate < 0.9 && m.extraMonthly > 0
                    ? `+${fmt(m.extraMonthly)}/mo to reach 90%`
                    : m.successRate >= 0.9
                    ? "≥90% probability of full coverage"
                    : undefined
                }
                valueClass={
                  m.successRate >= 0.9
                    ? "text-green-700 dark:text-green-400"
                    : "text-amber-700 dark:text-amber-400"
                }
                rowClass={
                  m.successRate < 0.9
                    ? "bg-amber-500/10 border border-amber-500/20"
                    : undefined
                }
              />
            )}

            {/* Unfunded gap — only if present */}
            {m.remainingGap > 0 && (
              <MetricRow
                label="Unfunded gap"
                value={fmt(m.remainingGap)}
                sub="Not covered by savings or planned loans — reduces net worth"
                valueClass="text-destructive"
              />
            )}

            {/* Post-graduation loan obligation */}
            {m.monthlyLoanPayment > 0 && (
              <MetricRow
                label="Loan repayment"
                value={fmt(m.monthlyLoanPayment) + "/mo"}
                sub={`Estimated obligation starting ~${m.lastGraduationYear}`}
                valueClass="text-muted-foreground"
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Stub for modules not yet built ────────────────────────────────────────────

function ModuleStub({ icon: Icon, label, description, href, phase }) {
  return (
    <Card className="opacity-60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <CardTitle className="font-heading text-base text-muted-foreground">{label}</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {phase}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function Overview() {
  const { profile } = useProfile();
  const activeModules = profile?.activeModules ?? [];
  const initializedModules = profile?.initializedModules ?? [];

  const collegeActive = activeModules.includes("college");
  const collegeInitialized = initializedModules.includes("college");
  const retirementActive = activeModules.includes("retirement");
  const altsActive = activeModules.includes("alts");

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 md:px-6">
      <div className="mb-8">
        <h1
          className="font-heading font-bold tracking-tight text-foreground"
          style={{ fontSize: "clamp(26px, 4vw, 38px)", lineHeight: 1.15 }}
        >
          Overview
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your active modules, composed into one picture.
        </p>
      </div>

      <div className="space-y-4">
        {/* College */}
        {collegeActive && (
          <CollegeSection initialized={collegeInitialized} />
        )}

        {/* Retirement stub */}
        {retirementActive && (
          <ModuleStub
            icon={BarChart3}
            label="Retirement"
            description="Income projection across every sleeve — crossover year and funding status."
            href="/retirement"
            phase="Phase 2"
          />
        )}

        {/* Alts stub */}
        {altsActive && (
          <ModuleStub
            icon={Layers}
            label="Alts"
            description="Blended IRR, total committed, total distributions — alt portfolio at a glance."
            href="/alts"
            phase="Phase 4"
          />
        )}

        {/* No active modules */}
        {!collegeActive && !retirementActive && !altsActive && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <TrendingUp className="h-7 w-7 text-primary" />
            </div>
            <h2 className="font-heading font-semibold text-foreground text-lg mb-2">
              No modules active
            </h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              Activate modules in your profile to see the holistic picture here.
            </p>
          </div>
        )}

        {/* Separator + inactive module hints */}
        {(collegeActive || retirementActive || altsActive) && (
          <>
            <Separator className="my-6" />
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
              Not in your plan
            </p>
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              {!collegeActive && (
                <ModuleStub
                  icon={GraduationCap}
                  label="College"
                  description="Endowment-style funding plan for multiple children."
                  href="/college"
                  phase="Active"
                />
              )}
              {!retirementActive && (
                <ModuleStub
                  icon={BarChart3}
                  label="Retirement"
                  description="Income projection across every sleeve."
                  href="/retirement"
                  phase="Phase 2"
                />
              )}
              {!altsActive && (
                <ModuleStub
                  icon={Layers}
                  label="Alts"
                  description="Capital calls, distributions, IRR — all in one place."
                  href="/alts"
                  phase="Phase 4"
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
