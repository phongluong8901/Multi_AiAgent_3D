/**
 * Logger tiện ích tập trung cho Seller Service.
 * Chuẩn hóa tiền tố `[seller-service] [TAG]` không sử dụng emoji, hỗ trợ các cấp độ logging:
 * - `info`: Ghi log thông tin vận hành bình thường
 * - `warn`: Ghi cảnh báo gián đoạn có thể phục hồi
 * - `error`: Ghi lỗi ngoại lệ hoặc thất bại nghiêm trọng
 */
export const logger = {
    info: (...args: any[]) => console.log(`[seller-service] [INFO]`, ...args),
    warn: (...args: any[]) => console.warn(`[seller-service] [WARN]`, ...args),
    error: (...args: any[]) => console.error(`[seller-service] [ERROR]`, ...args),
};
