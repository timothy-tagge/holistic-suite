import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { runCollegeMonteCarlo, findExtraMonthlyContribution } from "./runMonteCarlo.js";

const VALID_COST_TIERS = ["public-in-state", "public-out-of-state", "private", "elite"];

export const collegeUpdateChildren = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { uid } = request.auth;
  const { children } = request.data ?? {};

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
      throw new HttpsError("invalid-argument", "Each child must have a valid birth year.");
    }
    if (!VALID_COST_TIERS.includes(child.costTier)) {
      throw new HttpsError("invalid-argument", "Invalid cost tier.");
    }
    if (child.name !== undefined && typeof child.name !== "string") {
      throw new HttpsError("invalid-argument", "Child name must be a string.");
    }
    if (
      child.annualCostBase !== undefined &&
      (typeof child.annualCostBase !== "number" || child.annualCostBase <= 0)
    ) {
      throw new HttpsError("invalid-argument", "Annual cost base must be a positive number.");
    }
  }

  const db = getFirestore();
  const planRef = db.collection("college-plans").doc(uid);
  const snap = await planRef.get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "No college plan found.");
  }

  const now = new Date().toISOString();
  const updatedChildren = children.map((c, i) => ({
    id: c.id ?? `child-${i + 1}`,
    name: c.name?.trim() || `Child ${i + 1}`,
    birthYear: c.birthYear,
    costTier: c.costTier,
    ...(c.annualCostBase !== undefined && { annualCostBase: c.annualCostBase }),
  }));

  await planRef.update({ children: updatedChildren, updatedAt: now });

  const updated = await planRef.get();
  const updatedPlan = updated.data();

  const mcResult = runCollegeMonteCarlo(updatedPlan);
  const extraMonthly = findExtraMonthlyContribution(updatedPlan);
  await planRef.update({
    monteCarloResult: { ...mcResult, extraMonthly, computedAt: now },
  });

  const final = await planRef.get();
  return { ok: true, data: { plan: final.data() } };
});
