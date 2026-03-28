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

  // Verify document exists
  const existing = await ref.get();
  if (!existing.exists) {
    throw new HttpsError("not-found", "Profile not found. Call getProfile first.");
  }

  const updates = { updatedAt: new Date().toISOString() };
  if (age !== undefined) updates.age = age;
  if (targetRetirementYear !== undefined)
    updates.targetRetirementYear = targetRetirementYear;
  if (activeModules !== undefined) updates.activeModules = activeModules;

  await ref.update(updates);
  const updated = await ref.get();

  return { ok: true, data: { profile: updated.data() } };
});
