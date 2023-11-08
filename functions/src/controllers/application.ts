import { onRequest } from "firebase-functions/v2/https";
import * as express from "express";
import * as cors from "cors";
import bodyParser = require("body-parser");
import { corsConfig, isAuthenticated } from "../utils/middleware";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { APIResponse, ApplicationSchema } from "../utils/schema";
import { ZodError } from "zod";
import { logger } from "firebase-functions/v2";
import ensureError from "../utils/ensureError";
import { getAuth } from "firebase-admin/auth";

const app = express();
app.use(bodyParser.json());
app.use(cors(corsConfig));

/**
 * Endpoint to save and update application data and create a user account.
 */
app.post("/unauthenticated", async (req, res) => {
  try {
    const application = ApplicationSchema.parse(req.body);
    const email = application.email;

    await getAuth()
      .createUser({
        email: application.email,
        password: application.password,
        phoneNumber: `+1 ${application.demographics.phone_number}`,
        // eslint-disable-next-line
        displayName: `${application.demographics.first_name} ${application.demographics.last_name}`,
      })
      .then((userRecord) => {
        logger.info(
          "Successfully created user from application",
          userRecord.email
        );
      })
      .catch((err) => {
        throw new Error(err.message);
      });

    await getFirestore()
      .collection("users")
      .doc(email)
      .collection("user_items")
      .doc("application")
      .set({
        _last_committed: FieldValue.serverTimestamp(),
      });

    await getFirestore().doc(`users/${email}`).set({
      pronouons: application.demographics.pronouns,
      first_hackathon: application.demographics.first_hackathon,
      _last_committed: FieldValue.serverTimestamp(),
    });

    await getFirestore()
      .collection(`users/${email}/user_items/application/sections`)
      .doc("demographics")
      .set(application.demographics);

    await getFirestore()
      .collection(`users/${email}/user_items/application/sections`)
      .doc("short_responses")
      .set(application.short_responses);

    await getFirestore()
      .collection(`users/${email}/user_items/application/sections`)
      .doc("logistics")
      .set(application.logistics);

    await getFirestore()
      .collection(`users/${email}/user_items/application/sections`)
      .doc("socials")
      .set(application.socials);

    res.status(200).send({
      data: {
        message: "Application saved successfully and user account created",
      },
    } as APIResponse);
  } catch (err) {
    if (err instanceof ZodError) {
      logger.error(
        "User Application invalid shape:",
        JSON.stringify(err.issues)
      );
      res.status(400).send({
        error: "Invalid Application Data",
        data: { issues: err.issues },
      } as APIResponse);
      return;
    }

    const error = ensureError(err);
    logger.error(error);
    res.status(500).send({
      error: "Internal server error, could not complete request.",
    } as APIResponse);
  }
});

/**
 * Endpoint to save and update application data when user has an account.
 *
 * NOTE: Necessary since profile data is updated simultaneously.
 */
app.post("/authenticated", isAuthenticated, async (req, res) => {
  try {
    const application = ApplicationSchema.parse(req.body);
    const email = res.locals.email;

    await getFirestore()
      .collection("users")
      .doc(email)
      .collection("user_items")
      .doc("application")
      .set({
        _last_committed: FieldValue.serverTimestamp(),
      });

    await getFirestore().doc(`users/${email}`).set({
      pronouons: application.demographics.pronouns,
      first_hackathon: application.demographics.first_hackathon,
      _last_committed: FieldValue.serverTimestamp(),
    });

    await getFirestore()
      .collection(`users/${email}/user_items/application/sections`)
      .doc("demographics")
      .set(application.demographics);

    await getFirestore()
      .collection(`users/${email}/user_items/application/sections`)
      .doc("short_responses")
      .set(application.short_responses);

    await getFirestore()
      .collection(`users/${email}/user_items/application/sections`)
      .doc("logistics")
      .set(application.logistics);

    await getFirestore()
      .collection(`users/${email}/user_items/application/sections`)
      .doc("socials")
      .set(application.socials);

    getAuth()
      .updateUser(res.locals.uid, {
        phoneNumber: `+1 ${application.demographics.phone_number}`,
        // eslint-disable-next-line
        displayName: `${application.demographics.first_name} ${application.demographics.last_name}`,
      })
      .then((userRecord) => {
        logger.info(
          "Successfully updated phone number and display name for user",
          userRecord.email
        );
      })
      .catch((err) => {
        throw new Error(err.message);
      });

    res.status(200).send({
      data: {
        message: "Application saved successfully",
      },
    } as APIResponse);
  } catch (err) {
    if (err instanceof ZodError) {
      logger.error(
        "User Application invalid shape:",
        JSON.stringify(err.issues)
      );
      res.status(400).send({
        error: "Invalid Application Data",
        data: { issues: err.issues },
      } as APIResponse);
      return;
    }

    const error = ensureError(err);
    logger.error(error);
    res.status(500).send({
      error: "Internal server error, could not complete request.",
    } as APIResponse);
  }
});

export const application = onRequest(app);
