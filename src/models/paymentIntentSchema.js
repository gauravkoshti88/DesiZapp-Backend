import mongoose from "mongoose";

const paymentIntentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },

    intentKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    razorpayOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    razorpayPaymentId: {
      type: String,
      default: "",
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
    },

    paymentMethod: {
      type: String,
      enum: ["ONLINE"],
      default: "ONLINE",
    },

    status: {
      type: String,
      enum: [
        "created",
        "attempted",
        "authorized",
        "captured",
        "failed",
        "expired",
        "cancelled",
      ],
      default: "created",
      index: true,
    },

    failureReason: {
      type: String,
      default: "",
    },

    failureCode: {
      type: String,
      default: "",
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    capturedAt: {
      type: Date,
      default: null,
    },

    failedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

paymentIntentSchema.index({
  user: 1,
  createdAt: -1,
});

paymentIntentSchema.index({
  status: 1,
  expiresAt: 1,
});

const PaymentIntent = mongoose.model("PaymentIntent", paymentIntentSchema);

export default PaymentIntent;
