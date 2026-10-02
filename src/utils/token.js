import jwt from 'jsonwebtoken';

const genrateToken = (userId, role = "user") => {
    try {
        const token = jwt.sign(
            { userId, role },  
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );
        return token;
    } catch (error) {
        console.error("Token generation error:", error);
        throw error;
    }
};

export default genrateToken;