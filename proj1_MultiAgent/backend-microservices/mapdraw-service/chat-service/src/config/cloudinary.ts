import { v2 as cloudinary } from "cloudinary";

// Thiết lập cấu hình kết nối và xác thực cho dịch vụ Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;