import { onRequest } from "firebase-functions/v2/https";
import * as express from "express";
import * as cors from "cors";
import bodyParser = require("body-parser");
import { corsConfig, isAuthenticated } from "../utils/middleware";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  APIResponse,
  ApplicationSchema,
  ApplicationSchemaDto,
} from "../utils/schema";
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
    const application = ApplicationSchemaDto.parse(req.body);
    if (!application.user) throw new Error("No user provided");

    let email = application.user.email;

    await getAuth()
      .createUser({
        email: email,
        password: application.user.password,
        phoneNumber: `+1 ${application.user.phone_number}`,
        // eslint-disable-next-line
        displayName: `${application.user.first_name} ${application.user.last_name}`,
      })
      .then((userRecord) => {
        if (userRecord && userRecord.email) {
          email = userRecord.email;
        }
        logger.info("Successfully created user from application", email);
      })
      .catch((err) => {
        throw new Error(err.message);
      });

    const appDoc: ApplicationSchema = {
      status: "submitted",
      email: email,
      _submitted: FieldValue.serverTimestamp(),
      _last_committed: FieldValue.serverTimestamp(),
    };

    await getFirestore()
      .collection("users")
      .doc(email)
      .collection("user_items")
      .doc("application")
      .set(appDoc);

    await getFirestore().doc(`users/${email}`).set({
      pronouns: application.demographics.pronouns,
      checkedIn: false,
      _last_committed: FieldValue.serverTimestamp(),
    });

    await getFirestore()
      .collection(`users/${email}/user_items/application/sections`)
      .doc("demographics")
      .set({ email, ...application.demographics });

    await getFirestore()
      .collection(`users/${email}/user_items/application/sections`)
      .doc("short_response")
      .set({ email, ...application.short_response });

    await getFirestore()
      .collection(`users/${email}/user_items/application/sections`)
      .doc("logistics")
      .set({ email, ...application.logistics });

    await getFirestore()
      .collection(`users/${email}/user_items/application/sections`)
      .doc("socials")
      .set({ email, ...application.socials });

      await getFirestore()
      .collection(`users/${email}/user_items/`)
      .doc("team")
      .set({ invites: [], teamName: "", teamLeader: "" });

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
      data: {
        message: error.message,
      },
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
    const application = ApplicationSchemaDto.parse(req.body);
    const email = res.locals.email;

    const appDoc: ApplicationSchema = {
      status: "submitted",
      email: email,
      _submitted: FieldValue.serverTimestamp(),
      _last_committed: FieldValue.serverTimestamp(),
    };

    await getFirestore()
      .collection("users")
      .doc(email)
      .collection("user_items")
      .doc("application")
      .set(appDoc);

    await getFirestore().doc(`users/${email}`).set({
      pronouns: application.demographics.pronouns,
      _last_committed: FieldValue.serverTimestamp(),
    });

    await getFirestore()
      .collection(`users/${email}/user_items/application/sections`)
      .doc("demographics")
      .set(application.demographics);

    await getFirestore()
      .collection(`users/${email}/user_items/application/sections`)
      .doc("short_response")
      .set(application.short_response);

    await getFirestore()
      .collection(`users/${email}/user_items/application/sections`)
      .doc("logistics")
      .set(application.logistics);

    await getFirestore()
      .collection(`users/${email}/user_items/application/sections`)
      .doc("socials")
      .set(application.socials);

    if (application.user) {
      getAuth()
        .updateUser(res.locals.uid, {
          phoneNumber: `+1 ${application.user.phone_number}`,
          // eslint-disable-next-line
          displayName: `${application.user.first_name} ${application.user.last_name}`,
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
    }

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
