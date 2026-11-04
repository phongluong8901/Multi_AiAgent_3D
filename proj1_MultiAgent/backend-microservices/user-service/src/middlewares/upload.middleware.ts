import multer from "multer";

// Cấu hình lưu trữ tệp tạm thời trong bộ nhớ RAM thay vì lưu trực tiếp xuống ổ đĩa cứng của server
const storage = multer.memoryStorage();

// Khởi tạo và export đối tượng middleware upload sử dụng multer với các giới hạn và quy tắc lọc tệp
export const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn tối đa 5MB

    // Hàm lọc tệp, chỉ cho phép upload các định dạng hình ảnh (jpg, png, jpeg, gif, svg)
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Chỉ chấp nhận file hình ảnh (jpg, png, jpeg,...)!"));
        }
    },
});