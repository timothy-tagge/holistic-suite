import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { enrichPlan } from "./helpers.js";

const VALID_TYPES = ["call", "distribution-income", "distribution-roc", "exit"];

function sanitizeCF(cf) {
  return {
    date: cf.date,
    type: cf.type,
    amount: Number(cf.amount),
    note: cf.note ? String(cf.note).trim() : null,
  };
}

export const altsUpsertCashFlow = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  const { uid } = request.auth;
  const { investmentId, cashFlow } = request.data ?? {};

  if (!investmentId) throw new HttpsError("invalid-argument", "investmentId required.");
  if (!cashFlow?.date) throw new HttpsError("invalid-argument", "date required.");
  if (!VALID_TYPES.includes(cashFlow.type))
    throw new HttpsError("invalid-argument", "Invalid cash flow type.");
  if (!cashFlow.amount || cashFlow.amount <= 0)
    throw new HttpsError("invalid-argument", "Amount must be positive.");

  const db = getFirestore();
  const ref = db.collection("alts-plans").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Plan not found.");

  const plan = snap.data();
  const now = new Date().toISOString();
  const investments = (plan.investments ?? []).map((inv) => {
    if (inv.id !== investmentId) return inv;
    const cashFlows = inv.cashFlows ?? [];
    if (cashFlow.id) {
      const idx = cashFlows.findIndex((cf) => cf.id === cashFlow.id);
      if (idx === -1) throw new HttpsError("not-found", "Cash flow not found.");
      cashFlows[idx] = { ...cashFlows[idx], ...sanitizeCF(cashFlow) };
    } else {
      const newId = db.collection("_").doc().id;
      cashFlows.push({ id: newId, ...sanitizeCF(cashFlow) });
    }
    return { ...inv, cashFlows, updatedAt: now };
  });

  await ref.update({ investments, updatedAt: now });
  return {
    ok: true,
    data: { plan: enrichPlan({ ...plan, investments, updatedAt: now }) },
  };
});
