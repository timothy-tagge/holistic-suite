/**
 * Dividend module helpers — pure functions, fully testable.
 */

/**
 * Validates and deduplicates an incoming batch against existing payments.
 *
 * A row is skipped when:
 *   - ticker, date, or amount is missing/invalid
 *   - ticker+date already exists in existingPayments
 *   - ticker+date is duplicated within the batch itself
 *
 * Returns { toAdd: sanitized row objects (no id/timestamps), skipped: number }
 */
export function prepareBatchImport(incoming, existingPayments = []) {
  const existingKeys = new Set(
    (existingPayments ?? []).map((p) => `${p.ticker}|${p.date}`)
  );

  const toAdd = [];
  let skipped = 0;

  for (const p of incoming ?? []) {
    const ticker = String(p.ticker ?? "")
      .trim()
      .toUpperCase();
    const date = String(p.date ?? "").slice(0, 10);
    const amount = Number(p.amount);

    if (!ticker || !date || !(amount > 0)) {
      skipped++;
      continue;
    }

    const key = `${ticker}|${date}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }

    existingKeys.add(key); // deduplicate within the batch itself
    toAdd.push({ ticker, date, amount });
  }

  return { toAdd, skipped };
}

/**
 * Enriches a single payment with derived fields.
 * dividendPerShare and sharesAcquired are computed when their inputs are present.
 */
export function enrichPayment(payment) {
  const dividendPerShare =
    payment.amount != null && payment.sharesHeld != null && payment.sharesHeld > 0
      ? payment.amount / payment.sharesHeld
      : null;

  const sharesAcquired =
    payment.amount != null && payment.priceAtDate != null && payment.priceAtDate > 0
      ? payment.amount / payment.priceAtDate
      : null;

  return { ...payment, dividendPerShare, sharesAcquired };
}

/**
 * Enriches all payments and computes portfolio-level metrics.
 *
 * Per-ticker metrics:
 *   - payments sorted by date ascending
 *   - latestDPS: most recent dividendPerShare
 *   - dpsGrowthRate: % change from prior payment with a DPS value
 *   - totalReceived: sum of all amounts
 *   - totalSharesAcquired: sum of sharesAcquired across all payments
 *
 * Portfolio metrics:
 *   - totalAnnualIncome: sum of amounts in the trailing 12 months
 *   - allTickers: sorted unique list
 */
export function enrichPlan(plan) {
  const payments = (plan.payments ?? []).map(enrichPayment);

  // Sort all payments by date for consistent processing
  const sorted = [...payments].sort((a, b) => a.date.localeCompare(b.date));

  // Per-ticker aggregation
  const tickerMap = new Map();
  for (const p of sorted) {
    if (!tickerMap.has(p.ticker)) tickerMap.set(p.ticker, []);
    tickerMap.get(p.ticker).push(p);
  }

  const tickerStats = {};
  for (const [ticker, tickerPayments] of tickerMap) {
    const totalReceived = tickerPayments.reduce((s, p) => s + (p.amount ?? 0), 0);
    const totalSharesAcquired = tickerPayments.reduce(
      (s, p) => s + (p.sharesAcquired ?? 0),
      0
    );

    // DPS growth: compare latest DPS to prior DPS within same ticker
    const withDPS = tickerPayments.filter((p) => p.dividendPerShare != null);
    let latestDPS = null;
    let dpsGrowthRate = null;
    if (withDPS.length >= 1) {
      latestDPS = withDPS[withDPS.length - 1].dividendPerShare;
    }
    if (withDPS.length >= 2) {
      const prev = withDPS[withDPS.length - 2].dividendPerShare;
      if (prev > 0) dpsGrowthRate = (latestDPS - prev) / prev;
    }

    tickerStats[ticker] = {
      totalReceived,
      totalSharesAcquired,
      latestDPS,
      dpsGrowthRate,
    };
  }

  // Portfolio: trailing 12-month income
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffISO = cutoff.toISOString().slice(0, 10);
  const totalAnnualIncome = sorted
    .filter((p) => p.date >= cutoffISO)
    .reduce((s, p) => s + (p.amount ?? 0), 0);

  const allTickers = [...tickerMap.keys()].sort();

  return {
    ...plan,
    payments,
    tickerStats,
    portfolio: {
      totalAnnualIncome: Math.round(totalAnnualIncome * 100) / 100,
      allTickers,
      paymentCount: payments.length,
    },
  };
}
