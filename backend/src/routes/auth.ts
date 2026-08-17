import { Router, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "onyx_secure_vault_jwt_secret_key_change_me";

// 1. User Registration
router.post("/register", async (req: any, res: any) => {
  try {
    const { username, password, encryptedWallet } = req.body;

    if (!username || !password || !encryptedWallet) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: "Username already taken" });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user with encrypted wallet credentials
    const newUser = new User({
      username: username.toLowerCase(),
      passwordHash,
      encryptedWallet
    });

    await newUser.save();

    // Create JWT token
    const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: "7d" });

    return res.status(201).json({
      message: "Registration successful",
      token,
      username: newUser.username,
      encryptedWallet: newUser.encryptedWallet
    });
  } catch (error: any) {
    console.error("Register error:", error);
    return res.status(500).json({ error: "Server registration failed" });
  }
});

// 2. User Login
router.post("/login", async (req: any, res: any) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    // Find user
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Verify password hash
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Create JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" });

    return res.status(200).json({
      message: "Login successful",
      token,
      username: user.username,
      encryptedWallet: user.encryptedWallet
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Server login failed" });
  }
});

// 3. Get User Profile (Token Verification)
router.get("/me", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.userId).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(200).json(user);
  } catch (error: any) {
    console.error("Get profile error:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
