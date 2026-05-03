import mongoose from "mongoose";

const shopSchema = new mongoose.Schema(
  {
    restaurantName: {
      type: String,
      required: true,
    },
    image: {
      url: { type: String },
      public_id: { type: String }
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    shopStatus: {
      type: Boolean,
      default: true,
    },
    address: {
      type: String,
      required: true
    },
    foodItems: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Item",
      },
    ],
    orders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order"
      }
    ]
  },
  { timestamps: true }
);

const Shop = mongoose.model("Shop", shopSchema);

export default Shop;