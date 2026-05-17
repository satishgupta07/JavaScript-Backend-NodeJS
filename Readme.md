# JavaScript Backend NodeJS

A step-by-step learning repo for building production-grade backends with **Node.js**, **Express.js**, and **MongoDB**. The running example is a YouTube-style backend (`videotube`) that covers everything from a bare HTTP server to JWT auth, cookies, file uploads, and refresh-token rotation.


> Data model reference: [Eraser workspace](https://app.eraser.io/workspace/YtPqZ1VogxGy1jzIDkzj?origin=share)

---

## Table of Contents

1. [Prerequisites & Setup](#1-prerequisites--setup)
2. [Project Structure](#2-project-structure)
3. [Node.js Basics](#3-nodejs-basics)
4. [Environment Variables with dotenv](#4-environment-variables-with-dotenv)
5. [Express.js — The Web Framework](#5-expressjs--the-web-framework)
6. [Middleware Deep Dive](#6-middleware-deep-dive)
7. [MongoDB & Mongoose](#7-mongodb--mongoose)
8. [Designing Schemas & Models](#8-designing-schemas--models)
9. [Controllers & The Request/Response Cycle](#9-controllers--the-requestresponse-cycle)
10. [Routing in Express](#10-routing-in-express)
11. [Reading Input — Body, Params, Query](#11-reading-input--body-params-query)
12. [HTTP Status Codes](#12-http-status-codes)
13. [Custom Utilities — ApiError, ApiResponse, asyncHandler](#13-custom-utilities--apierror-apiresponse-asynchandler)
14. [Authentication with JWT](#14-authentication-with-jwt)
15. [Cookies & Secure Sessions](#15-cookies--secure-sessions)
16. [Access Token vs Refresh Token](#16-access-token-vs-refresh-token)
17. [Password Hashing with bcrypt](#17-password-hashing-with-bcrypt)
18. [File Uploads with Multer](#18-file-uploads-with-multer)
19. [Cloud Storage with Cloudinary](#19-cloud-storage-with-cloudinary)
20. [Protected Routes & Auth Middleware](#20-protected-routes--auth-middleware)
21. [Error Handling Patterns](#21-error-handling-patterns)
22. [Running the Project](#22-running-the-project)

---

## 1. Prerequisites & Setup

You should be comfortable with:
- Modern JavaScript (ES modules, `async/await`, destructuring, spread/rest) — see [javascript-handbook](https://github.com/satishgupta07/javascript-handbook)
- HTTP basics (methods, status codes, headers, cookies)
- A package manager (`npm` or `yarn`)

Install Node.js (LTS), MongoDB (local or Atlas cloud), and a HTTP client like Postman or Thunder Client.

Clone and install:

```bash
git clone https://github.com/satishgupta07/JavaScript-Backend-NodeJS.git
cd JavaScript-Backend-NodeJS
npm install
```

Create a `.env` file in the project root (see [Step 4](#4-environment-variables-with-dotenv) for the full list of variables).

---

## 2. Project Structure

A clean structure scales well. This repo follows a layered pattern:

```
src/
├── index.js              ← entry point: load env, connect DB, start server
├── app.js                ← Express app: middlewares + routes
├── constants.js          ← shared constants (DB name, enums)
├── db/
│   └── index.js          ← MongoDB connection logic
├── models/               ← Mongoose schemas (User, Video, Subscription)
├── controllers/          ← business logic per resource
├── routes/               ← URL → controller mapping
├── middlewares/          ← auth, multer (file upload)
└── utils/                ← ApiError, ApiResponse, asyncHandler, cloudinary
```

**Why this split?** Each layer has one job. Routes only declare URLs, controllers hold logic, models talk to the DB, middlewares run cross-cutting concerns. Swapping any one layer doesn't ripple through the others.

---

## 3. Node.js Basics

**Node.js** is a JavaScript runtime built on Chrome's V8 engine that lets you run JavaScript outside the browser. It's:
- **Single-threaded** with a non-blocking, event-driven I/O model
- **Module-based** — code is organized into modules (CommonJS or ES Modules)
- **npm-powered** — the largest package ecosystem in the world

This repo uses **ES Modules** (`import`/`export`). That's enabled by `"type": "module"` in [package.json](package.json).

The entry point [src/index.js](src/index.js) shows the canonical bootstrap sequence:

```js
import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({ path: "./.env" });

connectDB()
  .then(() => {
    app.listen(process.env.PORT || 8000, () => {
      console.log(`Server is running at port : ${process.env.PORT}`);
    });
  })
  .catch((err) => console.log("MONGO db connection failed !!! ", err));
```

**Why connect to DB first, then `listen`?** A server with no DB can only return errors. Failing fast at startup is better than accepting requests you can't serve.

---

## 4. Environment Variables with dotenv

Never commit secrets. `dotenv` loads key-value pairs from a `.env` file into `process.env`.

Create a `.env` file (already gitignored):

```
PORT=8000
MONGODB_URI=mongodb://localhost:27017
CORS_ORIGIN=http://localhost:3000

ACCESS_TOKEN_SECRET=your-long-random-string
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_SECRET=another-long-random-string
REFRESH_TOKEN_EXPIRY=10d

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER_NAME=videotube
```

The `dev` script preloads it: `nodemon -r dotenv/config --experimental-json-modules src/index.js`. The `-r dotenv/config` flag means env vars are available *before* any other module imports run — important when modules read `process.env` at the top level.

---

## 5. Express.js — The Web Framework

**Express** is a minimal, unopinionated web framework that sits on top of Node's `http` module. It gives you routing, middleware composition, and request/response helpers.

See [src/app.js](src/app.js):

```js
import express from "express";
const app = express();
```

`app` is the Express application instance. Everything — middlewares, routes, error handlers — attaches to it.

**Mental model:** Express is a pipeline. A request enters one end, flows through middlewares (in order), eventually hits a route handler, and a response flows back out.

---

## 6. Middleware Deep Dive

Middleware is just a function with the signature `(req, res, next) => { ... }`. It can mutate `req`/`res`, end the response, or pass control to the next middleware via `next()`.

This project uses these app-level middlewares in [src/app.js](src/app.js):

```js
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());
```

| Middleware | Purpose |
|---|---|
| `cors` | Allows requests from a different origin (e.g. your React frontend). `credentials: true` lets cookies cross origins. |
| `express.json` | Parses JSON request bodies. The `limit` guards against payload-flood attacks. |
| `express.urlencoded` | Parses form data (`application/x-www-form-urlencoded`). `extended: true` allows nested objects. |
| `express.static` | Serves files from `public/` directly (images, CSS, etc.). |
| `cookie-parser` | Parses the `Cookie` header into `req.cookies`. |

**Order matters.** A `cors` middleware placed after a route never runs for that route.

---

## 7. MongoDB & Mongoose

**MongoDB** is a document database — data is stored as JSON-like documents in collections. It's schemaless at the engine level, but schemas help you stay sane.

**Mongoose** is the most popular MongoDB ODM (Object Document Mapper) for Node.js. It adds schemas, validation, middleware (hooks), and convenient query helpers.

Connection lives in [src/db/index.js](src/db/index.js):

```js
import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}/${DB_NAME}`
    );
    console.log(`MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
  } catch (error) {
    console.log("MONGODB connection FAILED ", error);
    process.exit(1);
  }
};
```

**Why `process.exit(1)` on failure?** If the DB is unreachable at boot, there's no recovery path inside this process. Exiting lets your process manager (PM2, Docker, systemd) restart it cleanly.

---

## 8. Designing Schemas & Models

A Mongoose **schema** defines the shape of documents; a **model** is the compiled, queryable interface over a collection.

Look at the user schema in [src/models/user.model.js](src/models/user.model.js):

```js
const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    fullName: { type: String, required: true, trim: true, index: true },
    avatar:   { type: String, required: true },        // cloudinary url
    coverImage: { type: String },
    watchHistory: [{ type: Schema.Types.ObjectId, ref: "Video" }],
    password: { type: String, required: [true, "Password is required"] },
    refreshToken: { type: String },
  },
  { timestamps: true }
);
```

Key concepts:
- **`required`, `unique`, `trim`, `lowercase`** — validators run before save.
- **`index: true`** — creates a database index on that field for faster lookups (`findOne({ username })` becomes O(log n)).
- **`timestamps: true`** — Mongoose auto-adds `createdAt` and `updatedAt`.
- **`ref: "Video"`** — sets up a relationship. `watchHistory` stores video IDs and can be `.populate()`d on read.

### Relationships

[src/models/subscription.model.js](src/models/subscription.model.js) models a **many-to-many** relationship between users (subscribers ↔ channels) by introducing a join document:

```js
const subscriptionSchema = new Schema({
  subscriber: { type: Schema.Types.ObjectId, ref: "User" }, // one who is subscribing
  channel:    { type: Schema.Types.ObjectId, ref: "User" }, // one being subscribed to
}, { timestamps: true });
```

### Schema methods & hooks

Models can carry behavior. The user model uses both:

```js
// Hook: hash password before saving (only if it changed)
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Instance method: compare a candidate password with the stored hash
userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};
```

### Plugins

[src/models/video.model.js](src/models/video.model.js) uses `mongoose-aggregate-paginate-v2` to paginate aggregation pipelines:

```js
videoSchema.plugin(mongooseAggregatePaginate);
```

This becomes critical once you build feed/search endpoints over millions of videos.

---

## 9. Controllers & The Request/Response Cycle

A **controller** is the function that handles a route. It reads from `req`, talks to models, and writes to `res`.

Walk through `registerUser` in [src/controllers/user.controller.js](src/controllers/user.controller.js):

```js
const registerUser = asyncHandler(async (req, res) => {
  // 1. Read input
  const { fullName, email, username, password } = req.body;

  // 2. Validate
  if ([fullName, email, username, password].some((f) => f?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  // 3. Business rules — uniqueness
  const existedUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existedUser) throw new ApiError(409, "User with email or username already exists");

  // 4. Side effects — file uploads
  const avatarLocalPath = req.files?.avatar[0]?.path;
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  // 5. Persist
  const user = await User.create({ fullName, email, password, username, avatar: avatar.url, ... });

  // 6. Respond (without sensitive fields)
  const createdUser = await User.findById(user._id).select("-password -refreshToken");
  return res.status(201).json(new ApiResponse(201, createdUser, "User registered Successfully"));
});
```

Notice the consistent 6-step shape: **read → validate → check rules → side effects → persist → respond**. Every controller in this repo follows it.

---

## 10. Routing in Express

Routes map URL patterns + HTTP verbs to controllers. Group routes per resource for cleanliness.

[src/routes/user.routes.js](src/routes/user.routes.js):

```js
const router = Router();

router.route("/register").post(
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  registerUser
);

router.route("/login").post(loginUser);

// secured routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);

export default router;
```

The router is then mounted in [src/app.js](src/app.js):

```js
import userRouter from "./routes/user.routes.js";
app.use("/api/v1/users", userRouter);
// → POST http://localhost:8000/api/v1/users/register
```

**`/api/v1`** — version your API from day one. When you ship v2 with breaking changes, v1 keeps working for older clients.

---

## 11. Reading Input — Body, Params, Query

A controller has **three** primary places to read input from. Knowing which to use is half the battle.

| Source | Lives in | When to use | Example URL |
|---|---|---|---|
| **Body** | `req.body` | Sending data — create/update payloads | `POST /users` + JSON body |
| **Route params** | `req.params` | Identifying a specific resource | `GET /users/:id` → `/users/42` |
| **Query string** | `req.query` | Filtering, sorting, paginating, searching | `GET /videos?page=2&limit=10` |

### 11.1 `req.body` — The Request Body

The body carries the **payload** of POST/PUT/PATCH requests. To read it, you must register a body-parser middleware first (already done in [src/app.js](src/app.js)):

```js
app.use(express.json({ limit: "16kb" }));            // parses application/json
app.use(express.urlencoded({ extended: true, ... })); // parses form posts
```

Then `req.body` is a regular JS object. From `loginUser` in [src/controllers/user.controller.js](src/controllers/user.controller.js):

```js
const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;   // destructure JSON body
  // ...
});
```

The client sends:
```http
POST /api/v1/users/login
Content-Type: application/json

{ "email": "satish@example.com", "password": "secret123" }
```

> **For file uploads**, the body is `multipart/form-data` — `express.json()` won't parse it. That's why we use **Multer** ([Chapter 18](#18-file-uploads-with-multer)), which exposes text fields on `req.body` and files on `req.files`., which exposes text fields on `req.body` and files on `req.files`.

### 11.2 `req.params` — Route Parameters (Passing IDs in the URL)

Route params are **named placeholders** in the URL path. They identify *which* resource the request targets.

Define them with `:name` in the route:

```js
router.route("/c/:username").get(getUserChannelProfile);
router.route("/videos/:videoId").get(getVideoById);
router.route("/users/:userId/videos/:videoId").delete(removeVideo);
```

Read them inside the controller:

```js
const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;          // /c/satish → "satish"
  if (!username?.trim()) {
    throw new ApiError(400, "username is missing");
  }
  // ...
});
```

A real request:
```http
GET /api/v1/users/c/satish
```

**Why URL params instead of body for IDs?**
- They're **part of the resource address** — `GET /users/42` *is* "the user with id 42". The URL alone identifies what you're fetching.
- `GET` requests cannot have a body (by spec). Anything identifying the resource must live in the URL.
- They're **cacheable** and **bookmarkable** — proxies, browsers, and CDNs key on the full URL.

**Validating MongoDB ObjectIds** (a common gotcha):

```js
import mongoose from "mongoose";

const { videoId } = req.params;
if (!mongoose.isValidObjectId(videoId)) {
  throw new ApiError(400, "Invalid videoId");
}
const video = await Video.findById(videoId);
if (!video) throw new ApiError(404, "Video not found");
```

Skip this check and a malformed id like `/videos/xyz` will throw a noisy `CastError` deep inside Mongoose.

### 11.3 `req.query` — Query String Parameters

Everything after `?` in a URL is the **query string**. Express parses it into `req.query` automatically. Use it for *optional* parameters: filtering, sorting, pagination, search.

```http
GET /api/v1/videos?page=2&limit=10&sortBy=views&order=desc&q=react
```

```js
const getAllVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    order = "desc",
    q,
  } = req.query;

  // ⚠️ query values are ALWAYS strings — convert before doing math
  const skip = (Number(page) - 1) * Number(limit);

  const filter = q ? { title: { $regex: q, $options: "i" } } : {};
  const videos = await Video.find(filter)
    .sort({ [sortBy]: order === "desc" ? -1 : 1 })
    .skip(skip)
    .limit(Number(limit));

  return res.status(200).json(new ApiResponse(200, videos));
});
```

**Common pitfall:** `req.query.page` is the string `"2"`, not the number `2`. Always coerce with `Number()`, `parseInt()`, or a validator like Zod/Joi.

### 11.4 Quick decision guide

| You want to… | Use |
|---|---|
| Send the new user's data on signup | `req.body` |
| Look up a specific user by id | `req.params.userId` |
| Search/filter/paginate a list | `req.query` |
| Upload an avatar file | `req.files` (with Multer) |
| Read an auth token from the request | `req.cookies` or `req.headers.authorization` |

---

## 12. HTTP Status Codes

Status codes are the API's **first-line of communication**. A consistent, correct code tells the client *what happened* before they even read the body. They are grouped into five classes by the first digit:

| Class | Meaning |
|---|---|
| **1xx** | Informational (rarely used directly) |
| **2xx** | Success — the request worked |
| **3xx** | Redirection — go look somewhere else |
| **4xx** | Client error — *you* did something wrong |
| **5xx** | Server error — *we* messed up |

### 12.1 The codes you'll actually use

| Code | Name | When to send it |
|---|---|---|
| **200** | OK | Successful GET / PUT / PATCH / DELETE — anything that doesn't create a resource |
| **201** | Created | Successful POST that created a new resource (used in `registerUser`) |
| **204** | No Content | Successful request with no body to return (e.g. a DELETE with no payload) |
| **301** | Moved Permanently | Resource has a new permanent URL |
| **302** | Found | Temporary redirect |
| **304** | Not Modified | Caching — client's cached copy is still fresh |
| **400** | Bad Request | Validation failure, malformed JSON, missing fields |
| **401** | Unauthorized | No / invalid auth credentials (despite the name, this is about *auth-n*) |
| **403** | Forbidden | Authenticated but not allowed (auth-z failure) |
| **404** | Not Found | Resource doesn't exist |
| **409** | Conflict | Duplicate key — e.g. registering an email that already exists |
| **422** | Unprocessable Entity | Semantically wrong input that passed shape validation |
| **429** | Too Many Requests | Rate-limited |
| **500** | Internal Server Error | Unhandled exception, DB crash, etc. |
| **502** | Bad Gateway | Upstream service returned an invalid response |
| **503** | Service Unavailable | Overloaded or down for maintenance |

### 12.2 401 vs 403 — the one everyone gets wrong

- **401 Unauthorized** = "I don't know who you are." → Send when token is missing/invalid. *Used in* [src/middlewares/auth.middleware.js](src/middlewares/auth.middleware.js).
- **403 Forbidden** = "I know who you are, but you can't do this." → Send when a logged-in user lacks permission.

### 12.3 How this repo uses them

Scanning the controllers and middlewares:

```js
// 201 — new user created
return res.status(201).json(new ApiResponse(201, createdUser, "User registered Successfully"));

// 200 — login succeeded (no new resource was created — the user already existed)
return res.status(200).json(new ApiResponse(200, { user, accessToken, refreshToken }, "User logged In Successfully"));

// 400 — missing required fields
throw new ApiError(400, "All fields are required");

// 401 — no token / bad token
throw new ApiError(401, "Unauthorized request");

// 404 — user lookup failed
throw new ApiError(404, "User does not exist");

// 409 — username/email already taken
throw new ApiError(409, "User with email or username already exists");

// 500 — unexpected server-side failure
throw new ApiError(500, "Something went wrong while generating referesh and access token");
```

### 12.4 Setting the status

Two equivalent ways in Express:

```js
res.status(201).json({ ... });    // most common
res.json({ ... });                // defaults to 200
res.sendStatus(204);              // sets status AND ends the response (no body)
```

The `ApiResponse` utility derives `success` from the status (`statusCode < 400`) — that's why the body stays consistent: client code can branch on either `response.success` or `response.statusCode` without ambiguity.

### 12.5 Rules of thumb

1. **Don't return 200 with `{ error: "..." }`.** That breaks every HTTP client, proxy, and monitoring tool. If it failed, send a 4xx/5xx.
2. **Use 201 only for POSTs that created a resource.** Login/refresh/logout aren't creations — they're 200.
3. **Validation errors are 400, not 500.** A user typo isn't a server bug.
4. **5xx means "alert me."** If you're throwing 500 for missing input, your monitoring will be useless.

---

## 13. Custom Utilities — ApiError, ApiResponse, asyncHandler

Standardizing how you throw errors and shape responses makes a backend predictable.

### asyncHandler — [src/utils/asyncHandler.js](src/utils/asyncHandler.js)

Express 4 doesn't natively forward `async` rejections to error middleware. This wrapper does:

```js
const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};
```

Wrap every async controller in it — no more dangling `.catch()` blocks.

### ApiError — [src/utils/ApiError.js](src/utils/ApiError.js)

A custom `Error` subclass with HTTP-specific fields:

```js
class ApiError extends Error {
  constructor(statusCode, message = "Something went wrong", errors = [], stack = "") {
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.success = false;
    this.errors = errors;
    // ...
  }
}
```

### ApiResponse — [src/utils/ApiResponse.js](src/utils/ApiResponse.js)

Consistent success envelope:

```js
class ApiResponse {
  constructor(statusCode, data, message = "Success") {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }
}
```

Now every response — success or failure — has `success`, `message`, `data`, and `statusCode`. Frontend code becomes simpler.

---

## 14. Authentication with JWT

A **JSON Web Token (JWT)** is a signed, self-contained token: `header.payload.signature` ([jwt.io intro](https://jwt.io/introduction)). The server can verify it without a session store.

The user model issues two flavors of tokens in [src/models/user.model.js](src/models/user.model.js):

```js
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { _id: this._id, email: this.email, username: this.username, fullName: this.fullName },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { _id: this._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
};
```

**Why two secrets?** Compromise of one doesn't compromise the other. **Why is the refresh payload minimal?** It only needs to identify the user — no leakage of email/username if it's intercepted.

---

## 15. Cookies & Secure Sessions

Storing JWTs in `localStorage` exposes them to XSS. **`httpOnly` cookies** are immune to JavaScript access.

From `loginUser` in [src/controllers/user.controller.js](src/controllers/user.controller.js):

```js
const options = { httpOnly: true, secure: true };

return res
  .status(200)
  .cookie("accessToken", accessToken, options)
  .cookie("refreshToken", refreshToken, options)
  .json(new ApiResponse(200, { user, accessToken, refreshToken }, "User logged In Successfully"));
```

- **`httpOnly: true`** — JS on the page cannot read the cookie.
- **`secure: true`** — cookie is only sent over HTTPS.
- (Production tip) add `sameSite: "strict"` or `"lax"` to defend against CSRF.

---

## 16. Access Token vs Refresh Token

| | Access Token | Refresh Token |
|---|---|---|
| **Purpose** | Authorize each API request | Get a new access token when it expires |
| **Lifetime** | Short (minutes – hours) | Long (days – weeks) |
| **Sent on** | Every protected request | Only to the `/refresh-token` endpoint |
| **Stored** | Memory or httpOnly cookie | httpOnly cookie + DB (`user.refreshToken`) |
| **Revocable** | No (until it expires) | Yes — null the DB field |

The flow lives in `refreshAccessToken`:

```js
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) throw new ApiError(401, "unauthorized request");

  const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
  const user = await User.findById(decodedToken?._id);

  if (incomingRefreshToken !== user?.refreshToken) {
    throw new ApiError(401, "Refresh token is expired or used");
  }

  const { accessToken, newRefreshToken } = await generateAccessAndRefereshTokens(user._id);
  // ... set cookies + respond
});
```

The DB comparison (`incomingRefreshToken !== user.refreshToken`) lets you **revoke** a refresh token by overwriting it on logout or password change — true session control.

---

## 17. Password Hashing with bcrypt

**Never store plaintext passwords.** Bcrypt is a slow, salted hash specifically designed to resist brute-force attacks.

The hook in [src/models/user.model.js](src/models/user.model.js) hashes on save:

```js
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();   // important guard
  this.password = await bcrypt.hash(this.password, 10);
  next();
});
```

The `!this.isModified("password")` check prevents re-hashing an already-hashed password on every update.

The cost factor `10` is a 2^10 round count — high enough to slow attackers, low enough to keep login under a few hundred milliseconds. Tune upward as hardware improves.

Verification:

```js
userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};
```

---

## 18. File Uploads with Multer

**Multer** parses `multipart/form-data` (the only body type that supports files) and writes uploaded files to disk or memory.

[src/middlewares/multer.middleware.js](src/middlewares/multer.middleware.js):

```js
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

export const upload = multer({ storage });
```

Wire it into a route as middleware before the controller. The route in [src/routes/user.routes.js](src/routes/user.routes.js) accepts two named files:

```js
router.route("/register").post(
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  registerUser
);
```

Inside the controller, files are exposed via `req.files`:

```js
const avatarLocalPath = req.files?.avatar[0]?.path;
```

Why land them on disk first? To stream uploads to Cloudinary in the next step without holding huge buffers in memory.

---

## 19. Cloud Storage with Cloudinary

A production server shouldn't store user-uploaded files on its own filesystem (it doesn't scale across instances and dies with the container). Push them to a CDN like **Cloudinary**, **AWS S3**, or **Cloudflare R2**.

[src/utils/cloudinary.js](src/utils/cloudinary.js):

```js
const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      folder: process.env.CLOUDINARY_FOLDER_NAME,
    });
    fs.unlinkSync(localFilePath);   // delete temp file after upload
    return response;
  } catch (error) {
    if (localFilePath) fs.unlink(localFilePath, () => {}); // cleanup on failure too
    return null;
  }
};
```

Two important details:
1. **`resource_type: "auto"`** — Cloudinary auto-detects images vs videos.
2. **Cleanup on success *and* failure** — never leak files in the temp dir.

Persist only the returned `url` in MongoDB, not the file itself.

---

## 20. Protected Routes & Auth Middleware

A route is "protected" when it requires a valid access token. Middleware verifies the token and attaches the user to the request.

[src/middlewares/auth.middleware.js](src/middlewares/auth.middleware.js):

```js
export const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) throw new ApiError(401, "Unauthorized request");

    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

    if (!user) throw new ApiError(401, "Invalid Access Token");

    req.user = user;  // downstream handlers can read req.user
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid access token");
  }
});
```

It supports **both** cookies (browser flow) and `Authorization: Bearer ...` headers (mobile / server-to-server). Then any controller can read `req.user`:

```js
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } });
  // ... clear cookies and respond
});
```

---

## 21. Error Handling Patterns

The pattern in this repo:
1. **Throw** an `ApiError` from anywhere (`throw new ApiError(400, "...")`).
2. The `asyncHandler` wrapper catches the rejection and calls `next(err)`.
3. Express forwards it to an error-handling middleware (you can add a global one in `app.js`).
4. The client always gets the same shape — no more guessing.

Anti-pattern this avoids: leaking stack traces, sending half-written responses, or silently swallowing errors in `try/catch` blocks.

---

## 22. Running the Project

```bash
# install
npm install

# add your .env (see Step 4)

# run in dev mode (nodemon + dotenv preload)
npm run dev
```

Open Postman and try:

| Method | URL | Body |
|---|---|---|
| `POST` | `/api/v1/users/register` | form-data: `fullName`, `email`, `username`, `password`, `avatar` (file), `coverImage` (file) |
| `POST` | `/api/v1/users/login` | JSON: `{ "email": "...", "password": "..." }` |
| `POST` | `/api/v1/users/logout` | Header: `Authorization: Bearer <accessToken>` |
| `POST` | `/api/v1/users/refresh-token` | Cookie or JSON: `refreshToken` |

---
