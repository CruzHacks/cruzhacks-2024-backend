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
 */
export const UserRoles = ["applicant", "hacker", "judge", "admin"] as const;
export type UserRole = (typeof UserRoles)[number];

export const UserRolesSchema = z.object({
  role: z.enum(UserRoles),
  // TODO: specify correct Timestamp type
  _last_committed: z.any(),
});

export type UserRolesSchema = z.infer<typeof UserRolesSchema>;

/**
 * Firestore collection that stores user's application data.
 * Contains a subcollection called sections wich contains the various sections
 * of the application.
 */
export const ApplicationStatuses = [
  "draft",
  "submitted",
  "accepted",
  "rejected",
] as const;
export type ApplicationStatus = (typeof ApplicationStatuses)[number];

export const ApplicationSchema = z.object({
  status: z.enum(ApplicationStatuses),
  email: z.string(),
  _submitted: z.any(),
  _last_committed: z.any(),
});
export type ApplicationSchema = z.infer<typeof ApplicationSchema>;

// Section 0 - User Information
export const AppUserSchema = z.object({
  email: z.string(),
  phone_number: z
    .string()
    .refine(validator.isMobilePhone, "Invalid phone number."),
  password: z.string(),
  first_name: z.string().min(1, "First name must be at least 1 character."),
  last_name: z.string(),
});
export type AppUserSchema = z.infer<typeof AppUserSchema>;

// Section 1 - Demographics
export const AppDemographicsSchema = z.object({
  age: z
    .number()
    .min(12, "Must be at least 12 years old.")
    .max(120, "Invalid age."),
  country: z.string(),
  school: z.string(),

  year_in_school: z.string(),

  education_level: z.string(),

  ucsc_student: z.boolean(),
  ucsc_college_affiliation: z.string().optional(),

  graduation_year: z.number().optional(),

  area_of_study: z.string().array(),

  first_hackathon: z.boolean(),
  hackathon_experience: z.string(),
  tech_experience: z.string().max(1500, "Character limit exceeded."),

  ethnic_background: z.string().array(),

  pronouns: z.string(),

  gender: z.string(),

  sexual_orientation: z.string().optional(),

  underepresented_group: z.string().optional(),
});
export type AppDemographicsSchema = z.infer<typeof AppDemographicsSchema>;

// Section 2 - short response
export const AppShortResponseSchema = z.object({
  responses: z
    .object({
      question: z.string().max(1500, "Question supplied is too long."),
      answer: z
        .string()
        .min(0, "Please provide an answer.")
        .max(1500, "Charater limit exceeded."),
    })
    .array(),
});
export type AppShortResponseSchema = z.infer<typeof AppShortResponseSchema>;

// Section 3 - logistcs
export const AppLogisticsSchema = z.object({
  need_travel_reimbursement: z.string(),
  need_charter_bus: z.string(),
  attendence_possible_wo_reimbursement: z.string(),

  need_campus_parking_permit: z.string(),
  travel_plan: z.string().max(1500, "Character limit exceeded."),

  tshirt_size: z.string(),
  dietary_restrictions: z.string(),
});
export type AppLogisticsSchema = z.infer<typeof AppLogisticsSchema>;

// Section 4 - socials
export const AppSocialsSchema = z.object({
  resume_drop_form: z.boolean(),

  linked_in: z.string().url().optional(),
  github: z.string().url().optional(),
  discord: z.string().optional(),

  cruzhacks_referral: z.string().optional(), // how did you hear about CruzHacks
  // email of person who referred
  cruzhacks_refferal_email: z.string().optional(),
  cruzhacks_refferal_organization: z.string().optional(),
});
export type AppSocialsSchema = z.infer<typeof AppSocialsSchema>;

// Application Transfer Schema, used for recieving application data from the
// client
export const ApplicationSchemaDto = z.object({
  user: AppUserSchema.optional(),
  demographics: AppDemographicsSchema,
  short_responses: AppShortResponseSchema,
  logistics: AppLogisticsSchema,
  socials: AppSocialsSchema,
});
export type ApplicationSchemaDto = z.infer<typeof ApplicationSchemaDto>;
