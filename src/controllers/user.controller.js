/**
 * User controllers — HTTP handlers for the /api/v1/users/* routes.
 *
 * Each controller follows the same shape:
 *   read input → validate → check rules → side effects → persist → respond
 *
 * Every controller is wrapped in `asyncHandler` so thrown errors and rejected
 * promises forward to Express's error-handling middleware automatically.
 */
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

/**
 * Helper: mint a fresh access + refresh token pair for a user and
 * persist the refresh token on the user document.
 *
 * Storing the refresh token in the DB is what makes "log this user out
 * everywhere" possible — we simply null it.
 */
const generateAccessAndRefereshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    // Skip schema validators — we're only touching the refresh token, not the
    // whole document. Avoids needless re-validation of fields like avatar.
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating referesh and access token"
    );
  }
};

/**
 * POST /register — create a new user account.
 * Accepts multipart/form-data because it includes avatar + cover image files.
 */
const registerUser = asyncHandler(async (req, res) => {
  // 1. Read text fields from req.body (parsed by multer for multipart requests)
  const { fullName, email, username, password } = req.body;

  // 2. Validate — no field may be empty/whitespace.
  //    `.some()` short-circuits the moment one bad field is found.
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // 3. Uniqueness check — Mongo $or matches if EITHER username or email exists.
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    // 409 Conflict — duplicate resource (correct code for unique-constraint violations).
    throw new ApiError(409, "User with email or username already exists");
  }

  // 4. Read uploaded files from req.files (set by multer's upload.fields([...])).
  //    Optional chaining handles "field not provided at all" cases.
  const avatarLocalPath = req.files?.avatar[0]?.path;
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  // 5. Side effect: push files to Cloudinary, get back URLs.
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  // 6. Persist the user. The pre("save") hook will hash the password.
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  // 7. Re-fetch without sensitive fields. `-` prefix excludes from projection.
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  // 201 Created — a new resource was successfully created.
  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered Successfully"));
});

/**
 * POST /login — authenticate an existing user.
 * Issues access + refresh tokens and sets them as httpOnly cookies.
 */
const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  // Accept login by either username OR email — but at least one must be present.
  if (!username && !email) {
    throw new ApiError(400, "username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  // Uses the instance method on the User model (bcrypt.compare under the hood).
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    // 401 Unauthorized — bad credentials.
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
    user._id
  );

  // Strip sensitive fields before responding.
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  /**
   * Cookie options:
   *   httpOnly — not readable by client-side JS (defends against XSS).
   *   secure   — only sent over HTTPS (set false in local dev if needed).
   * In production also consider `sameSite: "lax"` or `"strict"` for CSRF defense.
   */
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In Successfully"
      )
    );
});

/**
 * POST /logout — invalidates the refresh token server-side AND clears cookies.
 * Protected by verifyJWT middleware, which populates req.user.
 */
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      // $unset removes the field entirely (vs $set to null which keeps the key).
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true, // return the updated document (not the pre-update one)
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

/**
 * POST /refresh-token — exchange a refresh token for a new access token.
 *
 * Security note: we compare the incoming refresh token against the one stored
 * on the user document. If they don't match, the token was revoked or reused
 * after rotation — reject it.
 */
const refreshAccessToken = asyncHandler(async (req, res) => {
  // Accept the token from cookies (browser) or body (mobile clients).
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized request");
  }

  try {
    // jwt.verify throws if the token is expired or signed with a different secret.
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    // Server-side revocation check — what makes this token "stateful".
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefereshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

/**
 * POST /change-password — verify old password, then set the new one.
 * The pre("save") hook re-hashes the password automatically.
 */
const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  user.password = newPassword;
  // Skip validators — only password changed, no need to revalidate avatar etc.
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

/**
 * GET /current-user — return the currently authenticated user.
 * Trivially read from req.user populated by verifyJWT middleware.
 */
const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User fetched successfully"));
});

/**
 * PATCH /update-account — update mutable profile fields.
 * Note: email change should ideally require re-verification in production.
 */
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email: email,
      },
    },
    { new: true } // return the updated doc
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

/**
 * PATCH /avatar — replace the user's avatar image.
 * Uses multer's upload.single("avatar") → file at req.file (singular).
 */
const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  //TODO: delete old image from Cloudinary to avoid orphaned files

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading on avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar image updated successfully"));
});

/**
 * PATCH /cover-image — replace the user's cover image.
 * Same pattern as updateUserAvatar.
 */
const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image file is missing");
  }

  //TODO: delete old image from Cloudinary to avoid orphaned files

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading on avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
};
