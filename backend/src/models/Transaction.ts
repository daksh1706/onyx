import mongoose, { Schema, Document } from "mongoose";

export interface ITransaction extends Document {
  hash: string;
  userId: mongoose.Types.ObjectId;
  type: "Send" | "Receive" | "Swap" | "Faucet" | "Deposit";
  token: string;
  amount: string;
  otherAddress?: string;
  blockNumber: number;
  timestamp: Date;
}

const TransactionSchema: Schema = new Schema(
  {
    hash: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true, enum: ["Send", "Receive", "Swap", "Faucet", "Deposit"] },
    token: { type: String, required: true },
    amount: { type: String, required: true },
    otherAddress: { type: String },
    blockNumber: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.model<ITransaction>("Transaction", TransactionSchema);
