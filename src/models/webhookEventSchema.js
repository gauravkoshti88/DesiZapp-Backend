import mongoose from "mongoose";

const webhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    event: {
      type: String,
      required: true,
      index: true,
    },

    razorpayOrderId: {
      type: String,
      default: "",
      index: true,
    },

    razorpayPaymentId: {
      type: String,
      default: "",
      index: true,
    },

    razorpayRefundId: {
      type: String,
      default: "",
      index: true,
    },

    status: {
      type: String,
      enum: ["received", "processed", "failed", "ignored"],
      default: "received",
      index: true,
    },

    attempts: {
      type: Number,
      default: 1,
    },

    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    errorMessage: {
      type: String,
      default: "",
    },

    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

webhookEventSchema.index({
  event: 1,
  createdAt: -1,
});

webhookEventSchema.index({
  razorpayOrderId: 1,
  createdAt: -1,
});

const WebhookEvent = mongoose.model("WebhookEvent", webhookEventSchema);

export default WebhookEvent;
