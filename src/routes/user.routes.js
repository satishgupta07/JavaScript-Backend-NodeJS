/**
 * User routes — maps URL patterns + HTTP verbs to controller functions.
 *
 * This file is mounted at /api/v1/users in app.js, so the full path for
 * each route is, e.g., POST /api/v1/users/register.
 *
 * Order of middleware in a `.post(...)` chain matters — they run left to right:
 *   multer (parses files) → verifyJWT (auth check) → controller (business logic)
 */
import { Router } from "express";
import {
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

// `Router()` creates a mini Express app — middleware + routes you can mount anywhere.
const router = Router();

/**
 * POST /register
 *   - upload.fields([...]) accepts multiple file fields by name.
 *   - maxCount: 1 means only one file per field.
 *   - After this middleware: req.body has text fields, req.files has files.
 */
router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);

// POST /login — no files, plain JSON body.
router.route("/login").post(loginUser);

// --- Secured routes (require a valid access token) ---

// verifyJWT runs first; if auth fails it throws and logoutUser never runs.
router.route("/logout").post(verifyJWT, logoutUser);

// /refresh-token does NOT use verifyJWT — it validates the refresh token itself.
// (The access token is likely expired at this point, which is why we're refreshing.)
router.route("/refresh-token").post(refreshAccessToken);

export default router;
