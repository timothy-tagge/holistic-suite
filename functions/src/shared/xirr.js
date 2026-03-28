const TOLERANCE = 1e-7;
const MAX_ITER = 200;
const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

function npv(amounts, years, r) {
  return amounts.reduce((s, a, i) => s + a / Math.pow(1 + r, years[i]), 0);
}
function dnpv(amounts, years, r) {
  return amounts.reduce(
    (s, a, i) => s - years[i] * a / (Math.pow(1 + r, years[i]) * (1 + r)),
    0
  );
}

export function xirr(cashFlows) {
  if (!cashFlows || cashFlows.length < 2) return null;
  if (!cashFlows.some(cf => cf.amount < 0)) return null;
  if (!cashFlows.some(cf => cf.amount > 0)) return null;

  const t0 = Math.min(...cashFlows.map(cf => new Date(cf.date).getTime()));
  const amounts = cashFlows.map(cf => cf.amount);
  const years = cashFlows.map(cf => (new Date(cf.date).getTime() - t0) / MS_PER_YEAR);

  for (const guess of [0.1, 0.0, -0.1, 0.3, 0.5]) {
    let r = guess;
    for (let i = 0; i < MAX_ITER; i++) {
      const f = npv(amounts, years, r);
      const df = dnpv(amounts, years, r);
      if (Math.abs(df) < 1e-12) break;
      const rNew = r - f / df;
      if (rNew <= -1) break;
      if (Math.abs(rNew - r) < TOLERANCE) {
        if (rNew > -1 && rNew < 10) return rNew;
        break;
      }
      r = rNew;
    }
  }
  return null;
}

// calls → negative, everything else → positive
export function toSignedCashFlows(cashFlows) {
  return (cashFlows ?? []).map(cf => ({
    date: cf.date,
    amount: cf.type === "call" ? -cf.amount : cf.amount,
  }));
}
