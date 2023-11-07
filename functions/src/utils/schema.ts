/**
 * This file contains all the schemas for the data stored in Firestore.
 * Including data validation through zod.
 */

import { z } from "zod";
import validator from "validator";

// Server responses should always adhere to the following schema
export const APIResponseSchema = z.object({
  error: z.string().optional(),
  data: z.any().optional(),
});

export type APIResponse = z.infer<typeof APIResponseSchema>;

/**
 * Firestore collection that stores user's role
 *
 * $USER_ROLES_COLLECTION/:email
 */
export const USER_ROLES_COLLECTION = "user_roles";

export const UserRoles = ["applicant", "hacker", "judge", "admin"] as const;
export type UserRole = (typeof UserRoles)[number];

export const UserRolesSchema = z.object({
  role: z.enum(UserRoles),
  // TODO: specify correct Timestamp type
  _last_committed: z.any(),
});

export type UserRolesSchema = z.infer<typeof UserRolesSchema>;

/**
 * Firestore collection that stores user's applications
 *
 * $USER_DATA_COLLECTION/:email
 */
export const USER_APPLICATION_COLLECTION = "applications";

// TODO: update with correct schema
export const ApplicationSchema = z.object({
  first_name: z.string()
    .refine((firstName) => firstName.length > 0, {
      message: "First name is required",
    }),
  last_name: z.string()
    .refine((lastName) => lastName.length > 0, {
      message: "Last name is required",
    }),
  phone_number: z.string().refine(validator.isMobilePhone, {
    message: "Invalid phone number",
  }),

  // Demographic Section
  country: z.string()
    .refine((country) => country.length > 0, {
      message: "Country is required",
    }), // possibly use api to pull countries
  school: z.string()
    .refine((school) => school.length > 0, {
      message: "School is required",
    }), // possibly use api to pull schools
  education_level: z.string()
    .refine((educationLevel) => educationLevel.length > 0, {
      message: "Education level is required",
    }), // create enum
  graduation_year: z.string().optional()
    .refine((gradYear) => !gradYear || gradYear.length > 0, {
      message: "Invalid graduation year",
    }), // date picker or radio button,
  highest_education_level: z.string().optional()
    .refine((educationLevel) =>
      !educationLevel || educationLevel.length > 0, {
      message: "Invalid highest education level",
    }), // create enum
  ucsc_college_affiliation: z.string().optional()
    .refine((collegeAffiliation) =>
      !collegeAffiliation || collegeAffiliation.length > 0, {
      message: "Invalid UCSC college affiliation",
    }), // create enum
  area_of_study: z.string()
    .refine((areaOfStudy) => areaOfStudy.length > 0, {
      message: "Area of study is required",
    }), // possibly use api to pull countries
  first_hackathon: z.boolean().optional(),

  ethnic_background: z.array(z.string().refine(
    (ethnicity) => ethnicity.length > 0, {
      message: "Ethnic background is required",
    })),
  pronouns: z.string().refine((pronoun) => pronoun.length > 0, {
    message: "Pronouns are required",
  }),
  gender: z.string().refine((gender) => gender.length > 0, {
    message: "Gender is required",
  }),
  sexual_orientation: z.string().refine(
    (orientation) => orientation.length > 0, {
      message: "Sexual orientation is required",
    }),
  underepresented_group: z.boolean().optional(),

  // Short Answer Questions
  why_attend: z.object({
    question: z.literal("Why do you want to attend CruzHacks"),
    answer: z.string()
      .refine((answer) => answer.length <= 1500, {
        message: "Answer should not exceed 1500 characters.",
      })
      .refine((answer) => answer.length > 0, {
        message: "Answer is required",
      }),
  }),
  what_see: z.object({
    question: z.literal("What would you like to see at CruzHacks this year"),
    answer: z.string()
      .refine((answer) => answer.length <= 1500, {
        message: "Answer should not exceed 1500 characters.",
      })
      .refine((answer) => answer.length > 0, {
        message: "Answer is required",
      }),
  }),
  grandest_invention: z.object({
    question: z.literal(
      "Excluding all outside factors (money, technology development, etc), " +
      "what is the grandest invention you would want to create or see"
    ),
    answer: z.string()
      .refine((answer) => answer.length <= 1500, {
        message: "Answer should not exceed 1500 characters.",
      })
      .refine((answer) => answer.length > 0, {
        message: "Answer is required",
      }),
  }),
});

export type ApplicationSchema = z.infer<typeof ApplicationSchema>;
