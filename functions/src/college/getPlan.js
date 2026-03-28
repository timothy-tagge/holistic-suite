import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { runCollegeMonteCarlo, findExtraMonthlyContribution } from "./runMonteCarlo.js";

export const collegeGetPlan = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { uid } = request.auth;
  const db = getFirestore();
  const planRef = db.collection("college-plans").doc(uid);
  const snap = await planRef.get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "No college plan found.");
  }

  let plan = snap.data();

  // Lazy-compute Monte Carlo if the plan predates server-side MC
  if (!plan.monteCarloResult) {
    const now = new Date().toISOString();
    const mcResult = runCollegeMonteCarlo(plan);
    const extraMonthly = findExtraMonthlyContribution(plan);
    const monteCarloResult = { ...mcResult, extraMonthly, computedAt: now };
    await planRef.update({ monteCarloResult });
    plan = { ...plan, monteCarloResult };
  }

  return { ok: true, data: { plan } };
});
