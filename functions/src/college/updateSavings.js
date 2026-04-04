import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { runCollegeMonteCarlo, findExtraMonthlyContribution } from "./runMonteCarlo.js";

export const collegeUpdateSavings = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { uid } = request.auth;
  const {
    totalSavings,
    monthlyContribution,
    annualReturn,
    inflationRate,
    lumpSums,
    loans,
  } = request.data ?? {};

  if (typeof totalSavings !== "number" || totalSavings < 0) {
    throw new HttpsError(
      "invalid-argument",
      "Total savings must be a non-negative number."
    );
  }

  if (typeof monthlyContribution !== "number" || monthlyContribution < 0) {
    throw new HttpsError(
      "invalid-argument",
      "Monthly contribution must be a non-negative number."
    );
  }

  if (typeof annualReturn !== "number" || annualReturn < 0 || annualReturn > 0.25) {
    throw new HttpsError("invalid-argument", "Annual return must be between 0% and 25%.");
  }

  const inflation = inflationRate ?? 0.03;
  if (typeof inflation !== "number" || inflation < 0 || inflation > 0.15) {
    throw new HttpsError(
      "invalid-argument",
      "Inflation rate must be between 0% and 15%."
    );
  }

  if (
    loans !== null &&
    loans !== undefined &&
    (typeof loans !== "object" ||
      typeof loans.totalAmount !== "number" ||
      loans.totalAmount < 0 ||
      typeof loans.rate !== "number" ||
      loans.rate < 0 ||
      loans.rate > 0.25 ||
      typeof loans.termYears !== "number" ||
      loans.termYears < 1 ||
      loans.termYears > 30)
  ) {
    throw new HttpsError("invalid-argument", "Invalid loans configuration.");
  }

  const currentYear = new Date().getFullYear();
  if (!Array.isArray(lumpSums)) {
    throw new HttpsError("invalid-argument", "lumpSums must be an array.");
  }
  for (const ls of lumpSums) {
    if (
      typeof ls.year !== "number" ||
      !Number.isInteger(ls.year) ||
      ls.year < currentYear
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Each lump sum must have a valid future year."
      );
    }
    if (typeof ls.amount !== "number" || ls.amount <= 0) {
      throw new HttpsError(
        "invalid-argument",
        "Each lump sum amount must be a positive number."
      );
    }
    if (ls.label !== undefined && typeof ls.label !== "string") {
      throw new HttpsError("invalid-argument", "Lump sum label must be a string.");
    }
  }

  const db = getFirestore();
  const planRef = db.collection("college-plans").doc(uid);
  const snap = await planRef.get();

  if (!snap.exists) {
    throw new HttpsError("not-found", "No college plan found.");
  }

  const now = new Date().toISOString();
  await planRef.update({
    totalSavings,
    monthlyContribution,
    annualReturn,
    inflationRate: inflation,
    lumpSums,
    loans: loans ?? null,
    updatedAt: now,
  });

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
