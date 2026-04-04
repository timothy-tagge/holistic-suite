import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { runCollegeMonteCarlo, findExtraMonthlyContribution } from "./runMonteCarlo.js";

const VALID_COST_TIERS = ["public-in-state", "public-out-of-state", "private", "elite"];

export const collegeSetup = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { uid } = request.auth;
  const { children, totalSavings, annualReturn, monthlyContribution, inflationRate } =
    request.data ?? {};

  if (!Array.isArray(children) || children.length === 0) {
    throw new HttpsError("invalid-argument", "At least one child is required.");
  }

  const currentYear = new Date().getFullYear();

  for (const child of children) {
    if (
      typeof child.birthYear !== "number" ||
      !Number.isInteger(child.birthYear) ||
      child.birthYear < currentYear - 22 ||
      child.birthYear > currentYear + 2
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Each child must have a valid birth year."
      );
    }
    if (!VALID_COST_TIERS.includes(child.costTier)) {
      throw new HttpsError("invalid-argument", "Invalid cost tier.");
    }
    if (
      child.annualCostBase !== undefined &&
      (typeof child.annualCostBase !== "number" || child.annualCostBase <= 0)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Annual cost base must be a positive number."
      );
    }
  }

  if (typeof totalSavings !== "number" || totalSavings < 0) {
    throw new HttpsError(
      "invalid-argument",
      "Total savings must be a non-negative number."
    );
  }

  if (typeof annualReturn !== "number" || annualReturn < 0 || annualReturn > 0.25) {
    throw new HttpsError("invalid-argument", "Annual return must be between 0% and 25%.");
  }

  if (typeof monthlyContribution !== "number" || monthlyContribution < 0) {
    throw new HttpsError(
      "invalid-argument",
      "Monthly contribution must be a non-negative number."
    );
  }

  const inflation = inflationRate ?? 0.03;
  if (typeof inflation !== "number" || inflation < 0 || inflation > 0.15) {
    throw new HttpsError(
      "invalid-argument",
      "Inflation rate must be between 0% and 15%."
    );
  }

  const db = getFirestore();
  const now = new Date().toISOString();

  // Create (or overwrite) the college plan
  const planRef = db.collection("college-plans").doc(uid);
  const planData = {
    ownerUid: uid,
    name: "Plan 1",
    isActive: true,
    children: children.map((c, i) => ({
      id: `child-${i + 1}`,
      name: c.name?.trim() || `Child ${i + 1}`,
      birthYear: c.birthYear,
      costTier: c.costTier,
      ...(c.annualCostBase !== undefined && { annualCostBase: c.annualCostBase }),
    })),
    totalSavings,
    monthlyContribution,
    annualReturn,
    inflationRate: inflation,
    lumpSums: [],
    loans: null,
    createdAt: now,
    updatedAt: now,
  };

  const mcResult = runCollegeMonteCarlo(planData);
  planData.monteCarloResult = {
    ...mcResult,
    extraMonthly: findExtraMonthlyContribution(planData),
    computedAt: now,
  };

  await planRef.set(planData);

  // Mark college as initialized in the profile
  const profileRef = db.collection("profile").doc(uid);
  await profileRef.update({
    initializedModules: FieldValue.arrayUnion("college"),
    updatedAt: now,
  });

  const updated = await profileRef.get();
  return { ok: true, data: { profile: updated.data() } };
});
