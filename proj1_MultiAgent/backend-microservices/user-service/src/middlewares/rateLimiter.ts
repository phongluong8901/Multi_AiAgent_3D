import { Redis } from "ioredis";
import { RedisStore } from "rate-limit-redis";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Kiểm tra xem có file .env thật không (dùng khi chạy local)
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log("◇ Loaded env from local .env file");
} else {
    // Nếu ở trên Docker (không có file .env), giữ nguyên biến do Docker Compose cung cấp
    dotenv.config();
}

// Khởi tạo ioredis client (tự động queue lệnh, khắc phục hoàn toàn ClientClosedError)
const redisClient = new Redis(process.env.REDIS_URL || "redis://redis:6379");

// Lắng nghe sự kiện kết nối Redis thành công
redisClient.on("connect", () => {
    console.log("[Redis] Connected successfully with ioredis.");
});

// Lắng nghe sự kiện lỗi xảy ra trong quá trình ioredis hoạt động
redisClient.on("error", (err) => {
    console.error("[Redis] Connection Error:", err);
});

// 1. Auth Rate Limiter (Bộ giới hạn dành riêng cho các tuyến đường xác thực như Đăng nhập, Đăng ký,...)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Khoảng thời gian tính bằng mili-giây (15 phút)
    max: 500, // Số lượng request tối đa được phép thực hiện trong khoảng thời gian trên (tối đa 500 lần thử)
    standardHeaders: true, // Trả về thông tin giới hạn chuẩn trong các header phản hồi (RateLimit-*)
    legacyHeaders: false, // Tắt các header cũ không chuẩn (X-RateLimit-*)
    store: new RedisStore({
        // @ts-expect-error - Bỏ qua lỗi bất tương thích kiểu dữ liệu tạm thời giữa ioredis và rate-limit-redis
        sendCommand: (...args: string[]) => redisClient.call(...args), // Cấu hình hàm truyền lệnh sử dụng phương thức .call() của ioredis
    }),
    message: {
        success: false,
        message: "Quá nhiều lần thử, vui lòng thử lại sau 15 phút.", // Thông báo lỗi trả về cho client khi vượt quá hạn mức
    },
});

// 2. General Rate Limiter (Bộ giới hạn thông thường áp dụng cho các API chung của hệ thống)
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // Khoảng thời gian cửa sổ trượt là 15 phút
    max: 10000, // Số lượng yêu cầu tối đa cho phép lớn hơn (tối đa 10000 request trong 15 phút)
    standardHeaders: true, // Kích hoạt header giới hạn tiêu chuẩn
    legacyHeaders: false, // Tắt header cũ
    store: new RedisStore({
        // @ts-expect-error - Bỏ qua cảnh báo kiểu dữ liệu TypeScript khi đồng bộ ioredis với store
        sendCommand: (...args: string[]) => redisClient.call(...args), // Ủy quyền thực thi lệnh Redis qua ioredis client
    }),
    message: {
        success: false,
        message: "Quá nhiều yêu cầu, vui lòng chậm lại.", // Thông báo cảnh báo khi client gửi request quá nhanh
    },
});