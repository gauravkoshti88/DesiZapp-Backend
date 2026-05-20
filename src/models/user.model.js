import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullname: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: false,
      minlength: 6,
    },
    phone: {
      type: String,
      unique: true,
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "foodPartner", "deliveryBoy"],
      required: true
    },
    profileImage: {
      url: String,
      public_id: String
    },
    address: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    otp: {
      type: String
    },
    isOtpVerified: {
      type: Boolean,
      default: false
    },
    otpExpires: {
      type: Date
    },
    socketId: {
      type: String,
    },
    isOnline: {
      type: Boolean,
      default: false
    },
    isBlocked: {
      type: Boolean,
      default: false
    },
    blockedAt: Date,
    blockedReason: String,
    orderHistory: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order"
      }
    ],
    aiRecommendationScore: {
      type: Number,
      default: 0
    },
    aiFeedback: [
      {
        suggestion: String,
        accepted: Boolean,
        createdAt: { type: Date, default: Date.now }
      }
    ],
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: {
        type: [Number],
        default: [0, 0]
      }
    }
  }, { timestamps: true }
);

userSchema.index({ location: "2dsphere" })

const User = mongoose.model("User", userSchema);

export default User;