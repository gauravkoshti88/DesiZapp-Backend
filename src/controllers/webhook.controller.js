import crypto from "crypto";
import Order from "../models/order.model.js";
import PaymentIntent from "../models/paymentIntentSchema.js";
import WebhookEvent from "../models/webhookEventSchema.js";

export const razorpayWebhook = async (req, res) => {
  let eventId = "";

  try {
    const signature = req.headers["x-razorpay-signature"];
    eventId = req.headers["x-razorpay-event-id"];

    if (!signature) {
      return res.status(400).json({
        success: false,
        message: "Razorpay signature missing",
      });
    }

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "Razorpay event ID missing",
      });
    }

    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      console.error("RAZORPAY_WEBHOOK_SECRET is missing");

      return res.status(500).json({
        success: false,
        message: "Webhook secret is not configured",
      });
    }

    // req.body must be raw Buffer
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(req.body)
      .digest("hex");

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid Razorpay webhook signature",
      });
    }

    const payload = JSON.parse(req.body.toString());

    const event = payload?.event;

    const paymentEntity = payload?.payload?.payment?.entity;

    const razorpayOrderEntity = payload?.payload?.order?.entity;

    const razorpayOrderId =
      paymentEntity?.order_id || razorpayOrderEntity?.id || "";

    const razorpayPaymentId = paymentEntity?.id || "";

    // Prevent duplicate webhook processing
    const existingEvent = await WebhookEvent.findOne({
      eventId,
    });

    if (existingEvent) {
      return res.status(200).json({
        success: true,
        message: "Webhook already processed",
      });
    }

    await WebhookEvent.create({
      eventId,
      event,
      razorpayOrderId,
      razorpayPaymentId,
      status: "received",
      payload,
    });

    // -----------------------------------------
    // PAYMENT CAPTURED
    // -----------------------------------------

    if (event === "payment.captured") {
      if (!razorpayOrderId || !razorpayPaymentId) {
        await WebhookEvent.findOneAndUpdate(
          { eventId },
          {
            status: "ignored",
            errorMessage: "Razorpay order/payment ID missing",
            processedAt: new Date(),
          },
        );

        return res.status(200).json({
          success: true,
        });
      }

      const order = await Order.findOne({
        razorpayOrderId,
      });

      if (!order) {
        await WebhookEvent.findOneAndUpdate(
          { eventId },
          {
            status: "ignored",
            errorMessage: "Order not found for Razorpay order",
            processedAt: new Date(),
          },
        );

        return res.status(200).json({
          success: true,
        });
      }

      // Verify payment amount
      const webhookAmount = Number(paymentEntity?.amount);

      const orderAmount = Math.round(Number(order.totalAmount) * 100);

      if (!Number.isFinite(webhookAmount) || webhookAmount !== orderAmount) {
        await WebhookEvent.findOneAndUpdate(
          { eventId },
          {
            status: "failed",
            errorMessage: `Payment amount mismatch. Razorpay: ${webhookAmount}, Order: ${orderAmount}`,
            processedAt: new Date(),
          },
        );

        console.error("Razorpay webhook amount mismatch:", {
          razorpayOrderId,
          webhookAmount,
          orderAmount,
        });

        return res.status(200).json({
          success: true,
        });
      }

      // Already paid
      if (order.payment === true) {
        await PaymentIntent.findOneAndUpdate(
          { razorpayOrderId },
          {
            razorpayPaymentId,
            status: "captured",
            capturedAt: new Date(),
          },
        );

        await WebhookEvent.findOneAndUpdate(
          { eventId },
          {
            status: "processed",
            processedAt: new Date(),
          },
        );

        return res.status(200).json({
          success: true,
          message: "Order already paid",
        });
      }

      // Mark order paid
      order.payment = true;
      order.razorpayPaymentId = razorpayPaymentId;
      order.paymentStatus = "captured";

      await order.save();

      // Update PaymentIntent
      await PaymentIntent.findOneAndUpdate(
        { razorpayOrderId },
        {
          razorpayPaymentId,
          status: "captured",
          capturedAt: new Date(),
        },
      );

      await WebhookEvent.findOneAndUpdate(
        { eventId },
        {
          status: "processed",
          processedAt: new Date(),
        },
      );

      console.log("Payment captured successfully via webhook:", {
        orderId: order._id,
        razorpayOrderId,
        razorpayPaymentId,
      });

      return res.status(200).json({
        success: true,
        message: "Payment captured successfully",
      });
    }

    // -----------------------------------------
    // PAYMENT AUTHORIZED
    // -----------------------------------------

    if (event === "payment.authorized") {
      if (razorpayOrderId) {
        await PaymentIntent.findOneAndUpdate(
          { razorpayOrderId },
          {
            razorpayPaymentId,
            status: "authorized",
          },
        );
      }

      await WebhookEvent.findOneAndUpdate(
        { eventId },
        {
          status: "processed",
          processedAt: new Date(),
        },
      );

      console.log("Payment authorized:", razorpayPaymentId);

      return res.status(200).json({
        success: true,
      });
    }

    // -----------------------------------------
    // PAYMENT FAILED
    // -----------------------------------------

    if (event === "payment.failed") {
      const failureReason =
        paymentEntity?.error_description || "Payment failed";

      const failureCode = paymentEntity?.error_code || "";

      if (razorpayOrderId) {
        await PaymentIntent.findOneAndUpdate(
          { razorpayOrderId },
          {
            razorpayPaymentId,
            status: "failed",
            failureReason,
            failureCode,
            failedAt: new Date(),
          },
        );

        const order = await Order.findOne({
          razorpayOrderId,
        });

        if (order && !order.payment) {
          order.paymentStatus = "failed";

          await order.save();
        }
      }

      await WebhookEvent.findOneAndUpdate(
        { eventId },
        {
          status: "processed",
          processedAt: new Date(),
        },
      );

      console.log("Razorpay payment failed:", {
        razorpayOrderId,
        razorpayPaymentId,
        failureReason,
      });

      return res.status(200).json({
        success: true,
      });
    }

    // -----------------------------------------
    // ORDER PAID
    // -----------------------------------------

    if (event === "order.paid") {
      if (razorpayOrderId) {
        const order = await Order.findOne({
          razorpayOrderId,
        });

        if (order && !order.payment && razorpayPaymentId) {
          order.payment = true;
          order.razorpayPaymentId = razorpayPaymentId;
          order.paymentStatus = "captured";

          await order.save();

          await PaymentIntent.findOneAndUpdate(
            { razorpayOrderId },
            {
              razorpayPaymentId,
              status: "captured",
              capturedAt: new Date(),
            },
          );
        }
      }

      await WebhookEvent.findOneAndUpdate(
        { eventId },
        {
          status: "processed",
          processedAt: new Date(),
        },
      );

      console.log("Razorpay order paid:", razorpayOrderId);

      return res.status(200).json({
        success: true,
      });
    }

    // -----------------------------------------
    // OTHER EVENTS
    // -----------------------------------------

    await WebhookEvent.findOneAndUpdate(
      { eventId },
      {
        status: "ignored",
        processedAt: new Date(),
      },
    );

    return res.status(200).json({
      success: true,
      message: `Event ${event} ignored`,
    });
  } catch (error) {
    console.error("Razorpay Webhook Error:", error);

    // If event was already stored, mark failed
    if (eventId) {
      await WebhookEvent.findOneAndUpdate(
        { eventId },
        {
          status: "failed",
          errorMessage: error.message,
          $inc: {
            attempts: 1,
          },
        },
      ).catch((updateError) => {
        console.error("Webhook event update error:", updateError);
      });
    }

    // Always let Razorpay retry failed webhook processing
    return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};
