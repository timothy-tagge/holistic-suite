import { describe, it, expect } from "vitest";
import { randomNormal, percentile, computeYearlyBands } from "../monteCarlo.js";

// ── randomNormal ──────────────────────────────────────────────────────────────

describe("randomNormal", () => {
  it("produces samples with approximately the correct mean", () => {
    const samples = Array.from({ length: 5000 }, () => randomNormal(100, 15));
    const mean = samples.reduce((s, x) => s + x, 0) / samples.length;
    expect(mean).toBeGreaterThan(95);
    expect(mean).toBeLessThan(105);
  });

  it("produces samples with approximately the correct standard deviation", () => {
    const n = 5000;
    const mean = 0;
    const stdDev = 1;
    const samples = Array.from({ length: n }, () => randomNormal(mean, stdDev));
    const actualMean = samples.reduce((s, x) => s + x, 0) / n;
    const variance = samples.reduce((s, x) => s + (x - actualMean) ** 2, 0) / n;
    expect(Math.sqrt(variance)).toBeGreaterThan(0.9);
    expect(Math.sqrt(variance)).toBeLessThan(1.1);
  });

  it("returns the mean when stdDev is 0", () => {
    // Box-Muller with stdDev=0 always returns mean
    expect(randomNormal(42, 0)).toBe(42);
  });
});

// ── percentile ────────────────────────────────────────────────────────────────

describe("percentile", () => {
  const arr = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  // Implementation uses floor(p × n) indexing.
  // For n=10: p=0.1 → index 1 → 20, p=0.5 → index 5 → 60, p=1.0 → index 9 (clamped) → 100.
  it("returns the value at floor(p × n) for p=0.1", () => {
    expect(percentile(arr, 0.1)).toBe(20);
  });

  it("returns the value at floor(p × n) for p=0.5", () => {
    expect(percentile(arr, 0.5)).toBe(60);
  });

  it("returns the maximum at p=1.0", () => {
    expect(percentile(arr, 1.0)).toBe(100);
  });

  it("does not mutate the original array", () => {
    const original = [5, 3, 1, 4, 2];
    percentile(original, 0.5);
    expect(original).toEqual([5, 3, 1, 4, 2]);
  });

  it("handles an unsorted input array", () => {
    const unsorted = [50, 10, 90, 30, 70];
    expect(percentile(unsorted, 0.1)).toBe(10);
    expect(percentile(unsorted, 1.0)).toBe(90);
  });
});

// ── computeYearlyBands ────────────────────────────────────────────────────────

describe("computeYearlyBands", () => {
  it("returns one band object per year", () => {
    const years = [2024, 2025, 2026];
    const balancesByYear = [
      Array.from({ length: 100 }, (_, i) => i),
      Array.from({ length: 100 }, (_, i) => i * 2),
      Array.from({ length: 100 }, (_, i) => i * 3),
    ];
    const bands = computeYearlyBands(years, balancesByYear);
    expect(bands).toHaveLength(3);
    expect(bands[0].year).toBe(2024);
    expect(bands[1].year).toBe(2025);
  });

  it("each band has the required fields", () => {
    const years = [2024];
    const balancesByYear = [Array.from({ length: 100 }, (_, i) => i)];
    const [band] = computeYearlyBands(years, balancesByYear);
    expect(band).toHaveProperty("p10");
    expect(band).toHaveProperty("p25");
    expect(band).toHaveProperty("p50");
    expect(band).toHaveProperty("p75");
    expect(band).toHaveProperty("p90");
    expect(band).toHaveProperty("bandBase");
    expect(band).toHaveProperty("bandWidth");
  });

  it("bandBase equals p10 and bandWidth equals p90 - p10", () => {
    const years = [2024];
    const balancesByYear = [Array.from({ length: 100 }, (_, i) => i)];
    const [band] = computeYearlyBands(years, balancesByYear);
    expect(band.bandBase).toBe(band.p10);
    expect(band.bandWidth).toBeCloseTo(band.p90 - band.p10, 5);
  });

  it("percentiles are in ascending order", () => {
    const years = [2024];
    const balancesByYear = [Array.from({ length: 1000 }, () => Math.random() * 1000)];
    const [band] = computeYearlyBands(years, balancesByYear);
    expect(band.p10).toBeLessThanOrEqual(band.p25);
    expect(band.p25).toBeLessThanOrEqual(band.p50);
    expect(band.p50).toBeLessThanOrEqual(band.p75);
    expect(band.p75).toBeLessThanOrEqual(band.p90);
  });

  it("bandWidth is 0 when all values are equal", () => {
    const years = [2024];
    const balancesByYear = [Array(100).fill(500)];
    const [band] = computeYearlyBands(years, balancesByYear);
    expect(band.bandWidth).toBe(0);
  });
});
