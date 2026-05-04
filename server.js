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
      "https://gauravkoshti88.github.io",
      "https://gauravkoshti88.github.io/desizapp-food"
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
    "https://gauravkoshti88.github.io",
    "https://gauravkoshti88.github.io/desizapp-food"
  ],
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Backend is running ✅");
});

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

app.get("/test-mail", async (req, res) => {
  try {
    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to:process.env.MAIL_USER,
      subject: "Test",
      text: "Working"
    })
    res.send("Mail sent ✅")
  } catch (error) {
    console.error("Error", error);
    res.send("Fail ❌")
  }
})

// Authentication Routes
app.use("/api/auth", authRouter);

// User Routes
app.use("/api/user", userRouter);

// Food Partner Routes
app.use("/api/shop", shopRouter);

// Items Routes
app.use("/api/food", itemRouter);

// Orders  Routes 
app.use("/api/order", orderRouter)

socketHandler(io)

server.listen(port, () => {
  dbConnect();
  console.log(`Server is running on http://localhost:${port}`);
})

