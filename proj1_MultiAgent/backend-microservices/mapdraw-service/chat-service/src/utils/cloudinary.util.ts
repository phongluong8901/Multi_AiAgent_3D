import "multer"; // Đảm bảo load type của multer
import cloudinary from "../config/cloudinary";

export interface CloudinaryUploadResult {
    fileUrl: string;
    fileName: string;
    fileSize: number;
    category: "image" | "document";
    extension: string;
}

/**
 * Hàm upload file lên Cloudinary, tự phân loại và đẩy vào 2 thư mục riêng biệt:
 * - Ảnh (.jpg, .png, ...) -> MultiAgent3dChatImg
 * - Tài liệu (.csv, .xlsx, .pdf, ...) -> MultiAgent3dChatDoc
 */
export const uploadFileToCloudinary = (file: Express.Multer.File): Promise<CloudinaryUploadResult> => {
    return new Promise((resolve, reject) => {
        const ext = file.originalname.split(".").pop()?.toLowerCase() || "";
        const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
        const category: "image" | "document" = isImage ? "image" : "document";

        // Tách thư mục động tùy thuộc vào loại file
        const folderName = isImage ? "MultiAgent3dChatImg" : "MultiAgent3dChatDoc";

        // Thiết lập tham số upload
        const uploadOptions: any = {
            folder: folderName, // Phân rã vào thư mục tương ứng
            resource_type: isImage ? "image" : "raw", // Nếu là file csv/xlsx/pdf thì để "raw"
            public_id: `${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, "")}`, // Tránh trùng tên file
        };

        // Nếu là ảnh thì tối ưu hóa chất lượng tự động
        if (isImage) {
            uploadOptions.transformation = [
                { quality: "auto", fetch_format: "auto" }
            ];
        }

        const stream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
                if (error) return reject(error);
                resolve({
                    fileUrl: result!.secure_url,
                    fileName: file.originalname,
                    fileSize: file.size,
                    category,
                    extension: ext,
                });
            }
        );

        stream.end(file.buffer);
    });
};