import express from "express";
import cors from "cors";
import sellerRoutes from "./routes/seller.routes";
import { errorHandler } from "./middlewares/error.middleware";

const app = express();

app.use(cors({
    origin: true,
    credentials: true,
}));

app.use(express.json());

// Routes
app.use("/api/v1/seller", sellerRoutes);

// Health check
app.get("/", (req, res) => {
    res.status(200).json({ message: "Seller Service is running smoothly!" });
});

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "seller-service" });
});

app.use(errorHandler);

export default app;
