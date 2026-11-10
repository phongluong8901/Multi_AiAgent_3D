import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db";
import coinRoutes from "./routes/coin.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5006;

app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
    res.status(200).json({
        service: "savecoin-service",
        message: "Virtual Coin Wallet & PlanTask Rewards Microservice is active!",
        port: PORT,
        timestamp: new Date().toISOString(),
    });
});

// Gắn routes
app.use("/api/v1", coinRoutes);

async function startServer() {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`[savecoin-service] Running on http://localhost:${PORT}`);
    });
}

startServer().catch((err) => {
    console.error("[savecoin-service] Fatal startup error:", err);
});
