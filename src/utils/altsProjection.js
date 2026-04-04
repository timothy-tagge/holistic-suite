/**
 * Alts projection math — pure functions, no Firebase or React dependencies.
 * All functions accept enriched investment objects (from enrichPlan).
 */

/** Parse the 4-digit year from an ISO date string without timezone side effects. */
function yearFromISO(isoDate) {
  return parseInt(isoDate.split("-")[0], 10);
}

/** Box-Muller transform — standard normal sample. */
function randomNormal() {
  let u, v;
  do {
    u = Math.random();
  } while (u === 0);
  do {
    v = Math.random();
  } while (v === 0);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Total projected distributions an investment will pay over its entire hold period.
 * Requires: projectedCashOnCash, cocStartDate, metrics.projectedExitYear.
 */
export function calcInvTotalProjectedDist(inv) {
  if (!inv.projectedCashOnCash || !inv.cocStartDate || !inv.metrics?.projectedExitYear)
    return 0;
  const cocStartYear = yearFromISO(inv.cocStartDate);
  const exitYear = inv.metrics.projectedExitYear;
  let total = 0;
  for (let y = cocStartYear; y < exitYear; y++) {
    const n = y - cocStartYear;
    total +=
      inv.committed * inv.projectedCashOnCash * Math.pow(1 + (inv.cocGrowthRate ?? 0), n);
  }
  return total;
}

/**
 * Cumulative projected distributions from an investment from cocStartDate through
 * (but not including) the given year. Used to compute NAV at a point in time.
 */
export function calcCumulativeProjectedDistToYear(inv, year) {
  if (!inv.projectedCashOnCash || !inv.cocStartDate) return 0;
  const cocStartYear = yearFromISO(inv.cocStartDate);
  const exitYear = inv.metrics?.projectedExitYear ?? Infinity;
  let total = 0;
  for (let y = cocStartYear; y < year && y < exitYear; y++) {
    const n = y - cocStartYear;
    total +=
      inv.committed * inv.projectedCashOnCash * Math.pow(1 + (inv.cocGrowthRate ?? 0), n);
  }
  return total;
}

/**
 * Projected NAV of a single investment at a given year.
 * Formula: committed × (1 + projectedIRR)^yearsHeld − cumulative distributions paid to date.
 * Returns 0 if the investment has exited or lacks IRR data.
 */
export function calcInvProjectedNAV(inv, year) {
  if (inv.projectedIRR == null || inv.committed == null) return 0;
  const exitYear = inv.metrics?.projectedExitYear ?? null;
  if (exitYear && year >= exitYear) return 0;

  // Base year for compounding: when capital was first deployed
  const baseYear = inv.cocStartDate
    ? yearFromISO(inv.cocStartDate)
    : (inv.vintage ?? null);
  if (baseYear == null) return 0;

  const yearsHeld = year - baseYear;
  if (yearsHeld < 0) return inv.committed; // before deployment, full committed is "at work"

  const grossValue = inv.committed * Math.pow(1 + inv.projectedIRR, yearsHeld);
  const cumDist = calcCumulativeProjectedDistToYear(inv, year);
  return Math.max(0, grossValue - cumDist);
}

/**
 * Builds a year-by-year projection table across all investments.
 * Returns rows only for years with meaningful data (distributions or exit events).
 *
 * Each row: { year, distributions, exitProceeds, portfolioNAV, cumulative, exits, exitLabel }
 *   distributions  — projected annual cash yield (income)
 *   exitProceeds   — estimated capital return at exit (IRR-based)
 *   portfolioNAV   — total paper value of all active investments at year-end
 *   cumulative     — running total of all cash received (distributions + exits)
 *   exits          — per-investment breakdown: [{ name, proceeds }]
 *   exitLabel      — display string for bar label: investment name or "N exits"
 */
export function buildProjection(investments, referenceYear) {
  if (!investments?.length) return [];
  const currentYear = referenceYear ?? new Date().getFullYear();
  const active = investments.filter((inv) => inv.status === "active");
  if (!active.length) return [];

  let maxYear = currentYear + 5;
  for (const inv of active) {
    const ey = inv.metrics?.projectedExitYear;
    if (ey && ey > maxYear) maxYear = ey;
  }

  let cumulative = 0;
  const rows = [];

  for (let year = currentYear; year <= maxYear; year++) {
    let distributions = 0;
    let exitProceeds = 0;
    let portfolioNAV = 0;
    const exits = [];
    const perInvDist = {};
    const perInvExit = {};

    for (const inv of active) {
      const cocStartYear = inv.cocStartDate ? yearFromISO(inv.cocStartDate) : null;
      const exitYear = inv.metrics?.projectedExitYear ?? null;

      // Annual distributions
      let invDist = 0;
      if (
        inv.projectedCashOnCash != null &&
        cocStartYear != null &&
        year >= cocStartYear &&
        (exitYear == null || year < exitYear)
      ) {
        const n = year - cocStartYear;
        invDist =
          inv.committed *
          inv.projectedCashOnCash *
          Math.pow(1 + (inv.cocGrowthRate ?? 0), n);
        distributions += invDist;
      }
      perInvDist[inv.id] = Math.round(invDist);

      // Exit proceeds — track per-investment for attribution
      let invExit = 0;
      if (exitYear && year === exitYear) {
        let proceeds;
        if (inv.projectedIRR != null && inv.projectedHoldYears != null) {
          const multiple = Math.pow(1 + inv.projectedIRR, inv.projectedHoldYears);
          const totalProjDist = calcInvTotalProjectedDist(inv);
          proceeds = Math.max(0, inv.committed * multiple - totalProjDist);
        } else {
          proceeds = inv.committed;
        }
        invExit = proceeds;
        exitProceeds += proceeds;
        exits.push({ name: inv.name, proceeds: Math.round(proceeds) });
      }
      perInvExit[inv.id] = Math.round(invExit);

      // NAV (paper value of this investment at year-end)
      portfolioNAV += calcInvProjectedNAV(inv, year);
    }

    cumulative += distributions + exitProceeds;

    const exitLabel =
      exits.length === 1
        ? exits[0].name
        : exits.length > 1
          ? `${exits.length} exits`
          : "";

    // Per-investment fields use prefixed keys so the chart can render one Bar per investment.
    const perInvFields = {};
    for (const inv of active) {
      perInvFields[`dist_${inv.id}`] = perInvDist[inv.id] ?? 0;
      perInvFields[`exit_${inv.id}`] = perInvExit[inv.id] ?? 0;
    }

    // totalValue = paper NAV + all cash received to date.
    // When an investment exits, its NAV drops to 0 and its proceeds enter cumulative —
    // the total value stays intact (cash is just a different form of the same value).
    const totalValue = portfolioNAV + cumulative;

    // Include every year from currentYear forward so the NAV line is continuous,
    // even in years with no cash events.
    rows.push({
      year,
      distributions: Math.round(distributions),
      exitProceeds: Math.round(exitProceeds),
      portfolioNAV: Math.round(portfolioNAV),
      cumulative: Math.round(cumulative),
      totalValue: Math.round(totalValue),
      exits,
      exitLabel,
      ...perInvFields,
    });
  }

  // Trim trailing zero rows (all zeros after last exit)
  while (rows.length > 1) {
    const last = rows[rows.length - 1];
    if (last.distributions === 0 && last.exitProceeds === 0 && last.portfolioNAV === 0) {
      rows.pop();
    } else {
      break;
    }
  }

  return rows;
}

/**
 * Monte Carlo projection — runs numSims simulations with jittered IRR and hold period,
 * returns year-by-year percentiles for the total value (NAV + cumulative cash).
 *
 * IRR is sampled from Normal(projectedIRR, σ) where σ = max(4pp, 35% of projected IRR).
 * Hold period is jittered ±2 years (uniform integer).
 *
 * Each row: { year, p10, p50, p90, bandHeight }
 *   bandHeight = p90 - p10, used for the stacked-Area confidence band in Recharts.
 *
 * @param {object[]} investments - enriched investment objects (from enrichPlan)
 * @param {number}   [referenceYear] - base year (defaults to current year)
 * @param {number}   [numSims=500]   - number of Monte Carlo simulations
 */
export function buildMonteCarloProjection(investments, referenceYear, numSims = 500) {
  if (!investments?.length) return [];
  const currentYear = referenceYear ?? new Date().getFullYear();
  const active = investments.filter((inv) => inv.status === "active");
  if (!active.length) return [];

  // Extend max year by 2 to absorb positive hold-period jitter.
  let maxYear = currentYear + 5;
  for (const inv of active) {
    const ey = inv.metrics?.projectedExitYear;
    if (ey && ey > maxYear) maxYear = ey + 2;
  }
  const years = [];
  for (let y = currentYear; y <= maxYear; y++) years.push(y);

  // Collect totalValue per sim per year.
  const simValues = Array.from({ length: numSims }, () =>
    new Array(years.length).fill(0)
  );

  for (let s = 0; s < numSims; s++) {
    const jittered = active.map((inv) => {
      // Jitter IRR (σ = max 4pp or 35% relative)
      const irr = inv.projectedIRR ?? 0.12;
      const sigma = Math.max(0.04, Math.abs(irr) * 0.35);
      const sampledIRR = Math.max(-0.5, Math.min(0.8, irr + randomNormal() * sigma));

      // Jitter hold years ±2 (uniform integer)
      const holdYears = inv.projectedHoldYears ?? 5;
      const exitJitter = Math.round((Math.random() - 0.5) * 4);
      const sampledHoldYears = Math.max(1, holdYears + exitJitter);

      // Recompute exit year from jittered hold period
      const baseYear = inv.cocStartDate
        ? yearFromISO(inv.cocStartDate)
        : (inv.vintage ?? null);
      const sampledExitYear =
        baseYear != null ? baseYear + sampledHoldYears : inv.metrics?.projectedExitYear;

      return {
        ...inv,
        projectedIRR: sampledIRR,
        projectedHoldYears: sampledHoldYears,
        metrics: { ...inv.metrics, projectedExitYear: sampledExitYear },
      };
    });

    const rows = buildProjection(jittered, currentYear);
    const rowMap = new Map(rows.map((r) => [r.year, r]));

    let lastValue = 0;
    years.forEach((year, i) => {
      const row = rowMap.get(year);
      if (row) {
        lastValue = row.totalValue;
        simValues[s][i] = lastValue;
      } else {
        // Carry forward: after exits the cash doesn't disappear.
        simValues[s][i] = lastValue;
      }
    });
  }

  // Compute percentiles per year.
  return years.map((year, i) => {
    const vals = simValues.map((sim) => sim[i]).sort((a, b) => a - b);
    const pct = (p) =>
      Math.round(vals[Math.min(numSims - 1, Math.floor(numSims * p))] ?? 0);
    const p10 = pct(0.1);
    const p50 = pct(0.5);
    const p90 = pct(0.9);
    return {
      year,
      p10,
      p50,
      p90,
      bandHeight: Math.max(0, p90 - p10),
    };
  });
}
