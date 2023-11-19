import { onRequest } from "firebase-functions/v2/https";
import * as express from "express";
import * as cors from "cors";
import bodyParser = require("body-parser");
import { corsConfig } from "../utils/middleware";
import ensureError from "../utils/ensureError";
import { logger } from "firebase-functions/v2";
import { getFirestore } from "firebase-admin/firestore";
import { APIResponse } from "../utils/schema";

const app = express();
app.use(bodyParser.json());
app.use(cors(corsConfig));

type StatisticsDict = {
  [key: string]: {
    [key: string | number]: number;
  };
};

/**
 * Endpoint to process and create statistics collection
 */
app.post("/generate", async (req, res) => {
  try {
    // Create statistics dictionary
    const statisticsDict: StatisticsDict = {
      ages: {},
    };

    // Get all demographics
    const demographics = await getFirestore()
      .collectionGroup("sections")
      .orderBy("country")
      .get();

    // Add to statistics dictionary
    demographics.docs.map((doc) => {
      const data = doc.data();

      // age
      const age = data.age;
      if (age) {
        if (age in statisticsDict.ages) {
          statisticsDict.ages[age] += 1;
        } else {
          statisticsDict.ages[age] = 1;
        }
      }
    });

    // Convert statistics dictionary to array
    const _statistics = Object.entries(statisticsDict).reduce(
      (acc, [statFieldKey, statFieldValues]) => ({
        ...acc,
        [statFieldKey]: Object.entries(statFieldValues).map((stat) => ({
          name: stat[0],
          value: stat[1],
        })),
      }),
      []
    );

    res.status(200).send({ data: _statistics } as APIResponse);
  } catch (err) {
    const error = ensureError(err);
    res.status(500).send({ error: error.message } as APIResponse);
  }
});

/**
 * Endpoint to get statistics
 */
app.get("/", async (req, res) => {
  try {
    console.log("monkey");
    res.status(200).send("Hello World!");
  } catch (err) {
    const error = ensureError(err);
    logger.error(error);
    res.status(500).send(error.message);
  }
});

export const statistics = onRequest(app);
