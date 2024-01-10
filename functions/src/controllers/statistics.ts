import { onRequest } from "firebase-functions/v2/https";
import * as express from "express";
import * as cors from "cors";
import bodyParser = require("body-parser");
import { corsConfig } from "../utils/middleware";
import ensureError from "../utils/ensureError";
import { logger } from "firebase-functions/v2";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { APIResponse } from "../utils/schema";

const app = express();
app.use(bodyParser.json());
app.use(cors(corsConfig));

type Dict<Type> = {
  [key: string | number]: Type;
};

/**
 * Convert a Firebase timestamp to a date string in format mm-dd-yyyy
 * @param {Timestamp} timestamp Firebase timestamp
 * @return {string} date string in format mm-dd-yyyy
 */
const timestampToDate = (timestamp: Timestamp) => {
  const currentDate = timestamp.toDate();

  // Format the date and time components
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");

  return `${month}-${day}-${year}`;
};

/**
 * Increment dictionary values based on keys in data
 * @param {Dict<Dict<number>>} dict a dictionary of dictionaries of numbers,
 * where the inner dictionary is a key-value pair of a statistic and its count
 * @param {string[]} keys1 keys to increment in dict
 * @param {Dict<string>} data a dictionary of strings, where the keys are used
 * to increment dict
 */
const batchIncrementDicts = (
  dict: Dict<Dict<number>>,
  keys1: string[],
  data: Dict<string>
) => {
  for (const k of keys1) {
    if (k in data) {
      pushToDict(dict[k], data[k], 1);
    }
  }
};

/**
 * Increment a dictionary value by one based on a key
 * @param {Dict<number>} dict a dictionary of numbers
 * @param {string} key a key to increment
 * @param {value} value a value to check if exists before incrementing
 */
const pushToDict = (dict: Dict<number>, key: string, value: number) => {
  if (value) {
    if (key in dict) {
      dict[key] += 1;
    } else {
      dict[key] = 1;
    }
  }
};

/**
 * Replace empty strings and "Prefer not to answer" with "No Answer"
 * @param {Dict<string>} dict a dictionary of strings to check
 */
const cleanupNoAnswer = (dict: Dict<string>) => {
  for (const k in dict) {
    if (
      dict[k] === undefined ||
      dict[k] === "" ||
      dict[k].toLowerCase() === "prefer not to answer"
    ) {
      dict[k] = "No Answer";
    }
  }
};

/**
 * Apply data cleanup to demographics statistics
 * @param {Dict<string>} demographics demographics statistics data to clean up
 */
const cleanupDemographics = (demographics: Dict<string>) => {
  if (demographics.age) {
    const age = Number(demographics.age);

    if (age < 18) {
      demographics.age = "< 18";
    } else if (age >= 18 && age <= 25) {
      demographics.age = "18-25";
      demographics.age_range_18_to_25 = String(age);
    } else if (age > 25 && age <= 30) {
      demographics.age = "26-30";
    } else if (age > 30) {
      demographics.age = "> 30";
    }
  }

  if (demographics.gender_identity_one) {
    const providedGenderIdentityOne = [
      "Transgender",
      "Cisgender",
      "Non-binary",
      "Prefer not to answer",
    ];

    let genderIdentityOne = demographics.gender_identity_one;

    if (genderIdentityOne.toLowerCase().includes("no")) {
      genderIdentityOne = "Prefer not to answer";
    }
    if (!providedGenderIdentityOne.includes(genderIdentityOne)) {
      genderIdentityOne = "Other";
    }

    demographics.gender_identity_one = genderIdentityOne;
  }

  if (demographics.gender_identity_two) {
    const providedGenderIdentityTwo = [
      "Man",
      "Woman",
      "Non-binary",
      "Prefer not to answer",
    ];

    let genderIdentityTwo = demographics.gender_identity_two;

    if (genderIdentityTwo.toLowerCase().includes("no")) {
      genderIdentityTwo = "Prefer not to answer";
    }
    if (!providedGenderIdentityTwo.includes(genderIdentityTwo)) {
      genderIdentityTwo = "Other";
    }

    demographics.gender_identity_two = genderIdentityTwo;
  }

  if (demographics.sexual_orientation) {
    const providedSexualOrientation = [
      "Heterosexual or straight",
      "Gay or lesbian",
      "Bisexual",
      "Queer",
      "Prefer Not to Answer",
    ];

    let sexualOrientation = demographics.sexual_orientation;

    if (sexualOrientation.toLowerCase().includes("no")) {
      sexualOrientation = "Prefer Not to Answer";
    }

    if (!providedSexualOrientation.includes(sexualOrientation)) {
      sexualOrientation = "Other";
    }

    if (sexualOrientation === "Heterosexual or straight") {
      sexualOrientation = "Heterosexual";
    }

    demographics.sexual_orientation = sexualOrientation;
  }

  if (demographics.ethnic_background) {
    const providedEthnicBackground = [
      "Asian Indian",
      "Black/African",
      "Chinese",
      "Filipino",
      "Korean",
      "Guamanian/Chamorro",
      "Japanese",
      "Hispanic/Lation/Spanish Origin",
      "Middle Eastern",
      "Vietnamese",
      "Native Hawaiian",
      "Samoan",
      "Native American or Alaskan Native",
      "White",
      "Other Pacific Islander",
      "Other Asian (Cambodian, Thai, etc.)",
      "No Answer",
    ];

    let ethnicBackground = demographics.ethnic_background;

    if (ethnicBackground.toLowerCase().includes("no")) {
      ethnicBackground = "No Answer";
    }

    if (!providedEthnicBackground.includes(ethnicBackground)) {
      ethnicBackground = "Other";
    }

    demographics.ethnic_background = ethnicBackground;
  }

  if (demographics.graduation_year === "2028 and beyond") {
    demographics.graduation_year = "2028+";
  }

  if ((demographics.ucsc_college_affiliation as string).includes("N/A")) {
    demographics.ucsc_college_affiliation = "N/A";
  }

  if ((demographics.first_cruzhacks as string).includes("Yes")) {
    demographics.first_cruzhacks = "Yes";
  }
  if ((demographics.first_cruzhacks as string).includes("No")) {
    demographics.first_cruzhacks = "No";
  }

  if ((demographics.hackathon_experience as string).includes("0")) {
    demographics.hackathon_experience = "0";
  }

  cleanupNoAnswer(demographics);
};

/**
 * Apply data cleanup to logistics statistics
 * @param {Dict<string>} logistics logistics statistics data to clean up
 */
const cleanupLogistics = (logistics: Dict<string>) => {
  if ((logistics.need_travel_reimbursement as string).includes("Yes")) {
    logistics.need_travel_reimbursement = "Yes";
  }
  if ((logistics.need_travel_reimbursement as string).includes("No")) {
    logistics.need_travel_reimbursement = "No";
  }

  if ((logistics.need_charter_bus as string).includes("Yes")) {
    logistics.need_charter_bus = "Yes";
  }
  if ((logistics.need_charter_bus as string).includes("No")) {
    logistics.need_charter_bus = "No";
  }

  if ((logistics.need_campus_parking_permit as string).includes("Yes")) {
    logistics.need_campus_parking_permit = "Yes";
  }
  if ((logistics.need_campus_parking_permit as string).includes("No")) {
    logistics.need_campus_parking_permit = "No";
  }

  if (
    (logistics.attendence_possible_wo_reimbursement as string).includes("Yes")
  ) {
    logistics.attendence_possible_wo_reimbursement = "Yes";
  }
  if (
    (logistics.attendence_possible_wo_reimbursement as string).includes("No")
  ) {
    logistics.attendence_possible_wo_reimbursement = "No";
  }

  if (logistics.tshirt_size) {
    const providedTshirtSizes = [
      "XS",
      "S",
      "M",
      "L",
      "XL",
      "XXL",
      "XXXL",
      "No Answer",
    ];

    let tshirtSize = logistics.tshirt_size;

    if (!providedTshirtSizes.includes(tshirtSize)) {
      logistics.other_tshirt_size = tshirtSize;
      tshirtSize = "Other";
    }

    logistics.tshirt_size = tshirtSize;
  }

  if (logistics.dietary_restrictions) {
    const providedDietaryRestrictions = [
      "Gluten-Free",
      "Vegan",
      "Vegetarian",
      "Peanut Allergies",
      "Lactose Intolerant",
      "No Beef",
      "No Pork",
      "None",
    ];

    let dietaryRestrictions = logistics.dietary_restrictions;

    if (dietaryRestrictions.toLowerCase().includes("n/a")) {
      dietaryRestrictions = "None";
    }

    if (dietaryRestrictions.toLowerCase().includes("no beef")) {
      dietaryRestrictions = "No Beef";
    } else if (dietaryRestrictions.toLowerCase().includes("no pork")) {
      dietaryRestrictions = "No Pork";
    } else if (!providedDietaryRestrictions.includes(dietaryRestrictions)) {
      logistics.other_dietary_restrictions = dietaryRestrictions;
      dietaryRestrictions = "Other";
    }

    logistics.dietary_restrictions = dietaryRestrictions;
  }

  cleanupNoAnswer(logistics);
};

/**
 * Convert a dictionary of dictionaries of numbers to a dictionary of arrays for
 * use in react-recharts
 * @param {Dict<Dict<strings>>} dict a dictionary of dictionaries of numbers,
 * where the inner dictionary is a key-value pair of a statistic and its count
 * @return {Dict<Dict<strings>[]>} a dictionary of arrays for use in
 * react-recharts
 */
const dictToRechartsArray = (dict: Dict<Dict<number>>) => {
  return Object.entries(dict).reduce(
    (acc, [statFieldKey, statFieldValues]) => ({
      ...acc,
      [statFieldKey]: Object.entries(statFieldValues).map((stat) => ({
        name: stat[0],
        value: stat[1],
      })),
    }),
    {}
  );
};

/**
 * Endpoint to process and create statistics collection
 */
app.post("/generate", async (req, res) => {
  try {
    // Create statistics dictionary
    const statistics = {
      // const statisticsDict: StatisticsDict = {
      submissions: {
        per_day: {},
        total: 0,
        accepted: 0,
        rejected: 0,
        approvalRate: 0,
      },
      demographics: {
        age: {},
        age_range_18_to_25: {},
        ethnic_background: {},
        sexual_orientation: {},
        gender_identity_one: {},
        gender_identity_two: {},
        underepresented_group: {},

        country: {},
        ucsc_vs_non_ucsc: {},
        ucsc_college_affiliation: {},
        year_in_school: {},
        graduation_year: {},
        area_of_study: {},
        area_of_study_cs_ce_gd_other: {},
        hackathon_experience: {},
        first_cruzhacks: {},
      },
      logistics: {
        need_travel_reimbursement: {},
        need_charter_bus: {},
        need_campus_parking_permit: {},
        attendence_possible_wo_reimbursement: {},

        tshirt_size: {},
        other_tshirt_size: {},
        dietary_restrictions: {},
        other_dietary_restrictions: {},
      },
      referral: {
        cruzhacks_referral: {},
      },
    };

    // Submissions
    const applications = await getFirestore()
      .collectionGroup("user_items")
      .orderBy("_submitted")
      .get();

    statistics.submissions.total = applications.docs.length;

    applications.docs.map((doc) => {
      const data = doc.data();

      if (data.status === "accepted") {
        statistics.submissions.accepted += 1;
      } else if (data.status === "rejected") {
        statistics.submissions.rejected += 1;
      }

      const day = timestampToDate(data._submitted);

      pushToDict(statistics.submissions.per_day, day, 1);
    });

    statistics.submissions.approvalRate =
      statistics.submissions.accepted / statistics.submissions.total;

    // Demographcis
    const demographics = await getFirestore()
      .collectionGroup("sections")
      .orderBy("country")
      .get();

    demographics.docs.map((doc) => {
      const data = doc.data();

      if (data.age && data.age >= 18 && data.age <= 25) {
        data.age_range_18_to_25 = String(data.age);
      }

      if (data.area_of_study) {
        if (data.area_of_study === "Computer and Information Science") {
          data.area_of_study_cs_ce_gd_other = "CS";
        } else if (data.area_of_study === "Computer Engineering") {
          data.area_of_study_cs_ce_gd_other = "CE";
        } else if (data.area_of_study === "Game Design") {
          data.area_of_study_cs_ce_gd_other = data.area_of_study;
        } else {
          data.area_of_study_cs_ce_gd_other = "Other";
        }
      }

      data.ucsc_vs_non_ucsc =
        data.school === "University of California, Santa Cruz" ?
          "UCSC" :
          "Non-UCSC";

      cleanupDemographics(data);

      batchIncrementDicts(
        statistics.demographics,
        Object.keys(statistics.demographics),
        data
      );
    });

    // Logistics
    const logistics = await getFirestore()
      .collectionGroup("sections")
      .orderBy("need_travel_reimbursement")
      .get();

    logistics.docs.map((doc) => {
      const data = doc.data();
      cleanupLogistics(data);

      batchIncrementDicts(
        statistics.logistics,
        Object.keys(statistics.logistics),
        data
      );
    });

    // Referral
    const referral = await getFirestore()
      .collectionGroup("sections")
      .orderBy("cruzhacks_referral")
      .get();

    referral.docs.map((doc) => {
      const data = doc.data();
      cleanupNoAnswer(data);

      batchIncrementDicts(
        statistics.referral,
        Object.keys(statistics.referral),
        data
      );
    });

    await getFirestore()
      .collection("statistics")
      .doc("precomputed_unformatted")
      .set({
        ...statistics,
        _last_computed: FieldValue.serverTimestamp(),
      });

    logger.info("Statistics pre-computed; Written to firestore");

    const rechartsStatistics = {
      submissions: {
        ...dictToRechartsArray({
          per_day: statistics.submissions.per_day,
        }),
        total: statistics.submissions.total,
        accepted: statistics.submissions.accepted,
        rejected: statistics.submissions.rejected,
        approvalRate: statistics.submissions.approvalRate,
      },
      demographics: dictToRechartsArray(statistics.demographics),
      logistics: {
        ...dictToRechartsArray({
          need_travel_reimbursement:
            statistics.logistics.need_travel_reimbursement,
          need_charter_bus: statistics.logistics.need_charter_bus,
          need_campus_parking_permit:
            statistics.logistics.need_campus_parking_permit,
          attendence_possible_wo_reimbursement:
            statistics.logistics.attendence_possible_wo_reimbursement,
          other_dietary_restrictions:
            statistics.logistics.other_dietary_restrictions,
          other_tshirt_size: statistics.logistics.other_tshirt_size,
        }),
        tshirt_size: statistics.logistics.tshirt_size,
        dietary_restrictions: statistics.logistics.dietary_restrictions,
      },
      referral: dictToRechartsArray(statistics.referral),
    };

    await getFirestore()
      .collection("statistics")
      .doc("pre_computed_recharts")
      .set({
        ...rechartsStatistics,
        _last_computed: FieldValue.serverTimestamp(),
      });

    logger.info("Statistics recharts pre-computed; Written to firestore");

    res.status(201).send({ data: rechartsStatistics } as APIResponse);
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
    const statistics = await getFirestore()
      .collection("statistics")
      .doc("pre_computed_recharts")
      .get();

    if (!statistics.exists) {
      throw new Error("Statistics do not exist");
    }

    const data = statistics.data();

    res.status(200).send({ data } as APIResponse);
  } catch (err) {
    const error = ensureError(err);
    logger.error(error);
    res.status(500).send(error.message);
  }
});

export const statistics = onRequest(app);
