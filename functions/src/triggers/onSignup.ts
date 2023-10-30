import { getAuth } from "firebase-admin/auth";
import { auth, logger } from "firebase-functions/v1";
import { UserRole } from "../utils/roles";
import ensureError from "../utils/ensureError";

/**
 * Triggered when a new user signs up.
 * Sets the user's role to "hacker" by default.
 */
export const onSignup = auth.user().onCreate(async (user) => {
  try {
    const role: UserRole = "hacker";
    await getAuth().setCustomUserClaims(user.uid, { role });
  } catch (err) {
    const error = ensureError(err);

    logger.error(error);
  }
});
