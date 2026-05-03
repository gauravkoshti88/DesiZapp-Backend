import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
  dishname: {
    type: String,
    required: true,
    trim: true
  },
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shop",
    required: true
  },
  category: {
    type: String,
    enum: [
      "Snacks",
      "Main Course",
      "Pizza",
      "Burger",
      "Dessert",
      "Drink",
      "Sandwich",
      "Salad",
      "Fast-Food",
      "South-Indian",
      "Others"
    ],
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  foodType:{
    type: String,
    enum: [
      "Veg",
      "Non-Veg",
      "Cold",
      "Drink"
    ],
    required:true
  },
  image: {
    url: { type: String },
    public_id: { type: String }
  },
  video: {
    url: { type: String },
    public_id: { type: String }
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  rating: {
    average: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Item = mongoose.model("Item", itemSchema);

export default Item;