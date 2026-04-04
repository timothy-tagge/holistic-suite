/**
 * Client-side college funding projection.
 * Pure functions — no Firebase, no UI imports.
 * Kept in sync with functions/src/college/getSummary.js (projectPlan).
 */

export const COST_TIER_MAP = {
  "public-in-state": 27000,
  "public-out-of-state": 45000,
  private: 60000,
  elite: 85000,
};

const COLLEGE_YEARS = 4;
const DEFAULT_INFLATION = 0.03;
const DEFAULT_LOAN_RATE = 0.0639;
const DEFAULT_LOAN_TERM = 10;

function monthlyPayment(principal, annualRate, termYears) {
  if (principal <= 0) return 0;
  const r = annualRate / 12;
  const n = termYears * 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/**
 * Deterministic year-by-year projection for a college plan.
 *
 * Returns:
 *   yearly    — array of { year, [childName]: annualCost, savings, loanBalance }
 *   childData — array of enriched child objects (startYear, endYear, annualCost, totalCost)
 *   summary   — aggregate metrics
 */
export function project(plan) {
  const {
    children,
    totalSavings,
    annualReturn,
    monthlyContribution = 0,
    lumpSums = [],
    loans,
    inflationRate,
  } = plan;

  if (!children?.length) return { yearly: [], childData: [], summary: null };

  const inflation = inflationRate ?? DEFAULT_INFLATION;
  const now = new Date().getFullYear();
  const annualContribution = monthlyContribution * 12;

  const childData = children.map((child) => {
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
    };
  });

  const lastYear = Math.max(...childData.map((c) => c.endYear - 1));
  const firstCollegeYear = Math.min(...childData.map((c) => c.startYear));
  const yearsToFirst = Math.max(0, firstCollegeYear - now);

  const yearly = [];
  let balance = totalSavings;
  let totalUncovered = 0;
  let runningLoanBalance = 0;
  let projectedAtFirst = null;

  for (let year = now; year <= lastYear; year++) {
    balance *= 1 + annualReturn;
    balance += annualContribution;

    const lumpSumTotal = lumpSums
      .filter((ls) => ls.year === year)
      .reduce((s, ls) => s + ls.amount, 0);
    if (lumpSumTotal > 0) balance += lumpSumTotal;

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
    // Hold loanBalance at 0 in the first crossover year so savings and loan lines meet cleanly
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
  const loanRate = loans?.rate ?? DEFAULT_LOAN_RATE;
  const loanTerm = loans?.termYears ?? DEFAULT_LOAN_TERM;
  const remainingGap = Math.round(gap - loanAmount);
  const monthlyLoanPayment = Math.round(monthlyPayment(loanAmount, loanRate, loanTerm));
  const monthlyNeeded =
    monthsToFirst > 0 && remainingGap > 0 ? Math.round(remainingGap / monthsToFirst) : 0;

  return {
    yearly,
    childData,
    summary: {
      totalProjectedCost: Math.round(totalProjectedCost),
      currentSavings: totalSavings,
      monthlyContribution,
      projectedAtFirst: projectedAtFirst ?? Math.round(totalSavings),
      finalBalance: Math.round(balance),
      gap,
      loanAmount,
      remainingGap,
      monthlyLoanPayment,
      monthlyNeeded,
      firstCollegeYear,
    },
  };
}
