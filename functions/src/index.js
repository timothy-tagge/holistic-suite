import { initializeApp } from "firebase-admin/app";
initializeApp();

export { getProfile } from "./shared/getProfile.js";
export { updateProfile } from "./shared/updateProfile.js";
export { collegeSetup } from "./college/setup.js";
export { collegeGetPlan } from "./college/getPlan.js";
export { collegeUpdateSavings } from "./college/updateSavings.js";
export { collegeGetSummary } from "./college/getSummary.js";
export { collegeUpdateChildren } from "./college/updateChildren.js";
