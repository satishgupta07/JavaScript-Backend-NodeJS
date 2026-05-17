/**
 * Application entry point.
 *
 * Bootstrap sequence:
 *   1. Load environment variables from `.env` into process.env (via dotenv).
 *   2. Connect to MongoDB.
 *   3. Only AFTER the DB is ready, start the HTTP server.
 *
 * Why connect to DB before listening?
 * A server that accepts requests but can't serve them is worse than one that
 * fails to start. Fail fast at boot — process managers (PM2 / Docker / systemd)
 * will restart it cleanly.
 */
import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

// Load env vars BEFORE any other module reads process.env.
// (The npm script also preloads dotenv via `-r dotenv/config` for safety.)
dotenv.config({
  path: "./.env",
});

connectDB()
  .then(() => {
    // Fallback port 8000 in case PORT isn't set in .env
    app.listen(process.env.PORT || 8000, () => {
      console.log(`⚙️ Server is running at port : ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    // If we can't reach Mongo at startup, log and let the process exit.
    console.log("MONGO db connection failed !!! ", err);
  });
