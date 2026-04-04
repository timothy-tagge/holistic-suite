import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { runCollegeMonteCarlo, findExtraMonthlyContribution } from "./runMonteCarlo.js";

export const collegeGetPlan = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { uid } = request.auth;
  const { override } = request.data ?? {};

  // If an override payload is provided, run Monte Carlo on it and return the
  // enriched plan without reading or writing Firestore. Used for sample preview.
  if (override != null) {
    const mcResult = runCollegeMonteCarlo(override);
    const extraMonthly = findExtraMonthlyContribution(override);
    const plan = {
      ...override,
      monteCarloResult: {
        ...mcResult,
        extraMonthly,
        computedAt: new Date().toISOString(),
      },
    };
    return { ok: true, data: { plan } };
  }

  const db = getFirestore();
  const planRef = db.collection("college-plans").doc(uid);
  const snap = await planRef.get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "No college plan found.");
  }

  let plan = snap.data();

  // Always recompute Monte Carlo on load so fixes to the MC algorithm take
  // effect immediately without requiring stale cached results to be cleared.
  const now = new Date().toISOString();
  const mcResult = runCollegeMonteCarlo(plan);
  const extraMonthly = findExtraMonthlyContribution(plan);
  const monteCarloResult = { ...mcResult, extraMonthly, computedAt: now };
  await planRef.update({ monteCarloResult });
  plan = { ...plan, monteCarloResult };

  return { ok: true, data: { plan } };
});
