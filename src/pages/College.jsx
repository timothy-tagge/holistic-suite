import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import { useProfile } from "@/contexts/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Pencil } from "lucide-react";
import {
  ComposedChart,
  Area,
  Bar,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Progress } from "@/components/ui/progress";
import { formatWithCommas, parseFormatted } from "@/lib/formatNumber";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ── Constants ──────────────────────────────────────────────────────────────

const COST_TIERS = [
  { key: "public-in-state", label: "Public in-state", annualCost: 27000 },
  { key: "public-out-of-state", label: "Public out-of-state", annualCost: 45000 },
  { key: "private", label: "Private", annualCost: 60000 },
  { key: "elite", label: "Elite", annualCost: 85000 },
];
const COST_TIER_MAP = Object.fromEntries(COST_TIERS.map((t) => [t.key, t.annualCost]));
const COLLEGE_YEARS = 4;
const DEFAULT_INFLATION = 0.03;
const DEFAULT_RETURN = "6";
const DEFAULT_LOAN_RATE = 6.39;       // Federal Direct Unsubsidized, undergrad, 2025–2026
const DEFAULT_LOAN_TERM = 10;          // Standard repayment term (years)
const LOAN_RATE_SOURCE = "Federal Direct Unsubsidized Loan rate for undergraduates, 2025–2026 academic year. Source: studentaid.gov. Verify the current rate before finalizing.";

// Colors for up to 5 children — amber for costs, distinct green for savings
const CHILD_COLORS = ["#f59e0b", "#d97706", "#b45309", "#92400e", "#78350f"];
const SAVINGS_COLOR = "#16a34a";
const LOAN_COLOR = "#dc2626";

// ── Projection math ────────────────────────────────────────────────────────

function monthlyPayment(principal, annualRate, termYears) {
  if (principal <= 0) return 0;
  const r = annualRate / 12;
  const n = termYears * 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function project(plan) {
  const { children, totalSavings, annualReturn, monthlyContribution = 0, lumpSums = [], loans, inflationRate } = plan;
  if (!children?.length) return { yearly: [], childData: [], summary: null };

  const inflation = inflationRate ?? DEFAULT_INFLATION;
  const now = new Date().getFullYear();
  const annualContribution = monthlyContribution * 12;

  const childData = children.map((child, i) => {
    const startYear = child.birthYear + 18;
    const yearsAway = Math.max(0, startYear - now);
    const baseCost = child.annualCostBase ?? COST_TIER_MAP[child.costTier];
    const annualCost = Math.round(baseCost * Math.pow(1 + inflation, yearsAway));
    return {
      ...child,
      startYear,
      endYear: startYear + COLLEGE_YEARS,
      annualCost,
      totalCost: annualCost * COLLEGE_YEARS,
      color: CHILD_COLORS[i % CHILD_COLORS.length],
    };
  });

  const lastYear = Math.max(...childData.map((c) => c.endYear - 1));
  const firstCollegeYear = Math.min(...childData.map((c) => c.startYear));

  const yearly = [];
  let balance = totalSavings;
  let totalUncovered = 0;
  let runningLoanBalance = 0;
  let projectedAtFirst = null;

  const yearsToFirst = Math.max(0, firstCollegeYear - now);

  for (let year = now; year <= lastYear; year++) {
    balance *= 1 + annualReturn;
    balance += annualContribution;
    const lumpSum = lumpSums.find((ls) => ls.year === year);
    if (lumpSum) balance += lumpSum.amount;

    if (year === firstCollegeYear) projectedAtFirst = Math.round(balance);

    const prevRunningLoan = runningLoanBalance;
    const row = { year };
    for (const child of childData) {
      if (year >= child.startYear && year < child.endYear) {
        row[child.name] = child.annualCost;
        if (balance >= child.annualCost) {
          balance -= child.annualCost;
        } else {
          const shortfall = child.annualCost - balance;
          totalUncovered += shortfall;
          runningLoanBalance += shortfall;
          balance = 0;
        }
      }
    }
    row.savings = Math.round(balance);
    // Hold loanBalance at 0 in the first crossover year so green and red meet at the same point
    row.loanBalance =
      runningLoanBalance > 0
        ? prevRunningLoan === 0
          ? 0
          : -Math.round(runningLoanBalance)
        : 0;
    yearly.push(row);
  }

  const totalProjectedCost = childData.reduce((s, c) => s + c.totalCost, 0);
  const gap = Math.round(totalUncovered);
  const monthsToFirst = yearsToFirst * 12;

  const loanAmount = loans?.totalAmount ?? 0;
  const loanRate = (loans?.rate ?? DEFAULT_LOAN_RATE / 100);
  const loanTerm = loans?.termYears ?? DEFAULT_LOAN_TERM;
  const remainingGap = Math.round(gap - loanAmount);
  const monthlyLoanPayment = Math.round(monthlyPayment(loanAmount, loanRate, loanTerm));
  const monthlyNeeded = monthsToFirst > 0 && remainingGap > 0 ? Math.round(remainingGap / monthsToFirst) : 0;

  return {
    yearly,
    childData,
    summary: {
      totalProjectedCost: Math.round(totalProjectedCost),
      currentSavings: totalSavings,
      monthlyContribution,
      projectedAtFirst: projectedAtFirst ?? Math.round(totalSavings),
      finalBalance: Math.round(balance),
      gap: Math.round(gap),
      loanAmount,
      remainingGap,
      monthlyLoanPayment,
      monthlyNeeded,
      firstCollegeYear,
    },
  };
}

// Monte Carlo is computed server-side (functions/src/college/runMonteCarlo.js)
// and cached in plan.monteCarloResult after every write.
const MC_STD_DEV = 0.12; // kept for display label only

// ── Formatters ─────────────────────────────────────────────────────────────

function usd(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function usdShort(n) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return usd(n);
}

// ── Setup wizard ───────────────────────────────────────────────────────────

function CollegeSetup() {
  const { profile, patchProfile } = useProfile();
  const navigate = useNavigate();

  const count = profile?.numberOfKids ?? 1;
  const currentYear = new Date().getFullYear();

  const [children, setChildren] = useState(() =>
    Array.from({ length: count }, () => ({
      name: "",
      birthYear: "",
      costTier: "public-in-state",
      annualCostBase: formatWithCommas(String(COST_TIER_MAP["public-in-state"])),
    }))
  );
  const [totalSavings, setTotalSavings] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState("");
  const [annualReturn, setAnnualReturn] = useState(DEFAULT_RETURN);
  const [inflationRate, setInflationRate] = useState("3");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function updateChild(index, field, value) {
    setChildren((prev) => prev.map((c, i) => {
      if (i !== index) return c;
      if (field === "costTier") {
        // Preset button clicked — also reset the cost input to the preset value
        return { ...c, costTier: value, annualCostBase: formatWithCommas(String(COST_TIER_MAP[value])) };
      }
      return { ...c, [field]: value };
    }));
  }

  const birthYearsValid = children.every((c) => {
    const y = parseInt(c.birthYear, 10);
    return c.birthYear !== "" && y >= currentYear - 22 && y <= currentYear + 2;
  });
  const returnNum = parseFloat(annualReturn);
  const returnValid = annualReturn !== "" && returnNum >= 0 && returnNum <= 25;
  const inflationNum = parseFloat(inflationRate);
  const inflationValid = inflationRate !== "" && inflationNum >= 0 && inflationNum <= 15;
  // Empty savings or contribution = $0, which is valid
  const savingsNum = totalSavings === "" ? 0 : parseFormatted(totalSavings);
  const savingsValid = totalSavings === "" || savingsNum >= 0;
  const monthlyNum = monthlyContribution === "" ? 0 : parseFormatted(monthlyContribution);
  const isValid = birthYearsValid && returnValid && inflationValid && savingsValid;

  async function handleSetup() {
    setSaving(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, "collegeSetup");
      const result = await fn({
        children: children.map((c, i) => ({
          name: c.name.trim() || `Child ${i + 1}`,
          birthYear: parseInt(c.birthYear, 10),
          costTier: c.costTier,
          annualCostBase: parseFormatted(c.annualCostBase) || COST_TIER_MAP[c.costTier],
        })),
        totalSavings: savingsNum,
        monthlyContribution: monthlyNum,
        annualReturn: returnNum / 100,
        inflationRate: inflationNum / 100,
      });
      if (result.data.ok) {
        patchProfile(result.data.data.profile);
        navigate("/college");
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
    <div className="max-w-lg mx-auto px-4 py-12">
      <h1
        className="font-heading font-bold tracking-tight text-foreground mb-2"
        style={{ fontSize: "clamp(24px, 4vw, 36px)", lineHeight: 1.15 }}
      >
        Set up College
      </h1>
      <p className="text-muted-foreground text-sm mb-10">
        A few details about your {count === 1 ? "child" : "children"} to get started.
      </p>

      <div className="space-y-6 mb-8">
        {children.map((child, i) => {
          const y = parseInt(child.birthYear, 10);
          const yearValid =
            child.birthYear !== "" && y >= currentYear - 22 && y <= currentYear + 2;

          return (
            <Card key={i}>
              <CardContent className="pt-6 space-y-4">
                {count > 1 && (
                  <p className="font-heading font-semibold text-foreground text-sm">
                    Child {i + 1}
                  </p>
                )}

                <div className="space-y-2">
                  <Label htmlFor={`name-${i}`}>Name (optional)</Label>
                  <Input
                    id={`name-${i}`}
                    placeholder={`Child ${i + 1}`}
                    value={child.name}
                    onChange={(e) => updateChild(i, "name", e.target.value)}
                    className="max-w-[240px]"
                    autoFocus={i === 0}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`birthYear-${i}`}>Birth year</Label>
                  <Input
                    id={`birthYear-${i}`}
                    type="number"
                    min={currentYear - 22}
                    max={currentYear + 2}
                    placeholder="e.g. 2018"
                    value={child.birthYear}
                    onChange={(e) => updateChild(i, "birthYear", e.target.value)}
                    className="text-lg h-12 max-w-[160px]"
                  />
                  {child.birthYear !== "" && !yearValid && (
                    <p className="text-xs text-destructive">
                      Enter a year between {currentYear - 22} and {currentYear + 2}.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Expected annual cost</Label>
                  <p className="text-xs text-muted-foreground">
                    Select a preset or enter a custom amount (today's dollars — inflated in the projection).
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {COST_TIERS.map((tier) => (
                      <Button
                        key={tier.key}
                        type="button"
                        variant={child.costTier === tier.key ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateChild(i, "costTier", tier.key)}
                      >
                        {tier.label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-muted-foreground text-sm">$</span>
                    <CurrencyInput
                      placeholder="Annual cost"
                      value={child.annualCostBase}
                      onChange={(v) => updateChild(i, "annualCostBase", v)}
                      className="h-10 max-w-[160px]"
                    />
                    <span className="text-xs text-muted-foreground">/yr</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Total savings */}
      <div className="space-y-2 mb-6">
        <Label htmlFor="totalSavings">
          Total saved across {count === 1 ? "your child" : "all children"}
        </Label>
        <p className="text-xs text-muted-foreground">
          Combined 529s or any funds earmarked for college.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-muted-foreground text-sm">$</span>
          <CurrencyInput
            id="totalSavings"
            placeholder="0"
            value={totalSavings}
            onChange={setTotalSavings}
            className="text-lg h-12 max-w-[200px]"
          />
        </div>
      </div>

      {/* Monthly contribution */}
      <div className="space-y-2 mb-6">
        <Label htmlFor="monthlyContribution">Planned monthly contribution</Label>
        <p className="text-xs text-muted-foreground">
          How much you plan to add each month going forward (529 or other savings).
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-muted-foreground text-sm">$</span>
          <CurrencyInput
            id="monthlyContribution"
            placeholder="0"
            value={monthlyContribution}
            onChange={setMonthlyContribution}
            className="text-lg h-12 max-w-[200px]"
          />
          <span className="text-muted-foreground text-sm">/mo</span>
        </div>
      </div>

      {/* Annual return + inflation rate */}
      <div className="flex flex-wrap gap-6 mb-8">
        <div className="space-y-2">
          <Label htmlFor="annualReturn">Expected annual return on savings</Label>
          <p className="text-xs text-muted-foreground">
            Your 529 or investment account growth rate. Defaults to 6%.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Input
              id="annualReturn"
              type="number"
              min={0}
              max={25}
              step={0.5}
              value={annualReturn}
              onChange={(e) => setAnnualReturn(e.target.value)}
              className="text-lg h-12 max-w-[120px]"
            />
            <span className="text-muted-foreground text-sm">%</span>
          </div>
          {annualReturn !== "" && !returnValid && (
            <p className="text-xs text-destructive">Enter a rate between 0% and 25%.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="inflationRate">College cost inflation</Label>
          <p className="text-xs text-muted-foreground">
            Annual cost increase. Historical avg ~3–4%.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Input
              id="inflationRate"
              type="number"
              min={0}
              max={15}
              step={0.5}
              value={inflationRate}
              onChange={(e) => setInflationRate(e.target.value)}
              className="text-lg h-12 max-w-[120px]"
            />
            <span className="text-muted-foreground text-sm">%</span>
          </div>
          {inflationRate !== "" && !inflationValid && (
            <p className="text-xs text-destructive">Enter a rate between 0% and 15%.</p>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-destructive mb-4">{error}</p>}

      <Button
        className="w-full gap-2"
        size="lg"
        onClick={handleSetup}
        disabled={saving || !isValid}
      >
        {saving ? "Saving…" : "Get started"}
        {!saving && <ArrowRight className="h-4 w-4" />}
      </Button>
    </div>
  );
}

// ── Savings config ─────────────────────────────────────────────────────────

const currentYear = new Date().getFullYear();

function SavingsConfig({ plan, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [totalSavings, setTotalSavings] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState("");
  const [annualReturn, setAnnualReturn] = useState("");
  const [inflationRate, setInflationRate] = useState("");
  const [lumpSums, setLumpSums] = useState([]);
  const [loanAmount, setLoanAmount] = useState("");
  const [loanRate, setLoanRate] = useState(String(DEFAULT_LOAN_RATE));
  const [loanTerm, setLoanTerm] = useState(String(DEFAULT_LOAN_TERM));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const firstInputRef = useRef(null);

  function openEdit() {
    setTotalSavings(plan.totalSavings > 0 ? formatWithCommas(String(plan.totalSavings)) : "");
    setMonthlyContribution(
      plan.monthlyContribution > 0 ? formatWithCommas(String(plan.monthlyContribution)) : ""
    );
    setAnnualReturn(String((plan.annualReturn * 100).toFixed(1)));
    setInflationRate(String(((plan.inflationRate ?? DEFAULT_INFLATION) * 100).toFixed(1)));
    const planLoans = plan.loans;
    setLoanAmount(planLoans?.totalAmount > 0 ? formatWithCommas(String(planLoans.totalAmount)) : "");
    setLoanRate(planLoans ? String((planLoans.rate * 100).toFixed(2)) : String(DEFAULT_LOAN_RATE));
    setLoanTerm(planLoans ? String(planLoans.termYears) : String(DEFAULT_LOAN_TERM));
    setLumpSums((plan.lumpSums ?? []).map((ls) => ({
      year: String(ls.year),
      amount: formatWithCommas(String(ls.amount)),
      label: ls.label ?? "",
    })));
    setError(null);
    setEditing(true);
    setTimeout(() => firstInputRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  function addLumpSum() {
    setLumpSums((prev) => [...prev, { year: "", amount: "", label: "" }]);
  }

  function removeLumpSum(i) {
    setLumpSums((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateLumpSum(i, field, value) {
    setLumpSums((prev) => prev.map((ls, idx) => (idx === i ? { ...ls, [field]: value } : ls)));
  }

  const savingsNum = totalSavings === "" ? 0 : parseFormatted(totalSavings);
  const monthlyNum = monthlyContribution === "" ? 0 : parseFormatted(monthlyContribution);
  const returnNum = parseFloat(annualReturn);
  const returnValid = annualReturn !== "" && returnNum >= 0 && returnNum <= 25;

  const inflationNum = parseFloat(inflationRate);
  const inflationValid = inflationRate !== "" && inflationNum >= 0 && inflationNum <= 15;
  const loanAmountNum = loanAmount === "" ? 0 : parseFormatted(loanAmount);
  const loanRateNum = parseFloat(loanRate);
  const loanTermNum = parseInt(loanTerm, 10);
  const loanRateValid = loanRate !== "" && loanRateNum >= 0 && loanRateNum <= 25;
  const loanTermValid = loanTerm !== "" && Number.isInteger(loanTermNum) && loanTermNum >= 1 && loanTermNum <= 30;

  const lumpSumsValid = lumpSums.every((ls) => {
    const y = parseInt(ls.year, 10);
    const a = parseFormatted(ls.amount);
    return ls.year !== "" && Number.isInteger(y) && y >= currentYear && ls.amount !== "" && a > 0;
  });

  const isValid = savingsNum >= 0 && monthlyNum >= 0 && returnValid && inflationValid && lumpSumsValid && loanRateValid && loanTermValid;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, "collegeUpdateSavings");
      const result = await fn({
        totalSavings: savingsNum,
        monthlyContribution: monthlyNum,
        annualReturn: returnNum / 100,
        inflationRate: inflationNum / 100,
        loans: loanAmountNum > 0
          ? { totalAmount: loanAmountNum, rate: loanRateNum / 100, termYears: loanTermNum }
          : null,
        lumpSums: lumpSums.map((ls) => ({
          year: parseInt(ls.year, 10),
          amount: parseFormatted(ls.amount),
          ...(ls.label?.trim() && { label: ls.label.trim() }),
        })),
      });
      if (result.data.ok) {
        onSaved(result.data.data.plan);
        setEditing(false);
      } else {
        setError(result.data.error?.message ?? "Something went wrong.");
      }
    } catch (err) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const planLumpSums = plan.lumpSums ?? [];

  if (!editing) {
    return (
      <div className="relative rounded-lg border bg-card px-5 py-4 mb-8">
        <Button variant="ghost" size="icon" onClick={openEdit} aria-label="Edit savings plan" className="absolute top-2 right-2">
          <Pencil className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-8 flex-wrap pr-10">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Current savings</p>
              <p className="font-heading font-semibold text-foreground text-sm">{usd(plan.totalSavings)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Monthly contribution</p>
              <p className="font-heading font-semibold text-foreground text-sm">
                {plan.monthlyContribution > 0 ? `${usd(plan.monthlyContribution)}/mo` : "None"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Annual return</p>
              <p className="font-heading font-semibold text-foreground text-sm">
                {(plan.annualReturn * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Cost inflation</p>
              <p className="font-heading font-semibold text-foreground text-sm">
                {((plan.inflationRate ?? DEFAULT_INFLATION) * 100).toFixed(1)}%/yr
              </p>
            </div>
            {planLumpSums.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Lump sums</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {planLumpSums.map((ls, i) => (
                    <p key={i} className="font-heading font-semibold text-foreground text-sm">
                      {usd(ls.amount)} in {ls.year}
                      {ls.label && (
                        <span className="font-normal text-muted-foreground"> · {ls.label}</span>
                      )}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {plan.loans?.totalAmount > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Planned loans</p>
                <p className="font-heading font-semibold text-foreground text-sm">
                  {usd(plan.loans.totalAmount)}
                  <span className="font-normal text-muted-foreground">
                    {" "}· {(plan.loans.rate * 100).toFixed(2)}% · {plan.loans.termYears}-yr repayment
                  </span>
                </p>
              </div>
            )}
          </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card px-5 py-5 mb-8 space-y-6">
      <h2 className="font-heading font-bold tracking-tight text-foreground text-lg">Edit savings plan</h2>

      {/* Core savings fields */}
      <div className="flex flex-wrap gap-6">
        <div className="space-y-1.5">
          <Label htmlFor="sc-savings">Current savings</Label>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-sm">$</span>
            <CurrencyInput
              ref={firstInputRef}
              id="sc-savings"
              placeholder="0"
              value={totalSavings}
              onChange={setTotalSavings}
              className="h-9 w-36"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sc-monthly">Monthly contribution</Label>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-sm">$</span>
            <CurrencyInput
              id="sc-monthly"
              placeholder="0"
              value={monthlyContribution}
              onChange={setMonthlyContribution}
              className="h-9 w-36"
            />
            <span className="text-muted-foreground text-sm">/mo</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sc-return">Annual return</Label>
          <div className="flex items-center gap-1.5">
            <Input
              id="sc-return"
              type="number"
              min={0}
              max={25}
              step={0.5}
              value={annualReturn}
              onChange={(e) => setAnnualReturn(e.target.value)}
              className="h-9 w-24"
            />
            <span className="text-muted-foreground text-sm">%</span>
          </div>
          {annualReturn !== "" && !returnValid && (
            <p className="text-xs text-destructive">0–25%</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sc-inflation">Cost inflation</Label>
          <div className="flex items-center gap-1.5">
            <Input
              id="sc-inflation"
              type="number"
              min={0}
              max={15}
              step={0.5}
              value={inflationRate}
              onChange={(e) => setInflationRate(e.target.value)}
              className="h-9 w-24"
            />
            <span className="text-muted-foreground text-sm">%/yr</span>
          </div>
          {inflationRate !== "" && !inflationValid && (
            <p className="text-xs text-destructive">0–15%</p>
          )}
        </div>
      </div>

      {/* Lump sums */}
      <div className="space-y-3">
        <h3 className="font-heading font-semibold tracking-tight text-foreground text-base">Planned lump sums</h3>
        {lumpSums.length === 0 && (
          <p className="text-xs text-muted-foreground">No lump sums planned.</p>
        )}
        {lumpSums.map((ls, i) => {
          const y = parseInt(ls.year, 10);
          const yearValid = ls.year !== "" && Number.isInteger(y) && y >= currentYear;
          const amountValid = ls.amount !== "" && parseFormatted(ls.amount) > 0;
          return (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <Input
                type="number"
                min={currentYear}
                placeholder="Year"
                value={ls.year}
                onChange={(e) => updateLumpSum(i, "year", e.target.value)}
                className="h-9 w-24"
              />
              <span className="text-muted-foreground text-sm">$</span>
              <CurrencyInput
                placeholder="Amount"
                value={ls.amount}
                onChange={(v) => updateLumpSum(i, "amount", v)}
                className="h-9 w-36"
              />
              <Input
                placeholder="Label (optional)"
                value={ls.label}
                onChange={(e) => updateLumpSum(i, "label", e.target.value)}
                className="h-9 w-40"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-muted-foreground h-9 px-2"
                onClick={() => removeLumpSum(i)}
              >
                Remove
              </Button>
              {ls.year !== "" && !yearValid && (
                <p className="text-xs text-destructive w-full">Year must be {currentYear} or later.</p>
              )}
              {ls.amount !== "" && !amountValid && (
                <p className="text-xs text-destructive w-full">Amount must be greater than zero.</p>
              )}
            </div>
          );
        })}
        <Button type="button" variant="outline" size="sm" onClick={addLumpSum}>
          + Add lump sum
        </Button>
      </div>

      {/* Loans */}
      <div className="space-y-3">
        <h3 className="font-heading font-semibold tracking-tight text-foreground text-base">Planned loans</h3>
        <div className="flex flex-wrap gap-6">
          <div className="space-y-1.5">
            <Label htmlFor="sc-loan-amount">Total loan amount</Label>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-sm">$</span>
              <CurrencyInput
                id="sc-loan-amount"
                placeholder="0"
                value={loanAmount}
                onChange={setLoanAmount}
                className="h-9 w-36"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label htmlFor="sc-loan-rate" className="cursor-help border-b border-dashed border-muted-foreground/50 w-fit">
                    Interest rate
                  </Label>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{LOAN_RATE_SOURCE}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="flex items-center gap-1.5">
              <Input
                id="sc-loan-rate"
                type="number"
                min={0}
                max={25}
                step={0.01}
                value={loanRate}
                onChange={(e) => setLoanRate(e.target.value)}
                className="h-9 w-24"
              />
              <span className="text-muted-foreground text-sm">%</span>
            </div>
            {loanRate !== "" && !loanRateValid && (
              <p className="text-xs text-destructive">0–25%</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sc-loan-term">Repayment term</Label>
            <div className="flex items-center gap-1.5">
              <Input
                id="sc-loan-term"
                type="number"
                min={1}
                max={30}
                value={loanTerm}
                onChange={(e) => setLoanTerm(e.target.value)}
                className="h-9 w-20"
              />
              <span className="text-muted-foreground text-sm">yrs</span>
            </div>
            {loanTerm !== "" && !loanTermValid && (
              <p className="text-xs text-destructive">1–30 years</p>
            )}
          </div>
        </div>
        {loanAmountNum > 0 && loanRateValid && loanTermValid && (
          <p className="text-xs text-muted-foreground">
            Estimated monthly repayment after graduation:{" "}
            <span className="font-medium text-foreground">
              {usd(Math.round(monthlyPayment(loanAmountNum, loanRateNum / 100, loanTermNum)))}/mo
            </span>
          </p>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving || !isValid}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, highlight }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="font-heading text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">{label}</p>
      <p
        className={[
          "font-heading font-bold text-xl tracking-tight",
          highlight === "good"
            ? "text-primary"
            : highlight === "bad"
              ? "text-destructive"
              : "text-foreground",
        ].join(" ")}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

// ── Children section ───────────────────────────────────────────────────────

function ChildrenSection({ plan, onSaved }) {
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const currentYear = new Date().getFullYear();

  function openEdit(child) {
    const baseCost = child.annualCostBase ?? COST_TIER_MAP[child.costTier];
    setEditingId(child.id);
    setEditValues({
      name: child.name,
      birthYear: String(child.birthYear),
      costTier: child.costTier,
      annualCostBase: formatWithCommas(String(baseCost)),
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setError(null);
  }

  const birthYear = parseInt(editValues.birthYear, 10);
  const birthYearValid =
    editValues.birthYear !== "" &&
    Number.isInteger(birthYear) &&
    birthYear >= currentYear - 22 &&
    birthYear <= currentYear + 2;

  async function handleSave(child) {
    setSaving(true);
    setError(null);
    try {
      const updatedChildren = plan.children.map((c) =>
        c.id === child.id
          ? {
              ...c,
              name: editValues.name.trim() || c.name,
              birthYear,
              costTier: editValues.costTier,
              annualCostBase: parseFormatted(editValues.annualCostBase) || COST_TIER_MAP[editValues.costTier],
            }
          : c
      );
      const fn = httpsCallable(functions, "collegeUpdateChildren");
      const result = await fn({ children: updatedChildren });
      if (result.data.ok) {
        onSaved(result.data.data.plan);
        setEditingId(null);
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
    <div className="space-y-2 mb-10">
      <p className="font-heading font-semibold text-foreground text-sm mb-4">Per-child breakdown</p>
      {plan.children.map((child, i) => {
        const color = CHILD_COLORS[i % CHILD_COLORS.length];
        const startYear = child.birthYear + 18;
        const yearsAway = Math.max(0, startYear - currentYear);
        const inflation = plan.inflationRate ?? DEFAULT_INFLATION;
        const annualCost = Math.round(COST_TIER_MAP[child.costTier] * Math.pow(1 + inflation, yearsAway));
        const totalCost = annualCost * COLLEGE_YEARS;
        const tier = COST_TIERS.find((t) => t.key === child.costTier);

        if (editingId === child.id) {
          return (
            <div key={child.id} className="rounded-lg border bg-card px-4 py-3 space-y-3">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1">
                  <Label htmlFor={`child-name-${child.id}`} className="text-xs">Name</Label>
                  <Input
                    id={`child-name-${child.id}`}
                    value={editValues.name}
                    onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                    className="h-8 w-36 text-sm"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`child-by-${child.id}`} className="text-xs">Birth year</Label>
                  <Input
                    id={`child-by-${child.id}`}
                    type="number"
                    min={currentYear - 22}
                    max={currentYear + 2}
                    value={editValues.birthYear}
                    onChange={(e) => setEditValues((v) => ({ ...v, birthYear: e.target.value }))}
                    className="h-8 w-24 text-sm"
                  />
                  {editValues.birthYear !== "" && !birthYearValid && (
                    <p className="text-xs text-destructive">{currentYear - 22}–{currentYear + 2}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Expected annual cost</Label>
                  <div className="flex gap-1 flex-wrap">
                    {COST_TIERS.map((t) => (
                      <Button
                        key={t.key}
                        type="button"
                        variant={editValues.costTier === t.key ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs px-2"
                        onClick={() => setEditValues((v) => ({
                          ...v,
                          costTier: t.key,
                          annualCostBase: formatWithCommas(String(COST_TIER_MAP[t.key])),
                        }))}
                      >
                        {t.label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-muted-foreground text-xs">$</span>
                    <CurrencyInput
                      value={editValues.annualCostBase ?? ""}
                      onChange={(v) => setEditValues((ev) => ({ ...ev, annualCostBase: v }))}
                      className="h-8 w-32 text-sm"
                      placeholder="Annual cost"
                    />
                    <span className="text-muted-foreground text-xs">/yr</span>
                  </div>
                </div>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={() => handleSave(child)} disabled={saving || !birthYearValid}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </div>
          );
        }

        return (
          <div
            key={child.id}
            className="flex items-center justify-between rounded-lg border bg-card px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: color }} />
              <div>
                <p className="font-medium text-foreground text-sm">{child.name}</p>
                <p className="text-xs text-muted-foreground">
                  Born {child.birthYear} · College {startYear}–{startYear + COLLEGE_YEARS} · {tier?.label}
                  {child.annualCostBase && child.annualCostBase !== COST_TIER_MAP[child.costTier] && (
                    <span className="text-primary"> · {usd(child.annualCostBase)}/yr custom</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className="font-heading font-semibold text-foreground text-sm">{usd(totalCost)}</p>
              <Button variant="ghost" size="icon" onClick={() => openEdit(child)} aria-label={`Edit ${child.name}`}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Holistic residual callout ───────────────────────────────────────────────

function HolisticResidualCallout({ summary }) {
  if (summary.remainingGap > 0) return null;
  const surplus = -summary.remainingGap;
  const finalBalance = summary.finalBalance ?? 0;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-5 py-4 mb-10 flex items-start gap-4">
      <div className="flex-1">
        <p className="font-heading font-semibold text-foreground text-sm mb-0.5">
          College is fully funded
        </p>
        <p className="text-xs text-muted-foreground">
          {surplus > 0
            ? `A ${usd(surplus)} surplus is available beyond the funding gap. `
            : ""}
          {finalBalance > 0
            ? `Your projected residual savings of ${usd(finalBalance)} after all college years will appear as a college asset in your holistic view.`
            : "This module's contribution to your holistic net worth is up to date."}
        </p>
      </div>
    </div>
  );
}

// ── Chart tooltips ──────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card p-3 text-xs shadow-md">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ background: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">{usd(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

function BandTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-lg border bg-card p-3 text-xs shadow-md">
      <p className="font-semibold text-foreground mb-2">{d.year}</p>
      <div className="space-y-1">
        {[
          { label: "Optimistic (90th)", key: "p90" },
          { label: "Median (50th)", key: "p50" },
          { label: "Pessimistic (10th)", key: "p10" },
        ].map(({ label, key }) => (
          <div key={key} className="flex items-center justify-between gap-6">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-foreground">{usd(d[key])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonteCarloSection({ result }) {
  const extraContrib = result.extraMonthly ?? null;
  const successPct = Math.round(result.successRate * 100);
  const successColor =
    successPct >= 90 ? "text-primary" : successPct >= 70 ? "text-yellow-600 dark:text-yellow-400" : "text-destructive";

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-6">
        {(result.numSims ?? 1000).toLocaleString()} simulations · ±{(MC_STD_DEV * 100).toFixed(0)}% annual return variance · moderate portfolio
      </p>

      <div className="flex items-end gap-3 mb-3">
        <span
          className={`font-heading font-bold tracking-tight ${successColor}`}
          style={{ fontSize: "clamp(40px, 6vw, 60px)", lineHeight: 1 }}
        >
          {successPct}%
        </span>
        <span className="text-muted-foreground text-sm mb-2">chance of fully funding college</span>
      </div>

      <Progress value={successPct} className="h-2 mb-6" />

      {result.successRate < 0.9 && extraContrib > 0 && (
        <div className="rounded-md bg-muted/60 px-4 py-3 mb-6 text-sm">
          <span className="text-foreground">
            Adding{" "}
            <span className="font-semibold text-foreground">{usd(extraContrib)}/mo</span>
            {" "}would bring your confidence above 90%.
          </span>
        </div>
      )}

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={result.yearlyBands} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={usdShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
          <ChartTooltip content={<BandTooltip />} />
          {/* Band: invisible base + shaded width stacked on top */}
          <Area type="monotone" dataKey="bandBase" stackId="band" fill="transparent" stroke="none" legendType="none" />
          <Area
            type="monotone"
            dataKey="bandWidth"
            stackId="band"
            fill={SAVINGS_COLOR}
            fillOpacity={0.12}
            stroke="none"
            name="Range (10th–90th)"
          />
          <Line type="monotone" dataKey="p90" name="Optimistic (90th)" stroke={SAVINGS_COLOR} strokeOpacity={0.4} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
          <Line type="monotone" dataKey="p50" name="Median" stroke={SAVINGS_COLOR} strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="p10" name="Pessimistic (10th)" stroke={LOAN_COLOR} strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground mt-3 text-center">
        Shaded band shows range of savings outcomes across all simulations. Dashed lines are 10th and 90th percentiles.
      </p>
    </div>
  );
}


const MODULE_LABELS = {
  retirement: "Retirement",
  alts: "Alts",
  equity: "Equity",
  property: "Property",
};

function CollegeDashboard() {
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartView, setChartView] = useState("projection");

  useEffect(() => {
    async function load() {
      try {
        const fn = httpsCallable(functions, "collegeGetPlan");
        const result = await fn();
        if (result.data.ok) {
          setPlan(result.data.data.plan);
        } else {
          setError(result.data.error?.message ?? "Failed to load plan.");
        }
      } catch (err) {
        setError(err.message ?? "Failed to load plan.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm gap-2">
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            border: "2px solid currentColor",
            borderTopColor: "transparent",
            animation: "spin 0.7s linear infinite",
            opacity: 0.4,
          }}
        />
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  const { yearly, childData, summary } = project(plan);
  const mc = plan.monteCarloResult;
  const uninitializedModules = (profile?.activeModules ?? []).filter(
    (m) => m !== "college" && !(profile?.initializedModules ?? []).includes(m)
  );

  return (
    <>
      {uninitializedModules.length > 0 && (
        <div className="sticky top-14 z-40 bg-accent-foreground px-4 md:px-6 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-accent">
            <span className="font-semibold text-accent">College is set up.</span>
            {" "}
            {uninitializedModules.length === 1
              ? `Set up ${MODULE_LABELS[uninitializedModules[0]] ?? uninitializedModules[0]} to complete your holistic view.`
              : `Set up ${uninitializedModules.slice(0, -1).map((m) => MODULE_LABELS[m] ?? m).join(", ")} and ${MODULE_LABELS[uninitializedModules.at(-1)] ?? uninitializedModules.at(-1)} to complete your holistic view.`}
          </p>
          <Button
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => navigate(`/${uninitializedModules[0]}`)}
          >
            Set up {MODULE_LABELS[uninitializedModules[0]] ?? uninitializedModules[0]}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    <div className="max-w-5xl mx-auto px-4 py-10 md:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="font-heading font-bold tracking-tight text-foreground"
          style={{ fontSize: "clamp(26px, 4vw, 38px)", lineHeight: 1.15 }}
        >
          College
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {plan.children.length === 1
            ? "1 child · endowment projection"
            : `${plan.children.length} children · endowment projection`}
          {" · "}
          {(plan.annualReturn * 100).toFixed(1)}% return · {((plan.inflationRate ?? DEFAULT_INFLATION) * 100).toFixed(1)}% inflation
          {plan.monthlyContribution > 0 && ` · ${usd(plan.monthlyContribution)}/mo`}
        </p>
      </div>

      {/* Savings config */}
      <SavingsConfig plan={plan} onSaved={(p) => setPlan(p)} />

      {/* Summary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <MetricCard
          label="Total projected cost"
          value={usd(summary.totalProjectedCost)}
          sub={`Inflation-adjusted at ${((plan.inflationRate ?? DEFAULT_INFLATION) * 100).toFixed(1)}%/yr`}
        />
        <MetricCard
          label={`Projected at ${summary.firstCollegeYear}`}
          value={usd(summary.projectedAtFirst)}
          sub="Savings at first college start"
          highlight={summary.projectedAtFirst >= summary.totalProjectedCost ? "good" : null}
        />
        <MetricCard
          label={summary.remainingGap <= 0 ? "Cha-ching" : "Remaining gap"}
          value={
            summary.remainingGap < 0
              ? `${usd(-summary.remainingGap)} surplus`
              : summary.remainingGap === 0
                ? "Fully funded"
                : usd(summary.remainingGap)
          }
          sub={
            summary.remainingGap <= 0
              ? "Your holistic view is paying off"
              : summary.loanAmount > 0
                ? `After ${usd(summary.loanAmount)} in planned loans`
                : "No loans planned"
          }
          highlight={summary.remainingGap <= 0 ? "good" : "bad"}
        />
        <MetricCard
          label={summary.loanAmount > 0 ? "Monthly loan payment" : "Monthly still needed"}
          value={
            summary.loanAmount > 0
              ? `${usd(summary.monthlyLoanPayment)}/mo`
              : mc?.extraMonthly > 0
                ? `${usd(mc.extraMonthly)}/mo`
                : "On track"
          }
          sub={
            summary.loanAmount > 0
              ? `After graduation · ${plan.loans?.termYears ?? DEFAULT_LOAN_TERM}-yr repayment`
              : mc?.extraMonthly > 0
                ? "Extra needed to reach 90% confidence"
                : "≥90% probability of full funding"
          }
          highlight={summary.loanAmount > 0 ? null : !mc || mc.extraMonthly === 0 ? "good" : null}
        />
      </div>

      {/* Chart card with Projection / Probability toggle */}
      <div className="rounded-lg border bg-card p-6 mb-10">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-1">
          <p className="font-heading font-semibold text-foreground">
            {chartView === "projection" ? "Savings vs. college costs" : "Probability of success"}
          </p>
          {mc && (
            <div className="flex items-center rounded-md border overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => setChartView("projection")}
                className={[
                  "px-3 py-1 text-xs font-medium transition-colors",
                  chartView === "projection"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                Projection
              </button>
              <button
                type="button"
                onClick={() => setChartView("probability")}
                className={[
                  "px-3 py-1 text-xs font-medium transition-colors border-l flex items-center gap-1.5",
                  chartView === "probability"
                    ? "bg-primary text-primary-foreground"
                    : mc && mc.successRate < 0.9
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25"
                      : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                Probability
                {mc && mc.successRate < 0.9 && chartView !== "probability" && (
                  <span className="font-semibold">
                    · {Math.round(mc.successRate * 100)}%
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {chartView === "projection" ? (
          <>
            <p className="text-xs text-muted-foreground mb-6">
              Amber bars show annual college costs. Green line shows projected savings balance.
              {yearly.some((r) => r.loanBalance < 0) && " Red dashed line shows accumulated loan balance below zero."}
            </p>
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={yearly} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={usdShort} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
                <ChartTooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const costs = payload.filter((p) => p.dataKey !== "savings" && p.dataKey !== "loanBalance");
                    const savings = payload.find((p) => p.dataKey === "savings");
                    const loan = payload.find((p) => p.dataKey === "loanBalance");
                    const ordered = [...costs, ...(savings ? [savings] : []), ...(loan ? [loan] : [])];
                    return (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center pt-4">
                        {ordered.map((entry) => (
                          <span key={entry.dataKey} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: entry.color }} />
                            {entry.value}
                          </span>
                        ))}
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.2} />
                {childData.map((child) => (
                  <Bar key={child.name} dataKey={child.name} stackId="costs" fill={child.color} radius={[0, 0, 0, 0]} />
                ))}
                <Line type="monotone" dataKey="savings" name="Savings balance" stroke={SAVINGS_COLOR} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                {yearly.some((r) => r.loanBalance < 0) && (
                  <Line type="monotone" dataKey="loanBalance" name="Loan balance" stroke={LOAN_COLOR} strokeWidth={2} strokeDasharray="4 3" dot={false} activeDot={{ r: 4 }} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </>
        ) : (
          mc && <MonteCarloSection result={mc} />
        )}
      </div>

      {/* Holistic residual callout */}
      <HolisticResidualCallout summary={summary} />

      {/* Per-child breakdown */}
      <ChildrenSection plan={plan} onSaved={(p) => setPlan(p)} />

    </div>
    </>
  );
}

// ── Top-level router ───────────────────────────────────────────────────────

export function College() {
  const { profile } = useProfile();
  const isInitialized = profile?.initializedModules?.includes("college") ?? false;
  return isInitialized ? <CollegeDashboard /> : <CollegeSetup />;
}
