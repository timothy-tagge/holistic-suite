import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

const VALID_MODULES = ["overview", "college", "alts", "equity", "property"];

export const updateProfile = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { uid } = request.auth;
  const { age, targetRetirementYear, activeModules } = request.data ?? {};

  // Validate inputs
  if (age !== undefined) {
    if (typeof age !== "number" || !Number.isInteger(age) || age < 18 || age > 100) {
      throw new HttpsError(
        "invalid-argument",
        "Age must be an integer between 18 and 100."
      );
    }
  }

  if (targetRetirementYear !== undefined) {
    const currentYear = new Date().getFullYear();
    if (
      typeof targetRetirementYear !== "number" ||
      !Number.isInteger(targetRetirementYear) ||
      targetRetirementYear < currentYear ||
      targetRetirementYear > currentYear + 60
    ) {
      throw new HttpsError("invalid-argument", "Invalid retirement year.");
    }
  }

  if (activeModules !== undefined) {
    if (
      !Array.isArray(activeModules) ||
      !activeModules.every((m) => VALID_MODULES.includes(m))
    ) {
      throw new HttpsError("invalid-argument", "Invalid module selection.");
    }
  }

  const db = getFirestore();
  const ref = db.collection("profile").doc(uid);
  const now = new Date().toISOString();

  const updates = { updatedAt: now };
  if (age !== undefined) updates.age = age;
  if (targetRetirementYear !== undefined)
    updates.targetRetirementYear = targetRetirementYear;
  if (activeModules !== undefined) updates.activeModules = activeModules;

  // Use set+merge so this works even if the doc was never seeded by getProfile
  const existing = await ref.get();
  if (!existing.exists) {
    const { token } = request.auth;
    await ref.set({
      displayName: token.name ?? "",
      email: token.email ?? "",
      photoURL: token.picture ?? "",
      age: null,
      targetRetirementYear: null,
      activeModules: [],
      createdAt: now,
      ...updates,
    });
  } else {
    await ref.update(updates);
  }

  const updated = await ref.get();

  return { ok: true, data: { profile: updated.data() } };
});
