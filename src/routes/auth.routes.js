import express from 'express'
import { adminLogin, googleAuth, resetPassword, sendOtp, userLogin, userLogout, userRegister, verifyOtp } from '../controllers/auth.controller.js';

const authRouter = express.Router();

// User Authentication Routes [Use - /api/auth/...]
authRouter.post("/user/register", userRegister)
authRouter.post("/user/login", userLogin)
authRouter.post("/user/logout", userLogout)

authRouter.post("/user/send-otp", sendOtp)
authRouter.post("/user/verify-otp", verifyOtp)
authRouter.post("/user/reset-password", resetPassword)

authRouter.post("/user/google-auth", googleAuth)

authRouter.post("/admin/login", adminLogin)




export default authRouter;