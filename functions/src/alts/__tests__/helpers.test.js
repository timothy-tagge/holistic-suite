import { describe, it, expect, beforeEach, vi } from "vitest";
import { enrichPlan } from "../helpers.js";

// Pin "today" so projectedNAV calculations are deterministic
const FIXED_NOW = new Date("2025-01-01").getTime();
beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
});

function makePlan(investments = []) {
  return { name: "Test Plan", investments };
}

function makeInv(overrides = {}) {
  return {
    id: "inv-1",
    name: "Test Investment",
    committed: 100000,
    status: "active",
    cashFlows: [],
    ...overrides,
  };
}

// ── Portfolio aggregates ──────────────────────────────────────────────────────

describe("enrichPlan — portfolio aggregates", () => {
  it("returns zero aggregates for an empty plan", () => {
    const { portfolio } = enrichPlan(makePlan());
    expect(portfolio.totalCommitted).toBe(0);
    expect(portfolio.totalCalled).toBe(0);
    expect(portfolio.totalDistributions).toBe(0);
    expect(portfolio.portfolioDPI).toBe(0);
    expect(portfolio.blendedIRR).toBeNull();
    expect(portfolio.portfolioProjectedNAV).toBeNull();
  });

  it("sums committed capital across investments", () => {
    const plan = makePlan([
      makeInv({ id: "1", committed: 50000 }),
      makeInv({ id: "2", committed: 75000 }),
    ]);
    const { portfolio } = enrichPlan(plan);
    expect(portfolio.totalCommitted).toBe(125000);
  });

  it("sums called capital from call cash flows", () => {
    const plan = makePlan([
      makeInv({
        cashFlows: [
          { id: "cf1", date: "2023-01-01", type: "call", amount: 40000 },
          { id: "cf2", date: "2023-06-01", type: "call", amount: 30000 },
        ],
      }),
    ]);
    const { portfolio } = enrichPlan(plan);
    expect(portfolio.totalCalled).toBe(70000);
  });

  it("computes DPI when called > 0", () => {
    const plan = makePlan([
      makeInv({
        cashFlows: [
          { id: "cf1", date: "2022-01-01", type: "call", amount: 100000 },
          { id: "cf2", date: "2024-01-01", type: "distribution-income", amount: 20000 },
        ],
      }),
    ]);
    const { portfolio } = enrichPlan(plan);
    expect(portfolio.portfolioDPI).toBeCloseTo(0.2, 5);
  });

  it("sets portfolioDPI to 0 when nothing has been called", () => {
    const { portfolio } = enrichPlan(makePlan([makeInv()]));
    expect(portfolio.portfolioDPI).toBe(0);
  });

  it("computes blendedIRR across all investments", () => {
    const plan = makePlan([
      makeInv({
        cashFlows: [
          { id: "cf1", date: "2023-01-01", type: "call", amount: 100000 },
          { id: "cf2", date: "2024-01-01", type: "exit", amount: 110000 },
        ],
      }),
    ]);
    const { portfolio } = enrichPlan(plan);
    expect(portfolio.blendedIRR).not.toBeNull();
    expect(portfolio.blendedIRR).toBeCloseTo(0.1, 2);
  });
});

// ── Per-investment metrics ────────────────────────────────────────────────────

describe("enrichPlan — per-investment metrics", () => {
  it("computes totalCalled from call cash flows only", () => {
    const plan = makePlan([makeInv({
      cashFlows: [
        { id: "c1", date: "2023-01-01", type: "call", amount: 50000 },
        { id: "c2", date: "2023-06-01", type: "distribution-income", amount: 5000 },
      ],
    })]);
    const { investments } = enrichPlan(plan);
    expect(investments[0].metrics.totalCalled).toBe(50000);
    expect(investments[0].metrics.totalDistributions).toBe(5000);
  });

  it("computes DPI per investment", () => {
    const plan = makePlan([makeInv({
      cashFlows: [
        { id: "c1", date: "2022-01-01", type: "call", amount: 100000 },
        { id: "c2", date: "2023-01-01", type: "distribution-income", amount: 30000 },
        { id: "c3", date: "2024-01-01", type: "distribution-roc", amount: 20000 },
      ],
    })]);
    const { investments } = enrichPlan(plan);
    expect(investments[0].metrics.dpi).toBeCloseTo(0.5, 5);
  });

  it("computes projectedAnnualDistribution when fields are present", () => {
    const plan = makePlan([makeInv({ committed: 200000, projectedCashOnCash: 0.08 })]);
    const { investments } = enrichPlan(plan);
    expect(investments[0].metrics.projectedAnnualDistribution).toBeCloseTo(16000, 0);
  });

  it("projectedAnnualDistribution is null when projectedCashOnCash is missing", () => {
    const plan = makePlan([makeInv({ committed: 100000 })]);
    const { investments } = enrichPlan(plan);
    expect(investments[0].metrics.projectedAnnualDistribution).toBeNull();
  });

  it("computes projectedExitYear from cocStartDate + holdYears", () => {
    const plan = makePlan([makeInv({
      cocStartDate: "2022-03-01",
      projectedHoldYears: 5,
    })]);
    const { investments } = enrichPlan(plan);
    expect(investments[0].metrics.projectedExitYear).toBe(2027);
  });

  it("computes projectedExitYear from vintage when cocStartDate is absent", () => {
    const plan = makePlan([makeInv({
      vintage: 2021,
      projectedHoldYears: 7,
    })]);
    const { investments } = enrichPlan(plan);
    expect(investments[0].metrics.projectedExitYear).toBe(2028);
  });

  it("projectedExitYear is null when holdYears is absent", () => {
    const plan = makePlan([makeInv({ vintage: 2020, cocStartDate: "2020-01-01" })]);
    const { investments } = enrichPlan(plan);
    expect(investments[0].metrics.projectedExitYear).toBeNull();
  });

  it("computes projectedNAV for an active investment with IRR", () => {
    // Capital deployed in 2023, 2 years of compounding at 18% by 2025
    const plan = makePlan([makeInv({
      committed: 100000,
      projectedIRR: 0.18,
      cocStartDate: "2023-01-01",
      status: "active",
      cashFlows: [],
    })]);
    const { investments } = enrichPlan(plan);
    const nav = investments[0].metrics.projectedNAV;
    expect(nav).not.toBeNull();
    // ~100000 × 1.18^2 ≈ 139240, minus 0 distributions
    expect(nav).toBeGreaterThan(130000);
    expect(nav).toBeLessThan(150000);
  });

  it("projectedNAV is null for realized investments", () => {
    const plan = makePlan([makeInv({
      committed: 100000,
      projectedIRR: 0.18,
      cocStartDate: "2020-01-01",
      status: "realized",
    })]);
    const { investments } = enrichPlan(plan);
    expect(investments[0].metrics.projectedNAV).toBeNull();
  });

  it("projectedNAV is null when projectedIRR is absent", () => {
    const plan = makePlan([makeInv({ cocStartDate: "2022-01-01" })]);
    const { investments } = enrichPlan(plan);
    expect(investments[0].metrics.projectedNAV).toBeNull();
  });

  it("portfolioProjectedNAV sums NAV across active investments", () => {
    const plan = makePlan([
      makeInv({ id: "1", committed: 100000, projectedIRR: 0.1, cocStartDate: "2024-01-01" }),
      makeInv({ id: "2", committed: 100000, projectedIRR: 0.1, cocStartDate: "2024-01-01" }),
    ]);
    const { portfolio, investments } = enrichPlan(plan);
    const expectedNAV = investments[0].metrics.projectedNAV + investments[1].metrics.projectedNAV;
    expect(portfolio.portfolioProjectedNAV).toBeCloseTo(expectedNAV, 0);
  });
});

// ── computedIRR ───────────────────────────────────────────────────────────────

describe("enrichPlan — computedIRR", () => {
  it("is null when there are no cash flows", () => {
    const plan = makePlan([makeInv({ cashFlows: [] })]);
    const { investments } = enrichPlan(plan);
    expect(investments[0].metrics.computedIRR).toBeNull();
  });

  it("is null when there are only calls (no distributions)", () => {
    const plan = makePlan([makeInv({
      cashFlows: [{ id: "c1", date: "2023-01-01", type: "call", amount: 100000 }],
    })]);
    const { investments } = enrichPlan(plan);
    expect(investments[0].metrics.computedIRR).toBeNull();
  });

  it("computes IRR when both calls and distributions are present", () => {
    const plan = makePlan([makeInv({
      cashFlows: [
        { id: "c1", date: "2023-01-01", type: "call", amount: 100000 },
        { id: "c2", date: "2024-01-01", type: "exit", amount: 115000 },
      ],
    })]);
    const { investments } = enrichPlan(plan);
    expect(investments[0].metrics.computedIRR).not.toBeNull();
    expect(investments[0].metrics.computedIRR).toBeCloseTo(0.15, 2);
  });
});
