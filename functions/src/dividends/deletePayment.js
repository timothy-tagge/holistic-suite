import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { enrichPlan } from "./helpers.js";

export const dividendsDeletePayment = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  const { uid } = request.auth;
  const { paymentId } = request.data ?? {};

  if (!paymentId) throw new HttpsError("invalid-argument", "paymentId is required.");

  const db = getFirestore();
  const ref = db.collection("dividend-payments").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "No dividend plan found.");

  const plan = snap.data();
  const payments = (plan.payments ?? []).filter((p) => p.id !== paymentId);
  if (payments.length === (plan.payments ?? []).length)
    throw new HttpsError("not-found", "Payment not found.");

  const now = new Date().toISOString();
  await ref.update({ payments, updatedAt: now });
  return { ok: true, data: { plan: enrichPlan({ ...plan, payments }) } };
});
