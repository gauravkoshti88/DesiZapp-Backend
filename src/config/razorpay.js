import Razorpay from "razorpay";
import dotenv from "dotenv";

dotenv.config();

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId) {
  console.error("RAZORPAY_KEY_ID is missing.");
}

if (!keySecret) {
  console.error("RAZORPAY_KEY_SECRET is missing.");
}

const razorpay = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

console.log("Razorpay Config:", {
  keyIdPresent: Boolean(keyId),
  keySecretPresent: Boolean(keySecret),
  mode: keyId?.startsWith("rzp_test_")
    ? "TEST"
    : keyId?.startsWith("rzp_live_")
      ? "LIVE"
      : "UNKNOWN",
});

export default razorpay;
