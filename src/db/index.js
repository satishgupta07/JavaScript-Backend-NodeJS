/**
 * MongoDB connection using Mongoose.
 *
 * Mongoose is an ODM (Object Document Mapper) — think "ORM but for MongoDB".
 * It adds schemas, validation, middleware (hooks), and query helpers on top
 * of the raw MongoDB driver.
 *
 * `mongoose.connect()` returns a Promise. We wrap it in async/await for
 * readable error handling, then export the function so `index.js` can await
 * it before starting the HTTP server.
 */
import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
  try {
    // The connection URI looks like: mongodb://localhost:27017/videotube
    // Mongoose will create the database lazily on first write if it doesn't exist.
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}/${DB_NAME}`
    );
    console.log(
      `\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`
    );
  } catch (error) {
    console.log("MONGODB connection FAILED ", error);
    // Exit code 1 = abnormal termination. A process manager will restart us.
    // We must NOT keep the server alive without a DB connection.
    process.exit(1);
  }
};

export default connectDB;
