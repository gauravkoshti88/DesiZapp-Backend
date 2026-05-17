import User from '../models/user.model.js'
import Order from '../models/order.model.js'
import DeliveryAssign from '../models/deliveryAssign.model.js'
import Shop from '../models/shop.model.js'

export const getAdmin = async (req, res) => {
    try {
        let adminEmail = req.adminEmail;

        if (!adminEmail) {
            return res.status(404).json({
                message: "Admin is not found"
            })
        }

        return res.status(201).json({
            email: adminEmail
        })
    } catch (error) {
        return res.status(500).json({
            message: `Get Admin Error ${error}`
        })
    }
}

export const getAdminDashboardState = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({ role: "user", isBlocked: false });
        const totalFoodPartners = await User.countDocuments({ role: "foodPartner", isBlocked: false });
        const totalDeliveryBoys = await User.countDocuments({ role: "deliveryBoy", isBlocked: false });
        const totalOrders = await Order.countDocuments();
        const totalAssignDeliveryBoys = await DeliveryAssign.countDocuments();

        const users = await User.find({ role: "user", isBlocked: false }).select("-password -otp");

        const shops = await Shop.find()
            .populate({
                path: "owner",
                match: { isBlocked: false },
                select: "-password -otp"
            })
            .then((allShops) => allShops.filter((s) => s.owner)); 


        const deliveryBoys = await User.find({ role: "deliveryBoy", isBlocked: false }).select("-password -otp");

        const assignDeliveryBoys = await DeliveryAssign.find()
            .populate({
                path: "order",
                select: "_id customer shopOrders",
                populate: [
                    {
                        path: "customer",
                        match: { isBlocked: false },
                        select: "fullname email phone",
                    },
                    {
                        path: "deliveryAddress",
                        select: "text"
                    },
                    {
                        path: "shopOrders",
                        select: "status shopOrderItems",
                        populate: {
                            path: "shopOrderItems.item",
                            select: "dishname price quantity",
                        },
                    },
                ],
            })
            .populate({
                path: "shop",
                select: "restaurantName owner",
                populate: {
                    path: "owner",
                    match: { isBlocked: false },
                    select: "phone",
                },
            })
            .populate({
                path: "assignTo",
                match: { isBlocked: false },
                select: "fullname _id phone"
            });

        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(25)
            .select("_id shopOrders.status")
            .populate({
                path: "customer",
                match: { isBlocked: false },
                select: "fullname"
            });

        const onlineDeliveryBoys = await User.countDocuments({
            role: "deliveryBoy",
            isOnline: true,
            isBlocked: false
        });

        const offlineDeliveryBoys = await User.countDocuments({
            role: "deliveryBoy",
            isOnline: false,
            isBlocked: false
        });

        return res.status(200).json({
            success: true,
            stats: {
                Users: totalUsers,
                Shops: totalFoodPartners,
                Delivery_Boy: totalDeliveryBoys,
                Orders: totalOrders,
                Assign_Delivery_Boy: totalAssignDeliveryBoys,
            },
            details: {
                customers: users,
                shops,
                deliveryBoys,
                assignDeliveryBoys,
                recentOrders,
                deliveryActivity: {
                    online: onlineDeliveryBoys,
                    offline: offlineDeliveryBoys
                },
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};


export const blockUser = async (req, res) => {
    try {
        const { userId, reason } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        user.isBlocked = true;
        user.blockedAt = new Date();
        user.blockedReason = reason || "No reason provided";
        user.isOnline = false;

        await user.save();

        return res.status(200).json({
            success: true,
            message: "User blocked successfully",
            user: {
                fullname: user.fullname,
                email: user.email,
                isBlocked: user.isBlocked,
                blockedReason: user.blockedReason
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

export const unBlockUser = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOneAndUpdate({ email }, {
            $set: {
                isBlocked: false,
                blockedReason: null,
                blockedAt: null
            }
        }, { returnDocument: "after" }).select("-password -otp");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not exist"
            });
        }

        return res.status(200).json({
            success: true,
            message: "User unblocked successfully",
            user: {
                fullname: user.fullname,
                email: user.email,
                phone: user.phone,
                isBlocked: user.isBlocked,
                role: user.role
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
}


export const blockedUsers = async (req, res) => {
    try {
        const users = await User.find({ isBlocked: true }).select("-password -otp")

        if (!users) {
            return res.status(404).json({
                success: false,
                message: "Users not found"
            });
        }

        const blockedUser = users.map((u) => ({
            fullname: u.fullname,
            email: u.email,
            phone: u.phone,
            reason: u.blockedReason,
            isBlocked: u.isBlocked,
            role: u.role
        }))

        return res.status(200).json({
            success: true,
            message: "Blocked Users",
            blockedUser
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
}