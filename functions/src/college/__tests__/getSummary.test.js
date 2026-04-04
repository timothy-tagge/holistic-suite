import { describe, it, expect } from "vitest";
import { calcMonthlyPayment, projectPlan } from "../getSummary.js";

const REFERENCE_YEAR = 2026;

function childStartingIn(yearsUntil, costTier = "public-in-state") {
  return { name: "Child", birthYear: REFERENCE_YEAR + yearsUntil - 18, costTier };
}

function basePlan(overrides = {}) {
  return {
    children: [childStartingIn(10)],
    totalSavings: 0,
    annualReturn: 0.07,
    monthlyContribution: 0,
    inflationRate: 0.03,
    lumpSums: [],
    loans: null,
    ...overrides,
  };
}

// ── calcMonthlyPayment ─────────────────────────────────────────────────────────

describe("calcMonthlyPayment", () => {
  it("returns 0 for zero principal", () => {
    expect(calcMonthlyPayment(0, 0.0639, 10)).toBe(0);
  });

  it("returns principal/n when rate is 0", () => {
    expect(calcMonthlyPayment(12000, 0, 1)).toBeCloseTo(1000);
  });

  it("returns correct payment for standard loan", () => {
    // $100k at 6.39% for 10 years → ~$1,119/mo
    const payment = calcMonthlyPayment(100000, 0.0639, 10);
    expect(payment).toBeGreaterThan(1100);
    expect(payment).toBeLessThan(1150);
  });

  it("higher rate produces higher payment", () => {
    const low = calcMonthlyPayment(100000, 0.04, 10);
    const high = calcMonthlyPayment(100000, 0.08, 10);
    expect(high).toBeGreaterThan(low);
  });

  it("longer term produces lower monthly payment", () => {
    const short = calcMonthlyPayment(100000, 0.06, 5);
    const long = calcMonthlyPayment(100000, 0.06, 20);
    expect(long).toBeLessThan(short);
  });
});

// ── projectPlan — lump sums ───────────────────────────────────────────────────

describe("projectPlan — lump sums", () => {
  it("applies a single lump sum", () => {
    const without = projectPlan(basePlan());
    const with_ls = projectPlan(
      basePlan({
        lumpSums: [{ year: REFERENCE_YEAR + 1, amount: 100000 }],
      })
    );
    expect(with_ls.gap).toBeLessThan(without.gap);
  });

  it("applies ALL lump sums in the same year — not just the first", () => {
    const two_same = projectPlan(
      basePlan({
        lumpSums: [
          { year: REFERENCE_YEAR + 1, amount: 40000 },
          { year: REFERENCE_YEAR + 1, amount: 250000 },
        ],
      })
    );
    const combined = projectPlan(
      basePlan({
        lumpSums: [{ year: REFERENCE_YEAR + 1, amount: 290000 }],
      })
    );
    expect(two_same.gap).toBe(combined.gap);
    expect(two_same.finalBalance).toBe(combined.finalBalance);
  });

  it("lump sums in different years are each applied", () => {
    const spread = projectPlan(
      basePlan({
        lumpSums: [
          { year: REFERENCE_YEAR + 1, amount: 50000 },
          { year: REFERENCE_YEAR + 2, amount: 50000 },
        ],
      })
    );
    const none = projectPlan(basePlan());
    // Spreading $100k across two years should reduce the gap vs no contributions
    expect(spread.gap).toBeLessThan(none.gap);
  });

  it("lump sum before college year is applied with compounding benefit", () => {
    const early = projectPlan(
      basePlan({
        lumpSums: [{ year: REFERENCE_YEAR + 1, amount: 50000 }],
      })
    );
    const late = projectPlan(
      basePlan({
        lumpSums: [{ year: REFERENCE_YEAR + 9, amount: 50000 }],
      })
    );
    // Same amount contributed earlier → better outcome (more time to compound)
    expect(early.gap).toBeLessThanOrEqual(late.gap);
  });
});

// ── projectPlan — core projection ─────────────────────────────────────────────

describe("projectPlan — core projection", () => {
  it("gap is 0 when savings fully cover costs", () => {
    const { gap } = projectPlan(basePlan({ totalSavings: 1000000 }));
    expect(gap).toBe(0);
  });

  it("finalBalance is 0 or positive", () => {
    const { finalBalance } = projectPlan(basePlan());
    expect(finalBalance).toBeGreaterThanOrEqual(0);
  });

  it("monthly contributions reduce the gap", () => {
    const none = projectPlan(basePlan({ monthlyContribution: 0 }));
    const with_contrib = projectPlan(basePlan({ monthlyContribution: 500 }));
    expect(with_contrib.gap).toBeLessThan(none.gap);
  });

  it("higher return rate reduces the gap", () => {
    const low = projectPlan(basePlan({ annualReturn: 0.03, totalSavings: 50000 }));
    const high = projectPlan(basePlan({ annualReturn: 0.09, totalSavings: 50000 }));
    expect(high.gap).toBeLessThan(low.gap);
  });

  it("more expensive cost tier increases the gap", () => {
    const cheap = projectPlan(
      basePlan({ children: [childStartingIn(10, "public-in-state")] })
    );
    const expensive = projectPlan(
      basePlan({ children: [childStartingIn(10, "private")] })
    );
    expect(expensive.gap).toBeGreaterThan(cheap.gap);
  });

  it("firstCollegeYear matches the earliest child start", () => {
    const plan = basePlan({
      children: [childStartingIn(12), childStartingIn(8)],
    });
    const { firstCollegeYear } = projectPlan(plan);
    expect(firstCollegeYear).toBe(REFERENCE_YEAR + 8);
  });

  it("lastGraduationYear is 4 years after the latest child starts", () => {
    const { lastGraduationYear } = projectPlan(
      basePlan({ children: [childStartingIn(10)] })
    );
    expect(lastGraduationYear).toBe(REFERENCE_YEAR + 10 + 4);
  });
});

// ── projectPlan — loans ───────────────────────────────────────────────────────

describe("projectPlan — loans", () => {
  it("remainingGap equals gap when no loan", () => {
    const { gap, remainingGap } = projectPlan(basePlan());
    expect(remainingGap).toBe(gap);
  });

  it("loan reduces remainingGap by loan amount", () => {
    const plan = basePlan({ loans: { totalAmount: 20000, rate: 0.0639, termYears: 10 } });
    const { gap, remainingGap, loanAmount } = projectPlan(plan);
    expect(loanAmount).toBe(20000);
    expect(remainingGap).toBe(gap - 20000);
  });

  it("monthlyLoanPayment is 0 when no loan", () => {
    const { monthlyLoanPayment } = projectPlan(basePlan());
    expect(monthlyLoanPayment).toBe(0);
  });

  it("monthlyLoanPayment is positive when loan is set", () => {
    const plan = basePlan({ loans: { totalAmount: 50000, rate: 0.0639, termYears: 10 } });
    const { monthlyLoanPayment } = projectPlan(plan);
    expect(monthlyLoanPayment).toBeGreaterThan(0);
  });
});
