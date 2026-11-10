import { Request } from "express";
import multer from "multer";
import "multer";

// Su dung memoryStorage de luu file tam tren RAM duoi dang Buffer
const storage = multer.memoryStorage();

/**
 * Bo loc kiem tra dinh dang MIME type va duoi file hop le:
 * - Dinh dang anh: JPEG, PNG, WEBP, GIF
 * - Dinh dang du lieu & tai lieu: CSV, XLSX, XLS, PDF, TXT, MD
 */
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
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

/**
 * Middleware Multer upload file dinh kem:
 * Gioi han toi da 20MB moi file, luu tru tam thoi trong Memory Buffer de day len Cloudinary.
 */
export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 20 * 1024 * 1024, // Gioi han toi da 20MB moi file
    },
});
