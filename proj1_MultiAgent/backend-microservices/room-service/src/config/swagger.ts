// src/config/swagger.ts
import swaggerJSDoc from "swagger-jsdoc"; // Import thư viện swagger-jsdoc để tự động tạo tài liệu chuẩn OpenAPI từ mã nguồn

// Khai báo đối tượng cấu hình tùy chọn cho swagger-jsdoc dựa trên kiểu dữ liệu Options
const options: swaggerJSDoc.Options = {
    definition: {
        openapi: "3.0.0", // Xác định phiên bản tiêu chuẩn kỹ thuật OpenAPI đang sử dụng (OpenAPI 3.0.0)
        info: {
            title: "MultiAgent Office - Room Service API", // Tiêu đề định danh dịch vụ hiển thị trên giao diện tài liệu
            version: "1.0.0",                        // Phiên bản hiện tại của dịch vụ API
            description: "Tài liệu API quản lý phòng làm việc, thành viên, lời mời và kết nối Agent trong hệ thống microservices.", // Mô tả tổng quan chức năng Room Service
        },
        servers: [
            {
                url: "http://localhost:5002",          // Đường dẫn URL gốc của máy chủ phục vụ kiểm thử API cho Room Service
                description: "Room Service Local Server", // Chú thích tên môi trường server cục bộ
            },
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: "http",                        // Loại cơ chế xác thực dựa trên HTTP
                    scheme: "bearer",                    // Lược đồ xác thực là Bearer
                    bearerFormat: "JWT",                 // Định dạng token là JSON Web Token
                    description: "Nhập token dạng: Bearer <access_token>", // Hướng dẫn cú pháp nhập token xác thực trên giao diện Swagger UI
                },
            },
        },
    },
    // Quét toàn bộ các tệp tài liệu định nghĩa API nằm trong thư mục src/docs/ để tự động tổng hợp
    apis: ["./src/docs/*.ts"],
};

// Khởi tạo và export các thông số kỹ thuật (specs) của Swagger dựa trên cấu hình options đã thiết lập
export const swaggerSpecs = swaggerJSDoc(options);