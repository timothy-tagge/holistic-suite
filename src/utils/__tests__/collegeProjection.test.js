import { describe, it, expect } from "vitest";
import { project, COST_TIER_MAP } from "../collegeProjection";

const REFERENCE_YEAR = new Date().getFullYear();

function childStartingIn(yearsUntil, costTier = "public-in-state", name = "Child") {
  return { name, birthYear: REFERENCE_YEAR + yearsUntil - 18, costTier };
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

// ── Lump sums — the bug that prompted these tests ─────────────────────────────

describe("project — lump sums", () => {
  it("applies ALL lump sums in the same year, not just the first", () => {
    const twoSameYear = project(
      basePlan({
        lumpSums: [
          { year: REFERENCE_YEAR + 1, amount: 40000 },
          { year: REFERENCE_YEAR + 1, amount: 250000 },
        ],
      })
    );
    const equivalent = project(
      basePlan({
        lumpSums: [{ year: REFERENCE_YEAR + 1, amount: 290000 }],
      })
    );
    expect(twoSameYear.summary.gap).toBe(equivalent.summary.gap);
    expect(twoSameYear.summary.finalBalance).toBe(equivalent.summary.finalBalance);
  });

  it("applies lump sums in different years independently", () => {
    const split = project(
      basePlan({
        lumpSums: [
          { year: REFERENCE_YEAR + 1, amount: 50000 },
          { year: REFERENCE_YEAR + 5, amount: 50000 },
        ],
      })
    );
    const none = project(basePlan());
    expect(split.summary.gap).toBeLessThan(none.summary.gap);
  });

  it("earlier lump sum compounds more than later lump sum of same size", () => {
    const early = project(
      basePlan({ lumpSums: [{ year: REFERENCE_YEAR + 1, amount: 50000 }] })
    );
    const late = project(
      basePlan({ lumpSums: [{ year: REFERENCE_YEAR + 8, amount: 50000 }] })
    );
    expect(early.summary.gap).toBeLessThanOrEqual(late.summary.gap);
  });

  it("lump sum after last college year has no effect on gap", () => {
    const afterEnd = project(
      basePlan({
        lumpSums: [{ year: REFERENCE_YEAR + 20, amount: 999999 }],
      })
    );
    const none = project(basePlan());
    expect(afterEnd.summary.gap).toBe(none.summary.gap);
  });
});

// ── Return shape ──────────────────────────────────────────────────────────────

describe("project — return shape", () => {
  it("returns empty arrays and null summary when no children", () => {
    const result = project({ ...basePlan(), children: [] });
    expect(result.yearly).toEqual([]);
    expect(result.childData).toEqual([]);
    expect(result.summary).toBeNull();
  });

  it("yearly has one row per year from now through last graduation", () => {
    const { yearly } = project(basePlan({ children: [childStartingIn(10)] }));
    expect(yearly.length).toBe(10 + 4); // years until start + 4 college years
  });

  it("each yearly row has year, savings, and loanBalance fields", () => {
    const { yearly } = project(basePlan({ totalSavings: 100000 }));
    for (const row of yearly) {
      expect(row).toHaveProperty("year");
      expect(row).toHaveProperty("savings");
      expect(row).toHaveProperty("loanBalance");
    }
  });

  it("yearly rows include child cost keyed by child name", () => {
    const plan = basePlan({ children: [childStartingIn(5, "public-in-state", "Emma")] });
    const { yearly } = project(plan);
    const collegeRows = yearly.filter((r) => r.Emma != null);
    expect(collegeRows.length).toBe(4);
  });

  it("childData has startYear, endYear, annualCost, totalCost", () => {
    const { childData } = project(basePlan());
    expect(childData[0]).toHaveProperty("startYear");
    expect(childData[0]).toHaveProperty("endYear");
    expect(childData[0]).toHaveProperty("annualCost");
    expect(childData[0]).toHaveProperty("totalCost");
    expect(childData[0].totalCost).toBe(childData[0].annualCost * 4);
  });
});

// ── Summary metrics ───────────────────────────────────────────────────────────

describe("project — summary", () => {
  it("gap is 0 when savings fully cover costs", () => {
    const { summary } = project(basePlan({ totalSavings: 1000000 }));
    expect(summary.gap).toBe(0);
  });

  it("gap is positive when savings fall short", () => {
    const { summary } = project(basePlan({ totalSavings: 0 }));
    expect(summary.gap).toBeGreaterThan(0);
  });

  it("monthly contributions reduce the gap", () => {
    const without = project(basePlan());
    const with_mc = project(basePlan({ monthlyContribution: 1000 }));
    expect(with_mc.summary.gap).toBeLessThan(without.summary.gap);
  });

  it("firstCollegeYear matches the earliest child start", () => {
    const plan = basePlan({
      children: [
        childStartingIn(12, "public-in-state", "A"),
        childStartingIn(8, "public-in-state", "B"),
      ],
    });
    expect(project(plan).summary.firstCollegeYear).toBe(REFERENCE_YEAR + 8);
  });

  it("private school costs more than public in-state", () => {
    const cheap = project(
      basePlan({ children: [childStartingIn(10, "public-in-state")] })
    );
    const expensive = project(basePlan({ children: [childStartingIn(10, "private")] }));
    expect(expensive.summary.gap).toBeGreaterThan(cheap.summary.gap);
  });

  it("totalProjectedCost is positive and inflation-adjusted", () => {
    const noInflation = project(basePlan({ inflationRate: 0 }));
    const withInflation = project(basePlan({ inflationRate: 0.05 }));
    expect(noInflation.summary.totalProjectedCost).toBeGreaterThan(0);
    expect(withInflation.summary.totalProjectedCost).toBeGreaterThan(
      noInflation.summary.totalProjectedCost
    );
  });

  it("remainingGap = gap - loanAmount", () => {
    const plan = basePlan({ loans: { totalAmount: 20000, rate: 0.0639, termYears: 10 } });
    const { summary } = project(plan);
    expect(summary.remainingGap).toBe(summary.gap - summary.loanAmount);
  });

  it("monthlyLoanPayment is 0 when no loan", () => {
    expect(project(basePlan()).summary.monthlyLoanPayment).toBe(0);
  });

  it("monthlyLoanPayment is positive when loan is set", () => {
    const plan = basePlan({ loans: { totalAmount: 50000, rate: 0.0639, termYears: 10 } });
    expect(project(plan).summary.monthlyLoanPayment).toBeGreaterThan(0);
  });
});

// ── COST_TIER_MAP ─────────────────────────────────────────────────────────────

describe("COST_TIER_MAP", () => {
  it("has all four tiers", () => {
    expect(COST_TIER_MAP).toHaveProperty("public-in-state");
    expect(COST_TIER_MAP).toHaveProperty("public-out-of-state");
    expect(COST_TIER_MAP).toHaveProperty("private");
    expect(COST_TIER_MAP).toHaveProperty("elite");
  });

  it("tiers are in ascending cost order", () => {
    const {
      "public-in-state": pub,
      "public-out-of-state": pubOut,
      private: priv,
      elite,
    } = COST_TIER_MAP;
    expect(pub).toBeLessThan(pubOut);
    expect(pubOut).toBeLessThan(priv);
    expect(priv).toBeLessThan(elite);
  });
});
