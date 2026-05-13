import jwt from "jsonwebtoken";

const adminAuth = async (req, res, next) => {
    try {
        let { token } = req.cookies;

        if (!token) {
            return res.status(400).json({
                message: "Not Authorized Login Admin"
            })
        }

        let verifyAdminToken = jwt.verify(token, process.env.JWT_SECRET);

        if (!verifyAdminToken) {
            return res.status(400).json({
                message: "Admin does not have a valid token"
            })
        }

        req.adminEmail = process.env.ADMIN_EMAIL;

        next()

    } catch (error) {
        return res.status(500).json({
            message: "Admin Authentication Error",
            error
        })
    }
}

export default adminAuth;