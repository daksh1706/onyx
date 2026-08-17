import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  username: string;
  passwordHash: string;
  encryptedWallet: string; // JSON payload storing encrypted seed/key
}

const UserSchema: Schema = new Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    encryptedWallet: { type: String, required: true }
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", UserSchema);
