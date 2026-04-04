export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Groups dividend payments into a monthly grouped-bar chart dataset.
 *
 * Returns:
 *   data  — array of 12 objects, one per month:
 *           { month: "Jan", "2024": 123.45, "2025": 150.00, ... }
 *   years — sorted array of unique years present in the filtered payments
 *
 * Filtering:
 *   filterTicker  — when set, only includes payments for that ticker
 *   filterAccount — when set, only includes payments for that accountId
 */
export function buildMonthlyChartData(
  payments,
  filterTicker = null,
  filterAccount = null
) {
  const filtered = (payments ?? []).filter((p) => {
    if (filterTicker && p.ticker !== filterTicker) return false;
    if (filterAccount && p.accountId !== filterAccount) return false;
    return true;
  });

  const yearSet = new Set();
  for (const p of filtered) {
    const y = parseInt(p.date.split("-")[0], 10);
    if (!isNaN(y)) yearSet.add(y);
  }
  const years = [...yearSet].sort((a, b) => a - b);

  const data = MONTHS.map((month) => {
    const obj = { month };
    for (const y of years) obj[String(y)] = 0;
    return obj;
  });

  for (const p of filtered) {
    const parts = p.date.split("-");
    const year = parseInt(parts[0], 10);
    const mIdx = parseInt(parts[1], 10) - 1;
    if (isNaN(year) || mIdx < 0 || mIdx > 11) continue;
    data[mIdx][String(year)] =
      Math.round(((data[mIdx][String(year)] ?? 0) + p.amount) * 100) / 100;
  }

  return { data, years };
}

/**
 * Aggregates dividend payments into annual totals for a trend line chart.
 *
 * Returns an array sorted by year ascending:
 *   [ { year: "2022", income: 4800.00 }, { year: "2023", income: 5600.00 }, ... ]
 *
 * Only years present in the filtered payments are included.
 */
export function buildAnnualChartData(
  payments,
  filterTicker = null,
  filterAccount = null
) {
  const filtered = (payments ?? []).filter((p) => {
    if (filterTicker && p.ticker !== filterTicker) return false;
    if (filterAccount && p.accountId !== filterAccount) return false;
    return true;
  });

  const yearMap = new Map();
  for (const p of filtered) {
    const year = parseInt(p.date.split("-")[0], 10);
    if (isNaN(year)) continue;
    yearMap.set(year, (yearMap.get(year) ?? 0) + p.amount);
  }

  return [...yearMap.keys()]
    .sort((a, b) => a - b)
    .map((y) => ({ year: String(y), income: Math.round(yearMap.get(y) * 100) / 100 }));
}
