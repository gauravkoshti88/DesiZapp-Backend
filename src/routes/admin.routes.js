import express from 'express'
import adminAuth from '../middlewere/adminAuth.js';
import { getAdmin, getAdminDashboardState } from '../controllers/admin.controller.js';

const adminRouter = express.Router();

adminRouter.get("/getAdmin", adminAuth, getAdmin)

adminRouter.get("/getDashboardState", adminAuth, getAdminDashboardState)

export default adminRouter;