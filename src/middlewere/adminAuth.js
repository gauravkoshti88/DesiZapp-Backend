import jwt from "jsonwebtoken";

const adminAuth = async (req, res, next) => {
    try {
        const token = req.cookies?.token || req.headers?.authorization?.replace(/^Bearer\s+/i, "");

        if (!token) {
            return res.status(401).json({
                message: "Not Authorized - No Admin Token Provided"
            });
        }

        let verifyAdminToken;
        try {
            verifyAdminToken = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtError) {
            return res.status(401).json({
                message: jwtError.name === "TokenExpiredError" ? "Admin Session Expired" : "Invalid Admin Token"
            });
        }

        // Strict verification: ensure the token was generated for ADMIN_EMAIL
        if (!verifyAdminToken || (verifyAdminToken.userId !== process.env.ADMIN_EMAIL && verifyAdminToken.role !== "admin")) {
            return res.status(403).json({
                message: "Access Denied: Admin privileges required"
            });
        }

        req.adminEmail = process.env.ADMIN_EMAIL;
        next();

    } catch (error) {
        return res.status(500).json({
            message: "Admin Authentication Error",
            error: error.message
        });
    }
};

export default adminAuth;