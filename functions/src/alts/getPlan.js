import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { enrichPlan } from "./helpers.js";

export const altsGetPlan = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  const { uid } = request.auth;
  const { override } = request.data ?? {};

  // If an override payload is provided, enrich and return it without touching Firestore.
  // Used for sample data preview — no user data is read or written.
  if (override != null) {
    return { ok: true, data: { plan: enrichPlan(override) } };
  }

  const db = getFirestore();
  const snap = await db.collection("alts-plans").doc(uid).get();
  if (!snap.exists) return { ok: true, data: { plan: null } };
  return { ok: true, data: { plan: enrichPlan(snap.data()) } };
});
