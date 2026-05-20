import express from "express";
import dotenv from 'dotenv'
import dbConnect from "./src/config/db.js";
import authRouter from './src/routes/auth.routes.js';
import cookieParser from 'cookie-parser';
import cors from 'cors'
import shopRouter from './src/routes/shop.routes.js';
import itemRouter from './src/routes/item.routes.js';
import userRouter from './src/routes/user.routes.js';
import orderRouter from './src/routes/order.routes.js';
import adminRouter from "./src/routes/admin.routes.js";
import aiRouter from "./src/routes/ai.routes.js";
import http from 'http'
import { Server } from 'socket.io';
import { socketHandler } from './socket.js';
import mongoose from "mongoose";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://gauravkoshti88.github.io",
      "https://desizapp-admin.vercel.app"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.set("io", io)

const port = process.env.PORT || 8000;
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://gauravkoshti88.github.io",
    "https://desizapp-admin.vercel.app"
  ],
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Backend is running ✅");
});

// Authentication Routes
app.use("/api/auth", authRouter);

// User Routes
app.use("/api/user", userRouter);

// Food Partner Routes
app.use("/api/shop", shopRouter);

// Items Routes
app.use("/api/food", itemRouter);

// Orders Routes 
app.use("/api/order", orderRouter);

// Admin Routes
app.use("/api/admin", adminRouter);

// app.use("/api/ai", aiRouter);

socketHandler(io)

server.listen(port, () => {
  dbConnect();
  console.log(`Server is running on http://localhost:${port}`);
})

