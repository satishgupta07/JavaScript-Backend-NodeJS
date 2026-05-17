/**
 * User model — represents a user account in the `users` collection.
 *
 * Mongoose flow:
 *   1. Define a Schema (the shape + validators + indexes).
 *   2. Attach instance methods / static methods / hooks to it.
 *   3. Compile it into a Model with `mongoose.model("User", schema)`.
 *   4. Use the Model to query / create / update documents.
 */
import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,    // creates a unique index — DB enforces no duplicates
      lowercase: true, // auto-lowercase on save (so "Satish" and "satish" collide)
      trim: true,      // strip surrounding whitespace
      index: true,     // additional index for fast lookups (find by username)
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    avatar: {
      type: String, // cloudinary url — we store the URL, not the file
      required: true,
    },
    coverImage: {
      type: String, // cloudinary url (optional)
    },
    // Array of references to Video documents.
    // We store ObjectIds and use .populate() to fetch the actual videos when needed.
    watchHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: "Video",
      },
    ],
    password: {
      type: String,
      // Array form lets us supply a custom validation error message.
      required: [true, "Password is required"],
    },
    refreshToken: {
      type: String,
      // Nullable on purpose — set on login, cleared on logout.
    },
  },
  {
    // Auto-add `createdAt` and `updatedAt` fields, maintained by Mongoose.
    timestamps: true,
  }
);

/**
 * Pre-save hook: hash the password before persisting.
 *
 * Why the `isModified` guard?
 *   The hook fires on every save, including profile updates that don't touch
 *   the password. Without this check we'd hash an already-hashed value,
 *   silently locking the user out.
 *
 * Why `function` and not an arrow?
 *   Arrows don't bind `this`. Mongoose hooks rely on `this` being the document.
 */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  // Cost factor 10 = 2^10 rounds. Higher = slower = harder to brute-force.
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

/**
 * Instance method: compare a plaintext candidate against the stored hash.
 * bcrypt.compare is timing-safe — don't replace with `===`.
 */
userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

/**
 * Short-lived token sent on every authenticated request.
 * Payload includes identifying fields so middleware doesn't need an extra DB hit.
 */
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      username: this.username,
      fullName: this.fullName,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};

/**
 * Long-lived token used only to mint new access tokens.
 * Minimal payload (just _id) — if intercepted, it leaks less.
 * We ALSO store this on the user document so we can revoke it (logout, etc).
 */
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

// Compile the schema into a Model.
// Mongoose pluralizes "User" → collection name `users`.
export const User = mongoose.model("User", userSchema);
