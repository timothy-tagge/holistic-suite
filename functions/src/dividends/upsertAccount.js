import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { enrichPlan } from "./helpers.js";

const VALID_TAX_TYPES = ["taxable", "traditional-ira", "roth-ira", "other"];

export const dividendsUpsertAccount = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  const { uid } = request.auth;
  const { account } = request.data ?? {};

  if (!account?.name?.trim())
    throw new HttpsError("invalid-argument", "Account name is required.");
  if (!VALID_TAX_TYPES.includes(account?.taxType))
    throw new HttpsError("invalid-argument", "Invalid tax type.");

  const db = getFirestore();
  const ref = db.collection("dividend-payments").doc(uid);
  const snap = await ref.get();
  const now = new Date().toISOString();

  let plan;
  if (!snap.exists) {
    const newId = db.collection("_").doc().id;
    plan = {
      ownerUid: uid,
      payments: [],
      accounts: [
        {
          id: newId,
          name: account.name.trim(),
          taxType: account.taxType,
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(plan);
  } else {
    plan = snap.data();
    const accounts = plan.accounts ?? [];
    if (account.id) {
      const idx = accounts.findIndex((a) => a.id === account.id);
      if (idx === -1) throw new HttpsError("not-found", "Account not found.");
      accounts[idx] = {
        ...accounts[idx],
        name: account.name.trim(),
        taxType: account.taxType,
      };
    } else {
      const newId = db.collection("_").doc().id;
      accounts.push({
        id: newId,
        name: account.name.trim(),
        taxType: account.taxType,
        createdAt: now,
      });
    }
    plan = { ...plan, accounts, updatedAt: now };
    await ref.update({ accounts: plan.accounts, updatedAt: now });
  }

  return { ok: true, data: { plan: enrichPlan(plan) } };
});
