/**
 * Express app configuration.
 *
 * This file does NOT start the server — it only builds the `app` object.
 * Keeping `app.js` (config) and `index.js` (start) separate makes the app
 * easier to test (you can `import { app }` into a test runner like Supertest
 * without binding a port).
 *
 * Middleware order matters — each request flows top-down through the stack.
 */
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

/**
 * CORS — Cross-Origin Resource Sharing.
 * Browsers block JS on origin A from calling API on origin B unless the API
 * explicitly opts in. `credentials: true` is required to send/receive cookies
 * across origins (needed for our httpOnly auth cookies).
 */
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

// Parse JSON request bodies. The size limit guards against payload-flood DoS.
app.use(express.json({ limit: "16kb" }));

// Parse URL-encoded form bodies (e.g. <form> submissions).
// `extended: true` lets us send nested objects via the `qs` library.
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// Serve static assets (images, css, etc.) directly from /public.
app.use(express.static("public"));

// Parse the `Cookie` header into `req.cookies`. Needed for httpOnly auth cookies.
app.use(cookieParser());

//routes import
import userRouter from "./routes/user.routes.js";

// Mount the user router at /api/v1/users.
// Versioning the API (/v1) from day one means breaking changes can ship as /v2
// without breaking existing clients.
app.use("/api/v1/users", userRouter);

// Example: http://localhost:8000/api/v1/users/register

export { app };
