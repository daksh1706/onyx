import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("Error: MONGODB_URI is missing in .env file.");
  process.exit(1);
}

async function resetDatabase() {
  try {
    console.log("Connecting to MongoDB database to reset...");
    await mongoose.connect(MONGODB_URI!);
    console.log("Connected successfully. Dropping database...");
    
    // Drop the active database
    await mongoose.connection.db?.dropDatabase();
    
    console.log("Database reset complete. All collections dropped successfully.");
  } catch (error) {
    console.error("Failed to reset database:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

resetDatabase();
