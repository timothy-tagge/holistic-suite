import { xirr, toSignedCashFlows } from "../shared/xirr.js";

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
        ? new Date(inv.cocStartDate).getFullYear()
        : inv.vintage ?? null;
      if (baseYear != null) projectedExitYear = baseYear + inv.projectedHoldYears;
    }

    return {
      ...inv,
      metrics: {
        totalCalled, totalDistributions, dpi, computedIRR,
        projectedAnnualDistribution, projectedExitYear,
      },
    };
  });

  const totalCommitted = investments.reduce((s, i) => s + (i.committed ?? 0), 0);
  const totalCalled = investments.reduce((s, i) => s + i.metrics.totalCalled, 0);
  const totalDistributions = investments.reduce((s, i) => s + i.metrics.totalDistributions, 0);
  const portfolioDPI = totalCalled > 0 ? totalDistributions / totalCalled : 0;
  const allCFs = investments.flatMap(i => toSignedCashFlows(i.cashFlows ?? []));
  const blendedIRR = xirr(allCFs);

  return {
    ...plan,
    investments,
    portfolio: { totalCommitted, totalCalled, totalDistributions, portfolioDPI, blendedIRR },
  };
}
