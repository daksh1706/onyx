import mongoose, { Schema, Document } from "mongoose";

export interface IBankAccount extends Document {
  userId: mongoose.Types.ObjectId;
  bankName: string;
  accountNumber: string;
  ifscCode?: string;
  accountHolderName?: string;
  isPrimary?: boolean;
  status?: "active" | "unverified" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

const BankAccountSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    bankName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    ifscCode: { type: String, default: "", trim: true },
    accountHolderName: { type: String, default: "", trim: true },
    isPrimary: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "unverified", "archived"], default: "active" },
  },
  { timestamps: true }
);

export default mongoose.model<IBankAccount>("BankAccount", BankAccountSchema);
