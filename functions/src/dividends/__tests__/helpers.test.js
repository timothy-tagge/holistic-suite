import { describe, it, expect } from "vitest";
import { enrichPayment, enrichPlan, prepareBatchImport } from "../helpers.js";

// ── enrichPayment ─────────────────────────────────────────────────────────────

describe("enrichPayment", () => {
  it("computes dividendPerShare when amount and sharesHeld are present", () => {
    const p = enrichPayment({ amount: 500, sharesHeld: 100, priceAtDate: null });
    expect(p.dividendPerShare).toBeCloseTo(5.0);
  });

  it("computes sharesAcquired when amount and priceAtDate are present", () => {
    const p = enrichPayment({ amount: 500, sharesHeld: null, priceAtDate: 25 });
    expect(p.sharesAcquired).toBeCloseTo(20);
  });

  it("computes both when all inputs are present", () => {
    const p = enrichPayment({ amount: 100, sharesHeld: 50, priceAtDate: 20 });
    expect(p.dividendPerShare).toBeCloseTo(2.0);
    expect(p.sharesAcquired).toBeCloseTo(5.0);
  });

  it("dividendPerShare is null when sharesHeld is null", () => {
    const p = enrichPayment({ amount: 100, sharesHeld: null, priceAtDate: 20 });
    expect(p.dividendPerShare).toBeNull();
  });

  it("sharesAcquired is null when priceAtDate is null", () => {
    const p = enrichPayment({ amount: 100, sharesHeld: 50, priceAtDate: null });
    expect(p.sharesAcquired).toBeNull();
  });

  it("dividendPerShare is null when sharesHeld is 0 (avoid divide by zero)", () => {
    const p = enrichPayment({ amount: 100, sharesHeld: 0, priceAtDate: null });
    expect(p.dividendPerShare).toBeNull();
  });

  it("sharesAcquired is null when priceAtDate is 0 (avoid divide by zero)", () => {
    const p = enrichPayment({ amount: 100, sharesHeld: null, priceAtDate: 0 });
    expect(p.sharesAcquired).toBeNull();
  });

  it("preserves all original fields", () => {
    const p = enrichPayment({
      id: "abc",
      ticker: "SCHD",
      date: "2025-03-15",
      amount: 100,
      sharesHeld: null,
      priceAtDate: null,
      note: "Q1",
    });
    expect(p.ticker).toBe("SCHD");
    expect(p.note).toBe("Q1");
  });
});

// ── enrichPlan — per-ticker stats ─────────────────────────────────────────────

function makePayment(overrides) {
  return {
    id: Math.random().toString(36).slice(2),
    ticker: "SCHD",
    date: "2025-01-01",
    amount: 100,
    sharesHeld: null,
    priceAtDate: null,
    ...overrides,
  };
}

function makePlan(payments = [], accounts = []) {
  return {
    ownerUid: "uid-1",
    payments,
    accounts,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };
}

describe("enrichPlan — tickerStats", () => {
  it("computes totalReceived per ticker", () => {
    const plan = makePlan([
      makePayment({ ticker: "SCHD", amount: 100, date: "2025-01-01" }),
      makePayment({ ticker: "SCHD", amount: 150, date: "2025-04-01" }),
      makePayment({ ticker: "O", amount: 50, date: "2025-01-15" }),
    ]);
    const { tickerStats } = enrichPlan(plan);
    expect(tickerStats["SCHD"].totalReceived).toBe(250);
    expect(tickerStats["O"].totalReceived).toBe(50);
  });

  it("computes totalSharesAcquired when priceAtDate is present", () => {
    const plan = makePlan([
      makePayment({ ticker: "SCHD", amount: 100, priceAtDate: 25, date: "2025-01-01" }),
      makePayment({ ticker: "SCHD", amount: 200, priceAtDate: 25, date: "2025-04-01" }),
    ]);
    const { tickerStats } = enrichPlan(plan);
    // 100/25 + 200/25 = 4 + 8 = 12
    expect(tickerStats["SCHD"].totalSharesAcquired).toBeCloseTo(12);
  });

  it("computes latestDPS from most recent payment with sharesHeld", () => {
    const plan = makePlan([
      makePayment({ ticker: "SCHD", amount: 100, sharesHeld: 50, date: "2025-01-01" }),
      makePayment({ ticker: "SCHD", amount: 120, sharesHeld: 55, date: "2025-04-01" }),
    ]);
    const { tickerStats } = enrichPlan(plan);
    // latest DPS = 120/55
    expect(tickerStats["SCHD"].latestDPS).toBeCloseTo(120 / 55);
  });

  it("latestDPS is null when no payments have sharesHeld", () => {
    const plan = makePlan([
      makePayment({ ticker: "SCHD", amount: 100, sharesHeld: null, date: "2025-01-01" }),
    ]);
    const { tickerStats } = enrichPlan(plan);
    expect(tickerStats["SCHD"].latestDPS).toBeNull();
  });

  it("computes dpsGrowthRate between last two DPS values", () => {
    const plan = makePlan([
      makePayment({ ticker: "SCHD", amount: 100, sharesHeld: 100, date: "2025-01-01" }), // DPS=1.00
      makePayment({ ticker: "SCHD", amount: 110, sharesHeld: 100, date: "2025-04-01" }), // DPS=1.10
    ]);
    const { tickerStats } = enrichPlan(plan);
    // growth = (1.10 - 1.00) / 1.00 = 0.10
    expect(tickerStats["SCHD"].dpsGrowthRate).toBeCloseTo(0.1);
  });

  it("dpsGrowthRate is null with only one DPS value", () => {
    const plan = makePlan([
      makePayment({ ticker: "SCHD", amount: 100, sharesHeld: 100, date: "2025-01-01" }),
    ]);
    const { tickerStats } = enrichPlan(plan);
    expect(tickerStats["SCHD"].dpsGrowthRate).toBeNull();
  });

  it("negative dpsGrowthRate when dividend is cut", () => {
    const plan = makePlan([
      makePayment({ ticker: "SCHD", amount: 110, sharesHeld: 100, date: "2025-01-01" }), // DPS=1.10
      makePayment({ ticker: "SCHD", amount: 90, sharesHeld: 100, date: "2025-04-01" }), // DPS=0.90
    ]);
    const { tickerStats } = enrichPlan(plan);
    expect(tickerStats["SCHD"].dpsGrowthRate).toBeLessThan(0);
  });

  it("payments are sorted by date before computing DPS growth", () => {
    // Insert out of order — older payment second
    const plan = makePlan([
      makePayment({ ticker: "SCHD", amount: 110, sharesHeld: 100, date: "2025-04-01" }), // DPS=1.10 (later)
      makePayment({ ticker: "SCHD", amount: 100, sharesHeld: 100, date: "2025-01-01" }), // DPS=1.00 (earlier)
    ]);
    const { tickerStats } = enrichPlan(plan);
    // Growth should be positive (1.00 → 1.10), not negative
    expect(tickerStats["SCHD"].dpsGrowthRate).toBeCloseTo(0.1);
  });
});

// ── enrichPlan — portfolio metrics ───────────────────────────────────────────

describe("enrichPlan — portfolio", () => {
  it("empty payments returns zero income and empty tickers", () => {
    const { portfolio } = enrichPlan(makePlan([]));
    expect(portfolio.totalAnnualIncome).toBe(0);
    expect(portfolio.allTickers).toEqual([]);
    expect(portfolio.paymentCount).toBe(0);
  });

  it("allTickers is sorted alphabetically", () => {
    const plan = makePlan([
      makePayment({ ticker: "O" }),
      makePayment({ ticker: "SCHD" }),
      makePayment({ ticker: "ABBV" }),
    ]);
    const { portfolio } = enrichPlan(plan);
    expect(portfolio.allTickers).toEqual(["ABBV", "O", "SCHD"]);
  });

  it("totalAnnualIncome includes only payments in trailing 12 months", () => {
    const now = new Date();
    const recentDate = new Date(now);
    recentDate.setMonth(recentDate.getMonth() - 3);
    const oldDate = new Date(now);
    oldDate.setFullYear(oldDate.getFullYear() - 2);

    const plan = makePlan([
      makePayment({ amount: 200, date: recentDate.toISOString().slice(0, 10) }),
      makePayment({ amount: 999, date: oldDate.toISOString().slice(0, 10) }),
    ]);
    const { portfolio } = enrichPlan(plan);
    expect(portfolio.totalAnnualIncome).toBe(200);
  });

  it("paymentCount reflects total number of payments", () => {
    const plan = makePlan([makePayment({}), makePayment({}), makePayment({})]);
    const { portfolio } = enrichPlan(plan);
    expect(portfolio.paymentCount).toBe(3);
  });
});

// ── prepareBatchImport ────────────────────────────────────────────────────────

describe("prepareBatchImport", () => {
  it("imports valid rows", () => {
    const { toAdd, skipped } = prepareBatchImport(
      [{ ticker: "SCHD", date: "2024-01-15", amount: 100 }],
      []
    );
    expect(toAdd).toHaveLength(1);
    expect(toAdd[0]).toEqual({ ticker: "SCHD", date: "2024-01-15", amount: 100 });
    expect(skipped).toBe(0);
  });

  it("normalises ticker to uppercase and trims whitespace", () => {
    const { toAdd } = prepareBatchImport(
      [{ ticker: " schd ", date: "2024-01-15", amount: 50 }],
      []
    );
    expect(toAdd[0].ticker).toBe("SCHD");
  });

  it("truncates date to YYYY-MM-DD", () => {
    const { toAdd } = prepareBatchImport(
      [{ ticker: "SCHD", date: "2024-01-15T00:00:00.000Z", amount: 50 }],
      []
    );
    expect(toAdd[0].date).toBe("2024-01-15");
  });

  it("skips rows with missing ticker", () => {
    const { toAdd, skipped } = prepareBatchImport(
      [{ ticker: "", date: "2024-01-15", amount: 100 }],
      []
    );
    expect(toAdd).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it("skips rows with missing date", () => {
    const { toAdd, skipped } = prepareBatchImport(
      [{ ticker: "SCHD", date: "", amount: 100 }],
      []
    );
    expect(toAdd).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it("skips rows with zero amount", () => {
    const { toAdd, skipped } = prepareBatchImport(
      [{ ticker: "SCHD", date: "2024-01-15", amount: 0 }],
      []
    );
    expect(toAdd).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it("skips rows with negative amount", () => {
    const { toAdd, skipped } = prepareBatchImport(
      [{ ticker: "SCHD", date: "2024-01-15", amount: -50 }],
      []
    );
    expect(toAdd).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it("skips rows that duplicate existing payments by ticker+date", () => {
    const existing = [{ ticker: "SCHD", date: "2024-01-15", amount: 100 }];
    const { toAdd, skipped } = prepareBatchImport(
      [{ ticker: "SCHD", date: "2024-01-15", amount: 200 }],
      existing
    );
    expect(toAdd).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it("deduplicates within the batch itself", () => {
    const { toAdd, skipped } = prepareBatchImport(
      [
        { ticker: "SCHD", date: "2024-01-15", amount: 100 },
        { ticker: "SCHD", date: "2024-01-15", amount: 100 },
      ],
      []
    );
    expect(toAdd).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it("allows same ticker on different dates", () => {
    const { toAdd, skipped } = prepareBatchImport(
      [
        { ticker: "SCHD", date: "2024-01-15", amount: 100 },
        { ticker: "SCHD", date: "2024-04-15", amount: 105 },
      ],
      []
    );
    expect(toAdd).toHaveLength(2);
    expect(skipped).toBe(0);
  });

  it("allows same date for different tickers", () => {
    const { toAdd } = prepareBatchImport(
      [
        { ticker: "SCHD", date: "2024-01-15", amount: 100 },
        { ticker: "VTI", date: "2024-01-15", amount: 50 },
      ],
      []
    );
    expect(toAdd).toHaveLength(2);
  });

  it("handles null/undefined incoming gracefully", () => {
    const { toAdd, skipped } = prepareBatchImport(null, []);
    expect(toAdd).toHaveLength(0);
    expect(skipped).toBe(0);
  });

  it("handles null existingPayments gracefully", () => {
    const { toAdd } = prepareBatchImport(
      [{ ticker: "SCHD", date: "2024-01-15", amount: 100 }],
      null
    );
    expect(toAdd).toHaveLength(1);
  });
});
