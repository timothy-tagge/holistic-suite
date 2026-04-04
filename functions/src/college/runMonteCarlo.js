import { randomNormal, computeYearlyBands } from "../shared/monteCarlo.js";

// ── Projection constants (kept in sync with getSummary.js) ──────────────────

const COST_TIER_MAP = {
  "public-in-state": 27000,
  "public-out-of-state": 45000,
  private: 60000,
  elite: 85000,
};
const COLLEGE_YEARS = 4;
const DEFAULT_INFLATION = 0.03;

// Moderate portfolio: ~12% annual return volatility
const MC_STD_DEV = 0.12;

/**
 * Runs Monte Carlo simulations for a college plan.
 *
 * @param {object} plan — Firestore college-plans document
 * @param {number} numSims — number of simulations (default 1000)
 * @returns {{ yearlyBands, successRate, numSims, stdDev }}
 */
export function runCollegeMonteCarlo(plan, numSims = 1000) {
  const {
    children,
    totalSavings,
    annualReturn,
    monthlyContribution = 0,
    lumpSums = [],
    loans,
    inflationRate,
  } = plan;
  const inflation = inflationRate ?? DEFAULT_INFLATION;
  const now = new Date().getFullYear();
  const annualContribution = (monthlyContribution ?? 0) * 12;
  const loanAmount = loans?.totalAmount ?? 0;

  const childData = children.map((child) => {
    const startYear = child.birthYear + 18;
    const yearsAway = Math.max(0, startYear - now);
    const baseCost = child.annualCostBase ?? COST_TIER_MAP[child.costTier];
    const annualCost = Math.round(baseCost * Math.pow(1 + inflation, yearsAway));
    return { ...child, startYear, endYear: startYear + COLLEGE_YEARS, annualCost };
  });

  const lastYear = Math.max(...childData.map((c) => c.endYear - 1));
  const years = [];
  for (let y = now; y <= lastYear; y++) years.push(y);

  const balancesByYear = years.map(() => []);
  let successCount = 0;

  for (let sim = 0; sim < numSims; sim++) {
    let balance = totalSavings;
    let uncovered = 0;

    for (let i = 0; i < years.length; i++) {
      const year = years[i];
      const r = Math.max(-0.5, Math.min(0.6, randomNormal(annualReturn, MC_STD_DEV)));
      balance = Math.max(0, balance * (1 + r));
      balance += annualContribution;
      const lumpSumTotal = (lumpSums ?? [])
        .filter((ls) => ls.year === year)
        .reduce((s, ls) => s + ls.amount, 0);
      if (lumpSumTotal > 0) balance += lumpSumTotal;

      for (const child of childData) {
        if (year >= child.startYear && year < child.endYear) {
          if (balance >= child.annualCost) {
            balance -= child.annualCost;
          } else {
            uncovered += child.annualCost - balance;
            balance = 0;
          }
        }
      }
      balancesByYear[i].push(Math.round(Math.max(0, balance)));
    }
    if (uncovered <= loanAmount) successCount++;
  }

  const yearlyBands = computeYearlyBands(years, balancesByYear);

  return {
    yearlyBands,
    successRate: successCount / numSims,
    numSims,
    stdDev: MC_STD_DEV,
  };
}

/**
 * Binary search for the extra monthly contribution needed to reach targetRate (default 90%).
 * Uses 300 simulations per iteration for speed (14 iterations).
 *
 * @returns {number} — additional monthly dollars needed, rounded up to nearest $25
 */
export function findExtraMonthlyContribution(plan, targetRate = 0.9) {
  let lo = 0,
    hi = 5000;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const testPlan = {
      ...plan,
      monthlyContribution: (plan.monthlyContribution ?? 0) + mid,
    };
    const { successRate } = runCollegeMonteCarlo(testPlan, 300);
    if (successRate >= targetRate) hi = mid;
    else lo = mid;
  }
  const extra = Math.ceil(hi / 25) * 25;
  // If the current plan already meets target, return 0
  const { successRate: currentRate } = runCollegeMonteCarlo(plan, 300);
  return currentRate >= targetRate ? 0 : extra;
}
