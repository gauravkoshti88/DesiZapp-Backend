import DeliveryAssign from "../models/deliveryAssign.model.js";
import Order from "../models/order.model.js";
import Shop from "../models/shop.model.js";
import User from "../models/user.model.js";
import { sendDeliveryOtpMail } from "../utils/mail.js";
import dotenv from "dotenv";
import PaymentIntent from "../models/paymentIntentSchema.js";
import WebhookEvent from "../models/webhookEventSchema.js";
import razorpay from "../config/razorpay.js";

dotenv.config();

const finalizePaidOrder = async ({
  req,
  order,
  razorpayPaymentId,
  paymentAmount,
}) => {
  if (!order) {
    throw new Error("Order not found.");
  }

  const expectedAmount = Math.round(Number(order.totalAmount) * 100);

  if (Number(paymentAmount) !== expectedAmount) {
    throw new Error("Payment amount mismatch.");
  }

  if (
    order.razorpayPaymentId &&
    order.razorpayPaymentId !== razorpayPaymentId
  ) {
    throw new Error("Payment ID mismatch.");
  }

  // Atomically mark the order as paid.
  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      payment: { $ne: true },
    },
    {
      $set: {
        payment: true,
        paymentStatus: "captured",
        razorpayPaymentId,
      },
    },
    {
      new: true,
    },
  );

  let finalOrder = updatedOrder;

  // Another request may have already marked it paid.
  if (!finalOrder) {
    finalOrder = await Order.findById(order._id);
  }

  if (!finalOrder) {
    throw new Error("Order not found after payment finalization.");
  }

  // Keep Razorpay payment ID if it was already stored.
  if (
    !finalOrder.razorpayPaymentId ||
    finalOrder.razorpayPaymentId !== razorpayPaymentId
  ) {
    finalOrder.razorpayPaymentId = razorpayPaymentId;
    finalOrder.payment = true;
    finalOrder.paymentStatus = "captured";
    await finalOrder.save();
  }

  // Update PaymentIntent.
  if (finalOrder.razorpayOrderId) {
    await PaymentIntent.findOneAndUpdate(
      {
        razorpayOrderId: finalOrder.razorpayOrderId,
      },
      {
        $set: {
          order: finalOrder._id,
          razorpayPaymentId,
          status: "captured",
          capturedAt: new Date(),
        },
      },
    );
  }

  // Claim realtime notification only once.
  const notificationClaim = await Order.findOneAndUpdate(
    {
      _id: finalOrder._id,
      paymentOrderNotified: { $ne: true },
    },
    {
      $set: {
        paymentOrderNotified: true,
      },
    },
    {
      new: true,
    },
  );

  if (notificationClaim) {
    const populatedOrder = await Order.findById(finalOrder._id)
      .populate("shopOrders.shop")
      .populate("shopOrders.shopOrderItems.item")
      .populate("customer");

    const io = req?.app?.get("io");

    if (io) {
      for (const shopOrder of populatedOrder.shopOrders) {
        const ownerId = shopOrder?.shop?.owner;

        if (!ownerId) continue;

        const owner = await User.findById(ownerId).select("socketId");

        const ownerSocketId = owner?.socketId;

        if (!ownerSocketId) continue;

        console.log("Emitting paid newOrder to:", ownerSocketId);

        io.to(ownerSocketId).emit("newOrder", {
          order: populatedOrder,
          shopOrder,
        });
      }
    }

    finalOrder = populatedOrder;
  }

  return finalOrder;
};

export const placeOrder = async (req, res) => {
  try {
    const { cartItems, paymentMethod, deliveryAddress, totalAmount } = req.body;

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({
        error: "Cart is empty",
      });
    }

    if (!deliveryAddress) {
      return res.status(400).json({
        error: "Delivery address is required",
      });
    }

    if (
      !deliveryAddress.text ||
      deliveryAddress.latitude === undefined ||
      deliveryAddress.longitude === undefined
    ) {
      return res.status(400).json({
        error: "Send Complete Delivery Address",
      });
    }

    const groupItemsByShop = {};

    cartItems.forEach((item) => {
      const shopId = item.shop?._id || item.shop;

      if (!shopId) {
        throw new Error("Shop ID is missing from cart item");
      }

      if (!groupItemsByShop[shopId]) {
        groupItemsByShop[shopId] = [];
      }

      groupItemsByShop[shopId].push(item);
    });

    const shopOrders = await Promise.all(
      Object.keys(groupItemsByShop).map(async (shopId) => {
        const shop = await Shop.findById(shopId).populate("owner");

        if (!shop) {
          throw new Error(`Shop not found: ${shopId}`);
        }

        if (!shop.owner) {
          throw new Error(`Shop owner not found: ${shopId}`);
        }

        const items = groupItemsByShop[shopId];

        const subtotal = items.reduce(
          (sum, item) =>
            sum + Number(item.price || 0) * Number(item.quantity || 0),
          0,
        );

        return {
          shop: shop._id,
          owner: shop.owner._id,
          subtotal,
          shopOrderItems: items.map((item) => ({
            item: item.id,
            dishname: item.dishname,
            price: item.price,
            quantity: item.quantity,
          })),
        };
      }),
    );

    if (paymentMethod === "ONLINE") {
      const idempotencyKey = `payment_${req.userId}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 10)}`;

      const intentKey = `intent_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 10)}`;

      const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(Number(totalAmount) * 100),
        currency: "INR",
        receipt: `receipt_order_${Date.now()}`,
      });

      const newOrder = await Order.create({
        customer: req.userId,
        paymentMethod,
        deliveryAddress,
        totalAmount,
        shopOrders,
        razorpayOrderId: razorpayOrder.id,
        payment: false,
        paymentStatus: "pending",
      });

      await PaymentIntent.create({
        user: req.userId,
        order: newOrder._id,
        intentKey,
        idempotencyKey,
        razorpayOrderId: razorpayOrder.id,
        amount: Math.round(Number(totalAmount) * 100),
        currency: "INR",
        paymentMethod: "ONLINE",
        status: "created",
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      return res.status(200).json({
        success: true,
        razorpayOrder,
        orderId: newOrder._id,
        paymentIntentId: intentKey,
      });
    }

    const newOrder = await Order.create({
      customer: req.userId,
      paymentMethod,
      deliveryAddress,
      totalAmount,
      shopOrders,
    });

    await newOrder.populate(
      "shopOrders.shopOrderItems.item",
      "dishname image price",
    );

    await newOrder.populate("shopOrders.shop", "restaurantName");

    await newOrder.populate("shopOrders.owner", "fullname socketId");

    await newOrder.populate("customer", "fullname email phone");

    const io = req.app.get("io");

    if (io) {
      newOrder.shopOrders.forEach((shopOrder) => {
        const ownerSocketId = shopOrder.owner?.socketId;

        if (ownerSocketId) {
          io.to(ownerSocketId).emit("newOrder", {
            _id: newOrder._id,
            paymentMethod: newOrder.paymentMethod,
            payment: newOrder.payment,
            customer: newOrder.customer,
            deliveryAddress: newOrder.deliveryAddress,
            shopOrders: shopOrder,
            createdAt: newOrder.createdAt,
          });
        }
      });
    }

    return res.status(201).json({
      success: true,
      order: newOrder,
    });
  } catch (error) {
    console.error("Place Order Error:", error);

    if (res.headersSent) {
      return;
    }

    return res.status(500).json({
      success: false,
      error: error.message || "Failed to place order",
    });
  }
};

export const paymentVerify = async (req, res) => {
  try {
    const userId = req.userId;

    const { orderId, razorpayPaymentId } = req.body;

    if (!orderId || !razorpayPaymentId) {
      return res.status(400).json({
        success: false,
        message: "Order ID and Razorpay payment ID are required.",
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      customer: userId,
      paymentMethod: "ONLINE",
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    // If webhook already completed the payment.
    if (
      order.payment === true &&
      order.razorpayPaymentId === razorpayPaymentId
    ) {
      const populatedOrder = await Order.findById(order._id)
        .populate("shopOrders.shop")
        .populate("shopOrders.shopOrderItems.item")
        .populate("customer");

      return res.status(200).json({
        success: true,
        message: "Payment already verified.",
        order: populatedOrder,
      });
    }

    const payment = await razorpay.payments.fetch(razorpayPaymentId);

    if (!payment) {
      return res.status(400).json({
        success: false,
        message: "Razorpay payment not found.",
      });
    }

    if (payment.order_id !== order.razorpayOrderId) {
      return res.status(400).json({
        success: false,
        message: "Payment does not belong to this order.",
      });
    }

    if (payment.status !== "captured") {
      return res.status(400).json({
        success: false,
        message: `Payment is not captured. Current status: ${payment.status}`,
      });
    }

    const expectedAmount = Math.round(Number(order.totalAmount) * 100);

    if (Number(payment.amount) !== expectedAmount) {
      return res.status(400).json({
        success: false,
        message: "Payment amount mismatch.",
      });
    }

    const finalOrder = await finalizePaidOrder({
      req,
      order,
      razorpayPaymentId,
      paymentAmount: payment.amount,
    });

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully.",
      order: finalOrder,
    });
  } catch (error) {
    console.error("Payment verify error:", error);

    return res.status(500).json({
      success: false,
      message: "Payment verification failed.",
      error: error.message,
    });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (user.role === "user") {
      const orders = await Order.find({ customer: req.userId })
        .sort({ createdAt: -1 })
        .populate("shopOrders.shop", "restaurantName")
        .populate("shopOrders.owner", "fullname email phone")
        .populate("shopOrders.shopOrderItems.item", "dishname image price");

      return res.status(200).json(orders);
    } else if (user.role === "foodPartner") {
      const orders = await Order.find({ "shopOrders.owner": req.userId })
        .sort({ createdAt: -1 })
        .populate("shopOrders.shop", "restaurantName")
        .populate("customer", "-isOtpVerified -profileImage")
        .populate("shopOrders.shopOrderItems.item", "dishname image price")
        .populate("shopOrders.assignDeliveryBoy", "fullname phone");

      const filteredOrder = orders.map((order) => ({
        _id: order._id,
        paymentMethod: order.paymentMethod,
        payment: order.payment,
        customer: order.customer,
        deliveryAddress: order.deliveryAddress,
        shopOrders: order.shopOrders.find((o) => o.owner._id == req.userId),
        createdAt: order.createdAt,
      }));

      return res.status(200).json(filteredOrder);
    }
  } catch (error) {
    return res.status(500).json({
      error: `Get Orders Error ${error}`,
    });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, shopId } = req.params;
    const { status } = req.body;

    const order = await Order.findById(orderId);

    const shopOrder = order.shopOrders.find((o) => o.shop == shopId);

    if (!shopOrder) {
      return res.status(400).json({
        error: "Shop order not found",
      });
    }

    shopOrder.status = status;

    let deliveryBoysPayload = [];

    if (status == "out of delivery" && !shopOrder.assignment) {
      const { longitude, latitude } = order.deliveryAddress;

      const nearByDeliveryBoy = await User.find({
        role: "deliveryBoy",
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [Number(longitude), Number(latitude)],
            },
            $maxDistance: 5000,
          },
        },
      });

      const nearByIds = nearByDeliveryBoy.map((boy) => boy._id);

      const busyBoysId = await DeliveryAssign.find({
        assignTo: { $in: nearByIds },
        status: { $nin: ["brodcasted", "completed"] },
      }).distinct("assignTo");

      const busyIdSet = new Set(busyBoysId.map((id) => String(id)));

      const availableBoys = nearByDeliveryBoy.filter(
        (b) => !busyIdSet.has(String(b._id)),
      );

      const candidates = availableBoys.map((b) => b._id);

      if (candidates.length == 0) {
        await order.save();
        return res.json({
          messgae:
            "Order status updated but there is no avaliable delivery boys",
        });
      }

      const deliveryAssign = await DeliveryAssign.create({
        order: order._id,
        shop: shopOrder.shop?._id,
        shopOrderId: shopOrder._id,
        brodcastedTo: candidates,
        status: "brodcasted",
      });

      await deliveryAssign.populate("order");
      await deliveryAssign.populate("shop");

      shopOrder.assignDeliveryBoy = deliveryAssign.assignTo;
      shopOrder.assignment = deliveryAssign._id;

      deliveryBoysPayload = availableBoys.map((b) => ({
        id: b._id,
        fullname: b.fullname,
        longitude: b.location.coordinates[0],
        latitude: b.location.coordinates[1],
        phone: b.phone,
      }));

      const io = req.app.get("io");

      if (io) {
        availableBoys.forEach((boy) => {
          const boySocketId = boy.socketId;
          if (boySocketId) {
            io.to(boySocketId).emit("newAssignment", {
              sentTo: boy._id,
              assignmentId: deliveryAssign._id,
              orderId: deliveryAssign.order?._id,
              shopName: deliveryAssign.shop?.restaurantName,
              deliveryAddress: deliveryAssign.order?.deliveryAddress,
              items:
                deliveryAssign.order.shopOrders.find((so) =>
                  so._id.equals(deliveryAssign.shopOrderId),
                )?.shopOrderItems || [],
              subtotal: deliveryAssign.order.shopOrders.find((so) =>
                so._id.equals(deliveryAssign.shopOrderId),
              )?.subtotal,
            });
          }
        });
      }
    }

    // await shopOrder.save()
    await order.save();

    const updatedShopOrder = order.shopOrders.find((o) => o.shop == shopId);

    await order.populate("shopOrders.shop", "restaurantName");
    await order.populate(
      "shopOrders.assignDeliveryBoy",
      "fullname email phone",
    );
    await order.populate("customer", "socketId");

    const io = req.app.get("io");

    if (io) {
      const customerSocketId = order.customer.socketId;
      if (customerSocketId) {
        io.to(customerSocketId).emit("updateStatus", {
          orderId: order._id,
          shopId: updatedShopOrder.shop._id,
          status: updatedShopOrder.status,
          userId: order.customer._id,
        });
      }
    }

    return res.status(200).json({
      shopOrder: updatedShopOrder,
      assignDeliveryBoy: updatedShopOrder?.assignDeliveryBoy,
      availableBoys: deliveryBoysPayload,
      assignment: updatedShopOrder?.assignment?._id,
    });
  } catch (error) {
    return res.status(500).json({
      error: `Update Order Error ${error}`,
    });
  }
};

export const getDeliveryBoyAssignment = async (req, res) => {
  try {
    const deliveryBoyId = req.userId;

    const assignment = await DeliveryAssign.find({
      brodcastedTo: deliveryBoyId,
      status: "brodcasted",
    })
      .populate("order")
      .populate("shop");

    const formatedData = assignment.map((a) => ({
      assignmentId: a._id,
      orderId: a.order?._id,
      shopName: a.shop?.restaurantName,
      deliveryAddress: a.order?.deliveryAddress,
      items:
        a.order.shopOrders.find((so) => so._id.equals(a.shopOrderId))
          ?.shopOrderItems || [],
      subtotal: a.order.shopOrders.find((so) => so._id.equals(a.shopOrderId))
        ?.subtotal,
    }));

    return res.status(200).json(formatedData);
  } catch (error) {
    return res.status(500).json({
      error: `Get Delivery Boy Assignment ${error}`,
    });
  }
};

export const acceptOrder = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const assignment = await DeliveryAssign.findById(assignmentId);

    if (!assignment) {
      return res.status(400).json({
        message: "assignment not found",
      });
    }

    if (assignment.status != "brodcasted") {
      return res.status(400).json({
        message: "assignment is expired",
      });
    }

    const alreadyAssigned = await DeliveryAssign.findOne({
      assignTo: req.userId,
      status: { $nin: ["brodcasted", "completed"] },
    });

    if (alreadyAssigned) {
      return res.status(400).json({
        message: "Your are already assigned to another order",
      });
    }

    assignment.assignTo = req.userId;
    assignment.status = "assigned";
    assignment.acceptedAt = new Date();

    await assignment.save();

    const order = await Order.findById(assignment.order)
      .populate("customer")
      .populate("shopOrders.owner", "socketId");

    if (!order) {
      return res.status(400).json({
        message: "Order not found",
      });
    }

    const shopOrder = order.shopOrders?.find(
      (so) => String(so._id) === String(assignment.shopOrderId),
    );

    if (!shopOrder) {
      return res.status(400).json({
        message: "ShopOrder not found in order",
      });
    }

    shopOrder.assignDeliveryBoy = req.userId;
    await order.save();

    shopOrder;
    ("shopId:", shopOrder.shop._id);

    const io = req.app.get("io");

    if (io) {
      // Customer ko notify karo
      const customerSocketId = order.customer?.socketId;
      if (customerSocketId) {
        io.to(customerSocketId).emit("acceptOrder", {
          orderId: order._id,
          shopId: shopOrder.shop._id,
          status: shopOrder.status,
          userId: order.customer._id,
          assignTo: assignment.assignTo, // ✅ delivery boy id
          acceptedAt: assignment.acceptedAt, // ✅ accept time
        });
      }

      // Shop owner ko notify karo
      const shopSocketId = shopOrder.owner?.socketId;
      if (shopSocketId) {
        io.to(shopSocketId).emit("acceptOrder", {
          orderId: order._id,
          shopId: shopOrder.shop._id,
          status: shopOrder.status,
          userId: shopOrder.owner._id,
          assignTo: assignment.assignTo,
          acceptedAt: assignment.acceptedAt,
        });
      }
    }

    return res.status(200).json({
      message: "Order Accepted",
    });
  } catch (error) {
    return res.status(500).json({
      error: `Accept Order Error ${error}`,
    });
  }
};

export const getCurrentOrder = async (req, res) => {
  try {
    const assignment = await DeliveryAssign.findOne({
      assignTo: req.userId,
      status: "assigned",
    })
      .populate("shop", "restaurantName address")
      .populate("assignTo", "fullname email phone location")
      .populate({
        path: "order",
        populate: [
          {
            path: "customer",
            select: "fullname email location phone",
          },
        ],
      });

    if (!assignment) {
      return res.status(400).json({
        message: "assignment not found",
      });
    }

    if (!assignment.order) {
      return res.status(400).json({
        message: "order not found",
      });
    }

    const shopOrder = assignment.order.shopOrders.find(
      (so) => String(so._id) === String(assignment.shopOrderId),
    );

    if (!shopOrder) {
      return res.status(400).json({
        message: "shop order not found",
      });
    }

    let deliveryBoyLocation = { lat: null, long: null };
    if (assignment.assignTo.location.coordinates.length == 2) {
      deliveryBoyLocation.lat = assignment.assignTo.location.coordinates[1];
      deliveryBoyLocation.long = assignment.assignTo.location.coordinates[0];
    }

    let customerLocation = { lat: null, long: null };
    if (assignment.order.deliveryAddress) {
      customerLocation.lat = assignment.order.deliveryAddress.latitude;
      customerLocation.long = assignment.order.deliveryAddress.longitude;
    }

    return res.status(200).json({
      _id: assignment.order._id,
      customer: assignment.order.customer,
      shop: assignment.shop,
      shopOrder,
      deliveryAddress: assignment.order.deliveryAddress,
      customerLocation,
      deliveryBoyLocation,
    });
  } catch (error) {
    return res.status(500).json({
      error: `Get Current Order Error ${error}`,
    });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId)
      .populate("customer")
      .populate({
        path: "shopOrders.shop",
        model: "Shop",
      })
      .populate({
        path: "shopOrders.assignDeliveryBoy",
        model: "User",
      })
      .populate({
        path: "shopOrders.shopOrderItems.item",
        model: "Item",
      })
      .lean();

    if (!order) {
      return res.status(400).json({
        error: "Order not found",
      });
    }

    return res.status(200).json(order);
  } catch (error) {
    return res.status(500).json({
      error: `Get Order By Id Error ${error}`,
    });
  }
};

export const sendDeliveryOtp = async (req, res) => {
  try {
    const { orderId, shopOrderId } = req.body;

    if (!orderId || !shopOrderId) {
      return res
        .status(400)
        .json({ error: "orderId and shopOrderId required" });
    }

    const order = await Order.findById(orderId).populate("customer");
    const shopOrder = order?.shopOrders?.id(shopOrderId);

    if (!order || !shopOrder) {
      return res.status(400).json({ error: "Enter valid order/shopOrderId" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    shopOrder.deliveryOtp = otp;
    shopOrder.otpExpires = Date.now() + 5 * 60 * 1000;
    await order.save();

    await sendDeliveryOtpMail(order.customer, otp);

    return res.status(200).json({
      message: `OTP sent successfully ✅ to ${order.customer.fullname}`,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({ error: `Send Delivery Otp Error ${error}` });
  }
};

export const verifyDeliveryOtp = async (req, res) => {
  try {
    const { orderId, shopOrderId, deliveryOtp } = req.body;

    const order = await Order.findById(orderId).populate("customer");
    const shopOrder = order.shopOrders.id(shopOrderId);

    if (!order || !shopOrder) {
      return res.status(400).json({
        error: "Enter valid order/shopOrderId",
      });
    }

    // ✅ OTP check (uncomment if needed)
    // if (shopOrder.deliveryOtp !== deliveryOtp || !shopOrder.otpExpires || shopOrder.otpExpires < Date.now()) {
    //   return res.status(400).json({
    //     message: "Invalid/Expired OTP"
    //   });
    // }

    // ✅ Mark order delivered
    order.payment = true;
    shopOrder.status = "delivered";
    shopOrder.deliveredAt = Date.now();

    await order.save();

    // ✅ Remove delivery assignment
    await DeliveryAssign.deleteOne({
      shopOrderId: shopOrder._id,
      order: order._id,
      assignTo: shopOrder.assignDeliveryBoy,
    });

    const io = req.app.get("io");

    // ✅ Emit socket events
    if (io) {
      const customerSocketId = order.customer.socketId;
      if (customerSocketId) {
        io.to(customerSocketId).emit("delivered", {
          orderId: order._id,
          shopId: shopOrder._id,
          status: shopOrder.status,
          userId: order.customer._id,
        });
      }

      const shopSocketId = shopOrder.owner?.socketId;
      if (shopSocketId) {
        io.to(shopSocketId).emit("delivered", {
          orderId: order._id,
          shopId: shopOrder._id,
          status: shopOrder.status,
          userId: shopOrder.owner._id,
        });
      }
    }

    // ✅ AI Integration: Update User Order History
    await User.findByIdAndUpdate(order.customer._id, {
      $push: { orderHistory: order._id },
    });

    return res.status(200).json({
      message: "Order Delivered Successfully ✅",
      aiUpdate: "User order history updated for AI recommendations",
    });
  } catch (error) {
    return res.status(500).json({
      err: `Verify Delivery Otp Error ${error}`,
      error,
    });
  }
};

export const getTodayDeliveries = async (req, res) => {
  try {
    const deliveryBoyId = req.userId;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const orders = await Order.find({
      "shopOrders.assignDeliveryBoy": deliveryBoyId,
      "shopOrders.status": "delivered",
      "shopOrders.deliveredAt": { $gte: startOfDay, $lte: endOfDay },
    }).lean();

    let todayDeliveries = [];

    orders.forEach((order) => {
      order.shopOrders.forEach((shopOrder) => {
        if (
          shopOrder.assignDeliveryBoy == deliveryBoyId &&
          shopOrder.status == "delivered" &&
          shopOrder.deliveredAt >= startOfDay &&
          shopOrder.deliveredAt <= endOfDay
        ) {
          todayDeliveries.push(shopOrder);
        }
      });
    });

    let stats = [];

    todayDeliveries.forEach((shopOrder) => {
      const hour = new Date(shopOrder.deliveredAt).getHours();
      stats[hour] = (stats[hour] || 0) + 1;
    });

    let formattedStats = Object.keys(stats).map((hour) => ({
      hour: parseInt(hour),
      count: stats[hour],
    }));

    formattedStats.sort((a, b) => a.hour - b.hour);

    return res.status(200).json(formattedStats);
  } catch (error) {
    return res.status(500).json({
      error: `Get Today Deliveries Error ${error}`,
    });
  }
};

export const razorpayWebhook = async (req, res) => {
  let webhookRecord = null;

  try {
    const signature = req.headers["x-razorpay-signature"];
    const eventId = req.headers["x-razorpay-event-id"];

    if (!signature) {
      return res.status(400).json({
        success: false,
        message: "Missing Razorpay webhook signature.",
      });
    }

    if (!eventId) {
      return res.status(400).json({
        success: false,
        message: "Missing Razorpay webhook event ID.",
      });
    }

    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({
        success: false,
        message: "Webhook body must be raw.",
      });
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("RAZORPAY_WEBHOOK_SECRET is missing.");

      return res.status(500).json({
        success: false,
        message: "Webhook secret is not configured.",
      });
    }

    // Verify Razorpay signature.
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(req.body)
      .digest("hex");

    const receivedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      console.error("Invalid Razorpay webhook signature.");

      return res.status(400).json({
        success: false,
        message: "Invalid webhook signature.",
      });
    }

    const payload = JSON.parse(req.body.toString("utf8"));

    const event = payload?.event;

    if (!event) {
      return res.status(400).json({
        success: false,
        message: "Webhook event is missing.",
      });
    }

    const paymentEntity = payload?.payload?.payment?.entity || null;

    const orderEntity = payload?.payload?.order?.entity || null;

    const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id || "";

    const razorpayPaymentId = paymentEntity?.id || "";

    // Create event record or get existing one.
    webhookRecord = await WebhookEvent.findOneAndUpdate(
      {
        eventId,
      },
      {
        $setOnInsert: {
          eventId,
          event,
          razorpayOrderId,
          razorpayPaymentId,
          payload,
          status: "received",
          attempts: 1,
        },
        $inc: {
          attempts: 1,
        },
      },
      {
        upsert: true,
        new: true,
      },
    );

    // Already successfully processed.
    if (
      webhookRecord.status === "processed" ||
      webhookRecord.status === "ignored"
    ) {
      return res.status(200).json({
        success: true,
        message: "Webhook already processed.",
      });
    }

    console.log(`Razorpay webhook received: ${event}`, {
      eventId,
      razorpayOrderId,
      razorpayPaymentId,
    });

    // ----------------------------------------
    // PAYMENT CAPTURED
    // ----------------------------------------

    if (event === "payment.captured") {
      if (!razorpayOrderId || !razorpayPaymentId) {
        throw new Error("Payment captured webhook missing Razorpay IDs.");
      }

      const order = await Order.findOne({
        razorpayOrderId,
        paymentMethod: "ONLINE",
      });

      if (!order) {
        throw new Error(
          `Order not found for Razorpay order ${razorpayOrderId}`,
        );
      }

      if (
        Number(paymentEntity?.amount) !==
        Math.round(Number(order.totalAmount) * 100)
      ) {
        throw new Error("Webhook payment amount does not match order amount.");
      }

      await finalizePaidOrder({
        req,
        order,
        razorpayPaymentId,
        paymentAmount: paymentEntity.amount,
      });

      await WebhookEvent.findOneAndUpdate(
        { eventId },
        {
          $set: {
            status: "processed",
            processedAt: new Date(),
            errorMessage: "",
          },
        },
      );

      return res.status(200).json({
        success: true,
        message: "Payment captured webhook processed.",
      });
    }

    // ----------------------------------------
    // ORDER PAID
    // ----------------------------------------

    if (event === "order.paid") {
      if (!razorpayOrderId) {
        throw new Error("Order paid webhook missing Razorpay order ID.");
      }

      // payment.captured is the event used for finalization.
      // If payment entity is available, finalize here too.
      if (razorpayPaymentId && paymentEntity?.amount) {
        const order = await Order.findOne({
          razorpayOrderId,
          paymentMethod: "ONLINE",
        });

        if (!order) {
          throw new Error(
            `Order not found for Razorpay order ${razorpayOrderId}`,
          );
        }

        if (
          Number(paymentEntity.amount) !==
          Math.round(Number(order.totalAmount) * 100)
        ) {
          throw new Error("Order paid webhook amount mismatch.");
        }

        await finalizePaidOrder({
          req,
          order,
          razorpayPaymentId,
          paymentAmount: paymentEntity.amount,
        });
      }

      await WebhookEvent.findOneAndUpdate(
        { eventId },
        {
          $set: {
            status: "processed",
            processedAt: new Date(),
            errorMessage: "",
          },
        },
      );

      return res.status(200).json({
        success: true,
        message: "Order paid webhook processed.",
      });
    }

    // ----------------------------------------
    // PAYMENT AUTHORIZED
    // ----------------------------------------

    if (event === "payment.authorized") {
      if (razorpayOrderId) {
        await Order.findOneAndUpdate(
          {
            razorpayOrderId,
            payment: { $ne: true },
          },
          {
            $set: {
              paymentStatus: "authorized",
            },
          },
        );
      }

      if (razorpayOrderId) {
        await PaymentIntent.findOneAndUpdate(
          {
            razorpayOrderId,
          },
          {
            $set: {
              razorpayPaymentId,
              status: "authorized",
            },
          },
        );
      }

      await WebhookEvent.findOneAndUpdate(
        { eventId },
        {
          $set: {
            status: "processed",
            processedAt: new Date(),
          },
        },
      );

      return res.status(200).json({
        success: true,
        message: "Payment authorized webhook processed.",
      });
    }

    // ----------------------------------------
    // PAYMENT FAILED
    // ----------------------------------------

    if (event === "payment.failed") {
      if (razorpayOrderId) {
        const order = await Order.findOne({
          razorpayOrderId,
          paymentMethod: "ONLINE",
        });

        // Never turn a successfully paid order back to failed.
        if (order && order.payment !== true) {
          await Order.updateOne(
            {
              _id: order._id,
              payment: { $ne: true },
            },
            {
              $set: {
                paymentStatus: "failed",
              },
            },
          );
        }
      }

      if (razorpayOrderId) {
        await PaymentIntent.findOneAndUpdate(
          {
            razorpayOrderId,
          },
          {
            $set: {
              razorpayPaymentId,
              status: "failed",
              failureReason:
                paymentEntity?.error_description ||
                paymentEntity?.error_reason ||
                "",
              failureCode: paymentEntity?.error_code || "",
              failedAt: new Date(),
            },
          },
        );
      }

      await WebhookEvent.findOneAndUpdate(
        { eventId },
        {
          $set: {
            status: "processed",
            processedAt: new Date(),
          },
        },
      );

      return res.status(200).json({
        success: true,
        message: "Payment failed webhook processed.",
      });
    }

    // ----------------------------------------
    // UNKNOWN EVENT
    // ----------------------------------------

    await WebhookEvent.findOneAndUpdate(
      { eventId },
      {
        $set: {
          status: "ignored",
          processedAt: new Date(),
        },
      },
    );

    console.log(`Ignoring unsupported Razorpay event: ${event}`);

    return res.status(200).json({
      success: true,
      message: `Event ${event} ignored.`,
    });
  } catch (error) {
    console.error("Razorpay webhook processing error:", error);

    if (webhookRecord?.eventId) {
      await WebhookEvent.findOneAndUpdate(
        {
          eventId: webhookRecord.eventId,
        },
        {
          $set: {
            status: "failed",
            errorMessage: error.message,
          },
        },
      );
    }

    // 500 is intentional so Razorpay can retry.
    return res.status(500).json({
      success: false,
      message: "Webhook processing failed.",
    });
  }
};
