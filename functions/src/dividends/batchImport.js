import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { prepareBatchImport } from "./helpers.js";
import { enrichPlan } from "./helpers.js";

export const dividendsBatchImport = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  const { uid } = request.auth;
  const { payments: incoming } = request.data ?? {};

  if (!Array.isArray(incoming) || incoming.length === 0)
    throw new HttpsError("invalid-argument", "payments array is required.");
  if (incoming.length > 5000)
    throw new HttpsError("invalid-argument", "Maximum 5000 payments per import.");

  const db = getFirestore();
  const ref = db.collection("dividend-payments").doc(uid);
  const snap = await ref.get();
  const now = new Date().toISOString();

  const existingPayments = snap.exists ? (snap.data().payments ?? []) : [];
  const { toAdd, skipped } = prepareBatchImport(incoming, existingPayments);

  if (toAdd.length === 0) {
    const plan = snap.exists ? enrichPlan(snap.data()) : null;
    return { ok: true, data: { plan, imported: 0, skipped } };
  }

  const newEntries = toAdd.map((p) => ({
    id: db.collection("_").doc().id,
    ticker: p.ticker,
    date: p.date,
    amount: p.amount,
    sharesHeld: null,
    priceAtDate: null,
    accountId: null,
    note: null,
    createdAt: now,
    updatedAt: now,
  }));

  const newPayments = [...existingPayments, ...newEntries];

  let plan;
  if (!snap.exists) {
    plan = {
      ownerUid: uid,
      payments: newPayments,
      accounts: [],
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(plan);
  } else {
    plan = { ...snap.data(), payments: newPayments, updatedAt: now };
    await ref.update({ payments: newPayments, updatedAt: now });
  }

  return { ok: true, data: { plan: enrichPlan(plan), imported: toAdd.length, skipped } };
});
