import cloudinary from "../config/cloudinary";

export const uploadBufferToCloudinary = (fileBuffer: Buffer): Promise<string> => {
    return new Promise((resolve, reject) => {
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
                resolve(result!.secure_url);
            }
        );
        stream.end(fileBuffer);
    });
};