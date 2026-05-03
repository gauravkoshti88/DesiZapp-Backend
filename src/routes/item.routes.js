import express from "express";
import authMiddleware from "../middlewere/authMiddleware.js";
import { addItem, editItem, getAllItems, getItemByCity, getItemById, getItemByShop, rating, removeFoodItem, searchItems } from "../controllers/item.controller.js";
import upload from "../middlewere/multer.js";

const itemRouter = express.Router()

itemRouter.post("/add-item", authMiddleware,upload.fields([
    {name: "image"},
    {name: "video"}
]), addItem)

itemRouter.put("/edit-item/:itemId", authMiddleware,upload.fields([
    {name: "image"},
    {name: "video"}
]), editItem)

itemRouter.get("/get-item/:id", authMiddleware, getItemById)

itemRouter.delete("/remove-item/:id", authMiddleware, removeFoodItem)

itemRouter.get("/get-fooditems-by-city/:city",authMiddleware, getItemByCity)

itemRouter.get("/get-fooditems-by-shop/:shopId",authMiddleware, getItemByShop)

itemRouter.get("/search-items", authMiddleware, searchItems);

itemRouter.post("/rating", authMiddleware, rating);

itemRouter.get("/all-items", authMiddleware, getAllItems)


export default itemRouter