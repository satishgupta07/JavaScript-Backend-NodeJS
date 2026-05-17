/**
 * Video model — represents an uploaded video.
 *
 * The video file itself lives on Cloudinary (CDN); we only store its URL here.
 * That keeps the DB small and lets the CDN handle bandwidth + transcoding.
 */
import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema(
  {
    videoFile: {
      type: String, // cloudinary url
      required: true,
    },
    thumbnail: {
      type: String, // cloudinary url
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    duration: {
      type: Number, // seconds — supplied by Cloudinary on upload
      required: true,
    },
    views: {
      type: Number,
      default: 0,
    },
    isPublished: {
      type: Boolean,
      default: true, // a draft mode would default to false
    },
    // Owner is a reference to a User document.
    // Use .populate("owner") to fetch the user inline when reading.
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Plugin: adds .aggregatePaginate() to the model.
 * Lets us paginate aggregation pipelines (e.g. complex feed/search queries)
 * without manually managing $skip + $limit + total counts.
 */
videoSchema.plugin(mongooseAggregatePaginate);

export const Video = mongoose.model("Video", videoSchema);
