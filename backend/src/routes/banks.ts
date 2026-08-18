import { Router, Response } from "express";
import mongoose from "mongoose";
import BankAccount from "../models/BankAccount";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();

// Helper to sanitize input strings
const sanitizeString = (val: any): string => {
  if (typeof val !== "string") return "";
  return val.trim().replace(/[<>]/g, "");
};

// 1. GET /api/banks - Retrieve all linked bank accounts for the logged-in user
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    const bankAccounts = await BankAccount.find({
      userId: req.userId,
      status: { $ne: "archived" },
    }).sort({ isPrimary: -1, createdAt: -1 });

    return res.status(200).json(bankAccounts);
  } catch (error: any) {
    console.error("Fetch bank accounts error:", error);
    return res.status(500).json({ error: "Failed to fetch bank accounts" });
  }
});

// 2. POST /api/banks - Link a new bank account
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    const { bankName, accountNumber, ifscCode, accountHolderName, isPrimary } = req.body;

    const cleanBankName = sanitizeString(bankName);
    const cleanAccountNumber = sanitizeString(accountNumber);
    const cleanIfsc = sanitizeString(ifscCode).toUpperCase();
    const cleanHolderName = sanitizeString(accountHolderName);

    // Security & format validations
    if (!cleanBankName || cleanBankName.length < 2 || cleanBankName.length > 100) {
      return res.status(400).json({ error: "Valid bank name is required (2-100 characters)." });
    }

    if (!cleanAccountNumber || cleanAccountNumber.length < 4 || cleanAccountNumber.length > 30) {
      return res.status(400).json({ error: "Valid account number or identifier is required (4-30 characters)." });
    }

    // Check if an existing bank with this exact account identifier already exists for user
    const existing = await BankAccount.findOne({
      userId: req.userId,
      bankName: cleanBankName,
      accountNumber: cleanAccountNumber,
      status: { $ne: "archived" },
    });

    if (existing) {
      return res.status(409).json({ error: "This bank account is already linked to your profile." });
    }

    // Check if this is the first linked bank
    const totalCount = await BankAccount.countDocuments({
      userId: req.userId,
      status: { $ne: "archived" },
    });

    const shouldBePrimary = totalCount === 0 || Boolean(isPrimary);

    if (shouldBePrimary && totalCount > 0) {
      // Unset previous primary accounts
      await BankAccount.updateMany({ userId: req.userId }, { $set: { isPrimary: false } });
    }

    const newBank = new BankAccount({
      userId: req.userId,
      bankName: cleanBankName,
      accountNumber: cleanAccountNumber,
      ifscCode: cleanIfsc,
      accountHolderName: cleanHolderName,
      isPrimary: shouldBePrimary,
      status: "active",
    });

    await newBank.save();

    return res.status(201).json({
      message: "Bank account linked successfully",
      bank: newBank,
    });
  } catch (error: any) {
    console.error("Add bank account error:", error);
    return res.status(500).json({ error: "Failed to link bank account" });
  }
});

// 3. PATCH /api/banks/:id - Update bank account details (or set primary)
router.patch("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid bank account ID format" });
    }

    const bank = await BankAccount.findOne({ _id: id, userId: req.userId });
    if (!bank) {
      return res.status(404).json({ error: "Bank account not found or access denied" });
    }

    const { bankName, accountNumber, ifscCode, accountHolderName, isPrimary } = req.body;

    if (bankName !== undefined) {
      const clean = sanitizeString(bankName);
      if (clean.length < 2 || clean.length > 100) {
        return res.status(400).json({ error: "Invalid bank name" });
      }
      bank.bankName = clean;
    }

    if (accountNumber !== undefined) {
      const clean = sanitizeString(accountNumber);
      if (clean.length < 4 || clean.length > 30) {
        return res.status(400).json({ error: "Invalid account number" });
      }
      bank.accountNumber = clean;
    }

    if (ifscCode !== undefined) {
      bank.ifscCode = sanitizeString(ifscCode).toUpperCase();
    }

    if (accountHolderName !== undefined) {
      bank.accountHolderName = sanitizeString(accountHolderName);
    }

    if (isPrimary === true) {
      await BankAccount.updateMany({ userId: req.userId }, { $set: { isPrimary: false } });
      bank.isPrimary = true;
    }

    await bank.save();

    return res.status(200).json({
      message: "Bank account updated successfully",
      bank,
    });
  } catch (error: any) {
    console.error("Update bank account error:", error);
    return res.status(500).json({ error: "Failed to update bank account" });
  }
});

// 4. DELETE /api/banks/:id - Remove a linked bank account
router.delete("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid bank account ID format" });
    }

    const bank = await BankAccount.findOneAndDelete({ _id: id, userId: req.userId });
    if (!bank) {
      return res.status(404).json({ error: "Bank account not found or access denied" });
    }

    // If the deleted account was primary, make the most recent remaining one primary
    if (bank.isPrimary) {
      const nextBank = await BankAccount.findOne({ userId: req.userId, status: { $ne: "archived" } }).sort({ createdAt: -1 });
      if (nextBank) {
        nextBank.isPrimary = true;
        await nextBank.save();
      }
    }

    return res.status(200).json({ message: "Bank account removed successfully", id });
  } catch (error: any) {
    console.error("Delete bank account error:", error);
    return res.status(500).json({ error: "Failed to remove bank account" });
  }
});

export default router;
