import express from 'express'
import authMiddleware from '../middlewere/authMiddleware.js'
import { createAndEditShop, getMyShop, getShopByCity } from '../controllers/shop.controller.js';
import upload from '../middlewere/multer.js';

const shopRouter = express.Router();

shopRouter.post("/create-edit", authMiddleware,upload.single("image"),createAndEditShop);

shopRouter.get("/my-shop", authMiddleware, getMyShop)

shopRouter.get("/get-shop-by-city/:city", authMiddleware, getShopByCity);

export default shopRouter