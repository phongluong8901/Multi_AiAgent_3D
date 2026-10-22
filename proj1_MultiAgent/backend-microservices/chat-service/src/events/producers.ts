import { getChannel } from "./rabbitmq"; // Import hàm lấy channel RabbitMQ đang hoạt động từ file quản lý kết nối

const CHAT_EXCHANGE = "chat.events";   // Khai báo tên Exchange dùng cho các sự kiện liên quan đến tin nhắn chat
const AGENT_EXCHANGE = "agent.events"; // Khai báo tên Exchange dùng để giao tiếp, truyền prompt xuống các AI agent

// Định nghĩa kiểu dữ liệu cho file đính kèm trong payload RabbitMQ
export interface ChatAttachmentPayload {
    fileUrl: string;
    fileName: string;
    fileSize?: number;
    category: "image" | "document";
    extension: string;
}

// Định nghĩa hàm bất đồng bộ publishChatMessage để đẩy sự kiện tin nhắn chat lên RabbitMQ
export async function publishChatMessage(payload: {
    messageId: string;
    roomId: string;
    typeChat?: "team" | "direct" | "agent" | "system" | "workflow";
    senderId: string;
    senderName: string;
    senderType: "user" | "agent" | "system";
    message: string;
    attachments?: ChatAttachmentPayload[]; // Bổ sung danh sách file đính kèm để agent ML/Analyst có thể đọc
    targetAgentId?: string;
    createdAt?: Date;
}) {
    try {
        const channel = getChannel(); // Lấy channel kết nối RabbitMQ hiện tại
        if (!channel) { // Kiểm tra nếu RabbitMQ chưa sẵn sàng hoặc mất kết nối
            console.warn("[chat-service] RabbitMQ channel not available, skipping publish.");
            return; // Thoát hàm an toàn, tránh làm sập luồng chính của ứng dụng
        }

        // Xác định routingKey dựa trên việc tin nhắn có tag đích (direct) tới một agent cụ thể hay gửi chung (broadcast)
        const routingKey = payload.targetAgentId
            ? `chat.message.direct.${payload.targetAgentId}` // Nếu có tag agent cụ thể
            : "chat.message.broadcast"; // Nếu là tin nhắn chung cho cả phòng

        // Thực hiện phát tán (publish) message lên RabbitMQ Exchange
        channel.publish(
            CHAT_EXCHANGE, // Tên Exchange nhận message
            routingKey, // Routing key định tuyến message
            Buffer.from(JSON.stringify(payload)), // Chuyển đổi object payload thành chuỗi JSON rồi ép kiểu sang Buffer (RabbitMQ yêu cầu dữ liệu dạng Buffer)
            { persistent: true } // Đánh dấu message là persistent (lưu đĩa) để không bị mất khi RabbitMQ khởi động lại
        );
        console.log(`[chat-service] Published event ${routingKey} to ${CHAT_EXCHANGE}`); // In log thành công
    } catch (err: any) {
        // Bắt lỗi ngoại lệ (nếu có sự cố khi publish) nhưng chỉ log cảnh báo để không làm gián đoạn request của người dùng
        console.warn(`[chat-service] publishChatMessage failed (MQ unavailable): ${err.message}`);
    }
}

// Định nghĩa hàm publishAgentPrompt để đẩy yêu cầu xử lý từ user xuống hệ thống AI Agent qua hàng đợi
export async function publishAgentPrompt(payload: {
    agentId: string;
    roomId: string;
    userPrompt: string;
    userName: string;
    userId: string;
}) {
    try {
        const channel = getChannel(); // Lấy channel RabbitMQ
        if (!channel) return; // Nếu channel không có sẵn thì dừng lại

        const routingKey = `agent.prompt.${payload.agentId}`; // Tạo routing key động gắn liền với ID của agent nhận nhiệm vụ
        channel.publish(
            AGENT_EXCHANGE, // Gửi vào Exchange chuyên biệt cho Agent
            routingKey, // Routing key theo từng agent cụ thể
            Buffer.from(JSON.stringify(payload)), // Đóng gói payload thành Buffer dữ liệu JSON
            { persistent: true } // Cấu hình lưu trữ bền vững (persistent)
        );
        console.log(`[chat-service] Published prompt request to agent ${payload.agentId}`); // Log thông báo thành công
    } catch (err: any) {
        console.warn(`[chat-service] publishAgentPrompt failed (MQ unavailable): ${err.message}`);
        // QUAN TRỌNG: Re-throw lại lỗi (ném lỗi ra ngoài) để hàm gọi nó (như AgentDispatcher) 
        // biết đường fallback chuyển sang gọi trực tiếp bằng HTTP POST sang FastAPI service nếu RabbitMQ chết.
        throw err;
    }
}