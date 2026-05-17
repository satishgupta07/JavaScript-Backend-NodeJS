/**
 * Subscription model — a join document that models a many-to-many
 * relationship between users (subscribers ↔ channels).
 *
 * A "channel" is just another User. One Subscription document represents
 * one (subscriber, channel) pair. To find all of a channel's subscribers,
 * query: Subscription.find({ channel: channelId }).
 *
 * Note: "Subsciption" (typo) is the original collection name — kept here to
 * avoid breaking existing data. Rename via migration if needed.
 */
import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new Schema(
  {
    subscriber: {
      type: Schema.Types.ObjectId, // one who is subscribing
      ref: "User",
    },
    channel: {
      type: Schema.Types.ObjectId, // one to whom 'subscriber' is subscribing
      ref: "User",
    },
  },
  { timestamps: true }
);

export const Subsciption = mongoose.model("Subsciption", subscriptionSchema);
