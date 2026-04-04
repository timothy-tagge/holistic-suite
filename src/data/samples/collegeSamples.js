/**
 * Sample College datasets for manual testing and integration test fixtures.
 *
 * Each profile maps directly to the `collegeSetup` API contract:
 * { children, totalSavings, annualReturn, monthlyContribution, inflationRate }
 *
 * Birth years are computed relative to `referenceYear` so projections stay
 * meaningful regardless of when the sample is loaded.
 *
 * Usage (UI):   getCollegeSamples()          — current year
 * Usage (tests): getCollegeSamples(2024)     — deterministic
 */
export function getCollegeSamples(referenceYear = new Date().getFullYear()) {
  const yr = referenceYear;

  return [
    // ── Profile 1 — Two Kids, Public Schools ─────────────────────────────────
    {
      id: "two-kids-public",
      label: "Two Kids — Public Schools",
      description:
        "Two children heading to public in-state universities, modest savings, " +
        "$500/month contribution. Tests the typical middle-class funding gap.",
      childCount: 2,
      payload: {
        children: [
          { name: "Emma", birthYear: yr - 8, costTier: "public-in-state" },
          { name: "Liam", birthYear: yr - 5, costTier: "public-in-state" },
        ],
        totalSavings: 35000,
        monthlyContribution: 500,
        annualReturn: 0.06,
        inflationRate: 0.03,
      },
    },

    // ── Profile 2 — Three Kids, Mixed Tiers ──────────────────────────────────
    {
      id: "three-kids-mixed",
      label: "Three Kids — Mixed Schools",
      description:
        "Three children at different cost tiers and ages. Oldest targets a private " +
        "school, youngest targets public. Tests staggered funding pressure.",
      childCount: 3,
      payload: {
        children: [
          { name: "Sophia", birthYear: yr - 14, costTier: "private" },
          { name: "Noah", birthYear: yr - 10, costTier: "public-out-of-state" },
          { name: "Olivia", birthYear: yr - 6, costTier: "public-in-state" },
        ],
        totalSavings: 120000,
        monthlyContribution: 1500,
        annualReturn: 0.07,
        inflationRate: 0.03,
      },
    },

    // ── Profile 3 — One Child, Elite School ──────────────────────────────────
    {
      id: "one-child-elite",
      label: "One Child — Elite School",
      description:
        "Single child targeting an elite institution ($85K/yr baseline). High " +
        "savings rate and lump-sum potential. Tests whether funding is achievable " +
        "with aggressive contributions.",
      childCount: 1,
      payload: {
        children: [{ name: "Ava", birthYear: yr - 4, costTier: "elite" }],
        totalSavings: 80000,
        monthlyContribution: 2500,
        annualReturn: 0.07,
        inflationRate: 0.035,
      },
    },
    // ── Profile 4 — My Plan ───────────────────────────────────────────────────
    {
      id: "my-plan",
      label: "My Plan",
      description:
        "Three children (2011, 2013, 2015) across public in-state, private, and public out-of-state. " +
        "$65K saved, annual lump sums 2026–2030 plus a large $250K contribution in 2028.",
      childCount: 3,
      payload: {
        children: [
          { name: "Child 1", birthYear: 2011, costTier: "public-in-state" },
          { name: "Child 2", birthYear: 2013, costTier: "private" },
          { name: "Child 3", birthYear: 2015, costTier: "public-out-of-state" },
        ],
        totalSavings: 65000,
        monthlyContribution: 0,
        annualReturn: 0.07,
        inflationRate: 0.035,
        lumpSums: [
          { year: 2026, amount: 40000, label: "Annual contribution" },
          { year: 2027, amount: 40000, label: "Annual contribution" },
          { year: 2028, amount: 40000, label: "Annual contribution" },
          { year: 2028, amount: 250000, label: "Large contribution" },
          { year: 2029, amount: 40000, label: "Annual contribution" },
          { year: 2030, amount: 40000, label: "Annual contribution" },
        ],
      },
    },
  ];
}
