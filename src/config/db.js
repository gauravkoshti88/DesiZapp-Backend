import mongoose from "mongoose";

async function dbConnect() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("✅ Database Connected Successfully");
  } catch (error) {
    console.error("❌ DB Connection Error:", error.message);
    process.exit(1);
  }
}

export default dbConnect;
