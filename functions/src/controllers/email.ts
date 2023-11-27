import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import * as express from "express";
import * as cors from "cors";
import bodyParser = require("body-parser");
import { corsConfig } from "../utils/middleware";
import * as base64 from "base-64";
import { defineString } from "firebase-functions/params";
import { APIResponse } from "../utils/schema";
import ensureError from "../utils/ensureError";

// Define some parameters
const mcServer = defineString("MAILCHIMP_SERVER");
const mcApiKey = defineString("MAILCHIMP_API_KEY");
const mcAudienceId = defineString("MAILCHIMP_AUDIANCE_ID");

const app = express();
app.use(bodyParser.json());
app.use(cors(corsConfig));

/**
 * Endpoint to subscribe to the mailing list.
 */
app.post("/subscribe", async (req, res) => {
  const { email } = req.query;

  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  try {
    const mcResponse = await fetch(
      `https://${mcServer.value()}.api.mailchimp.com/3.0/lists/${mcAudienceId.value()}/members`,
      {
        method: "POST",
        headers: {
          authorization: `Basic ${base64.encode(
            `anystring:${mcApiKey.value()}`
          )}`,
        },
        body: JSON.stringify({
          email_address: email,
          status: "subscribed",
        }),
      }
    );

    if (mcResponse.status == 200) {
      res
        .status(200)
        .json({ data: { message: "Subscribe Successful" } } as APIResponse);
      return;
    }

    const mcResponseJson = await mcResponse.json();

    if (mcResponseJson.title == "Member Exists") {
      res.status(403).json({ error: "Member Exists" } as APIResponse);
      return;
    }

    throw new Error(mcResponseJson);
  } catch (err) {
    const error = ensureError(err);
    logger.error(error.message);
    res.status(500).json({
      error: "Error subscribing to mailing list",
      data: { message: error.message },
    } as APIResponse);
    return;
  }
});

export const email = onRequest(app);
