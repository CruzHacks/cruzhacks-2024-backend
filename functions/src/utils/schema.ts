/**
 * This file contains all the schemas for the data stored in Firestore.
 * Including data validation through zod.
 */

import { z } from "zod";

/**
 * Firestore collection that stores user's role
 *
 * $USER_ROLES_COLLECTION/:userId
 */
export const USER_ROLES_COLLECTION = "user_role";

export const UserRoles = ["applicant", "hacker", "judge", "admin"] as const;
export type UserRole = (typeof UserRoles)[number];

export const UserRolesSchema = z.object({
  role: z.enum(UserRoles),
  // TODO: specify correct Timestamp type
  _last_committed: z.any(),
});

export type UserRolesSchema = z.infer<typeof UserRolesSchema>;
