import { xirr, toSignedCashFlows } from "../shared/xirr.js";

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

function yearFromISO(isoDate) {
  return parseInt(isoDate.split("-")[0], 10);
}

/**
 * Projected NAV of a single investment as of today.
 * Formula: committed × (1 + projectedIRR)^yearsHeld − actual distributions received.
 * Represents "paper value" when no mark-to-market is available.
 */
function computeProjectedNAV(inv, totalDistributions) {
  if (inv.projectedIRR == null || inv.committed == null || inv.status === "realized") return null;
  const baseDate = inv.cocStartDate
    ? new Date(inv.cocStartDate)
    : inv.vintage ? new Date(inv.vintage, 0, 1) : null;
  if (!baseDate) return null;
  const yearsHeld = (Date.now() - baseDate.getTime()) / MS_PER_YEAR;
  if (yearsHeld < 0) return inv.committed;
  const grossValue = inv.committed * Math.pow(1 + inv.projectedIRR, yearsHeld);
  return Math.max(0, grossValue - totalDistributions);
}

export function enrichPlan(plan) {
  const investments = (plan.investments ?? []).map(inv => {
    const cfs = inv.cashFlows ?? [];
    const totalCalled = cfs.filter(cf => cf.type === "call").reduce((s, cf) => s + cf.amount, 0);
    const totalDistributions = cfs.filter(cf => cf.type !== "call").reduce((s, cf) => s + cf.amount, 0);
    const dpi = totalCalled > 0 ? totalDistributions / totalCalled : 0;
    const computedIRR = xirr(toSignedCashFlows(cfs));

    // Projection metrics
    const projectedAnnualDistribution =
      inv.committed != null && inv.projectedCashOnCash != null
        ? inv.committed * inv.projectedCashOnCash
        : null;

    // Exit year: cocStartDate + holdYears, fallback to vintage + holdYears
    let projectedExitYear = null;
    if (inv.projectedHoldYears != null) {
      const baseYear = inv.cocStartDate
        ? yearFromISO(inv.cocStartDate)
        : inv.vintage ?? null;
      if (baseYear != null) projectedExitYear = baseYear + inv.projectedHoldYears;
    }

    // Projected NAV today — IRR-compounded paper value minus actual distributions
    const projectedNAV = computeProjectedNAV(inv, totalDistributions);

    return {
      ...inv,
      metrics: {
        totalCalled, totalDistributions, dpi, computedIRR,
        projectedAnnualDistribution, projectedExitYear, projectedNAV,
      },
    };
  });

  const totalCommitted = investments.reduce((s, i) => s + (i.committed ?? 0), 0);
  const totalCalled = investments.reduce((s, i) => s + i.metrics.totalCalled, 0);
  const totalDistributions = investments.reduce((s, i) => s + i.metrics.totalDistributions, 0);
  const portfolioDPI = totalCalled > 0 ? totalDistributions / totalCalled : 0;
  const allCFs = investments.flatMap(i => toSignedCashFlows(i.cashFlows ?? []));
  const blendedIRR = xirr(allCFs);
  const portfolioProjectedNAV = investments
    .filter(i => i.metrics.projectedNAV != null)
    .reduce((s, i) => s + i.metrics.projectedNAV, 0) || null;

  return {
    ...plan,
    investments,
    portfolio: {
      totalCommitted, totalCalled, totalDistributions,
      portfolioDPI, blendedIRR, portfolioProjectedNAV,
    },
  };
}
