import genrateToken from '../utils/token.js';
import User from '../models/user.model.js'
import bcrypt from 'bcryptjs';
import { sendOtpMail, sendWelcomeMail } from '../utils/mail.js';

export const userRegister = async (req, res) => {
  const { fullname, email, password, role, phone } = req.body;
  try {
    if (!fullname || !email || !password || !role || !phone) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const isExistUser = await User.findOne({ email });
    if (isExistUser) {
      return res.status(409).json({ error: "User Already Exists" });
    }

    const isExistPhone = await User.findOne({ phone });

    if (isExistPhone) {
      return res.status(409).json({ error: "Phone No Already Exists" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters long" });
    }

    if (phone.length < 10) {
      return res.status(400).json({ error: "Phone number must be at least 10 digits" });
    }

    const hashPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      fullname,
      email,
      password: hashPassword,
      role,
      phone
    });

    const token = genrateToken(newUser._id);

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const user = newUser.toObject();
    delete user.password;

    return res.status(201).json({
      message: "User Register Successfully",
      user,
      token
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
};

// /**
//  * User Login Controller 
//  * API - [/api/auth/user/login]
//  */

export const userLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const isExistUser = await User.findOne({ email });

    if (!isExistUser) {
      return res.status(404).json({ error: "User Not Found" });
    }

    if (isExistUser.isBlocked) {
      return res.status(403).json({
        error: "Your account has been blocked"
      })
    }

    const comparePassword = await bcrypt.compare(password, isExistUser.password);

    if (!comparePassword) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const token = genrateToken(isExistUser._id);

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const user = isExistUser.toObject();
    delete user.password;

    return res.status(200).json({
      message: "User Logged In Successfully",
      user,
      token
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
};

// /**
//  * User Logout Controller 
//  * API - [/api/auth/user/logout]
//  */

export const userLogout = (req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === "production";
    res.clearCookie("token", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax"
    });

    return res.status(200).json({
      message: "User Logout Successfully"
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
};

export const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "User does not exists" })
    }
    const otp = Math.floor(1000 + Math.random() * 9000).toString()

    user.otp = otp
    user.otpExpires = Date.now() + 5 * 60 * 1000
    user.isOtpVerified = false
    await user.save()

    await sendOtpMail(email, otp)

    return res.status(200).json({
      message: "OTP sent successfully"
    })

  } catch (error) {
    return res.status(500).json(`Send otp error ${error}`)
  }
}

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user || user.otp != otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ error: "Invalid/Expired OTP" })
    }

    user.otp = undefined
    user.isOtpVerified = true
    user.otpExpires = undefined
    await user.save();

    return res.status(200).json({
      message: "OTP Verify successfully"
    })

  } catch (error) {
    return res.status(500).json(`Verify otp error ${error}`)
  }
}

export const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    const user = await User.findOne({ email });

    if (!user || !user.isOtpVerified) {
      return res.status(400).json({ error: "Otp Verification Required" })
    }

    const hashPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashPassword;
    user.isOtpVerified = false
    await user.save()

    return res.status(200).json({
      message: "Password Reset Successfully"
    })
  } catch (error) {
    return res.status(500).json(`Reset password error ${error}`)
  }
}

export const googleAuth = async (req, res) => {
  try {
    const { fullname, email, phone, role } = req.body;

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        fullname,
        email,
        phone,
        role: role || "user"
      });
    }

    const token = genrateToken(user._id, user.role);

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const userObj = user.toObject();
    delete userObj.password;

    return res.status(200).json({
      message: "Google Auth Successful",
      user: userObj,
      token
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Google Signup Error" });
  }
};

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASS) {
      let token = genrateToken(email, "admin");
      const isProduction = process.env.NODE_ENV === "production";
      res.cookie('token', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
      return res.status(200).json({
        message: "Admin Login Successfully",
        token
      });
    }
    return res.status(400).json({ message: "Invalid Credentials" });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Admin Login Error" });
  }
};