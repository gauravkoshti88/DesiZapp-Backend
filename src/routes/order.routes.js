import express from 'express';
import authMiddleware from '../middlewere/authMiddleware.js'
import { acceptOrder, getCurrentOrder, getDeliveryBoyAssignment, getMyOrders, getOrderById, getTodayDeliveries, paymentVerify, placeOrder, sendDeliveryOtp, updateOrderStatus, verifyDeliveryOtp } from '../controllers/order.controller.js';
 
const orderRouter = express.Router();

orderRouter.post("/place-order", authMiddleware, placeOrder);

orderRouter.post("/verify-payment", authMiddleware, paymentVerify);

orderRouter.get("/my-orders", authMiddleware, getMyOrders);

orderRouter.put("/update-status/:orderId/:shopId", authMiddleware, updateOrderStatus)

orderRouter.get("/get-assignment", authMiddleware, getDeliveryBoyAssignment)

orderRouter.get("/accept-order/:assignmentId",authMiddleware,acceptOrder)

orderRouter.get("/current-order",authMiddleware,getCurrentOrder)

orderRouter.get("/get-order-by-id/:orderId",authMiddleware,getOrderById)

orderRouter.post("/send-delivery-otp", authMiddleware, sendDeliveryOtp);

orderRouter.post("/verify-delivery-otp", authMiddleware, verifyDeliveryOtp);

orderRouter.get("/get-today-deliveries", authMiddleware, getTodayDeliveries)

export default orderRouter