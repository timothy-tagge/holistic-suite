/**
 * Alts projection math — pure functions, no Firebase or React dependencies.
 * All functions accept enriched investment objects (from enrichPlan).
 */

/** Parse the 4-digit year from an ISO date string without timezone side effects. */
function yearFromISO(isoDate) {
  return parseInt(isoDate.split("-")[0], 10);
}

/**
 * Total projected distributions an investment will pay over its entire hold period.
 * Requires: projectedCashOnCash, cocStartDate, metrics.projectedExitYear.
 */
export function calcInvTotalProjectedDist(inv) {
  if (!inv.projectedCashOnCash || !inv.cocStartDate || !inv.metrics?.projectedExitYear) return 0;
  const cocStartYear = yearFromISO(inv.cocStartDate);
  const exitYear = inv.metrics.projectedExitYear;
  let total = 0;
  for (let y = cocStartYear; y < exitYear; y++) {
    const n = y - cocStartYear;
    total += inv.committed * inv.projectedCashOnCash * Math.pow(1 + (inv.cocGrowthRate ?? 0), n);
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
    total += inv.committed * inv.projectedCashOnCash * Math.pow(1 + (inv.cocGrowthRate ?? 0), n);
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
    : inv.vintage ?? null;
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
 * Each row: { year, distributions, exitProceeds, portfolioNAV, cumulative }
 *   distributions  — projected annual cash yield (income)
 *   exitProceeds   — estimated capital return at exit (IRR-based)
 *   portfolioNAV   — total paper value of all active investments at year-end
 *   cumulative     — running total of all cash received (distributions + exits)
 */
export function buildProjection(investments, referenceYear) {
  if (!investments?.length) return [];
  const currentYear = referenceYear ?? new Date().getFullYear();
  const active = investments.filter(inv => inv.status === "active");
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

    for (const inv of active) {
      const cocStartYear = inv.cocStartDate ? yearFromISO(inv.cocStartDate) : null;
      const exitYear = inv.metrics?.projectedExitYear ?? null;

      // Annual distributions
      if (
        inv.projectedCashOnCash != null &&
        cocStartYear != null &&
        year >= cocStartYear &&
        (exitYear == null || year < exitYear)
      ) {
        const n = year - cocStartYear;
        distributions += inv.committed * inv.projectedCashOnCash
          * Math.pow(1 + (inv.cocGrowthRate ?? 0), n);
      }

      // Exit proceeds
      if (exitYear && year === exitYear) {
        if (inv.projectedIRR != null && inv.projectedHoldYears != null) {
          const multiple = Math.pow(1 + inv.projectedIRR, inv.projectedHoldYears);
          const totalProjDist = calcInvTotalProjectedDist(inv);
          exitProceeds += Math.max(0, inv.committed * multiple - totalProjDist);
        } else {
          exitProceeds += inv.committed;
        }
      }

      // NAV (paper value of this investment at year-end)
      portfolioNAV += calcInvProjectedNAV(inv, year);
    }

    cumulative += distributions + exitProceeds;

    // Include every year from currentYear forward so the NAV line is continuous,
    // even in years with no cash events.
    rows.push({
      year,
      distributions: Math.round(distributions),
      exitProceeds: Math.round(exitProceeds),
      portfolioNAV: Math.round(portfolioNAV),
      cumulative: Math.round(cumulative),
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
