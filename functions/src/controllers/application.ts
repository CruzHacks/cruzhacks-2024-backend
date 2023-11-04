import { onRequest } from "firebase-functions/v2/https";
import * as express from "express";
import * as cors from "cors";
import bodyParser = require("body-parser");
import { corsConfig, isAuthenticated } from "../utils/middleware";
import { getFirestore } from "firebase-admin/firestore";
import {
  ApplicationSchema,
  USER_APPLICATION_COLLECTION,
} from "../utils/schema";
import { ZodError } from "zod";
import { logger } from "firebase-functions/v2";
import ensureError from "../utils/ensureError";
import { getAuth } from "firebase-admin/auth";

const app = express();
app.use(bodyParser.json());
app.use(cors(corsConfig));

/**
 * Endpoint to save and update application data.
 *
 * NOTE: Necessary since profile data is updated simultaneously.
 */
app.post("/", isAuthenticated, async (req, res) => {
  try {
    const application = ApplicationSchema.parse(req.body);

    await getFirestore()
      .collection(USER_APPLICATION_COLLECTION)
      .doc(res.locals.email)
      .set(application, { merge: false });

    getAuth()
      .updateUser(res.locals.uid, {
        phoneNumber: `+1 ${application.phone_number}`,
        displayName: `${application.first_name} ${application.last_name}`,
      })
      .then((userRecord) => {
        logger.info(`Successfully updated user ${userRecord.uid}`);
      })
      .catch((err) => {
        throw new Error(err.message);
      });

    res.status(200).send({ message: "Application saved successfully" });
  } catch (err) {
    if (err instanceof ZodError) {
      logger.error(
        "User Application invalid shape:",
        JSON.stringify(err.issues)
      );
      res
        .status(400)
        .send({ message: "Invalid Application Data", issues: err.issues });
      return;
    }

    const error = ensureError(err);
    logger.error(error);
    res.status(500).send({
      message: "Internal server error, could not complete request.",
    });
  }
});

export const application = onRequest(app);
