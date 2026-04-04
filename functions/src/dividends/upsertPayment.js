import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { enrichPlan } from "./helpers.js";

function sanitize(p) {
  return {
    ticker: String(p.ticker).trim().toUpperCase(),
    date: String(p.date).slice(0, 10), // enforce YYYY-MM-DD
    amount: Number(p.amount),
    sharesHeld: p.sharesHeld != null ? Number(p.sharesHeld) : null,
    priceAtDate: p.priceAtDate != null ? Number(p.priceAtDate) : null,
    accountId: p.accountId ?? null,
    note: p.note ? String(p.note).trim() : null,
  };
}

export const dividendsUpsertPayment = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  const { uid } = request.auth;
  const { payment } = request.data ?? {};

  if (!payment?.ticker?.trim())
    throw new HttpsError("invalid-argument", "Ticker is required.");
  if (!payment?.date) throw new HttpsError("invalid-argument", "Date is required.");
  if (payment?.amount == null || payment.amount <= 0)
    throw new HttpsError("invalid-argument", "Amount must be positive.");

  const db = getFirestore();
  const ref = db.collection("dividend-payments").doc(uid);
  const snap = await ref.get();
  const now = new Date().toISOString();

  let plan;
  if (!snap.exists) {
    const newId = db.collection("_").doc().id;
    plan = {
      ownerUid: uid,
      payments: [{ id: newId, ...sanitize(payment), createdAt: now, updatedAt: now }],
      accounts: [],
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(plan);
  } else {
    plan = snap.data();
    const payments = plan.payments ?? [];
    if (payment.id) {
      const idx = payments.findIndex((p) => p.id === payment.id);
      if (idx === -1) throw new HttpsError("not-found", "Payment not found.");
      payments[idx] = { ...payments[idx], ...sanitize(payment), updatedAt: now };
    } else {
      const newId = db.collection("_").doc().id;
      payments.push({ id: newId, ...sanitize(payment), createdAt: now, updatedAt: now });
    }
    plan = { ...plan, payments, updatedAt: now };
    await ref.update({ payments: plan.payments, updatedAt: now });
  }

  return { ok: true, data: { plan: enrichPlan(plan) } };
});
