import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    // 1. Read the Connection String from .env
    // If .env is missing, it defaults to 'tradecomply'
    const dbName = process.env.MONGODB_URI || 'mongodb://localhost:27017/tradecomply';
    
    // 2. Open the Connection
    await mongoose.connect(dbName);
    
    console.log(`✅ MongoDB Connected to: ${dbName}`);
  } catch (error) {
    console.error('❌ MongoDB Connection Failed:', error);
    // Stop the app if DB is dead
    process.exit(1);
  }
};

export default connectDB;