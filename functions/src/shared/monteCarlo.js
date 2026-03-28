/**
 * Shared Monte Carlo statistical utilities.
 * Used by all modules that need probabilistic projections.
 */

/**
 * Box-Muller transform — generates a normally distributed random number.
 */
export function randomNormal(mean, stdDev) {
  const u1 = Math.random();
  const u2 = Math.random();
  return mean + stdDev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Returns the p-th percentile of a numeric array (0 < p <= 1).
 * Mutates a copy — does not modify the original array.
 */
export function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(Math.floor(p * sorted.length), sorted.length - 1)];
}

/**
 * Given a 2D array of simulation values indexed by year (balancesByYear[yearIndex][simIndex]),
 * returns an array of band objects suitable for a Recharts stacked Area fan chart.
 *
 * Each object: { year, p10, p25, p50, p75, p90, bandBase, bandWidth }
 *   - bandBase: invisible base for the stacked Area trick (= p10)
 *   - bandWidth: the shaded region height (= p90 - p10)
 */
export function computeYearlyBands(years, balancesByYear) {
  return years.map((year, i) => {
    const vals = balancesByYear[i];
    const p10 = percentile(vals, 0.1);
    const p90 = percentile(vals, 0.9);
    return {
      year,
      p10,
      p25: percentile(vals, 0.25),
      p50: percentile(vals, 0.5),
      p75: percentile(vals, 0.75),
      p90,
      bandBase: p10,
      bandWidth: Math.max(0, p90 - p10),
    };
  });
}
