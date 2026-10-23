import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db";
import { connectRabbitMQ } from "./config/rabbitmq";
import { seedProducts } from "./seeders/product.seeder";

import productRoutes from "./routes/product.routes";
import orderRoutes from "./routes/order.routes";
import inventoryRoutes from "./routes/inventory.routes";
import walletRoutes from "./routes/wallet.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5004;

app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
    res.status(200).json({
        service: "product-service",
        message: "AI Agent Marketplace & Rental Microservice is active!",
        timestamp: new Date().toISOString(),
    });
});

// Routes API v1
app.use("/api/v1", productRoutes);
app.use("/api/v1", orderRoutes);
app.use("/api/v1", inventoryRoutes);
app.use("/api/v1", walletRoutes);

async function startServer() {
    await connectDB();
    await connectRabbitMQ();
    await seedProducts();

    app.listen(PORT, () => {
        console.log(`[product-service] Running on http://localhost:${PORT}`);
    });
}

startServer().catch((err) => {
    console.error("[product-service] Fatal startup error:", err);
});
