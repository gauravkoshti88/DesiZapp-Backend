import jwt from 'jsonwebtoken';
import User from '../models/user.model.js'

const authMiddleware = async (req, res, next) => {
    try {
        const { token } = req.cookies;

        if (!token) {
            return res.status(401).json({
                error: "Unauthorized - No Token Provided"
            });
        }

        // verify is synchronous
        const verifyToken = jwt.verify(token, process.env.JWT_SECRET);

        if (!verifyToken) {
            return res.status(401).json({
                error: "Unauthorized - Invalid Token"
            });
        }

        const user = await User.findById(verifyToken.userId)

        if(!user){
            return res.status(404).json({
                message:"User not found"
            })
        }

        if(user.isBlocked){
            return res.status(403).json({
                message: "Your account has been blocked"
            })
        }
        
        req.userId = verifyToken.userId;

        next();
    } catch (err) {
        return res.status(500).json({
            error: "User Authentication Error",
            err: err.message
        });
    }
};

export default authMiddleware;