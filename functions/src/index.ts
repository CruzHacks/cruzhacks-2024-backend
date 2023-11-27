import * as admin from "firebase-admin";
admin.initializeApp();

// Express API Endpoints
export { auth } from "./controllers/auth";
export { application } from "./controllers/application";
export { email } from "./controllers/email";

// Custom Claim Triggers
export { onSignup, mirrorCustomClaims } from "./triggers/customClaim";
