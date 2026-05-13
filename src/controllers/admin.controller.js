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
        const totalUsers = await User.countDocuments({ role: "user" });
        const totalFoodPartners = await Shop.countDocuments(); // ✅ shops count
        const totalDeliveryBoys = await User.countDocuments({ role: "deliveryBoy" });
        const totalOrders = await Order.countDocuments();
        const totalAssignDeliveryBoys = await DeliveryAssign.countDocuments();

        const users = await User.find({ role: "user" }).select("-password -otp");
        const shops = await Shop.find()
            .populate("owner", "-password -otp"); 
        const deliveryBoys = await User.find({ role: "deliveryBoy" }).select("-password -otp");
        const assignDeliveryBoys = await DeliveryAssign.find();

        return res.status(200).json({
            success: true,
            stats: {
                totalUsers,
                totalFoodPartners,
                totalDeliveryBoys,
                totalOrders,
                totalAssignDeliveryBoys,
            },
            details: {
                customers: users,
                shops, 
                deliveryBoys,
                assignDeliveryBoys,
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