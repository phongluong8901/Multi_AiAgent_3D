import { Request } from "express";
import multer from "multer";
import "multer"; // Đảm bảo load type của Express.Multer.File

// Sử dụng memoryStorage để lưu file tạm trên RAM dưới dạng Buffer
const storage = multer.memoryStorage();

// Bộ lọc định dạng file cho phép
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimeTypes = [
        // Ảnh
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        // Dữ liệu / Tài liệu
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/pdf",
        "text/plain"
    ];

    const ext = file.originalname.split(".").pop()?.toLowerCase() || "";
    const allowedExtensions = ["jpg", "jpeg", "png", "webp", "gif", "csv", "xlsx", "xls", "pdf", "txt", "md"];

    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error("Định dạng file không được hỗ trợ! Chỉ chấp nhận Ảnh, CSV, Excel, PDF và Text."));
    }
};

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 20 * 1024 * 1024, // Giới hạn tối đa 20MB mỗi file
    },
});