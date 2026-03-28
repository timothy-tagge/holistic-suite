import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { enrichPlan } from "./helpers.js";

function sanitize(inv) {
  return {
    name: String(inv.name).trim(),
    sponsor: inv.sponsor ? String(inv.sponsor).trim() : null,
    vintage: inv.vintage ? Number(inv.vintage) : null,
    committed: Number(inv.committed),
    projectedIRR: inv.projectedIRR != null ? Number(inv.projectedIRR) : null,
    preferredReturn: inv.preferredReturn != null ? Number(inv.preferredReturn) : null,
    projectedCashOnCash: inv.projectedCashOnCash != null ? Number(inv.projectedCashOnCash) : null,
    cocStartDate: inv.cocStartDate ? String(inv.cocStartDate) : null,
    projectedHoldYears: inv.projectedHoldYears != null ? Number(inv.projectedHoldYears) : null,
    cocGrowthRate: inv.cocGrowthRate != null ? Number(inv.cocGrowthRate) : null,
    status: inv.status === "realized" ? "realized" : "active",
    currentNAV: null, // reserved for future
  };
}

export const altsUpsertInvestment = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  const { uid } = request.auth;
  const { investment } = request.data ?? {};

  if (!investment?.name?.trim()) throw new HttpsError("invalid-argument", "Name is required.");
  if (!investment.committed || investment.committed <= 0) throw new HttpsError("invalid-argument", "Committed capital must be positive.");

  const db = getFirestore();
  const ref = db.collection("alts-plans").doc(uid);
  const snap = await ref.get();
  const now = new Date().toISOString();

  let plan;
  if (!snap.exists) {
    const newId = db.collection("_").doc().id;
    plan = {
      ownerUid: uid,
      name: "My Alts Portfolio",
      createdAt: now,
      updatedAt: now,
      investments: [{ id: newId, ...sanitize(investment), cashFlows: [], createdAt: now, updatedAt: now }],
    };
    await ref.set(plan);
  } else {
    plan = snap.data();
    const investments = plan.investments ?? [];
    if (investment.id) {
      const idx = investments.findIndex(i => i.id === investment.id);
      if (idx === -1) throw new HttpsError("not-found", "Investment not found.");
      investments[idx] = { ...investments[idx], ...sanitize(investment), updatedAt: now };
    } else {
      const newId = db.collection("_").doc().id;
      investments.push({ id: newId, ...sanitize(investment), cashFlows: [], createdAt: now, updatedAt: now });
    }
    plan = { ...plan, investments, updatedAt: now };
    await ref.update({ investments: plan.investments, updatedAt: now });
  }

  return { ok: true, data: { plan: enrichPlan(plan) } };
});
