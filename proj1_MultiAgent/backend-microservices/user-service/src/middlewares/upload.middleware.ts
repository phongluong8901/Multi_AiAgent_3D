import multer from "multer";

const storage = multer.memoryStorage();

export const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn tối đa 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Chỉ chấp nhận file hình ảnh (jpg, png, jpeg,...)!"));
        }
    },
});