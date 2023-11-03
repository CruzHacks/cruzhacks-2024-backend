import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { auth, logger } from "firebase-functions/v1";
import {
  USER_ROLES_COLLECTION,
  UserRole,
  UserRolesSchema,
} from "../utils/schema";
import ensureError from "../utils/ensureError";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { SafeParseSuccess, ZodError } from "zod";

/**
 * Triggered when a new user signs up.
 * Sets the user's role to "applicant" by default.
 */
export const onSignup = auth.user().onCreate(async (user) => {
  try {
    // Default role is "applicant"
    const role: UserRole = "applicant";

    // Set role in Custom Claim to use in Firebase Rules and client routing
    await getAuth().setCustomUserClaims(user.uid, { role });

    // Set role in Firestore to allow updates in dashboard
    const _userRoleDoc: UserRolesSchema = {
      _last_committed: FieldValue.serverTimestamp(),
      role,
    };

    // Validate the user role document (throws error if invalid)
    const userRoleDoc = UserRolesSchema.parse(_userRoleDoc);

    // Create the user role document
    getFirestore()
      .doc(`${USER_ROLES_COLLECTION}/${user.uid}`)
      .set(userRoleDoc, { merge: true });
  } catch (err) {
    if (err instanceof ZodError) {
      logger.error("User Role Doc invalid shape:", JSON.stringify(err.issues));
      return;
    }

    const error = ensureError(err);
    logger.error(error);
  }
});

/**
 * Updates Custom Claims when a user document is written. Addtionally,
 * validates UserRolesSchema to default if invalid.
 */
export const mirrorCustomClaims = onDocumentWritten(
  `${USER_ROLES_COLLECTION}/{userId}`,
  async (event) => {
    const beforeData = event.data?.before.data() || {};
    const afterData = event.data?.after.data() || {};

    // Avoid infinite loops
    if (beforeData.role === afterData.role) {
      logger.info("Skipping update to user claims, no changes detected");
      return;
    }

    // Check custom claim is under 1000 character limit
    const newRole = afterData.role || "";
    if (newRole.length > 1000) {
      logger.error(
        `User claims payload too large: ${newRole.length} characters`
      );
      logger.info(
        "Undoing firestore update on",
        USER_ROLES_COLLECTION,
        "/",
        event.params.userId
      );
      await event.data?.after.ref.update(beforeData);
      return;
    }

    const uid = event.params?.userId;
    logger.info(`Updating user claims for ${uid}: ${newRole}`);
    await getAuth().setCustomUserClaims(uid, { role: newRole });

    logger.info("Updating document timestamp");

    // Set role in Firestore to allow updates in dashboard
    const _userRoleDoc: UserRolesSchema = {
      _last_committed: FieldValue.serverTimestamp(),
      role: newRole,
    };

    // Validate the new UserRoleDoc
    const userRoleDocParse = UserRolesSchema.safeParse(_userRoleDoc);

    if (!userRoleDocParse.success) {
      logger.error(
        "User Role Doc invalid shape:",
        JSON.stringify(userRoleDocParse.error.issues)
      );
      logger.info("Restoring to default");
    }

    // If the document is invalid, restore to default
    const userRoleDoc = (userRoleDocParse as SafeParseSuccess<UserRolesSchema>)
      .data || {
      role: "applicant",
      _last_committed: FieldValue.serverTimestamp(),
    };

    await event.data?.after.ref.update(userRoleDoc);
  }
);
