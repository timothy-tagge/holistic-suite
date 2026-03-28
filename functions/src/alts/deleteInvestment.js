import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { enrichPlan } from "./helpers.js";

export const altsDeleteInvestment = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  const { uid } = request.auth;
  const { investmentId } = request.data ?? {};
  if (!investmentId) throw new HttpsError("invalid-argument", "investmentId required.");

  const db = getFirestore();
  const ref = db.collection("alts-plans").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Plan not found.");

  const plan = snap.data();
  const investments = (plan.investments ?? []).filter(i => i.id !== investmentId);
  const now = new Date().toISOString();
  await ref.update({ investments, updatedAt: now });

  return { ok: true, data: { plan: enrichPlan({ ...plan, investments }) } };
});
