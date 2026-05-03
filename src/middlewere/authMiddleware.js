import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
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