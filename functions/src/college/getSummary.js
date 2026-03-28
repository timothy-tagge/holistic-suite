import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

// ── Projection constants (kept in sync with frontend College.jsx) ───────────

const COST_TIER_MAP = {
  "public-in-state": 27000,
  "public-out-of-state": 45000,
  "private": 60000,
  "elite": 85000,
};
const COLLEGE_YEARS = 4;
const DEFAULT_INFLATION = 0.03;
const DEFAULT_LOAN_RATE = 0.0639;
const DEFAULT_LOAN_TERM = 10;

function calcMonthlyPayment(principal, annualRate, termYears) {
  if (principal <= 0) return 0;
  const r = annualRate / 12;
  const n = termYears * 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function projectPlan(plan) {
  const {
    children,
    totalSavings,
    annualReturn,
    monthlyContribution = 0,
    lumpSums = [],
    loans,
    inflationRate,
  } = plan;

  const inflation = inflationRate ?? DEFAULT_INFLATION;
  const now = new Date().getFullYear();
  const annualContribution = monthlyContribution * 12;

  const childData = children.map((child) => {
    const startYear = child.birthYear + 18;
    const yearsAway = Math.max(0, startYear - now);
    const baseCost = child.annualCostBase ?? COST_TIER_MAP[child.costTier];
    const annualCost = Math.round(baseCost * Math.pow(1 + inflation, yearsAway));
    return { ...child, startYear, endYear: startYear + COLLEGE_YEARS, annualCost };
  });

  const lastYear = Math.max(...childData.map((c) => c.endYear - 1));
  const firstCollegeYear = Math.min(...childData.map((c) => c.startYear));

  let balance = totalSavings;
  let totalUncovered = 0;

  for (let year = now; year <= lastYear; year++) {
    balance *= 1 + annualReturn;
    balance += annualContribution;
    const lumpSum = lumpSums.find((ls) => ls.year === year);
    if (lumpSum) balance += lumpSum.amount;

    for (const child of childData) {
      if (year >= child.startYear && year < child.endYear) {
        if (balance >= child.annualCost) {
          balance -= child.annualCost;
        } else {
          totalUncovered += child.annualCost - balance;
          balance = 0;
        }
      }
    }
  }

  const finalBalance = Math.round(balance);
  const gap = Math.round(totalUncovered);
  const loanAmount = loans?.totalAmount ?? 0;
  const loanRate = loans?.rate ?? DEFAULT_LOAN_RATE;
  const loanTerm = loans?.termYears ?? DEFAULT_LOAN_TERM;
  const remainingGap = gap - loanAmount;
  const monthlyLoanPayment = Math.round(calcMonthlyPayment(loanAmount, loanRate, loanTerm));

  return {
    finalBalance,
    gap,
    loanAmount,
    remainingGap,
    monthlyLoanPayment,
    firstCollegeYear,
    lastGraduationYear: lastYear + 1,
  };
}

// ── Function ────────────────────────────────────────────────────────────────

export const collegeGetSummary = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { uid } = request.auth;
  const db = getFirestore();
  const snap = await db.collection("college-plans").doc(uid).get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "No college plan found.");
  }

  const plan = snap.data();
  const p = projectPlan(plan);

  // Net worth: residual savings is an asset; planned loan is a liability
  const netWorthContribution = p.finalBalance - p.loanAmount;

  // Action items
  const now = new Date().toISOString();
  const actionItems = [];

  if (p.remainingGap > 0) {
    actionItems.push({
      id: "college.fundingGap",
      moduleKey: "college",
      severity: p.remainingGap > 50000 ? "urgent" : "warning",
      title: "College funding gap",
      body: `Your college plan has an unfunded gap of $${p.remainingGap.toLocaleString()}. Consider increasing monthly contributions, adding a lump sum, or planning loans.`,
      cta: { label: "Review college plan", href: "/college" },
      dismissible: false,
      generatedAt: now,
    });
  }

  if (p.monthlyLoanPayment > 0) {
    actionItems.push({
      id: "college.loanRepayment",
      moduleKey: "college",
      severity: "info",
      title: `Loan repayment begins ~${p.lastGraduationYear}`,
      body: `Estimated $${p.monthlyLoanPayment.toLocaleString()}/mo in student loan repayments will begin after your last child graduates.`,
      cta: { label: "Review college plan", href: "/college" },
      dismissible: true,
      generatedAt: now,
    });
  }

  const mc = plan.monteCarloResult ?? null;

  return {
    ok: true,
    data: {
      summary: {
        moduleKey: "college",
        planName: plan.name,
        activePlanId: uid,
        netWorthContribution,
        projectedAnnualIncome: 0,
        metrics: {
          totalSavings: plan.totalSavings,
          monthlyContribution: plan.monthlyContribution ?? 0,
          finalBalance: p.finalBalance,
          gap: p.gap,
          loanAmount: p.loanAmount,
          remainingGap: p.remainingGap,
          monthlyLoanPayment: p.monthlyLoanPayment,
          firstCollegeYear: p.firstCollegeYear,
          lastGraduationYear: p.lastGraduationYear,
          successRate: mc?.successRate ?? null,
          extraMonthly: mc?.extraMonthly ?? null,
        },
        actionItems,
        lastUpdated: plan.updatedAt,
      },
    },
  };
});
