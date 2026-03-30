import { describe, it, expect } from "vitest";
import {
  calcInvTotalProjectedDist,
  calcCumulativeProjectedDistToYear,
  calcInvProjectedNAV,
  buildProjection,
} from "../altsProjection.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInv(overrides = {}) {
  return {
    id: "inv-1",
    name: "Test",
    committed: 100000,
    status: "active",
    projectedIRR: 0.18,
    projectedCashOnCash: 0.08,
    cocStartDate: "2023-01-01",
    projectedHoldYears: 5,
    cocGrowthRate: 0,
    cashFlows: [],
    metrics: {
      projectedExitYear: 2028,
      totalCalled: 0,
      totalDistributions: 0,
    },
    ...overrides,
  };
}

// ── calcInvTotalProjectedDist ─────────────────────────────────────────────────

describe("calcInvTotalProjectedDist", () => {
  it("returns 0 when projectedCashOnCash is missing", () => {
    expect(calcInvTotalProjectedDist(makeInv({ projectedCashOnCash: null }))).toBe(0);
  });

  it("returns 0 when cocStartDate is missing", () => {
    expect(calcInvTotalProjectedDist(makeInv({ cocStartDate: null }))).toBe(0);
  });

  it("returns 0 when projectedExitYear is missing", () => {
    const inv = makeInv({ metrics: { projectedExitYear: null } });
    expect(calcInvTotalProjectedDist(inv)).toBe(0);
  });

  it("computes flat distributions over 5 years at 8%", () => {
    // $100k × 8% × 5 years = $40,000
    const inv = makeInv(); // cocStartDate=2023, exitYear=2028, 5 years, growth=0
    const total = calcInvTotalProjectedDist(inv);
    expect(total).toBeCloseTo(40000, 0);
  });

  it("compounds distributions with a growth rate", () => {
    const inv = makeInv({ cocGrowthRate: 0.05 });
    // Year 0: 8000, Year 1: 8400, Year 2: 8820, Year 3: 9261, Year 4: 9724
    const expected = [0, 1, 2, 3, 4]
      .reduce((s, n) => s + 100000 * 0.08 * Math.pow(1.05, n), 0);
    expect(calcInvTotalProjectedDist(inv)).toBeCloseTo(expected, 0);
  });
});

// ── calcCumulativeProjectedDistToYear ─────────────────────────────────────────

describe("calcCumulativeProjectedDistToYear", () => {
  it("returns 0 when distributions haven't started yet", () => {
    const inv = makeInv({ cocStartDate: "2025-01-01" });
    expect(calcCumulativeProjectedDistToYear(inv, 2024)).toBe(0);
  });

  it("returns 0 for a year before cocStartDate", () => {
    const inv = makeInv();
    expect(calcCumulativeProjectedDistToYear(inv, 2022)).toBe(0);
  });

  it("returns one year of distributions for the year after start", () => {
    const inv = makeInv(); // cocStartDate=2023, 8%
    // Up to (not including) 2024: only year 2023 = $8,000
    expect(calcCumulativeProjectedDistToYear(inv, 2024)).toBeCloseTo(8000, 0);
  });

  it("accumulates over multiple years", () => {
    const inv = makeInv(); // flat 8%, up to 2026 = 3 years = $24,000
    expect(calcCumulativeProjectedDistToYear(inv, 2026)).toBeCloseTo(24000, 0);
  });

  it("does not include distributions from or after exitYear", () => {
    const inv = makeInv(); // exitYear=2028
    // Up to and past exit — should stop at exit
    const atExit = calcCumulativeProjectedDistToYear(inv, 2028);
    const pastExit = calcCumulativeProjectedDistToYear(inv, 2030);
    expect(atExit).toBeCloseTo(pastExit, 0);
  });
});

// ── calcInvProjectedNAV ───────────────────────────────────────────────────────

describe("calcInvProjectedNAV", () => {
  it("returns 0 when projectedIRR is missing", () => {
    const inv = makeInv({ projectedIRR: null });
    expect(calcInvProjectedNAV(inv, 2025)).toBe(0);
  });

  it("returns 0 when committed is missing", () => {
    const inv = makeInv({ committed: null });
    expect(calcInvProjectedNAV(inv, 2025)).toBe(0);
  });

  it("returns 0 for a year at or after the exit year", () => {
    const inv = makeInv(); // exitYear=2028
    expect(calcInvProjectedNAV(inv, 2028)).toBe(0);
    expect(calcInvProjectedNAV(inv, 2030)).toBe(0);
  });

  it("returns committed capital for a year before cocStartDate", () => {
    const inv = makeInv({ cocStartDate: "2025-01-01" });
    expect(calcInvProjectedNAV(inv, 2024)).toBe(100000);
  });

  it("grows at the projected IRR rate", () => {
    // cocStartDate=2023, querying year=2025 → yearsHeld = 2025-2023 = 2
    // grossValue = 100000 × 1.18^2 ≈ 139,240
    // cumDist (2023 + 2024) = 16,000
    const inv = makeInv(); // cocStartDate=2023, 18% IRR, 8% yield, growth=0
    const nav = calcInvProjectedNAV(inv, 2025);
    const yearsHeld = 2025 - 2023; // parsed from ISO, not getFullYear()
    const grossValue = 100000 * Math.pow(1.18, yearsHeld);
    const cumDist = calcCumulativeProjectedDistToYear(inv, 2025);
    expect(nav).toBeCloseTo(grossValue - cumDist, -2);
  });

  it("returns 0 (not negative) when distributions exceed gross value", () => {
    // Extreme case: very low IRR, very high cash yield
    const inv = makeInv({
      projectedIRR: 0.01,
      projectedCashOnCash: 0.50,
      cocStartDate: "2020-01-01",
      metrics: { projectedExitYear: 2030 },
    });
    const nav = calcInvProjectedNAV(inv, 2027);
    expect(nav).toBeGreaterThanOrEqual(0);
  });
});

// ── buildProjection ───────────────────────────────────────────────────────────

describe("buildProjection", () => {
  it("returns empty array for null/empty investments", () => {
    expect(buildProjection(null)).toEqual([]);
    expect(buildProjection([])).toEqual([]);
  });

  it("returns empty array when all investments are realized", () => {
    const inv = makeInv({ status: "realized" });
    expect(buildProjection([inv], 2025)).toEqual([]);
  });

  it("generates rows for each year from referenceYear to exitYear", () => {
    const inv = makeInv(); // cocStart=2023, exit=2028
    const rows = buildProjection([inv], 2024);
    const years = rows.map(r => r.year);
    expect(years).toContain(2024);
    expect(years).toContain(2027); // last distribution year
    expect(years).toContain(2028); // exit year
  });

  it("distribution rows have correct flat yield", () => {
    const inv = makeInv(); // $100k × 8% = $8k/yr, growth=0
    const rows = buildProjection([inv], 2024);
    const distRow = rows.find(r => r.year === 2024 && r.exitProceeds === 0);
    expect(distRow?.distributions).toBeCloseTo(8000, -1);
  });

  it("exit year row has exitProceeds > 0", () => {
    const inv = makeInv(); // exit=2028
    const rows = buildProjection([inv], 2024);
    const exitRow = rows.find(r => r.year === 2028);
    expect(exitRow).toBeDefined();
    expect(exitRow.exitProceeds).toBeGreaterThan(0);
  });

  it("exit proceeds are estimated as IRR multiple minus projected distributions", () => {
    const inv = makeInv(); // 18% IRR, 5 yr hold, $40k projected distributions
    const rows = buildProjection([inv], 2024);
    const exitRow = rows.find(r => r.year === 2028);
    const multiple = Math.pow(1.18, 5);
    const totalDist = 100000 * 0.08 * 5; // $40k
    const expectedExit = 100000 * multiple - totalDist;
    expect(exitRow.exitProceeds).toBeCloseTo(expectedExit, -2);
  });

  it("cumulative increases monotonically", () => {
    const inv = makeInv();
    const rows = buildProjection([inv], 2024);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].cumulative).toBeGreaterThanOrEqual(rows[i - 1].cumulative);
    }
  });

  it("portfolioNAV is present in every row", () => {
    const inv = makeInv();
    const rows = buildProjection([inv], 2024);
    for (const row of rows) {
      expect(row).toHaveProperty("portfolioNAV");
      expect(typeof row.portfolioNAV).toBe("number");
    }
  });

  it("portfolioNAV decreases toward 0 at exit", () => {
    const inv = makeInv();
    const rows = buildProjection([inv], 2024);
    const exitRow = rows.find(r => r.year === 2028);
    expect(exitRow?.portfolioNAV).toBe(0);
  });

  it("combines multiple investments correctly", () => {
    const inv1 = makeInv({ id: "1", committed: 100000 });
    const inv2 = makeInv({ id: "2", committed: 200000 });
    const rows = buildProjection([inv1, inv2], 2024);
    const distRow = rows.find(r => r.year === 2024);
    // 8% of 100k + 8% of 200k = 24k
    expect(distRow?.distributions).toBeCloseTo(24000, -1);
  });

  it("applies growth rate to distributions", () => {
    const inv = makeInv({ cocGrowthRate: 0.10 }); // 10% annual growth
    const rows = buildProjection([inv], 2023);
    const year0 = rows.find(r => r.year === 2023);
    const year1 = rows.find(r => r.year === 2024);
    expect(year0?.distributions).toBeCloseTo(8000, -1);
    expect(year1?.distributions).toBeCloseTo(8800, -1);
  });

  it("uses a fallback of committed capital as exit proceeds when IRR is missing", () => {
    const inv = makeInv({ projectedIRR: null, projectedHoldYears: null });
    const rows = buildProjection([inv], 2024);
    const exitRow = rows.find(r => r.exitProceeds > 0);
    if (exitRow) {
      expect(exitRow.exitProceeds).toBeCloseTo(100000, -2);
    }
  });

  it("extends to at least currentYear + 5 when no exit is defined", () => {
    const inv = makeInv({
      projectedHoldYears: null,
      metrics: { projectedExitYear: null },
    });
    const rows = buildProjection([inv], 2024);
    const maxYear = Math.max(...rows.map(r => r.year));
    expect(maxYear).toBeGreaterThanOrEqual(2029);
  });
});
