// src/config/swagger.ts
import swaggerJSDoc from "swagger-jsdoc";

const options: swaggerJSDoc.Options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Claw Office - User Service API",
            version: "1.0.0",
            description: "Tài liệu API quản lý người dùng và xác thực hệ thống microservices.",
        },
        servers: [
            {
                url: "http://localhost:5001",
                description: "User Service Local Server",
            },
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                    description: "Nhập token dạng: Bearer <access_token>",
                },
            },
        },
    },
    // Quét toàn bộ các file tài liệu nằm trong thư mục src/docs/
    apis: ["./src/docs/*.ts"],
};

export const swaggerSpecs = swaggerJSDoc(options);