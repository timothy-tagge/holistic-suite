import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { enrichPlan } from "./helpers.js";

export const altsGetSummary = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  const { uid } = request.auth;
  const db = getFirestore();
  const snap = await db.collection("alts-plans").doc(uid).get();
  if (!snap.exists) throw new HttpsError("not-found", "No alts plan found.");

  const plan = enrichPlan(snap.data());
  const { portfolio } = plan;
  const now = new Date().toISOString();
  const actionItems = [];

  const activeCount = (plan.investments ?? []).filter(i => i.status === "active").length;
  if (activeCount === 0 && (plan.investments ?? []).length === 0) {
    actionItems.push({
      id: "alts.no-investments",
      moduleKey: "alts",
      severity: "info",
      title: "No investments recorded",
      body: "Add your alternative investments to track performance and compare projected vs actual IRR.",
      cta: { label: "Open Alts", href: "/alts" },
      dismissible: true,
      generatedAt: now,
    });
  }

  return {
    ok: true,
    data: {
      summary: {
        moduleKey: "alts",
        planName: plan.name,
        activePlanId: uid,
        netWorthContribution: portfolio.totalCalled - portfolio.totalDistributions,
        projectedAnnualIncome: 0,
        metrics: {
          totalCommitted: portfolio.totalCommitted,
          totalCalled: portfolio.totalCalled,
          totalDistributions: portfolio.totalDistributions,
          portfolioDPI: portfolio.portfolioDPI,
          blendedIRR: portfolio.blendedIRR,
          investmentCount: (plan.investments ?? []).length,
        },
        actionItems,
        lastUpdated: plan.updatedAt,
      },
    },
  };
});
