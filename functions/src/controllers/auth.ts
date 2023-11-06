import { onRequest } from "firebase-functions/v2/https";
import * as express from "express";
import * as cors from "cors";
import bodyParser = require("body-parser");
import { corsConfig, isAuthenticated, isAuthorized } from "../utils/middleware";
import { getFirestore } from "firebase-admin/firestore";
import ensureError from "../utils/ensureError";
import { logger } from "firebase-functions/v2";
import { USER_ROLES_COLLECTION } from "../utils/schema";
import { getAuth } from "firebase-admin/auth";

const app = express();
app.use(bodyParser.json());
app.use(cors(corsConfig));

/**
 * Endpoint to check if the user's role is synced with their custom claims.
 */
app.get("/checkRoleSynced", isAuthenticated, async (req, res) => {
  try {
    await getFirestore()
      .collection(USER_ROLES_COLLECTION)
      .doc(res.locals.email)
      .get()
      .then((doc) => {
        const firestoreRole = doc.data()?.role ?? "undefined";
        const customClaimRole = res.locals.role ?? "undefined";
        if (firestoreRole !== customClaimRole) {
          logger.warn("Roles are out of sync! For user: " + res.locals.uid);
          res
            .status(200)
            .send({ customClaimRole, firestoreRole, synced: false });
          return;
        }
        res.status(200).send({ customClaimRole, firestoreRole, synced: true });
        return;
      })
      .catch((err) => {
        throw err;
      });
  } catch (err) {
    const error = ensureError(err);
    logger.error(error);
    res.status(500).send({ message: error.message });
  }
});

/**
 * Endpoint to retrieve list of users with role.
 */
app.get(
  "/users",
  isAuthenticated,
  isAuthorized({ hasRole: ["admin"] }),
  async (req, res) => {
    try {
      const pageToken = req.query.pageToken as string;

      logger.info(`pageToken ${pageToken}`);
      logger.info(`pageToken length: ${pageToken.length}`);

      await getAuth()
        .listUsers(50, pageToken !== "undefined" ? pageToken : undefined)
        .then((listUsersResult) => {
          const users = listUsersResult.users.map((user) => {
            return {
              uid: user.uid,
              displayName: user.displayName,
              email: user.email,
              role: user.customClaims?.role,
            };
          });
          res.status(200).send({
            users,
            nextPageToken: listUsersResult.pageToken,
          });
          return;
        });
    } catch (err) {
      const error = ensureError(err);
      logger.error(error);
      res.status(500).send({ message: error.message });
    }
  }
);

export const auth = onRequest(app);
