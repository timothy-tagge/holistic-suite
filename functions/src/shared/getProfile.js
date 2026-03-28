import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

export const getProfile = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { uid, token } = request.auth;
  const db = getFirestore();
  const ref = db.collection("profile").doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    // First visit — seed profile from Google auth data
    const now = new Date().toISOString();
    const profile = {
      displayName: token.name ?? "",
      email: token.email ?? "",
      photoURL: token.picture ?? "",
      age: null,
      targetRetirementAge: null,
      numberOfKids: null,
      monthlyCollegeBudget: null,
      numberOfAltsInvestments: null,
      totalCommittedCapital: null,
      activeModules: [],
      initializedModules: [],
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(profile);
    return { ok: true, data: { profile } };
  }

  return { ok: true, data: { profile: snap.data() } };
});
