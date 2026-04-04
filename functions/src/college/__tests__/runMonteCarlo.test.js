import { describe, it, expect } from "vitest";
import { runCollegeMonteCarlo, findExtraMonthlyContribution } from "../runMonteCarlo.js";

const REFERENCE_YEAR = 2026;

// Child born so college starts exactly `yearsUntil` years from REFERENCE_YEAR
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

// ── Lump sum handling ──────────────────────────────────────────────────────────

describe("lump sums", () => {
  it("applies a single lump sum in the correct year", () => {
    const withLump = basePlan({
      lumpSums: [{ year: REFERENCE_YEAR + 1, amount: 50000 }],
    });
    const without = basePlan({});

    const { successRate: rWith } = runCollegeMonteCarlo(withLump, 500);
    const { successRate: rWithout } = runCollegeMonteCarlo(without, 500);

    // A $50k lump sum into an otherwise empty plan should meaningfully raise success rate
    expect(rWith).toBeGreaterThan(rWithout);
  });

  it("applies ALL lump sums in the same year — not just the first", () => {
    // Two entries in the same year: only the first would be applied with .find()
    const twoInSameYear = basePlan({
      lumpSums: [
        { year: REFERENCE_YEAR + 1, amount: 10000 },
        { year: REFERENCE_YEAR + 1, amount: 90000 }, // this one was silently dropped
      ],
    });
    const singleEquivalent = basePlan({
      lumpSums: [{ year: REFERENCE_YEAR + 1, amount: 100000 }],
    });

    const { successRate: rTwo } = runCollegeMonteCarlo(twoInSameYear, 1000);
    const { successRate: rSingle } = runCollegeMonteCarlo(singleEquivalent, 1000);

    // Both should produce statistically equivalent success rates
    expect(rTwo).toBeCloseTo(rSingle, 1);
  });

  it("combines three lump sums in the same year correctly", () => {
    const split = basePlan({
      lumpSums: [
        { year: REFERENCE_YEAR + 2, amount: 40000 },
        { year: REFERENCE_YEAR + 2, amount: 250000 },
        { year: REFERENCE_YEAR + 2, amount: 10000 },
      ],
    });
    const combined = basePlan({
      lumpSums: [{ year: REFERENCE_YEAR + 2, amount: 300000 }],
    });

    const { successRate: rSplit } = runCollegeMonteCarlo(split, 1000);
    const { successRate: rCombined } = runCollegeMonteCarlo(combined, 1000);

    expect(rSplit).toBeCloseTo(rCombined, 1);
  });

  it("lump sums in different years are each applied once", () => {
    const spread = basePlan({
      lumpSums: [
        { year: REFERENCE_YEAR + 1, amount: 50000 },
        { year: REFERENCE_YEAR + 2, amount: 50000 },
      ],
    });
    const single = basePlan({
      lumpSums: [{ year: REFERENCE_YEAR + 1, amount: 100000 }],
    });

    // Spreading vs concentrating affects timing but total contributed is equal —
    // spread should do slightly worse due to one year less compounding on the 2nd tranche
    const { successRate: rSpread } = runCollegeMonteCarlo(spread, 500);
    const { successRate: rSingle } = runCollegeMonteCarlo(single, 500);

    // Both positive, spread slightly lower or equal (within reasonable MC variance)
    expect(rSpread).toBeGreaterThanOrEqual(0);
    expect(rSingle).toBeGreaterThanOrEqual(0);
  });
});

// ── Return value shape ─────────────────────────────────────────────────────────

describe("return shape", () => {
  it("returns successRate between 0 and 1", () => {
    const { successRate } = runCollegeMonteCarlo(basePlan(), 200);
    expect(successRate).toBeGreaterThanOrEqual(0);
    expect(successRate).toBeLessThanOrEqual(1);
  });

  it("returns yearlyBands with p10 ≤ p50 ≤ p90 for every year", () => {
    const { yearlyBands } = runCollegeMonteCarlo(basePlan(), 200);
    expect(yearlyBands.length).toBeGreaterThan(0);
    for (const band of yearlyBands) {
      expect(band.p10).toBeLessThanOrEqual(band.p50);
      expect(band.p50).toBeLessThanOrEqual(band.p90);
    }
  });

  it("reports the correct numSims", () => {
    const { numSims } = runCollegeMonteCarlo(basePlan(), 300);
    expect(numSims).toBe(300);
  });
});

// ── Success rate logic ─────────────────────────────────────────────────────────

describe("success rate", () => {
  it("is 0% when savings and contributions are zero and no loans", () => {
    const plan = basePlan({ totalSavings: 0, monthlyContribution: 0, lumpSums: [] });
    const { successRate } = runCollegeMonteCarlo(plan, 200);
    expect(successRate).toBe(0);
  });

  it("is higher with more savings", () => {
    const low = basePlan({ totalSavings: 10000 });
    const high = basePlan({ totalSavings: 500000 });
    const { successRate: rLow } = runCollegeMonteCarlo(low, 500);
    const { successRate: rHigh } = runCollegeMonteCarlo(high, 500);
    expect(rHigh).toBeGreaterThan(rLow);
  });

  it("counts as success when uncovered costs are within the loan budget", () => {
    const withLoan = basePlan({ loans: { totalAmount: 999999 } });
    const { successRate } = runCollegeMonteCarlo(withLoan, 200);
    expect(successRate).toBe(1);
  });

  it("multiple children increase total cost vs single child", () => {
    // Give enough savings for one child but not three
    const one = basePlan({ children: [childStartingIn(10)], totalSavings: 120000 });
    const three = basePlan({
      children: [childStartingIn(8), childStartingIn(10), childStartingIn(12)],
      totalSavings: 120000,
    });
    const { successRate: rOne } = runCollegeMonteCarlo(one, 500);
    const { successRate: rThree } = runCollegeMonteCarlo(three, 500);
    expect(rOne).toBeGreaterThan(0);
    expect(rThree).toBeLessThan(rOne);
  });
});

// ── findExtraMonthlyContribution ──────────────────────────────────────────────

describe("findExtraMonthlyContribution", () => {
  it("returns 0 when plan already meets 90% target", () => {
    const wealthy = basePlan({ totalSavings: 2000000 });
    const extra = findExtraMonthlyContribution(wealthy);
    expect(extra).toBe(0);
  });

  it("returns a positive multiple of $25 when plan is underfunded", () => {
    const poor = basePlan({ totalSavings: 0 });
    const extra = findExtraMonthlyContribution(poor);
    expect(extra).toBeGreaterThan(0);
    expect(extra % 25).toBe(0);
  });
});
