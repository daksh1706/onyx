import { Router, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "onyx_secure_vault_jwt_secret_key_change_me";

// Helper to sanitize input strings
const sanitize = (val: any): string => {
  if (typeof val !== "string") return "";
  return val.trim().replace(/[<>]/g, "");
};

// 1. User Registration
router.post("/register", async (req: any, res: any) => {
  try {
    const { username, password, encryptedWallet, fullName, email, phone, img } = req.body;

    if (!username || !password || !encryptedWallet) {
      return res.status(400).json({ error: "Missing required fields (username, password, encryptedWallet)" });
    }

    const cleanUsername = sanitize(username).toLowerCase();
    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      return res.status(400).json({ error: "Username must be between 3 and 30 characters" });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    // Security check on image size (max 5MB for base64 image data)
    let cleanImg = "";
    if (typeof img === "string") {
      if (img.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "Profile image size exceeds the 5MB limit." });
      }
      cleanImg = img;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username: cleanUsername });
    if (existingUser) {
      return res.status(409).json({ error: "Username already taken" });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user with encrypted wallet credentials and profile info
    const newUser = new User({
      username: cleanUsername,
      passwordHash,
      encryptedWallet,
      fullName: sanitize(fullName),
      email: sanitize(email),
      phone: sanitize(phone),
      img: cleanImg,
    });

    await newUser.save();

    // Create JWT token
    const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: "7d" });

    return res.status(201).json({
      message: "Registration successful",
      token,
      username: newUser.username,
      fullName: newUser.fullName,
      email: newUser.email,
      phone: newUser.phone,
      img: newUser.img,
      encryptedWallet: newUser.encryptedWallet,
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

    const cleanUsername = sanitize(username).toLowerCase();

    // Find user
    const user = await User.findOne({ username: cleanUsername });
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
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      img: user.img,
      encryptedWallet: user.encryptedWallet,
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Server login failed" });
  }
});

// 3. Get User Profile (Token Verification)
router.get("/me", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

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

// 4. Update User Profile
router.patch("/me", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    const { fullName, email, phone, img } = req.body;

    const updateFields: Record<string, string> = {};
    if (fullName !== undefined) updateFields.fullName = sanitize(fullName);
    if (email !== undefined) updateFields.email = sanitize(email);
    if (phone !== undefined) updateFields.phone = sanitize(phone);

    if (img !== undefined) {
      if (typeof img === "string" && img.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "Profile image size exceeds 5MB limit." });
      }
      updateFields.img = img;
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updateFields },
      { new: true, select: "-passwordHash" }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      message: "Profile updated",
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      img: user.img,
    });
  } catch (error: any) {
    console.error("Update profile error:", error);
    return res.status(500).json({ error: "Server error updating profile" });
  }
});

// 5. Update Password / Security Passcode
router.patch("/change-password", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    const { currentPassword, newPassword, newEncryptedWallet } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters long." });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (currentPassword) {
      const match = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!match) {
        return res.status(401).json({ error: "Current password does not match." });
      }
    }

    const saltRounds = 10;
    user.passwordHash = await bcrypt.hash(newPassword, saltRounds);

    if (newEncryptedWallet) {
      user.encryptedWallet = newEncryptedWallet;
    }

    await user.save();

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error: any) {
    console.error("Change password error:", error);
    return res.status(500).json({ error: "Failed to update password" });
  }
});

export default router;
