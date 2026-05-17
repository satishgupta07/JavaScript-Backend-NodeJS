/**
 * Auth middleware — verifies the JWT on incoming requests and attaches the
 * resolved user document to `req.user`.
 *
 * Usage:
 *   router.route("/logout").post(verifyJWT, logoutUser);
 *
 * Mount this BEFORE the controller on any route that should be protected.
 * The middleware either calls next() (auth passed) or throws (auth failed).
 */
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

// We don't use the `res` argument here, hence the conventional `_` placeholder.
export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    /**
     * Token resolution — accept from EITHER source:
     *   1. httpOnly cookie  (browser flow — set on login)
     *   2. Authorization header  (mobile clients, server-to-server)
     *
     * The `Bearer ` prefix is the OAuth 2.0 convention for token-based auth.
     */
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    console.log(token);
    if (!token) {
      // 401 Unauthorized — "I don't know who you are" (vs 403 "you can't do this").
      throw new ApiError(401, "Unauthorized request");
    }

    // jwt.verify throws if signature is bad OR token is expired.
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // Load the user from DB. Even though the JWT payload has the _id, we
    // re-fetch to (a) confirm the user still exists and (b) get fresh data.
    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );

    if (!user) {
      throw new ApiError(401, "Invalid Access Token");
    }

    // Attach the user to the request so downstream handlers can use it.
    // e.g. logoutUser reads req.user._id.
    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid access token");
  }
});
