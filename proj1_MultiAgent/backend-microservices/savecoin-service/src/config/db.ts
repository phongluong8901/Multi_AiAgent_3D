import mongoose from "mongoose";

export async function connectDB() {
    const uri = process.env.MONGO_URI || "mongodb://localhost:27017/savecoin_db";
    try {
        await mongoose.connect(uri);
        console.log("[savecoin-service] Connected to MongoDB Atlas successfully");
    } catch (error) {
        console.error("[savecoin-service] MongoDB connection error:", error);
        setTimeout(connectDB, 5000);
    }
}
