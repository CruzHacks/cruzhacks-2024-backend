import { onRequest } from "firebase-functions/v2/https";
import * as express from "express";
import * as cors from "cors";
import bodyParser = require("body-parser");
import { corsConfig, isAuthenticated, isAuthorized } from "../utils/middleware";
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
      pronouons: application.demographics.pronouns,
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
      pronouons: application.demographics.pronouns,
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

app.get(
  "/export",
  isAuthenticated,
  isAuthorized({ hasRole: ["admin"] }),
  async (req, res) => {
    try {
      const submissions = await getFirestore()
        .collectionGroup("user_items")
        .orderBy("_submitted")
        .get();

      const emails = submissions.docs.map((doc) => doc.data().email);

      // eslint-disable-next-line
      const applications: any = submissions.docs.reduce((acc, doc) => {
        if (!doc.data()) return acc;

        return {
          ...acc,
          [doc.data().email]: {
            submission: {
              status: doc.data().status,
              rsvp: doc.data().rsvp,
              _submitted: doc.data()._submitted.toDate(),
            },
          },
        };
      }, {});

      await getAuth()
        .listUsers(1000)
        .then((userRecords) => {
          userRecords.users.forEach((user) => {
            if (!user.email) return;
            if (!emails.includes(user.email)) return;

            if (user.email in applications) {
              applications[user.email].user = {
                email: user.email,
                phone_number: user.phoneNumber,
                display_name: user.displayName,
              };
            }
          });
        });

      await getFirestore()
        .collectionGroup("users")
        .get()
        .then((users) => {
          users.docs.forEach((doc) => {
            const user = doc.data();
            if (!user.pronouons) return;
            if (!emails.includes(doc.id)) return;

            if (doc.id in applications) {
              applications[doc.id].user.checked_in = user.checkedIn;
            }
          });
        });

      await getFirestore()
        .collectionGroup("sections")
        .orderBy("country")
        .get()
        .then((demographics) =>
          demographics.docs.forEach((doc) => {
            const { email, ...demo } = doc.data();
            if (!emails.includes(email)) return;

            if (email in applications) {
              applications[email].demographics = demo;
            }
          })
        );

      await getFirestore()
        .collectionGroup("sections")
        .orderBy("grand_invention")
        .get()
        .then((shortResponse) =>
          shortResponse.docs.forEach((doc) => {
            const { email, ...short } = doc.data();
            if (!emails.includes(email)) return;

            if (email in applications) {
              applications[email].short_response = short;
            }
          })
        );

      await getFirestore()
        .collectionGroup("sections")
        .orderBy("need_travel_reimbursement")
        .get()
        .then((logistics) =>
          logistics.docs.forEach((doc) => {
            const { email, ...log } = doc.data();
            if (!emails.includes(email)) return;

            if (email in applications) {
              applications[email].logistics = log;
            }
          })
        );

      await getFirestore()
        .collectionGroup("sections")
        .orderBy("cruzhacks_referral")
        .get()
        .then((socials) =>
          socials.docs.forEach((doc) => {
            const { email, ...social } = doc.data();
            if (!emails.includes(email)) return;

            if (email in applications) {
              applications[email].socials = social;
            }
          })
        );

      const applicationsArray = Object.keys(applications).map((key) => ({
        ...applications[key],
      }));

      logger.info("Successfully exported applications");

      res.status(200).send({
        data: {
          applications: applicationsArray,
        },
      } as APIResponse);
    } catch (err) {
      const error = ensureError(err);
      logger.error(error);
      res.status(500).send({
        error: "Internal server error, could not complete request.",
        data: {
          message: error.message,
          error: error,
        },
      } as APIResponse);
    }
  }
);

export const application = onRequest(app);
