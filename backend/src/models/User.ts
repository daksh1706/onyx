import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  passwordHash: string;
  encryptedWallet: string; // JSON payload storing encrypted seed/key
  fullName?: string;
  email?: string;
  phone?: string;
  img?: string; // Profile picture URL or base64 data string
}

const UserSchema: Schema = new Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    encryptedWallet: { type: String, required: true },
    fullName: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    img: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", UserSchema);
