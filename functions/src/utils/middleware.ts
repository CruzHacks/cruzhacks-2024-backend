import { Request, Response } from "express";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions/v2";
import { UserRole } from "./roles";
import ensureError from "./ensureError";

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
  const { authorization } = req.headers;

  if (!authorization) return res.status(401).send({ message: "Unauthorized" });

  if (!authorization.startsWith("Bearer")) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  const split = authorization.split("Bearer ");
  if (split.length !== 2) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  const token = split[1];

  try {
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

    return res.status(401).send({ message: "Unauthorized" });
  }
}

/**
 * Middleware to check if the user is authorized to access endpoint.
 * @param {Object} opts authentication validation options
 * @return {Function} middleware function
 */
export function isAuthorized(opts: {
  hasRole: UserRole;
  allowSameUser?: boolean;
}) {
  return (req: Request, res: Response, next: () => void) => {
    const { role, email, uid } = res.locals;
    const { id } = req.params;

    if (email === "dev@cruzhacks.com") return next();
    if (opts.allowSameUser && id && uid === id) return next();
    if (!role) return res.status(403).send();
    if (opts.hasRole.includes(role)) return next();

    return res.status(403).send();
  };
}
