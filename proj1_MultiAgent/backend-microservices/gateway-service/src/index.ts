import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { globalLimiter } from "./middlewares/rateLimiter";
import userRouter from "./routes/user-service/user.proxy";
import serviceRouter from "./routes/service.proxy";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware chung
app.use(cors());

// Áp dụng Global Rate Limiter cho toàn cổng Gateway
app.use(globalLimiter);

// Health check endpoint
app.get("/", (req, res) => {
    res.status(200).json({ message: "API Gateway is running smoothly!" });
});

// Gắn các modules route proxy vào app
app.use(userRouter);
app.use(serviceRouter);

// Khởi chạy Gateway Server
app.listen(PORT, () => {
    console.log(`[api-gateway] Gateway is running on http://localhost:${PORT}`);
});