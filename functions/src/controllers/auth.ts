import { onRequest } from "firebase-functions/v2/https";
import * as express from "express";
import * as cors from "cors";
import bodyParser = require("body-parser");
import { isAuthenticated, isAuthorized } from "../utils/middleware";
import { getFirestore } from "firebase-admin/firestore";
import ensureError from "../utils/ensureError";
import { logger } from "firebase-functions/v2";

const app = express();
app.use(bodyParser.json());
app.use(cors({ origin: true }));

/**
 * Endpoint to check if the user's role is synced with their custom claims.
 */
app.get("/checkRoleSynced", isAuthenticated, async (req, res) => {
  try {
    await getFirestore()
      .collection("users")
      .doc(res.locals.uid)
      .get()
      .then((doc) => {
        const firestoreRole = doc.data()?.role;
        const customClaimRole = res.locals.role;
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
 * Endpoint to check if the user is authenticated.
 */
app.get("/checkAuthenticated", isAuthenticated, (req, res) => {
  res.status(200).send("Hello from Firebase!");
});

/**
 * Endpoint to check if the user is authenticated and has the role of "hacker".
 */
app.get(
  "/testAuthenticatedAdmin",
  isAuthorized({ hasRole: "admin" }),
  (req, res) => {
    res.status(200).send("Hello from Firebase!");
  }
);

export const auth = onRequest(app);
