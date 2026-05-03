import DeliveryAssign from '../models/deliveryAssign.model.js';
import Order from '../models/order.model.js';
import Shop from '../models/shop.model.js'
import User from '../models/user.model.js'
import { sendDeliveryOtpMail } from '../utils/mail.js';
import Razorpay from 'razorpay'
import dotenv from 'dotenv'

dotenv.config()

let instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const placeOrder = async (req, res) => {
    try {
        const { cartItems, paymentMethod, deliveryAddress, totalAmount } = req.body;

        if (cartItems.length === 0 || !cartItems) {
            return res.status(400).json({
                error: "Cart is empty"
            })
        }

        if (!deliveryAddress.text || !deliveryAddress.latitude || !deliveryAddress.longitude) {
            return res.status(400).json({
                error: "Send Complete Delivery Address"
            })
        }

        let groupItemsByShop = {};

        cartItems.forEach(item => {
            const shopId = item.shop._id ? item.shop._id : item.shop
            if (!groupItemsByShop[shopId]) {
                groupItemsByShop[shopId] = []
            }
            groupItemsByShop[shopId].push(item)
        });

        const shopOrders = await Promise.all(Object.keys(groupItemsByShop).map(async (shopId) => {
            const shop = await Shop.findById(shopId).populate("owner")
            if (!shop) {
                return res.status(400).json({
                    error: "Shop not found"
                })
            }
            const items = groupItemsByShop[shopId]
            const subtotal = items.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0);
            return {
                shop: shop._id,
                owner: shop.owner._id,
                subtotal,
                shopOrderItems: items.map((i) => ({
                    item: i.id,
                    dishname: i.dishname,
                    price: i.price,
                    quantity: i.quantity
                }))
            }
        }))

        if (paymentMethod === "ONLINE") {
            const razorpayOrder = await instance.orders.create({
                amount: Math.round(totalAmount * 100),
                currency: "INR",
                receipt: `receipt_order_${Date.now()}`,
            })

            const newOrder = await Order.create({
                customer: req.userId,
                paymentMethod,
                deliveryAddress,
                totalAmount,
                shopOrders,
                razorpayOrderId: razorpayOrder.id,
                payment: false
            })

            return res.status(200).json({
                razorpayOrder,
                orderId: newOrder._id,
            });
        }

        const newOrder = await Order.create({
            customer: req.userId,
            paymentMethod,
            deliveryAddress,
            totalAmount,
            shopOrders
        })

        await newOrder.populate("shopOrders.shopOrderItems.item", "dishname image price")
        await newOrder.populate("shopOrders.shop", "restaurantName")
        await newOrder.populate("shopOrders.owner", "fullname socketId")
        await newOrder.populate("customer", "fullname email phone")

        const io = req.app.get("io");

        if (io) {
            newOrder.shopOrders.forEach(shopOrder => {
                const ownerSocketId = shopOrder.owner.socketId;
                ("Emitting newOrder to:", ownerSocketId);

                if (ownerSocketId) {
                    io.to(ownerSocketId).emit("newOrder", {
                        _id: newOrder._id,
                        paymentMethod: newOrder.paymentMethod,
                        payment: newOrder.payment,
                        customer: newOrder.customer,
                        deliveryAddress: newOrder.deliveryAddress,
                        shopOrders: shopOrder,
                        createdAt: newOrder.createdAt
                    })
                }
            })
        }


        return res.status(201).json(newOrder);

    } catch (error) { 
        return res.status(500).json({
            error: `Place Order Error ${error}`
        })
    }
}

export const paymentVerify = async (req, res) => {
    try {
        const { orderId, razorpayPaymentId } = req.body;

        const payment = await instance.payments.fetch(razorpayPaymentId)

        if (!payment || payment.status !== "captured") {
            return res.status(400).json({
                error: "Payment not successful"
            })
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(400).json({
                error: "Order not found"
            })
        }
        order.payment = true;
        order.razorpayPaymentId = razorpayPaymentId;
        await order.save();

        await order.populate("shopOrders.shopOrderItems.item", "dishname image price")
        await order.populate("shopOrders.shop", "restaurantName")
        await order.populate("shopOrders.owner", "fullname socketId")
        await order.populate("customer", "fullname email phone")

        const io = req.app.get("io");

        if (io) {
            order.shopOrders.forEach(shopOrder => {
                const ownerSocketId = shopOrder.owner.socketId;

                if (ownerSocketId) {
                    io.to(ownerSocketId).emit("newOrder", {
                        _id: order._id,
                        paymentMethod: order.paymentMethod,
                        payment: order.payment,
                        customer: order.customer,
                        deliveryAddress: order.deliveryAddress,
                        shopOrders: shopOrder,
                        createdAt: order.createdAt
                    })
                }
            })
        }

        return res.status(200).json(order)

    } catch (error) {
        return res.status(500).json({
            error: `Payment Verify Error ${error}`
        })
    }
}

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
                .populate("shopOrders.assignDeliveryBoy", "fullname phone")

            const filteredOrder = orders.map((order => ({
                _id: order._id,
                paymentMethod: order.paymentMethod,
                payment: order.payment,
                customer: order.customer,
                deliveryAddress: order.deliveryAddress,
                shopOrders: order.shopOrders.find(o => o.owner._id == req.userId),
                createdAt: order.createdAt
            })))

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

        const shopOrder = order.shopOrders.find(o => o.shop == shopId)

        if (!shopOrder) {
            return res.status(400).json({
                error: "Shop order not found"
            })
        }

        shopOrder.status = status;

        let deliveryBoysPayload = [];

        if (status == "out of delivery" && !shopOrder.assignment) {
            const { longitude, latitude } = order.deliveryAddress;

            const nearByDeliveryBoy = await User.find({
                role: "deliveryBoy",
                location: {
                    $near: {
                        $geometry: { type: "Point", coordinates: [Number(longitude), Number(latitude)] },
                        $maxDistance: 5000
                    }
                }
            })

            const nearByIds = nearByDeliveryBoy.map(boy => boy._id);

            const busyBoysId = await DeliveryAssign.find({
                assignTo: { $in: nearByIds },
                status: { $nin: ["brodcasted", "completed"] }
            }).distinct("assignTo");

            const busyIdSet = new Set(busyBoysId.map(id => String(id)))

            const availableBoys = nearByDeliveryBoy.filter(b => !busyIdSet.has(String(b._id)));

            const candidates = availableBoys.map(b => b._id);

            if (candidates.length == 0) {
                await order.save()
                return res.json({
                    messgae: "Order status updated but there is no avaliable delivery boys"
                })
            }

            const deliveryAssign = await DeliveryAssign.create({
                order: order._id,
                shop: shopOrder.shop?._id,
                shopOrderId: shopOrder._id,
                brodcastedTo: candidates,
                status: "brodcasted"
            })

            await deliveryAssign.populate("order")
            await deliveryAssign.populate("shop")

            shopOrder.assignDeliveryBoy = deliveryAssign.assignTo
            shopOrder.assignment = deliveryAssign._id

            deliveryBoysPayload = availableBoys.map(b => ({
                id: b._id,
                fullname: b.fullname,
                longitude: b.location.coordinates[0],
                latitude: b.location.coordinates[1],
                phone: b.phone
            }))

            const io = req.app.get("io");

            if (io) {
                availableBoys.forEach(boy => {
                    const boySocketId = boy.socketId
                    if (boySocketId) {
                        io.to(boySocketId).emit("newAssignment", {
                            sentTo: boy._id,
                            assignmentId: deliveryAssign._id,
                            orderId: deliveryAssign.order?._id,
                            shopName: deliveryAssign.shop?.restaurantName,
                            deliveryAddress: deliveryAssign.order?.deliveryAddress,
                            items: deliveryAssign.order.shopOrders.find(so => so._id.equals(deliveryAssign.shopOrderId))?.shopOrderItems || [],
                            subtotal: deliveryAssign.order.shopOrders.find(so => so._id.equals(deliveryAssign.shopOrderId))?.subtotal,
                        })
                    }
                })
            }
        }

        // await shopOrder.save()
        await order.save();

        const updatedShopOrder = order.shopOrders.find(o => o.shop == shopId)

        await order.populate("shopOrders.shop", "restaurantName")
        await order.populate("shopOrders.assignDeliveryBoy", "fullname email phone")
        await order.populate("customer", "socketId")

        const io = req.app.get("io");

        if (io) {
            const customerSocketId = order.customer.socketId
            if (customerSocketId) {
                io.to(customerSocketId).emit("updateStatus", {
                    orderId: order._id,
                    shopId: updatedShopOrder.shop._id,
                    status: updatedShopOrder.status,
                    userId: order.customer._id
                })
            }
        }

        return res.status(200).json({
            shopOrder: updatedShopOrder,
            assignDeliveryBoy: updatedShopOrder?.assignDeliveryBoy,
            availableBoys: deliveryBoysPayload,
            assignment: updatedShopOrder?.assignment?._id
        });

    } catch (error) {
        return res.status(500).json({
            error: `Update Order Error ${error}`,
        });
    }
}

export const getDeliveryBoyAssignment = async (req, res) => {
    try {
        const deliveryBoyId = req.userId;

        const assignment = await DeliveryAssign.find({
            brodcastedTo: deliveryBoyId,
            status: "brodcasted"
        })
            .populate("order")
            .populate("shop")

        const formatedData = assignment.map(a => ({
            assignmentId: a._id,
            orderId: a.order?._id,
            shopName: a.shop?.restaurantName,
            deliveryAddress: a.order?.deliveryAddress,
            items: a.order.shopOrders.find(so => so._id.equals(a.shopOrderId))?.shopOrderItems || [],
            subtotal: a.order.shopOrders.find(so => so._id.equals(a.shopOrderId))?.subtotal,
        }))

        return res.status(200).json(formatedData)
    } catch (error) {
        return res.status(500).json({
            error: `Get Delivery Boy Assignment ${error}`,
        })
    }
}

export const acceptOrder = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const assignment = await DeliveryAssign.findById(assignmentId);

        if (!assignment) {
            return res.status(400).json({
                message: "assignment not found"
            })
        }

        if (assignment.status != "brodcasted") {
            return res.status(400).json({
                message: "assignment is expired"
            })
        }

        const alreadyAssigned = await DeliveryAssign.findOne({
            assignTo: req.userId,
            status: { $nin: ["brodcasted", "completed"] }
        })

        if (alreadyAssigned) {
            return res.status(400).json({
                message: "Your are already assigned to another order"
            })
        }

        assignment.assignTo = req.userId
        assignment.status = "assigned"
        assignment.acceptedAt = new Date()

        await assignment.save()

        const order = await Order.findById(assignment.order)
            .populate("customer")
            .populate("shopOrders.owner","socketId");

        if (!order) {
            return res.status(400).json({
                message: "Order not found"
            })
        }

        const shopOrder = order.shopOrders?.find(
            (so) => String(so._id) === String(assignment.shopOrderId)
        );

        if (!shopOrder) {
            return res.status(400).json({
                message: "ShopOrder not found in order",
            });
        }

        shopOrder.assignDeliveryBoy = req.userId;
        await order.save();

        (shopOrder);
        ("shopId:",shopOrder.shop._id);
        

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
                    assignTo: assignment.assignTo,        // ✅ delivery boy id
                    acceptedAt: assignment.acceptedAt     // ✅ accept time
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
                    acceptedAt: assignment.acceptedAt
                });
            }
        }

        return res.status(200).json({
            message: "Order Accepted"
        })

    } catch (error) {
        return res.status(500).json({
            error: `Accept Order Error ${error}`,
        })
    }
}

export const getCurrentOrder = async (req, res) => {
    try {
        const assignment = await DeliveryAssign.findOne({
            assignTo: req.userId,
            status: "assigned"
        })
            .populate("shop", "restaurantName address")
            .populate("assignTo", "fullname email phone location")
            .populate({
                path: "order",
                populate: [{
                    path: "customer",
                    select: "fullname email location phone"
                }],
            })

        if (!assignment) {
            return res.status(400).json({
                message: "assignment not found"
            })
        }

        if (!assignment.order) {
            return res.status(400).json({
                message: "order not found"
            })
        }

        const shopOrder = assignment.order.shopOrders.find((so) => String(so._id) === String(assignment.shopOrderId))

        if (!shopOrder) {
            return res.status(400).json({
                message: "shop order not found"
            })
        }

        let deliveryBoyLocation = { lat: null, long: null }
        if (assignment.assignTo.location.coordinates.length == 2) {
            deliveryBoyLocation.lat = assignment.assignTo.location.coordinates[1]
            deliveryBoyLocation.long = assignment.assignTo.location.coordinates[0]
        }


        let customerLocation = { lat: null, long: null }
        if (assignment.order.deliveryAddress) {
            customerLocation.lat = assignment.order.deliveryAddress.latitude
            customerLocation.long = assignment.order.deliveryAddress.longitude
        }

        return res.status(200).json({
            _id: assignment.order._id,
            customer: assignment.order.customer,
            shop: assignment.shop,
            shopOrder,
            deliveryAddress: assignment.order.deliveryAddress,
            customerLocation,
            deliveryBoyLocation
        })

    } catch (error) {
        return res.status(500).json({
            error: `Get Current Order Error ${error}`,
        })
    }
}

export const getOrderById = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId)
            .populate("customer")
            .populate({
                path: "shopOrders.shop",
                model: "Shop"
            })
            .populate({
                path: "shopOrders.assignDeliveryBoy",
                model: "User"
            })
            .populate({
                path: "shopOrders.shopOrderItems.item",
                model: "Item"
            }).lean()

        if (!order) {
            return res.status(400).json({
                error: "Order not found"
            })
        }

        return res.status(200).json(order);
    } catch (error) {
        return res.status(500).json({
            error: `Get Order By Id Error ${error}`
        })
    }
}

export const sendDeliveryOtp = async (req, res) => {
    try {
        const { orderId, shopOrderId } = req.body;

        if (!orderId || !shopOrderId) {
            return res.status(400).json({ error: "orderId and shopOrderId required" });
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
        console.log("Mail",process.env.MAIL_USER);
        console.log("pass",process.env.MAIL_PASS);
        
        
        await sendDeliveryOtpMail(order.customer, otp);

        return res.status(200).json({
            message: `OTP sent successfully ✅ to ${order.customer.fullname}`
        });
    } catch (error) {
        return res.status(500).json({ error: `Send Delivery Otp Error ${error}` });
    }
};


export const verifyDeliveryOtp = async (req, res) => {
    try {
        const { orderId, shopOrderId, deliveryOtp } = req.body;

        const order = await Order.findById(orderId).populate("customer")
        const shopOrder = order.shopOrders.id(shopOrderId)

        if (!order || !shopOrder) {
            return res.status(400).json({
                error: "Enter vailid order/shopOrderId"
            })
        }

        if (shopOrder.deliveryOtp !== deliveryOtp || !shopOrder.otpExpires || shopOrder.otpExpires < Date.now()) {
            return res.status(400).json({
                message: "Invailid/Expired OTP"
            })
        }

        order.payment = true
        shopOrder.status = "delivered"
        shopOrder.deliveredAt = Date.now();

        await order.save();

        await DeliveryAssign.deleteOne({
            shopOrderId: shopOrder._id,
            order: order._id,
            assignTo: shopOrder.assignDeliveryBoy
        })

        const io = req.app.get("io")

        if (io) {
            const customerSocketId = order.customer.socketId
            if (customerSocketId) {
                io.to(customerSocketId).emit("delivered", {
                    orderId: order._id,
                    shopId: shopOrder._id,
                    status: shopOrder.status,
                    userId: order.customer._id
                })
            }
        }

        if (io) {
            const shopSocketId = shopOrder.owner?.socketId
            if (shopSocketId) {
                io.to(shopSocketId).emit("delivered", {
                    orderId: order._id,
                    shopId: shopOrder._id,
                    status: shopOrder.status,
                    userId: shopOrder.owner._id
                })
            }
        }

        return res.status(200).json({
            message: "Order Delivered Successfylly ✅"
        })

    } catch (error) {
        return res.status(500).json({
            error: `Verify Delivery Otp Error ${error}`
        })
    }
}

export const getTodayDeliveries = async (req, res) => {
    try {
        const deliveryBoyId = req.userId;

        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date()
        endOfDay.setHours(23, 59, 59, 999);

        const orders = await Order.find({
            "shopOrders.assignDeliveryBoy": deliveryBoyId,
            "shopOrders.status": "delivered",
            "shopOrders.deliveredAt": { $gte: startOfDay, $lte: endOfDay }
        }).lean()

        let todayDeliveries = [];

        orders.forEach(order => {
            order.shopOrders.forEach(shopOrder => {
                if (shopOrder.assignDeliveryBoy == deliveryBoyId && shopOrder.status == "delivered" && shopOrder.deliveredAt >= startOfDay && shopOrder.deliveredAt <= endOfDay) {
                    todayDeliveries.push(shopOrder)
                }
            })
        })

        let stats = []

        todayDeliveries.forEach(shopOrder => {
            const hour = new Date(shopOrder.deliveredAt).getHours();
            stats[hour] = (stats[hour] || 0) + 1
        })

        let formattedStats = Object.keys(stats).map(hour => ({
            hour: parseInt(hour),
            count: stats[hour]
        }))

        formattedStats.sort((a, b) => a.hour - b.hour)

        return res.status(200).json(formattedStats)

    } catch (error) {
        return res.status(500).json({
            error: `Get Today Deliveries Error ${error}`
        })
    }
}