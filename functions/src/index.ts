import * as admin from "firebase-admin";
admin.initializeApp();

// Express API Endpoints
export { application } from "./controllers/application";
export { auth } from "./controllers/auth";
export { statistics } from "./controllers/statistics";
export { email } from "./controllers/email";

// Custom Claim Triggers
export { onSignup, mirrorCustomClaims } from "./triggers/customClaim";
