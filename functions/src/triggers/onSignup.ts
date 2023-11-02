import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { auth, logger } from "firebase-functions/v1";
import { UserRole } from "../utils/roles";
import ensureError from "../utils/ensureError";
import { onDocumentWritten } from "firebase-functions/v2/firestore";

/**
 * Triggered when a new user signs up.
 * Sets the user's role to "hacker" by default.
 */
export const onSignup = auth.user().onCreate(async (user) => {
  try {
    const role: UserRole = "applicant";

    await getAuth().setCustomUserClaims(user.uid, { role });
    getFirestore()
      .doc(`users/${user.uid}`)
      .set(
        { _lastCommitted: FieldValue.serverTimestamp(), role },
        { merge: true }
      );
  } catch (err) {
    const error = ensureError(err);

    logger.error(error);
  }
});

/**
 * Updates Custom Claims when a user document is written.
 */
export const mirrorCustomClaims = onDocumentWritten(
  "users/{userId}",
  async (event) => {
    const beforeData = event.data?.before.data() || {};
    const afterData = event.data?.after.data() || {};

    // Skip updates where _lastCommitted hasn't changed to avoid infinite loops
    const skipUpdate = beforeData.role === afterData.role;

    if (skipUpdate) {
      logger.info("Skipping update to user claims, no changes detected");
      return;
    }
    // Create a new JSON payload and check it is under character limit (1000)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _lastCommitted, ...newClaims } = afterData;
    const stringifiedClaims = JSON.stringify(newClaims);
    if (stringifiedClaims.length > 1000) {
      logger.error(
        `User claims payload too large: ${stringifiedClaims.length} characters`
      );
      return;
    }

    const uid = event.params?.userId;
    logger.info(`Updating user claims for ${uid}: ${stringifiedClaims}`);
    await getAuth().setCustomUserClaims(uid, newClaims);

    logger.info("Updating document timestamp");
    await event.data?.after.ref.update({
      _lastCommitted: FieldValue.serverTimestamp(),
      ...newClaims,
    });
  }
);
