import { describe, it, expect } from "vitest";
import { formatWithCommas, parseFormatted } from "../../lib/formatNumber.js";

// ── formatWithCommas ──────────────────────────────────────────────────────────

describe("formatWithCommas", () => {
  it("returns empty string for empty/null/undefined input", () => {
    expect(formatWithCommas("")).toBe("");
    expect(formatWithCommas(null)).toBe("");
    expect(formatWithCommas(undefined)).toBe("");
  });

  it("formats thousands", () => {
    expect(formatWithCommas("1000")).toBe("1,000");
    expect(formatWithCommas("10000")).toBe("10,000");
    expect(formatWithCommas("100000")).toBe("100,000");
    expect(formatWithCommas("1000000")).toBe("1,000,000");
  });

  it("does not add comma to numbers below 1000", () => {
    expect(formatWithCommas("999")).toBe("999");
    expect(formatWithCommas("42")).toBe("42");
  });

  it("preserves a trailing decimal point", () => {
    expect(formatWithCommas("1000.")).toBe("1,000.");
  });

  it("preserves decimal digits", () => {
    expect(formatWithCommas("1234.56")).toBe("1,234.56");
    expect(formatWithCommas("1000000.5")).toBe("1,000,000.5");
  });

  it("strips existing commas before reformatting", () => {
    expect(formatWithCommas("1,000")).toBe("1,000");
    expect(formatWithCommas("1,000,000")).toBe("1,000,000");
  });

  it("returns input as-is for invalid (non-numeric) input", () => {
    expect(formatWithCommas("abc")).toBe("abc");
    expect(formatWithCommas("12.34.56")).toBe("12.34.56");
  });

  it("accepts numbers and converts to string", () => {
    expect(formatWithCommas(50000)).toBe("50,000");
  });
});

// ── parseFormatted ────────────────────────────────────────────────────────────

describe("parseFormatted", () => {
  it("returns 0 for empty/null/undefined", () => {
    expect(parseFormatted("")).toBe(0);
    expect(parseFormatted(null)).toBe(0);
    expect(parseFormatted(undefined)).toBe(0);
  });

  it("strips commas and parses to a float", () => {
    expect(parseFormatted("1,234")).toBe(1234);
    expect(parseFormatted("1,000,000")).toBe(1000000);
  });

  it("handles decimal values", () => {
    expect(parseFormatted("1,234.56")).toBeCloseTo(1234.56, 5);
  });

  it("handles plain numbers without commas", () => {
    expect(parseFormatted("42")).toBe(42);
    expect(parseFormatted("3.14")).toBeCloseTo(3.14, 5);
  });

  it("returns 0 for non-numeric strings", () => {
    expect(parseFormatted("abc")).toBe(0);
    expect(parseFormatted("$1,000")).toBe(0); // $ is not stripped
  });
});
