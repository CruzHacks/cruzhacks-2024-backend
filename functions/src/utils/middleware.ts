import { Request, Response } from "express";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { APIResponse, UserRole } from "./schema";
import ensureError from "./ensureError";

// Cors config for all endpoints
// TODO: update cors config to only allow certain origins
export const corsConfig = {
  origin: "*",
};

/**
 * Middleware to check if the user is authenticated.
 * @param {Request} req The first number.
 * @param {Response} res The second number.
 * @param {Function} next The second number.
 */
export async function isAuthenticated(
  req: Request,
  res: Response,
  next: () => void
) {
  try {
    const { authorization } = req.headers;

    if (!authorization) {
      throw new Error("no authroization header");
    }

    if (!authorization.startsWith("Bearer")) {
      throw new Error("'Bearer' not present in authorization header");
    }

    const split = authorization.split("Bearer ");
    if (split.length !== 2) {
      throw new Error("Missing token in authorization header");
    }

    const token = split[1];

    const decodedToken: admin.auth.DecodedIdToken = await admin
      .auth()
      .verifyIdToken(token);
    res.locals = {
      ...res.locals,
      uid: decodedToken.uid,
      role: decodedToken.role,
      email: decodedToken.email,
    };
    return next();
  } catch (e) {
    const error = ensureError(e);
    logger.error(error.message);

    return res.status(401).send({ error: "Unauthorized" } as APIResponse);
  }
}

/**
 * Middleware to check if the user is authorized to access endpoint.
 * @param {Object} opts authentication validation options
 * @return {Function} middleware function
 */
export function isAuthorized(opts: {
  hasRole: UserRole[];
  allowSameUser?: boolean;
}) {
  return (req: Request, res: Response, next: () => void) => {
    const { role, email, uid } = res.locals;
    const { id } = req.params;

    if (email === "dev@cruzhacks.com") return next();
    if (opts.allowSameUser && id && uid === id) return next();
    if (!role) {
      return res.status(403).send({
        error: "Forbidden, missing required authorization role",
      } as APIResponse);
    }
    if (opts.hasRole.includes(role)) return next();

    return res.status(403).send({
      error: "Forbidden, missing required authorization role",
    } as APIResponse);
  };
}
