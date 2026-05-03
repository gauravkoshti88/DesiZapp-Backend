import express from 'express';

import authMiddleware from '../middlewere/authMiddleware.js';
import { editUserProfile, getUser, updateUserLocation } from '../controllers/user.controller.js';
import upload from '../middlewere/multer.js';


const userRouter = express.Router();

userRouter.get("/get-user",authMiddleware, getUser);

userRouter.post("/update-location",authMiddleware,updateUserLocation)

userRouter.post("/edit-profile", authMiddleware, upload.single("profileImage"), editUserProfile)

export default userRouter;