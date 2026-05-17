/**
 * Multer middleware — parses multipart/form-data so we can accept file uploads.
 *
 * Why files land on disk first (instead of streaming straight to Cloudinary):
 *   - Simpler error handling (the file is fully on disk before we touch the network).
 *   - We can retry the Cloudinary upload without re-uploading from the client.
 *   - The Cloudinary util deletes the temp file after a successful upload.
 */
import multer from "multer";

// diskStorage = save to local filesystem. Alternative: memoryStorage (RAM only).
const storage = multer.diskStorage({
  // Destination folder for incoming files.
  // Must exist before the server starts (see /public/temp/.gitkeep).
  destination: function (req, file, cb) {
    cb(null, "./public/temp");
  },
  // Filename strategy. Using `file.originalname` is simple but risks collisions
  // when two users upload files with the same name simultaneously.
  // For production, prefix with a UUID or timestamp.
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

// Export the configured multer instance. Routes use it like:
//   upload.single("avatar")             — one file
//   upload.fields([{ name, maxCount }]) — multiple named fields
//   upload.array("photos", 10)          — array of same-named files
export const upload = multer({
  storage,
});
