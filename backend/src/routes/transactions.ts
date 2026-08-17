import { Router, Response } from "express";
import Transaction from "../models/Transaction";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();

// 1. Log a new transaction
router.post("/", authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const { hash, type, token, amount, otherAddress, blockNumber, timestamp } = req.body;

    if (!hash || !type || !token || !amount || !blockNumber) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if transaction was already logged
    const existingTx = await Transaction.findOne({ hash });
    if (existingTx) {
      return res.status(200).json(existingTx); // Already logged, return success
    }

    const newTx = new Transaction({
      hash,
      userId: req.userId,
      type,
      token,
      amount,
      otherAddress,
      blockNumber,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });

    await newTx.save();
    return res.status(201).json(newTx);
  } catch (error: any) {
    console.error("Post transaction error:", error);
    return res.status(500).json({ error: "Server failed to log transaction" });
  }
});

// 2. Fetch transaction history
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const txHistory = await Transaction.find({ userId: req.userId })
      .sort({ blockNumber: -1 })
      .limit(100);

    return res.status(200).json(txHistory);
  } catch (error: any) {
    console.error("Get transactions error:", error);
    return res.status(500).json({ error: "Server failed to retrieve transactions" });
  }
});

export default router;
