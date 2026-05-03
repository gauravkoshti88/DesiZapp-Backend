import mongoose from "mongoose";

const shopOrderItemSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    required: true
  },
  dishname: String,
  price: Number,
  quantity: Number
})

const shopOrderSchema = new mongoose.Schema({
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  subtotal: Number,
  shopOrderItems: [shopOrderItemSchema],
  status: {
    type: String,
    enum: ["pending", "confirm", "preparing", "out of delivery", "on the way", "delivered", "rejected"],
    default: "pending"
  },
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DeliveryAssign",
    default: null
  },
  assignDeliveryBoy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  deliveryOtp: {
    type: String,
    default:null
  },
  otpExpires: {
    type: Date,
    default:null
  },
  deliveredAt:{
    type:Date,
    default:null
  }
}, { timestamps: true })

const orderSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    totalAmount: { type: Number },

    // Payment
    paymentMethod: {
      type: String,
      enum: ["COD", "ONLINE"],
      required: true
    },

    // Shipping Info
    deliveryAddress: {
      text: String,
      latitude: Number,
      longitude: Number
    },

    shopOrders: [shopOrderSchema],
    payment: {
      type: Boolean,
      default: false
    },
    razorpayOrderId: {
      type: String,
      default:""
    },
    razorpayPaymentId: {
      type: String,
      default:""
    },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
export default Order;