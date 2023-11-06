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
  first_name: z.string(),
  last_name: z.string(),
  phone_number: z.string().refine(validator.isMobilePhone),

  // Demographic Section
  age: z.number(),
  country: z.string(), // possibly use api to pull countries
  school: z.string(), // possibly use api to pull schools
  education_level: z.string(), // create enum
  graduation_year: z.string().optional(), // date picker or radio button,
  highest_education_level: z.string().optional(), // create enum
  ucsc_college_affiliation: z.string().optional(), // create enum
  area_of_study: z.string(), // possibly use api to pull countries
  first_hackathon: z.boolean().optional(),

  ethnic_background: z.array(z.string()),
  pronouns: z.string(),
  gender: z.string(),
  sexual_orientation: z.string(),
  underepresented_group: z.boolean().optional(),
});

export type ApplicationSchema = z.infer<typeof ApplicationSchema>;
