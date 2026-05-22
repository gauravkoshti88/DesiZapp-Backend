# 🍔 DesiZapp-Backend

**A Full-Stack Food Delivery Platform Backend** - Powering seamless food ordering, real-time tracking, and secure payments with a modern Node.js backend.

---

## 📋 Overview

**DesiZapp** is a production-ready food delivery platform built with the **MERN stack**. This backend repository handles all server-side operations including user authentication, restaurant management, order processing, payment integration, and real-time order tracking via WebSockets.

**Problem Solved:** Simplifies food ordering with a secure, scalable backend that supports multiple user roles (customers, restaurant partners, delivery personnel, and admins) with real-time updates and comprehensive order management.

**Tech Stack:** Node.js, Express.js, MongoDB, Mongoose, Socket.io, JWT, Google OAuth, Razorpay

---

## ✨ Features

- **🔐 Secure Authentication**
  - JWT-based session management
  - Google OAuth 2.0 integration
  - Email OTP verification
  - Password reset functionality

- **👥 Multi-Role User Management**
  - Customer accounts with profile management
  - Delivery personnel with location tracking
  - Restaurant partner dashboard
  - Admin panel for platform control

- **🍽️ Restaurant & Menu Management**
  - Restaurant registration and profile updates
  - Dynamic menu item management
  - Location-based restaurant discovery
  - Earnings tracking for partners

- **📦 Order Management**
  - Real-time order placement and acceptance
  - Dynamic order status updates
  - Delivery personnel assignment
  - Order history and tracking

- **💳 Payment Integration**
  - Razorpay payment gateway integration
  - Secure payment verification
  - Transaction history

- **🚚 Real-Time Delivery Tracking**
  - Live location updates using Socket.io
  - Delivery OTP verification
  - Real-time order notifications
  - Delivery personnel assignment management

- **📍 Geolocation Services**
  - Location-based restaurant discovery
  - Delivery personnel tracking
  - City-based filtering

- **👨‍💼 Admin Dashboard**
  - Platform analytics and statistics
  - User blocking/unblocking system
  - Dashboard state monitoring
  - Admin authentication

- **🖼️ Image Management**
  - Cloudinary integration for image uploads
  - Profile and restaurant images
  - Optimized image delivery

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| **Runtime** | Node.js |
| **Framework** | Express.js 5.2.1 |
| **Database** | MongoDB 7.2.0 |
| **ODM** | Mongoose 9.3.0 |
| **Real-Time** | Socket.io 4.8.3 |
| **Authentication** | JWT, Google OAuth |
| **Payments** | Razorpay 2.9.6 |
| **Image Storage** | Cloudinary 2.9.0 |
| **Email Service** | Nodemailer 8.0.4 |
| **Security** | bcryptjs 3.0.3 |
| **Caching** | Redis 5.12.1 |
| **AI Integration** | OpenAI 6.38.0 |
| **Dev Tools** | Nodemon 3.1.14 |

---

## 📦 Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- MongoDB instance (local or Atlas)
- Cloudinary account
- Razorpay account
- Google OAuth credentials (optional)

### Step 1: Clone the Repository

```bash
git clone https://github.com/gauravkoshti88/DesiZapp-Backend.git
cd DesiZapp-Backend
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment Variables

```bash
Create a `.env` file in the root directory.
```

### Step 4: Start the Server

**Development Mode:**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

The server will be running on `http://localhost:8000`

---

## 🚀 Usage

### Running Locally

1. **Start MongoDB:**
   ```bash
   # If using local MongoDB
   mongod
   ```

2. **Start the Backend:**
   ```bash
   npm run dev
   ```

3. **Test the API:**
   - Health check: `GET http://localhost:8000/`
   - Use Postman or curl to test endpoints

### API Endpoints Overview

#### Authentication (`/api/auth`)
- `POST /user/register` - Register new user
- `POST /user/login` - User login
- `POST /user/logout` - User logout
- `POST /user/send-otp` - Send OTP to email
- `POST /user/verify-otp` - Verify OTP
- `POST /user/reset-password` - Reset password
- `POST /user/google-auth` - Google OAuth login
- `POST /admin/login` - Admin login

#### User Routes (`/api/user`)
- `GET /get-user` - Get user profile
- `POST /update-location` - Update delivery location
- `POST /edit-profile` - Edit user profile with image
- `GET /delivered-orders` - Get delivered orders by delivery personnel

#### Restaurant Routes (`/api/shop`)
- `POST /create-edit` - Create or edit restaurant
- `GET /my-shop` - Get restaurant details
- `GET /get-shop-by-city/:city` - Find restaurants by city
- `GET /earnings/:shopId` - Get restaurant earnings

#### Food Items (`/api/food`)
- CRUD operations for menu items

#### Orders (`/api/order`)
- `POST /place-order` - Place new order
- `POST /verify-payment` - Verify Razorpay payment
- `GET /my-orders` - Get user's orders
- `PUT /update-status/:orderId/:shopId` - Update order status
- `GET /get-assignment` - Get delivery assignment
- `GET /accept-order/:assignmentId` - Accept delivery order
- `GET /current-order` - Get current delivery order
- `GET /get-order-by-id/:orderId` - Get order details
- `POST /send-delivery-otp` - Send OTP to customer
- `POST /verify-delivery-otp` - Verify delivery OTP
- `GET /get-today-deliveries` - Get today's deliveries

#### Admin Routes (`/api/admin`)
- `GET /getAdmin` - Get admin profile
- `GET /getDashboardState` - Get dashboard analytics
- `POST /block-user` - Block user
- `GET /blocked-users` - Get list of blocked users
- `POST /unblock-user` - Unblock user

---

## 🌐 Live Demo / Deployment

- **Backend:** Deployed on [Render](https://render.com)
- **Frontend:** Deployed on [Vercel](https://vercel.com)

**Live URLs:**
- Admin Dashboard: https://desizapp-admin.vercel.app
- Customer App: https://desizapp-food-delivery.vercel.app

---

## 📁 Folder Structure

```
DesiZapp-Backend/
├── src/
│   ├── config/              # Database & configuration
│   │   └── db.js           # MongoDB connection
│   ├── controllers/         # Route handlers
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── shop.controller.js
│   │   ├── item.controller.js
│   │   ├── order.controller.js
│   │   ├── admin.controller.js
│   │   └── ai.controller.js
│   ├── middlewere/          # Custom middleware
│   │   ├── authMiddleware.js    # JWT verification
│   │   ├── adminAuth.js         # Admin authentication
│   │   └── multer.js           # File upload handling
│   ├── models/              # Mongoose schemas
│   │   ├── user.model.js
│   │   ├── shop.model.js
│   │   ├── item.model.js
│   │   ├── order.model.js
│   │   └── admin.model.js
│   ├── routes/              # API routes
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── shop.routes.js
│   │   ├── item.routes.js
│   │   ├── order.routes.js
│   │   ├── admin.routes.js
│   │   └── ai.routes.js
│   ├── utils/               # Utility functions
│   └── ai/                  # AI integration
├── socket.js                # WebSocket configuration
├── server.js                # Express app setup
├── .env                     # Environment variables (create this)
├── .gitignore               # Git ignore rules
├── package.json             # Dependencies
└── README.md                # This file
```

---

## 🔌 Real-Time Features (Socket.io)

The backend uses Socket.io for real-time communication:

### Socket Events:
- **`identity`** - Register user connection
- **`updateLocation`** - Update delivery personnel location (latitude, longitude)
- **`deliveryBoyLocationUpdate`** - Broadcast delivery location to connected clients
- **`disconnect`** - Handle user disconnection

### CORS Configuration:
- Allows connections from: `localhost:5173`, `localhost:5174`, and deployed Vercel apps

---

## 🔐 Security Features

- ✅ Password hashing with bcryptjs
- ✅ JWT token-based authentication
- ✅ CORS protection
- ✅ Cookie-based session management
- ✅ Role-based access control (User, Admin, Partner, Delivery)
- ✅ OTP verification for sensitive operations
- ✅ Admin middleware for protected routes
- ✅ Environment variable protection

## 🤝 Contributing

Contributions are welcome! Here's how to help:

1. **Fork the repository**
   ```bash
   git clone https://github.com/yourusername/DesiZapp-Backend.git
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/YourFeatureName
   ```

3. **Commit your changes**
   ```bash
   git commit -m "Add: Brief description of changes"
   ```

4. **Push to your branch**
   ```bash
   git push origin feature/YourFeatureName
   ```

5. **Open a Pull Request** with a detailed description of changes

### Code Guidelines:
- Follow ES6+ standards
- Use async/await for asynchronous operations
- Add comments for complex logic
- Test endpoints before submitting PR

---

## 📝 License

This project is licensed under the **MIT License**. See the LICENSE file for more details.

---

## 📧 Contact & Support

**Developer:** Gaurav Koshti  
**GitHub:** [@gauravkoshti88](https://github.com/gauravkoshti88)  
**LinkedIn:** [Gaurav Koshti](www.linkedin.com/in/gaurav-koshti-565b73249)  
**Email:** gaurav.koshti1@gmail.com

---

## 🙏 Acknowledgments

- Thanks to the open-source community for amazing libraries
- MongoDB & Mongoose for robust data management
- Socket.io for real-time communication
- Razorpay for seamless payment integration
- Cloudinary for reliable image storage

---

## 📈 Project Stats

- **Repository:** gauravkoshti88/DesiZapp-Backend
- **Language:** JavaScript (Node.js)
- **Last Updated:** May 2026
- **Contributors:** 1
- **Stars:** ⭐

---

**Made with ❤️ by Gaurav Koshti**
