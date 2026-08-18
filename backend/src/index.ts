import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth";
import txRoutes from "./routes/transactions";
import bankRoutes from "./routes/banks";
import faucetRoutes from "./routes/faucet";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI;

// Security & Body parsing middlewares
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/transactions", txRoutes);
app.use("/api/banks", bankRoutes);
app.use("/api/faucet", faucetRoutes);

// Health Check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date() });
});

if (!MONGODB_URI) {
  console.error("Critical: MONGODB_URI environmental variable is missing.");
  process.exit(1);
}

// Mongoose Connection
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Successfully connected to MongoDB database.");
    app.listen(PORT, () => {
      console.log(`Backend server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database connection failure:", err);
    process.exit(1);
  });
