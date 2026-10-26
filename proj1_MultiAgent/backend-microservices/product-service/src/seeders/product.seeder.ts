import { ProductModel } from "../models/product.model";

export async function seedProducts() {
    try {
        const defaultProducts = [
            // 1. NVIDIA MICRODUCK DEBUGGER
            {
                agentId: "agent_microduck",
                name: "NVIDIA MicroDuck Orin",
                title: "Robot Vịt Vàng Debugger & Phân Tích Logic AST",
                description: "Thiết kế cảm hứng từ Rubber Duck Debugging huyền thoại kết hợp vi xử lý NVIDIA Jetson Orin Nano 40 TOPS. Trang bị cảm biến quang học RGB-D, phát hiện syntax error, debug stack trace và tối ưu thuật toán thời gian thực.",
                color: "#eab308",
                category: "Robotics & Vision",
                formType: "duck",
                computeTier: "Jetson Orin Nano 40 TOPS",
                pricing: {
                    buyPrice: 750,
                    rentHourlyRate: 8,
                    rentDailyRate: 45,
                    rentMonthlyRate: 700,
                },
                skills: ["Live Code Debugging", "AST Code Analysis", "Rubber Duck Logic Walkthrough", "TensorRT Bug Detector"],
                tools: ["calculator_tool", "web_search_tool"],
                modelTier: "gemini-2.5-flash-lite",
                rating: 5.0,
                reviewsCount: 230,
                totalRented: 680,
                totalBought: 195,
                isFeatured: true,
                isAvailableForRent: true,
                isAvailableForBuy: true,
            },

            // 2. NOVA CARTER AMR (INDUSTRIAL MOBILE ROBOT)
            {
                agentId: "agent_amr",
                name: "Nova Carter AMR Industrial",
                title: "Robot Tự Hành Nhà Kho & Điều Phối Hậu Cần",
                description: "Robot AMR tiêu chuẩn công nghiệp hợp tác giữa NVIDIA & Segway. Tích hợp Jetson AGX Orin 275 TOPS, 2 cụm LiDAR 360 độ và 4 camera RealSense Stereoscopic. Chạy thuật toán Isaac ROS 2 Nav2, tự động lập bản đồ Cartographer SLAM và tránh vật cản động.",
                color: "#f97316",
                category: "Industrial AMR",
                formType: "amr",
                computeTier: "Jetson AGX Orin 275 TOPS",
                pricing: {
                    buyPrice: 1350,
                    rentHourlyRate: 20,
                    rentDailyRate: 110,
                    rentMonthlyRate: 1600,
                },
                skills: ["Isaac ROS 2 Nav2", "360 LiDAR SLAM", "Dynamic Obstacle Avoidance", "Warehouse Log Automation"],
                tools: ["system_control_tool", "calculator_tool"],
                modelTier: "gemini-2.5-flash-lite",
                rating: 4.9,
                reviewsCount: 185,
                totalRented: 512,
                totalBought: 140,
                isFeatured: true,
                isAvailableForRent: true,
                isAvailableForBuy: true,
            },

            // 3. PROJECT GR00T BIPED HUMANOID
            {
                agentId: "agent_gr00t",
                name: "Project GR00T Humanoid AI",
                title: "Robot Người Hai Chân Đa Thể Thức (Isaac GR00T)",
                description: "Nền tảng robot hình nhân hai chân đột phá chạy mô hình nền tảng NVIDIA GR00T. Khả năng bắt chước thao tác khéo léo của con người, hiểu lệnh ngôn ngữ tự nhiên, phối hợp chuyển động toàn thân (whole-body control) trong môi trường văn phòng và phòng thí nghiệm.",
                color: "#76b900",
                category: "Humanoid GR00T",
                formType: "humanoid",
                computeTier: "Dual Thor Superchip 2000 TFLOPS",
                pricing: {
                    buyPrice: 1800,
                    rentHourlyRate: 25,
                    rentDailyRate: 140,
                    rentMonthlyRate: 2100,
                },
                skills: ["Whole-body Motion Control", "Dexterous Manipulation", "Multimodal Spatial Reasoning", "Isaac Lab Training"],
                tools: ["system_control_tool", "web_search_tool"],
                modelTier: "gemini-2.5-flash-lite",
                rating: 5.0,
                reviewsCount: 310,
                totalRented: 840,
                totalBought: 260,
                isFeatured: true,
                isAvailableForRent: true,
                isAvailableForBuy: true,
            },

            // 4. CYBER DRONE FALCON (AERIAL ISAAC)
            {
                agentId: "agent_drone",
                name: "Cyber Falcon Patrol Drone",
                title: "Drone Giám Sát Trên Không & Tuần Tra An Ninh 3D",
                description: "Drone 4 cánh quạt sợi carbon siêu nhẹ trang bị vi xử lý Jetson Orin NX 100 TOPS và cảm biến RTK định vị centimet. Tự động tuần tra không phận, lập bản đồ không gian 3D và phát hiện dị vật bằng thị giác máy tính AI.",
                color: "#06b6d4",
                category: "Robotics & Vision",
                formType: "drone",
                computeTier: "Jetson Orin NX 100 TOPS",
                pricing: {
                    buyPrice: 950,
                    rentHourlyRate: 14,
                    rentDailyRate: 75,
                    rentMonthlyRate: 1150,
                },
                skills: ["3D Aerial Photogrammetry", "Centimeter RTK Positioning", "Thermal Inspection", "Isaac Perceptor Vision"],
                tools: ["web_search_tool"],
                modelTier: "gemini-2.5-flash-lite",
                rating: 4.8,
                reviewsCount: 142,
                totalRented: 390,
                totalBought: 98,
                isFeatured: false,
                isAvailableForRent: true,
                isAvailableForBuy: true,
            },

            // 5. TEAM LEAD ORCHESTRATOR
            {
                agentId: "agent_manager",
                name: "DGX Fleet Orchestrator",
                title: "Trung Tâm Điều Phối Cụm Robot Tự Hành & Đa Tác Vụ",
                description: "Node chỉ huy cấp siêu máy tính DGX. Tiếp nhận bài toán quy mô lớn, phân bổ nhiệm vụ đồng bộ cho đàn robot MicroDuck, Nova Carter AMR và Drone thực thi liên tục không gián đoạn.",
                color: "#3b82f6",
                category: "Management",
                formType: "humanoid",
                computeTier: "NVIDIA DGX Cluster Node",
                pricing: {
                    buyPrice: 1500,
                    rentHourlyRate: 22,
                    rentDailyRate: 120,
                    rentMonthlyRate: 1800,
                },
                skills: ["Multi-Robot Fleet Handoff", "Hierarchical Task Network", "Realtime Telemetry Sync", "Consensus Protocol"],
                tools: ["system_control_tool"],
                modelTier: "gemini-2.5-flash-lite",
                rating: 5.0,
                reviewsCount: 198,
                totalRented: 620,
                totalBought: 175,
                isFeatured: true,
                isAvailableForRent: true,
                isAvailableForBuy: true,
            },

            // 6. CODING & ALGORITHM ROBOT
            {
                agentId: "agent_coder",
                name: "TensorRT Code Master",
                title: "Robot Kỹ Sư Tối Ưu Hóa & Lập Trình CUDA/Python",
                description: "Chuyên gia viết mã ứng dụng robot thông minh, nạp pipeline TensorRT tăng tốc độ suy luận deep learning, tích hợp ROS 2 nodes và kiểm thử tự động.",
                color: "#ec4899",
                category: "AI Engineering",
                formType: "humanoid",
                computeTier: "RTX 6000 Ada Generation",
                pricing: {
                    buyPrice: 1100,
                    rentHourlyRate: 16,
                    rentDailyRate: 85,
                    rentMonthlyRate: 1300,
                },
                skills: ["CUDA Kernel Optimization", "TensorRT Model Quantization", "ROS 2 C++/Python Nodes", "GitOps CI/CD"],
                tools: ["calculator_tool", "web_search_tool"],
                modelTier: "gemini-2.5-flash-lite",
                rating: 4.9,
                reviewsCount: 165,
                totalRented: 430,
                totalBought: 132,
                isFeatured: false,
                isAvailableForRent: true,
                isAvailableForBuy: true,
            },

            // 7. WEB RESEARCH ROBOT
            {
                agentId: "agent_search",
                name: "Omniverse Data Scout",
                title: "Robot Trinh Sát Dữ Liệu & RAG Thời Gian Thực",
                description: "Thu thập tài liệu nghiên cứu robotics, dữ liệu vật lý mô phỏng và cập nhật tri thức mới nhất từ thế giới thực vào kho ngữ cảnh của toàn đội.",
                color: "#8b5cf6",
                category: "Research & Search",
                formType: "humanoid",
                computeTier: "NVIDIA Cloud SuperNIC",
                pricing: {
                    buyPrice: 650,
                    rentHourlyRate: 9,
                    rentDailyRate: 45,
                    rentMonthlyRate: 720,
                },
                skills: ["Autonomous Data Mining", "RAG Vector Indexing", "Technical Spec Extraction", "Realtime Web Feeds"],
                tools: ["web_search_tool"],
                modelTier: "gemini-2.5-flash-lite",
                rating: 4.8,
                reviewsCount: 120,
                totalRented: 310,
                totalBought: 84,
                isFeatured: false,
                isAvailableForRent: true,
                isAvailableForBuy: true,
            }
        ];

        for (const item of defaultProducts) {
            await ProductModel.findOneAndUpdate(
                { agentId: item.agentId },
                { $set: item },
                { upsert: true, new: true }
            );
        }
        console.log(`[product-service] Seeded ${defaultProducts.length} NVIDIA robotics agent products successfully.`);
    } catch (e) {
        console.error("[product-service] Error seeding products:", e);
    }
}
