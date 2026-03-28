import { initializeApp } from "firebase-admin/app";
initializeApp();

export { getProfile } from "./shared/getProfile.js";
export { updateProfile } from "./shared/updateProfile.js";
