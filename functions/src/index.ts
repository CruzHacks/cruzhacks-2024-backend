import * as admin from "firebase-admin";
admin.initializeApp();

export { auth } from "./controllers/auth";
export { onSignup, mirrorCustomClaims } from "./triggers/onSignup";
