import express from 'express'
import adminAuth from '../middlewere/adminAuth.js';
import { blockedUsers, blockUser, getAdmin, getAdminDashboardState, unBlockUser } from '../controllers/admin.controller.js';

const adminRouter = express.Router();

adminRouter.get("/getAdmin", adminAuth, getAdmin)

adminRouter.get("/getDashboardState", adminAuth, getAdminDashboardState)

adminRouter.post("/block-user", adminAuth, blockUser)

adminRouter.get("/blocked-users", adminAuth, blockedUsers)

adminRouter.post("/unblock-user", adminAuth, unBlockUser)

export default adminRouter;