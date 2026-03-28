import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

const VALID_MODULES = ["retirement", "college", "alts", "equity", "property"];

export const updateProfile = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { uid } = request.auth;
  const {
    age,
    targetRetirementAge,
    numberOfKids,
    monthlyCollegeBudget,
    numberOfAltsInvestments,
    totalCommittedCapital,
    activeModules,
    initializedModules,
  } = request.data ?? {};

  // Validate inputs (null is allowed to clear a field)
  if (age !== undefined && age !== null) {
    if (typeof age !== "number" || !Number.isInteger(age) || age < 18 || age > 100) {
      throw new HttpsError("invalid-argument", "Age must be an integer between 18 and 100.");
    }
  }

  if (targetRetirementAge !== undefined && targetRetirementAge !== null) {
    if (
      typeof targetRetirementAge !== "number" ||
      !Number.isInteger(targetRetirementAge) ||
      targetRetirementAge < 40 ||
      targetRetirementAge > 80
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Target retirement age must be an integer between 40 and 80."
      );
    }
  }

  if (numberOfKids !== undefined && numberOfKids !== null) {
    if (
      typeof numberOfKids !== "number" ||
      !Number.isInteger(numberOfKids) ||
      numberOfKids < 1 ||
      numberOfKids > 20
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Number of kids must be an integer between 1 and 20."
      );
    }
  }

  if (monthlyCollegeBudget !== undefined && monthlyCollegeBudget !== null) {
    if (typeof monthlyCollegeBudget !== "number" || monthlyCollegeBudget < 0) {
      throw new HttpsError("invalid-argument", "Monthly college budget must be a non-negative number.");
    }
  }

  if (numberOfAltsInvestments !== undefined && numberOfAltsInvestments !== null) {
    if (
      typeof numberOfAltsInvestments !== "number" ||
      !Number.isInteger(numberOfAltsInvestments) ||
      numberOfAltsInvestments < 0 ||
      numberOfAltsInvestments > 500
    ) {
      throw new HttpsError("invalid-argument", "Number of alts investments must be an integer between 0 and 500.");
    }
  }

  if (totalCommittedCapital !== undefined && totalCommittedCapital !== null) {
    if (typeof totalCommittedCapital !== "number" || totalCommittedCapital < 0) {
      throw new HttpsError("invalid-argument", "Total committed capital must be a non-negative number.");
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

  if (initializedModules !== undefined) {
    if (
      !Array.isArray(initializedModules) ||
      !initializedModules.every((m) => VALID_MODULES.includes(m))
    ) {
      throw new HttpsError("invalid-argument", "Invalid initialized modules.");
    }
  }

  const db = getFirestore();
  const ref = db.collection("profile").doc(uid);
  const now = new Date().toISOString();

  const updates = { updatedAt: now };
  if (age !== undefined) updates.age = age;
  if (targetRetirementAge !== undefined) updates.targetRetirementAge = targetRetirementAge;
  if (numberOfKids !== undefined) updates.numberOfKids = numberOfKids;
  if (monthlyCollegeBudget !== undefined) updates.monthlyCollegeBudget = monthlyCollegeBudget;
  if (numberOfAltsInvestments !== undefined) updates.numberOfAltsInvestments = numberOfAltsInvestments;
  if (totalCommittedCapital !== undefined) updates.totalCommittedCapital = totalCommittedCapital;
  if (activeModules !== undefined) updates.activeModules = activeModules;
  if (initializedModules !== undefined) updates.initializedModules = initializedModules;

  // Use set+merge so this works even if the doc was never seeded by getProfile
  const existing = await ref.get();
  if (!existing.exists) {
    const { token } = request.auth;
    await ref.set({
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
      ...updates,
    });
  } else {
    await ref.update(updates);
  }

  const updated = await ref.get();

  return { ok: true, data: { profile: updated.data() } };
});
