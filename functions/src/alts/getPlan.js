import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { enrichPlan } from "./helpers.js";

export const altsGetPlan = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  const { uid } = request.auth;
  const db = getFirestore();
  const snap = await db.collection("alts-plans").doc(uid).get();
  if (!snap.exists) return { ok: true, data: { plan: null } };
  return { ok: true, data: { plan: enrichPlan(snap.data()) } };
});
