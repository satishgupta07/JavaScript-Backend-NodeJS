/**
 * Cloudinary upload utility.
 *
 * Flow:
 *   1. Multer saves the uploaded file to /public/temp on our local disk.
 *   2. We hand that path to Cloudinary, which streams the file to its CDN.
 *   3. Cloudinary returns metadata (including the public URL).
 *   4. We delete the local temp file — whether the upload succeeded or failed.
 *
 * Why local-disk-first instead of streaming straight from the request?
 *   - The file is fully on disk before we touch the network → simpler retries.
 *   - We can validate/scan files before sending them off-server.
 *   - Multer's diskStorage is simpler than memory or stream storage.
 */
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Configure the Cloudinary SDK once at module load.
// These env vars come from your Cloudinary dashboard.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    // Optional field — bail out gracefully if the caller didn't supply a path.
    if (!localFilePath) return null;

    // resource_type: "auto" — Cloudinary detects images vs videos vs raw files.
    // folder: organizes uploads in the Cloudinary dashboard.
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      folder: process.env.CLOUDINARY_FOLDER_NAME,
    });

    console.log("file is uploaded on cloudinary ", response.url);

    // Sync delete is fine here — file is small and we want to free disk space
    // before the function returns.
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    /**
     * Clean up the temp file on failure too — otherwise the /public/temp
     * directory slowly fills up with orphaned files.
     * Async unlink here (vs sync above) so we don't block the error path.
     */
    if (localFilePath) {
      fs.unlink(localFilePath, (unlinkError) => {
        if (unlinkError) {
          console.error("Error deleting local file:", unlinkError);
        }
      });
    }
    console.error("Error uploading to Cloudinary:", error);
    return null;
  }
};

export { uploadOnCloudinary };
