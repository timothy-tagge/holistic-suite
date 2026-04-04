import { describe, it, expect } from "vitest";
import { buildMonthlyChartData, buildAnnualChartData } from "../dividendsChart.js";

const p = (ticker, date, amount, accountId = null) => ({
  ticker,
  date,
  amount,
  accountId,
});

describe("buildMonthlyChartData", () => {
  it("returns 12 months with no payments", () => {
    const { data, years } = buildMonthlyChartData([]);
    expect(data).toHaveLength(12);
    expect(data[0].month).toBe("Jan");
    expect(data[11].month).toBe("Dec");
    expect(years).toHaveLength(0);
  });

  it("detects unique years from payments", () => {
    const { years } = buildMonthlyChartData([
      p("SCHD", "2024-01-15", 100),
      p("SCHD", "2025-01-15", 110),
    ]);
    expect(years).toEqual([2024, 2025]);
  });

  it("years are sorted ascending", () => {
    const { years } = buildMonthlyChartData([
      p("SCHD", "2025-01-15", 110),
      p("SCHD", "2024-01-15", 100),
    ]);
    expect(years).toEqual([2024, 2025]);
  });

  it("accumulates payments into correct month slot", () => {
    const { data } = buildMonthlyChartData([p("SCHD", "2024-03-15", 200)]);
    expect(data[2]["2024"]).toBeCloseTo(200); // March = index 2
  });

  it("sums multiple payments in the same month+year", () => {
    const { data } = buildMonthlyChartData([
      p("SCHD", "2024-01-10", 100),
      p("VTI", "2024-01-20", 50),
    ]);
    expect(data[0]["2024"]).toBeCloseTo(150);
  });

  it("keeps different years in separate columns", () => {
    const { data } = buildMonthlyChartData([
      p("SCHD", "2024-01-15", 100),
      p("SCHD", "2025-01-15", 120),
    ]);
    expect(data[0]["2024"]).toBeCloseTo(100);
    expect(data[0]["2025"]).toBeCloseTo(120);
  });

  it("months with no payments default to 0", () => {
    const { data } = buildMonthlyChartData([p("SCHD", "2024-06-15", 100)]);
    expect(data[0]["2024"]).toBe(0); // Jan
    expect(data[11]["2024"]).toBe(0); // Dec
    expect(data[5]["2024"]).toBeCloseTo(100); // Jun
  });

  it("filters by ticker", () => {
    const { data, years } = buildMonthlyChartData(
      [p("SCHD", "2024-01-15", 100), p("VTI", "2024-01-20", 50)],
      "SCHD"
    );
    expect(data[0]["2024"]).toBeCloseTo(100);
    expect(years).toEqual([2024]);
  });

  it("filter by ticker excludes other tickers entirely", () => {
    const { data } = buildMonthlyChartData([p("VTI", "2024-01-15", 50)], "SCHD");
    expect((years) => years).toBeDefined();
    // VTI payment should not appear; year 2024 won't even be a column
    expect(data[0]["2024"]).toBeUndefined();
  });

  it("filters by account", () => {
    const { data } = buildMonthlyChartData(
      [p("SCHD", "2024-01-15", 100, "acc1"), p("SCHD", "2024-01-20", 50, "acc2")],
      null,
      "acc1"
    );
    expect(data[0]["2024"]).toBeCloseTo(100);
  });

  it("filters by both ticker and account", () => {
    const { data } = buildMonthlyChartData(
      [
        p("SCHD", "2024-01-15", 100, "acc1"),
        p("SCHD", "2024-01-20", 50, "acc2"),
        p("VTI", "2024-01-25", 75, "acc1"),
      ],
      "SCHD",
      "acc1"
    );
    expect(data[0]["2024"]).toBeCloseTo(100);
  });

  it("handles null payments array gracefully", () => {
    const { data, years } = buildMonthlyChartData(null);
    expect(data).toHaveLength(12);
    expect(years).toHaveLength(0);
  });

  it("skips payments with invalid dates", () => {
    const { years } = buildMonthlyChartData([
      { ticker: "SCHD", date: "invalid", amount: 100 },
    ]);
    expect(years).toHaveLength(0);
  });

  it("handles many years correctly", () => {
    const payments = [2021, 2022, 2023, 2024, 2025].map((y) =>
      p("SCHD", `${y}-06-15`, y * 10)
    );
    const { data, years } = buildMonthlyChartData(payments);
    expect(years).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(data[5]["2021"]).toBeCloseTo(2021 * 10);
    expect(data[5]["2025"]).toBeCloseTo(2025 * 10);
  });
});

// ── buildAnnualChartData ──────────────────────────────────────────────────────

describe("buildAnnualChartData", () => {
  it("returns empty array with no payments", () => {
    expect(buildAnnualChartData([])).toEqual([]);
  });

  it("sums all payments for a year", () => {
    const data = buildAnnualChartData([
      p("SCHD", "2024-01-15", 100),
      p("SCHD", "2024-06-15", 200),
    ]);
    expect(data).toHaveLength(1);
    expect(data[0].year).toBe("2024");
    expect(data[0].income).toBeCloseTo(300);
  });

  it("produces one entry per year, sorted ascending", () => {
    const data = buildAnnualChartData([
      p("SCHD", "2025-01-15", 120),
      p("SCHD", "2023-01-15", 80),
      p("SCHD", "2024-01-15", 100),
    ]);
    expect(data.map((d) => d.year)).toEqual(["2023", "2024", "2025"]);
  });

  it("filters by ticker", () => {
    const data = buildAnnualChartData(
      [p("SCHD", "2024-01-15", 100), p("VTI", "2024-01-15", 50)],
      "SCHD"
    );
    expect(data).toHaveLength(1);
    expect(data[0].income).toBeCloseTo(100);
  });

  it("filters by account", () => {
    const data = buildAnnualChartData(
      [p("SCHD", "2024-01-15", 100, "acc1"), p("SCHD", "2024-01-15", 50, "acc2")],
      null,
      "acc1"
    );
    expect(data[0].income).toBeCloseTo(100);
  });

  it("handles null payments gracefully", () => {
    expect(buildAnnualChartData(null)).toEqual([]);
  });

  it("skips payments with invalid dates", () => {
    const data = buildAnnualChartData([{ ticker: "SCHD", date: "bad", amount: 100 }]);
    expect(data).toHaveLength(0);
  });
});
