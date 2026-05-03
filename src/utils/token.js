import jwt from 'jsonwebtoken';

const genrateToken = (userId, role) => {
    try {
        const token = jwt.sign(
            { userId },  
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        if (token) {
            return token;
        }
    } catch (error) {
        return error
    }
}

export default genrateToken;