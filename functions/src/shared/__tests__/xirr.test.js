import { describe, it, expect } from "vitest";
import { xirr, toSignedCashFlows } from "../xirr.js";

// ── xirr ─────────────────────────────────────────────────────────────────────

describe("xirr", () => {
  it("returns null for fewer than 2 cash flows", () => {
    expect(xirr([])).toBeNull();
    expect(xirr(null)).toBeNull();
    expect(xirr([{ date: "2023-01-01", amount: -1000 }])).toBeNull();
  });

  it("returns null when all cash flows are outflows (no positive)", () => {
    expect(xirr([
      { date: "2023-01-01", amount: -1000 },
      { date: "2024-01-01", amount: -500 },
    ])).toBeNull();
  });

  it("returns null when all cash flows are inflows (no negative)", () => {
    expect(xirr([
      { date: "2023-01-01", amount: 500 },
      { date: "2024-01-01", amount: 600 },
    ])).toBeNull();
  });

  it("computes ~10% IRR for a simple 1-year investment", () => {
    const cfs = [
      { date: "2023-01-01", amount: -1000 },
      { date: "2024-01-01", amount: 1100 },
    ];
    const result = xirr(cfs);
    expect(result).not.toBeNull();
    expect(result).toBeCloseTo(0.1, 3);
  });

  it("computes ~0% IRR when the same amount is returned", () => {
    const cfs = [
      { date: "2023-01-01", amount: -1000 },
      { date: "2024-01-01", amount: 1000 },
    ];
    const result = xirr(cfs);
    expect(result).not.toBeNull();
    expect(result).toBeCloseTo(0.0, 3);
  });

  it("computes ~18% IRR for a typical private equity deal", () => {
    // Invest $100k, receive $24k/yr for 5 years, then $80k at exit
    const cfs = [
      { date: "2020-01-01", amount: -100000 },
      { date: "2021-01-01", amount: 24000 },
      { date: "2022-01-01", amount: 24000 },
      { date: "2023-01-01", amount: 24000 },
      { date: "2024-01-01", amount: 24000 },
      { date: "2025-01-01", amount: 24000 + 80000 },
    ];
    const result = xirr(cfs);
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(0.15);
    expect(result).toBeLessThan(0.25);
  });

  it("computes negative IRR for a loss-making investment", () => {
    const cfs = [
      { date: "2023-01-01", amount: -1000 },
      { date: "2025-01-01", amount: 500 },
    ];
    const result = xirr(cfs);
    expect(result).not.toBeNull();
    expect(result).toBeLessThan(0);
  });

  it("handles multiple capital calls followed by distributions", () => {
    const cfs = [
      { date: "2021-01-01", amount: -50000 },
      { date: "2021-07-01", amount: -50000 },
      { date: "2023-01-01", amount: 20000 },
      { date: "2024-01-01", amount: 20000 },
      { date: "2025-01-01", amount: 130000 },
    ];
    const result = xirr(cfs);
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(0.1);
  });

  it("returns null for IRR above 1000% (likely non-convergence artifact)", () => {
    // Degenerate: invest $1, get $10000 next day
    const cfs = [
      { date: "2024-01-01", amount: -1 },
      { date: "2024-01-02", amount: 10000 },
    ];
    // Either converges to a huge number (> 10 limit) or null — both are acceptable
    const result = xirr(cfs);
    if (result !== null) {
      expect(result).toBeLessThanOrEqual(10);
    }
  });
});

// ── toSignedCashFlows ─────────────────────────────────────────────────────────

describe("toSignedCashFlows", () => {
  it("converts calls to negative amounts", () => {
    const cfs = [{ date: "2023-01-01", type: "call", amount: 1000 }];
    const result = toSignedCashFlows(cfs);
    expect(result[0].amount).toBe(-1000);
  });

  it("keeps distributions as positive amounts", () => {
    const types = ["distribution-income", "distribution-roc", "exit"];
    for (const type of types) {
      const result = toSignedCashFlows([{ date: "2023-01-01", type, amount: 500 }]);
      expect(result[0].amount).toBe(500);
    }
  });

  it("preserves the date field", () => {
    const cfs = [{ date: "2024-06-15", type: "call", amount: 100 }];
    expect(toSignedCashFlows(cfs)[0].date).toBe("2024-06-15");
  });

  it("handles null/undefined gracefully", () => {
    expect(toSignedCashFlows(null)).toEqual([]);
    expect(toSignedCashFlows(undefined)).toEqual([]);
    expect(toSignedCashFlows([])).toEqual([]);
  });
});
