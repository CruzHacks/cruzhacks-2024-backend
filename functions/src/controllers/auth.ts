import { onRequest } from "firebase-functions/v2/https";
import * as express from "express";
import * as cors from "cors";
import bodyParser = require("body-parser");
import { corsConfig, isAuthenticated, isAuthorized } from "../utils/middleware";
import { getFirestore } from "firebase-admin/firestore";
import ensureError from "../utils/ensureError";
import { logger } from "firebase-functions/v2";
import { APIResponse, UserRoles } from "../utils/schema";
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
 * Endpoint to Check-In a user.
 */
app.post(
  "/checkIn",
  isAuthenticated,
  isAuthorized({ hasRole: ["admin"] }),
  async (req, res) => {
    try {
      const uid = req.query.uid as string;

      const userRecord = await getAuth().getUser(uid);

      await getFirestore().doc(`users/${userRecord.email}`).update({
        checkedIn: true,
      });

      logger.info("Checked in user: " + userRecord.email);

      res.status(200).send({
        data: {
          userRecord,
        },
      } as APIResponse);
    } catch (err) {
      const error = ensureError(err);
      logger.error(error);
      res.status(500).send({ error: error.message } as APIResponse);
    }
  }
);

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
            if (!doc.data().pronouons) return acc;

            return {
              ...acc,
              [doc.id]: doc.data().pronouons,
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
                user.email && user.email in pronounsDict
                  ? pronounsDict[user.email]
                  : undefined,
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

app.post("/fixUsers", async (req, res) => {
  try {
    const toBeDelete = [];
    for (let i = 0; i < 522; i++) {
      const documentRef = await getFirestore().doc(`users/${i}`);
      const doc = await documentRef.get();
      toBeDelete.push(doc.id);

      await getFirestore().recursiveDelete(documentRef);
    }

    res.status(200).send({
      data: {
        toBeDelete,
      },
    } as APIResponse);
  } catch (err) {
    console.error(err);
    const error = ensureError(err);
    logger.error(error);
    res.status(500).send({ error: error.message } as APIResponse);
  }
});

/**
 * Endpoint to upgrade RSVPD applicants to hackers.
 */
app.get("/upgradeRSVPD", async (req, res) => {
  try {
    const applications = await getFirestore()
      .collectionGroup("user_items")
      .orderBy("_submitted")
      .get();

    const RSVPdHackers: string[] = [];

    applications.docs.forEach((doc) => {
      if (doc.data().rsvp === true) {
        RSVPdHackers.push(doc.data().email);
      }
    });

    let failedUpgrades = 0;
    const successfulUpgrades: string[] = [];
    const errors: any[] = [];

    for (const emailIdx in RSVPdHackers) {
      if (!emailIdx) continue;
      const email = RSVPdHackers[emailIdx];

      try {
        // Updating user role
        await getFirestore().doc(`users/${email}/user_items/role`).update({
          role: "hacker",
        });

        // Updating custom claims
        const user = await getAuth().getUserByEmail(email);
        const { uid } = user;

        await getAuth().setCustomUserClaims(uid, { role: UserRoles[1] });
      } catch (err) {
        failedUpgrades += 1;
        errors.push(err);
      }
    }

    res.status(201).send({
      data: {
        RSVPdHackers,
        successfulUpgrades,
        failedUpgrades,
        notSuccessful: RSVPdHackers.length - successfulUpgrades.length,
        errors,
      },
    } as APIResponse);
  } catch (err) {
    const error = ensureError(err);
    logger.error(error);
    res.status(500).send({ error: error.message } as APIResponse);
  }
});

export const auth = onRequest(app);
