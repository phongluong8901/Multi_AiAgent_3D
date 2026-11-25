import cloudinary from "../config/cloudinary";

// Định nghĩa và export hàm upload buffer ảnh lên Cloudinary
export const uploadBufferToCloudinary = (fileBuffer: Buffer): Promise<string> => {
    return new Promise((resolve, reject) => {
        // Tạo một upload stream để đẩy dữ liệu dạng buffer trực tiếp lên Cloudinary
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "MultiAgent3dAvatar", // Đặt tên folder trên Cloudinary theo yêu cầu
                transformation: [
                    { width: 400, height: 400, crop: "fill" }, // Tự động crop vuông avatar 400x400
                    { quality: "auto", fetch_format: "auto" }   // Tối ưu hóa dung lượng ảnh tự động
                ],
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result!.secure_url); // Nếu thành công, trả về đường dẫn URL HTTPS bảo mật của bức ảnh
            }
        );
        stream.end(fileBuffer); // Kết thúc stream và truyền toàn bộ dữ liệu Buffer của file vào
    });
};