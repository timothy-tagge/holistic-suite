/**
 * Sample Alts datasets for manual testing and integration test fixtures.
 *
 * Each profile is a self-contained snapshot:  investments + cash flows.
 * Dates are computed relative to `referenceYear` so the projections stay
 * meaningful regardless of when the sample is loaded.
 *
 * Usage (UI):  getAltsSamples()                — current year
 * Usage (tests): getAltsSamples(2024)          — deterministic
 */
export function getAltsSamples(referenceYear = new Date().getFullYear()) {
  const yr = referenceYear;

  return [
    // ── Profile 1 — Conservative Income ──────────────────────────────────────
    {
      id: "conservative-income",
      label: "Conservative Income",
      description:
        "Private credit and real estate — quarterly distributions, predictable exits. " +
        "8–14% projected IRR.",
      investmentCount: 3,
      investments: [
        {
          name: "Skyline Private Credit Fund II",
          investmentType: "private-credit",
          sponsor: "Skyline Capital",
          vintage: yr - 2,
          committed: 50000,
          projectedIRR: 0.1,
          projectedCashOnCash: 0.09,
          cocStartDate: `${yr - 2}-03-01`,
          projectedHoldYears: 3,
          cocGrowthRate: 0,
          preferredReturn: 0.08,
          status: "active",
          cashFlows: [
            {
              date: `${yr - 2}-03-15`,
              type: "call",
              amount: 50000,
              note: "Initial capital call",
            },
            {
              date: `${yr - 2}-06-30`,
              type: "distribution-income",
              amount: 1125,
              note: "Q1 distribution",
            },
            {
              date: `${yr - 2}-09-30`,
              type: "distribution-income",
              amount: 1125,
              note: "Q2 distribution",
            },
            {
              date: `${yr - 2}-12-31`,
              type: "distribution-income",
              amount: 1125,
              note: "Q3 distribution",
            },
            {
              date: `${yr - 1}-03-31`,
              type: "distribution-income",
              amount: 1125,
              note: "Q4 distribution",
            },
          ],
        },
        {
          name: "Ashcroft Multifamily Value-Add V",
          investmentType: "real-estate",
          realEstateNiche: "multifamily",
          sponsor: "Ashcroft Capital",
          vintage: yr - 3,
          committed: 100000,
          projectedIRR: 0.14,
          projectedCashOnCash: 0.08,
          cocStartDate: `${yr - 3}-07-01`,
          projectedHoldYears: 5,
          cocGrowthRate: 0.02,
          preferredReturn: 0.08,
          status: "active",
          cashFlows: [
            {
              date: `${yr - 3}-07-10`,
              type: "call",
              amount: 100000,
              note: "Full equity commitment",
            },
            {
              date: `${yr - 3}-12-31`,
              type: "distribution-income",
              amount: 2000,
              note: "H2 distribution",
            },
            {
              date: `${yr - 2}-06-30`,
              type: "distribution-income",
              amount: 4000,
              note: "H1 distribution",
            },
            {
              date: `${yr - 2}-12-31`,
              type: "distribution-income",
              amount: 4080,
              note: "H2 distribution",
            },
            {
              date: `${yr - 1}-06-30`,
              type: "distribution-income",
              amount: 4162,
              note: "H1 distribution",
            },
            {
              date: `${yr - 1}-12-31`,
              type: "distribution-income",
              amount: 4245,
              note: "H2 distribution",
            },
          ],
        },
        {
          name: "National Self-Storage Portfolio III",
          investmentType: "real-estate",
          realEstateNiche: "self-storage",
          sponsor: "National Storage Partners",
          vintage: yr - 1,
          committed: 75000,
          projectedIRR: 0.12,
          projectedCashOnCash: 0.07,
          cocStartDate: `${yr - 1}-04-01`,
          projectedHoldYears: 4,
          cocGrowthRate: 0.01,
          preferredReturn: 0.07,
          status: "active",
          cashFlows: [
            {
              date: `${yr - 1}-04-15`,
              type: "call",
              amount: 75000,
              note: "Initial capital call",
            },
            {
              date: `${yr - 1}-12-31`,
              type: "distribution-income",
              amount: 2625,
              note: "First distribution (9 months)",
            },
          ],
        },
      ],
    },

    // ── Profile 2 — Growth PE / VC ────────────────────────────────────────────
    {
      id: "growth-pe-vc",
      label: "Growth PE / VC",
      description:
        "Private equity and venture capital — high upside, minimal current income, " +
        "long hold periods. 18–25% projected IRR.",
      investmentCount: 3,
      investments: [
        {
          name: "Summit Growth Partners VII",
          investmentType: "private-equity",
          sponsor: "Summit Partners",
          vintage: yr - 3,
          committed: 250000,
          projectedIRR: 0.2,
          projectedCashOnCash: 0.03,
          cocStartDate: `${yr - 3}-01-01`,
          projectedHoldYears: 6,
          cocGrowthRate: 0,
          preferredReturn: 0.08,
          status: "active",
          cashFlows: [
            {
              date: `${yr - 3}-02-01`,
              type: "call",
              amount: 125000,
              note: "First capital call (50%)",
            },
            {
              date: `${yr - 3}-08-01`,
              type: "call",
              amount: 125000,
              note: "Second capital call (50%)",
            },
            {
              date: `${yr - 2}-12-31`,
              type: "distribution-income",
              amount: 7500,
              note: "Annual distribution",
            },
            {
              date: `${yr - 1}-12-31`,
              type: "distribution-income",
              amount: 7500,
              note: "Annual distribution",
            },
          ],
        },
        {
          name: "Founders Fund XI",
          investmentType: "venture-capital",
          sponsor: "Founders Fund",
          vintage: yr - 2,
          committed: 100000,
          projectedIRR: 0.25,
          projectedCashOnCash: null,
          cocStartDate: null,
          projectedHoldYears: 8,
          cocGrowthRate: null,
          preferredReturn: null,
          status: "active",
          cashFlows: [
            { date: `${yr - 2}-06-01`, type: "call", amount: 50000, note: "First close" },
            {
              date: `${yr - 1}-06-01`,
              type: "call",
              amount: 50000,
              note: "Second close",
            },
          ],
        },
        {
          name: "Horizon Growth Equity III",
          investmentType: "private-equity",
          sponsor: "Horizon Capital",
          vintage: yr - 1,
          committed: 150000,
          projectedIRR: 0.18,
          projectedCashOnCash: 0.02,
          cocStartDate: `${yr - 1}-04-01`,
          projectedHoldYears: 5,
          cocGrowthRate: 0,
          preferredReturn: 0.08,
          status: "active",
          cashFlows: [
            {
              date: `${yr - 1}-04-15`,
              type: "call",
              amount: 150000,
              note: "Full commitment funded",
            },
          ],
        },
      ],
    },

    // ── Profile 3 — Mixed Portfolio with Realized Exit ────────────────────────
    {
      id: "mixed-with-exit",
      label: "Diversified + Realized Exit",
      description:
        "A mix of real estate, private credit, and energy with one fully realized " +
        "investment showing actual exit proceeds. Good for testing total value carry-through.",
      investmentCount: 4,
      investments: [
        {
          // Fully realized — exit proceeds recorded as actual CF
          name: "Paceline Senior Credit Fund I",
          investmentType: "private-credit",
          sponsor: "Paceline Equity Partners",
          vintage: yr - 5,
          committed: 75000,
          projectedIRR: 0.11,
          projectedCashOnCash: 0.09,
          cocStartDate: `${yr - 5}-01-01`,
          projectedHoldYears: 3,
          cocGrowthRate: 0,
          preferredReturn: 0.08,
          status: "realized",
          cashFlows: [
            {
              date: `${yr - 5}-01-15`,
              type: "call",
              amount: 75000,
              note: "Full capital call",
            },
            {
              date: `${yr - 5}-06-30`,
              type: "distribution-income",
              amount: 1688,
              note: "Q1-Q2 distribution",
            },
            {
              date: `${yr - 5}-12-31`,
              type: "distribution-income",
              amount: 1688,
              note: "Q3-Q4 distribution",
            },
            {
              date: `${yr - 4}-06-30`,
              type: "distribution-income",
              amount: 1688,
              note: "H1 distribution",
            },
            {
              date: `${yr - 4}-12-31`,
              type: "distribution-income",
              amount: 1688,
              note: "H2 distribution",
            },
            {
              date: `${yr - 3}-06-30`,
              type: "distribution-income",
              amount: 1688,
              note: "H1 distribution",
            },
            {
              date: `${yr - 3}-09-30`,
              type: "exit",
              amount: 95000,
              note: "Exit proceeds (1.27× MOIC)",
            },
          ],
        },
        {
          name: "BluePeak Real Estate Partners II",
          investmentType: "real-estate",
          realEstateNiche: "multifamily",
          sponsor: "BluePeak Capital",
          vintage: yr - 2,
          committed: 100000,
          projectedIRR: 0.15,
          projectedCashOnCash: 0.08,
          cocStartDate: `${yr - 2}-06-01`,
          projectedHoldYears: 5,
          cocGrowthRate: 0.02,
          preferredReturn: 0.08,
          status: "active",
          cashFlows: [
            {
              date: `${yr - 2}-06-15`,
              type: "call",
              amount: 100000,
              note: "Equity commitment",
            },
            {
              date: `${yr - 2}-12-31`,
              type: "distribution-income",
              amount: 2667,
              note: "H2 distribution (7 months)",
            },
            {
              date: `${yr - 1}-06-30`,
              type: "distribution-income",
              amount: 4000,
              note: "H1 distribution",
            },
            {
              date: `${yr - 1}-12-31`,
              type: "distribution-income",
              amount: 4080,
              note: "H2 distribution",
            },
          ],
        },
        {
          name: "Energy Income Trust II",
          investmentType: "energy",
          sponsor: "Ironwood Energy",
          vintage: yr - 2,
          committed: 100000,
          projectedIRR: 0.13,
          projectedCashOnCash: 0.1,
          cocStartDate: `${yr - 2}-01-01`,
          projectedHoldYears: 4,
          cocGrowthRate: 0,
          preferredReturn: 0.08,
          status: "active",
          cashFlows: [
            {
              date: `${yr - 2}-01-20`,
              type: "call",
              amount: 100000,
              note: "Full capital call",
            },
            {
              date: `${yr - 2}-06-30`,
              type: "distribution-income",
              amount: 5000,
              note: "H1 distribution",
            },
            {
              date: `${yr - 2}-12-31`,
              type: "distribution-income",
              amount: 5000,
              note: "H2 distribution",
            },
            {
              date: `${yr - 1}-06-30`,
              type: "distribution-income",
              amount: 5000,
              note: "H1 distribution",
            },
            {
              date: `${yr - 1}-12-31`,
              type: "distribution-income",
              amount: 5000,
              note: "H2 distribution",
            },
          ],
        },
        {
          name: "HarbourView PE Fund III",
          investmentType: "private-equity",
          sponsor: "HarbourView Capital",
          vintage: yr - 1,
          committed: 200000,
          projectedIRR: 0.19,
          projectedCashOnCash: 0.02,
          cocStartDate: `${yr - 1}-01-01`,
          projectedHoldYears: 6,
          cocGrowthRate: 0,
          preferredReturn: 0.08,
          status: "active",
          cashFlows: [
            {
              date: `${yr - 1}-01-15`,
              type: "call",
              amount: 100000,
              note: "First call (50%)",
            },
            {
              date: `${yr - 1}-07-01`,
              type: "call",
              amount: 100000,
              note: "Second call (50%)",
            },
          ],
        },
      ],
    },

    // ── Profile 4 — My Portfolio ──────────────────────────────────────────────
    {
      id: "my-portfolio",
      label: "My Portfolio",
      description:
        "Development, multifamily value-add, energy, and private credit. " +
        "Staggered capital calls across 2025–2026. High-conviction, long-hold positions.",
      investmentCount: 4,
      investments: [
        {
          name: "AHM",
          investmentType: "real-estate",
          realEstateNiche: "development",
          sponsor: "AHM",
          vintage: yr - 1,
          committed: 50000,
          projectedIRR: 0.22,
          projectedCashOnCash: null,
          cocStartDate: null,
          projectedHoldYears: 7,
          cocGrowthRate: null,
          preferredReturn: 0.08,
          status: "active",
          cashFlows: [
            {
              date: `${yr - 1}-04-15`,
              type: "call",
              amount: 50000,
              note: "Full capital call",
            },
          ],
        },
        {
          name: "CIG Fund II",
          investmentType: "real-estate",
          realEstateNiche: "multifamily",
          sponsor: "CIG",
          vintage: yr - 1,
          committed: 100000,
          projectedIRR: 0.26,
          projectedCashOnCash: 0.06,
          cocStartDate: `${yr}-01-01`,
          projectedHoldYears: 5,
          cocGrowthRate: 0,
          preferredReturn: 0.08,
          status: "active",
          cashFlows: [
            {
              date: `${yr - 1}-09-01`,
              type: "call",
              amount: 20000,
              note: "First capital call",
            },
            {
              date: `${yr}-02-15`,
              type: "call",
              amount: 27000,
              note: "Second capital call",
            },
          ],
        },
        {
          name: "Aspen Energy",
          investmentType: "energy",
          sponsor: "Aspen",
          vintage: yr - 1,
          committed: 100000,
          projectedIRR: 0.28,
          projectedCashOnCash: 0.1,
          cocStartDate: `${yr + 1}-01-01`,
          projectedHoldYears: 10,
          cocGrowthRate: 0,
          preferredReturn: 0.08,
          status: "active",
          cashFlows: [
            {
              date: `${yr - 1}-03-01`,
              type: "call",
              amount: 100000,
              note: "Full capital call",
            },
          ],
        },
        {
          name: "Aspen Private Credit",
          investmentType: "private-credit",
          sponsor: "Aspen",
          vintage: yr - 1,
          committed: 50000,
          projectedIRR: 0.105,
          projectedCashOnCash: 0.105,
          cocStartDate: `${yr - 1}-06-01`,
          projectedHoldYears: 2,
          cocGrowthRate: 0,
          preferredReturn: 0.08,
          status: "active",
          cashFlows: [
            {
              date: `${yr - 1}-06-01`,
              type: "call",
              amount: 50000,
              note: "Full capital call",
            },
          ],
        },
      ],
    },
  ];
}
