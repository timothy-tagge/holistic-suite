import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { enrichPlan } from "./helpers.js";

export const altsDeleteCashFlow = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  const { uid } = request.auth;
  const { investmentId, cashFlowId } = request.data ?? {};
  if (!investmentId || !cashFlowId)
    throw new HttpsError("invalid-argument", "investmentId and cashFlowId required.");

  const db = getFirestore();
  const ref = db.collection("alts-plans").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Plan not found.");

  const plan = snap.data();
  const now = new Date().toISOString();
  const investments = (plan.investments ?? []).map((inv) => {
    if (inv.id !== investmentId) return inv;
    return {
      ...inv,
      cashFlows: (inv.cashFlows ?? []).filter((cf) => cf.id !== cashFlowId),
      updatedAt: now,
    };
  });

  await ref.update({ investments, updatedAt: now });
  return {
    ok: true,
    data: { plan: enrichPlan({ ...plan, investments, updatedAt: now }) },
  };
});
