/**
 * Express router for providing authentication related routes.
 * @module routers/auth
 * @requires express
 */

import { onRequest } from "firebase-functions/v2/https";
import * as express from "express";
import * as cors from "cors";
import bodyParser = require("body-parser");
import { isAuthenticated } from "../utils/middleware";

/**
 * Express router to mount authentication related functions on.
 * @type {object}
 * @const
 * @namespace authRouter
 */
const app = express();
app.use(bodyParser.json());
app.use(cors({ origin: true }));

/**
 * Route for testing if routes are working.
 * @name get/test
 * @function
 * @memberof module:routers/auth~authRouter
 * @inner
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 */
app.get("/test", (req, res) => {
  res.status(200).send("Hello from Firebase!");
});

/**
 * Route for testing if user is authenticated.
 * @name get/test
 * @function
 * @memberof module:routers/auth~authRouter
 * @inner
 * @param {string} path - Express path
 * @param {callback} middleware - Express middleware.
 */
app.get("/testAuthenticated", isAuthenticated, (req, res) => {
  res.status(200).send("Hello from Firebase!");
});

export const auth = onRequest(app);
