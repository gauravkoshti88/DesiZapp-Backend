import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies?.token || req.headers?.authorization?.replace(/^Bearer\s+/i, "");

        if (!token) {
            return res.status(401).json({
                error: "Unauthorized - No Token Provided"
            });
        }

        let verifyToken;
        try {
            verifyToken = jwt.verify(token, process.env.JWT_SECRET);
        } catch (jwtError) {
            return res.status(401).json({
                error: jwtError.name === "TokenExpiredError" ? "Token Expired - Please Login Again" : "Unauthorized - Invalid Token"
            });
        }

        if (!verifyToken || !verifyToken.userId) {
            return res.status(401).json({
                error: "Unauthorized - Invalid Token Payload"
            });
        }

        const user = await User.findById(verifyToken.userId);

        if (!user) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        if (user.isBlocked) {
            return res.status(403).json({
                error: "Your account has been blocked"
            });
        }

        req.userId = user._id.toString();
        req.user = user;

        next();
    } catch (err) {
        return res.status(500).json({
            error: "User Authentication Error",
            message: err.message
        });
    }
};

export default authMiddleware;