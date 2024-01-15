import { onRequest } from "firebase-functions/v2/https";
import * as express from "express";
import * as cors from "cors";
import bodyParser = require("body-parser");
import { corsConfig, isAuthenticated, isAuthorized } from "../utils/middleware";
import { getFirestore } from "firebase-admin/firestore";
import ensureError from "../utils/ensureError";
import { logger } from "firebase-functions/v2";
import { APIResponse } from "../utils/schema";
import { getAuth } from "firebase-admin/auth";

const app = express();
app.use(bodyParser.json());
app.use(cors(corsConfig));

/**
 * Endpoint to check if a user email exists.
 */
app.get("/emailTaken", async (req, res) => {
  try {
    const email = req.query.email as string;
    await getAuth()
      .getUserByEmail(email)
      .then(() => {
        res.status(200).send({ data: { exists: true } } as APIResponse);
      })
      .catch(() => {
        res.status(200).send({ data: { exists: false } } as APIResponse);
      });
  } catch (err) {
    const error = ensureError(err);
    logger.error(error);
    res.status(500).send({ error: error.message } as APIResponse);
  }
});

/**
 * Endpoint to check if a user phone number exists.
 */
app.get("/phoneNumberTaken", async (req, res) => {
  try {
    const phoneNumber = req.query.phoneNumber as string;
    logger.debug("Checking if phone number exists: " + phoneNumber);

    await getAuth()
      .getUserByPhoneNumber(phoneNumber)
      .then(() => {
        res.status(200).send({ data: { exists: true } } as APIResponse);
      })
      .catch(() => {
        res.status(200).send({ data: { exists: false } } as APIResponse);
      });
  } catch (err) {
    const error = ensureError(err);
    logger.error(error);
    res.status(500).send({ error: error.message } as APIResponse);
  }
});

/**
 * Endpoint to check if the user's role is synced with their custom claims.
 */
app.get("/checkRoleSynced", isAuthenticated, async (req, res) => {
  try {
    await getFirestore()
      .doc(`users/${res.locals.email}/user_items/role`)
      .get()
      .then((doc) => {
        const firestoreRole = doc.data()?.role ?? "undefined";
        const customClaimRole = res.locals.role ?? "undefined";

        if (firestoreRole !== customClaimRole) {
          logger.warn("Roles are out of sync! For user: " + res.locals.uid);
        }

        res.status(200).send({
          data: {
            customClaimRole,
            firestoreRole,
            synced: customClaimRole === firestoreRole,
          },
        } as APIResponse);
        return;
      })
      .catch((err) => {
        throw err;
      });
  } catch (err) {
    const error = ensureError(err);
    logger.error(error);
    res.status(500).send({ error: error.message } as APIResponse);
  }
});

/**
 * Endpoint to retrieve list of users with role.
 *
 * NOTE: This endpoint only returns up to 1000 users sorted by UID. To fix this
 * issue, we can use pagination. However, this causes a problem for grabbing the
 * correct pronouns from the user's collection group.
 */
app.get(
  "/users",
  isAuthenticated,
  isAuthorized({ hasRole: ["admin"] }),
  async (req, res) => {
    try {
      let pronounsDict: { [email: string]: string } = {};
      await getFirestore()
        .collectionGroup("users")
        .get()
        .then((querySnapshot) => {
          pronounsDict = querySnapshot.docs.reduce((acc, doc) => {
            if (!doc.data().pronouns) return acc;

            return {
              ...acc,
              [doc.id]: doc.data().pronouns,
            };
          }, {});
        });

      await getAuth()
        .listUsers(1000)
        .then((listUsersResult) => {
          const users = listUsersResult.users.map((user) => {
            return {
              uid: user.uid,
              displayName: user.displayName,
              email: user.email,
              pronouns:
                user.email && user.email in pronounsDict ?
                  pronounsDict[user.email] :
                  undefined,
              role: user.customClaims?.role,
            };
          });
          res.status(200).send({
            data: {
              users,
            },
          } as APIResponse);
          return;
        });
    } catch (err) {
      const error = ensureError(err);
      logger.error(error);
      res.status(500).send({ error: error.message } as APIResponse);
    }
  }
);

export const auth = onRequest(app);
