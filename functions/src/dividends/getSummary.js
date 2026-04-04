import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { enrichPlan } from "./helpers.js";

export const dividendsGetSummary = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  const { uid } = request.auth;
  const db = getFirestore();
  const snap = await db.collection("dividend-payments").doc(uid).get();
  if (!snap.exists) throw new HttpsError("not-found", "No dividend plan found.");

  const plan = enrichPlan(snap.data());
  const { portfolio } = plan;
  const now = new Date().toISOString();
  const actionItems = [];

  // Year-by-year income breakdown — descending
  const yearMap = new Map();
  for (const p of plan.payments ?? []) {
    const year = parseInt(p.date.split("-")[0], 10);
    if (!isNaN(year)) yearMap.set(year, (yearMap.get(year) ?? 0) + p.amount);
  }
  const annualBreakdown = [...yearMap.keys()]
    .sort((a, b) => b - a)
    .map((y) => ({ year: String(y), income: Math.round(yearMap.get(y) * 100) / 100 }));

  if (portfolio.paymentCount === 0) {
    actionItems.push({
      id: "dividends.no-payments",
      moduleKey: "dividends",
      severity: "info",
      title: "No dividend payments recorded",
      body: "Add your dividend payments to track income, DRIP accumulation, and DPS growth.",
      cta: { label: "Open Dividends", href: "/dividends" },
      dismissible: true,
      generatedAt: now,
    });
  }

  return {
    ok: true,
    data: {
      summary: {
        moduleKey: "dividends",
        planName: "Dividend Tracker",
        activePlanId: uid,
        netWorthContribution: 0,
        projectedAnnualIncome: portfolio.totalAnnualIncome,
        metrics: {
          totalAnnualIncome: portfolio.totalAnnualIncome,
          paymentCount: portfolio.paymentCount,
          tickerCount: portfolio.allTickers.length,
          annualBreakdown,
        },
        actionItems,
        lastUpdated: plan.updatedAt,
      },
    },
  };
});
