import express from "express";
import cors from "cors";
import sellerRoutes from "./routes/seller.routes";
import { errorHandler } from "./middlewares/error.middleware";

/**
 * Khởi tạo ứng dụng Express cho Seller Service.
 * Thiết lập CORS, JSON body parser, các tuyến đường API và middleware xử lý lỗi toàn cục.
 */
const app = express();

// Cấu hình CORS cho phép kết nối từ mọi frontend domain và cho phép gửi credentials/cookie
app.use(cors({
    origin: true,
    credentials: true,
}));

// Body parser nhận tải trọng JSON
app.use(express.json());

// Đăng ký toàn bộ các route quản lý Node, giá thuê, suy luận và dashboard của Seller
app.use("/api/v1/seller", sellerRoutes);

// Health check endpoint
app.get("/", (req, res) => {
    res.status(200).json({
        service: "seller-service",
        message: "Multi-Agent Local AI Compute Seller & Host Management Service is active!",
        timestamp: new Date().toISOString(),
    });
});

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "seller-service" });
});

// Middleware xử lý lỗi toàn cục (phải đặt sau tất cả các route)
app.use(errorHandler);

export default app;
