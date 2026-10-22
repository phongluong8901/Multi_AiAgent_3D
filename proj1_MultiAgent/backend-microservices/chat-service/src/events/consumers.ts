import { Server as SocketIOServer } from "socket.io"; // Import kiểu dữ liệu của Socket.IO Server
import { getChannel } from "./rabbitmq"; // Lấy channel kết nối RabbitMQ đã được thiết lập sẵn
import { chatService } from "../services/chat.service"; // Import service thao tác với database chat
import { broadcastToRoom, agentDispatcher } from "../services/agent.dispatcher"; // Import hàm broadcast realtime và bộ điều phối agent

/**
 * Lắng nghe agent.events từ RabbitMQ:
 * Khi agent phản hồi -> Lưu tin nhắn vào MongoDB và broadcast qua Socket.IO
 */
export async function startChatConsumers(io: SocketIOServer) {
    const channel = getChannel(); // Lấy channel RabbitMQ hiện tại
    if (!channel) { // Kiểm tra nếu chưa kết nối được RabbitMQ
        console.warn("[chat-service] RabbitMQ channel not available for consumers. Chat will work via direct HTTP only.");
        return; // Thoát an toàn nếu không có MQ
    }

    const queueName = "chat_agent_reply_queue"; // Đặt tên hàng đợi nhận phản hồi từ các Agent
    await channel.assertQueue(queueName, { durable: true }); // Khởi tạo hàng đợi (durable: true giúp hàng đợi không bị mất khi RabbitMQ sập)
    await channel.bindQueue(queueName, "agent.events", "agent.reply.#"); // Gắn (bind) hàng đợi vào Exchange "agent.events" với routing key pattern "agent.reply.#"

    console.log(`[chat-service] Waiting for agent replies on queue: ${queueName}`);

    // Bắt đầu tiêu thụ (consume) message từ hàng đợi
    channel.consume(queueName, async (msg) => {
        if (!msg) return; // Nếu message rỗng thì bỏ qua

        try {
            const data = JSON.parse(msg.content.toString()); // Parse chuỗi Buffer nhận được thành object JSON
            const roomId = data.roomId || data.room_id; // Lấy ID phòng (hỗ trợ cả camelCase và snake_case)
            const agentId = data.agentId || data.agent_id || "agent"; // Lấy ID của agent phản hồi
            const agentName = data.agentName || data.agent_name || "AI Assistant"; // Lấy tên hiển thị của agent
            const answer = data.content || data.reply || data.answer || ""; // Nội dung câu trả lời từ LLM/Agent
            const toolsUsed = data.toolsUsed || data.used_tools || []; // Các công cụ (tools) mà agent đã sử dụng trong quá trình suy nghĩ
            const depth = data.depth || 0; // Độ sâu đệ quy ủy quyền giữa các agent (tránh lặp vô hạn)

            console.log(`[chat-service] Received agent reply event for room: ${roomId} from ${agentId}`);

            if (!roomId) { // Nếu thiếu thông tin phòng, không thể lưu lịch sử
                console.warn("[chat-service] Received agent reply without roomId, skipping save.");
                channel.ack(msg); // Xác nhận đã xử lý message này để RabbitMQ xóa khỏi queue, tránh kẹt queue
                return;
            }

            const trace = data.workflow_trace || data.trace || data.workflowTrace; // Lấy sơ đồ luồng suy nghĩ LangGraph (nếu có)

            // 1. Lưu câu trả lời của agent vào cơ sở dữ liệu MongoDB
            const saved = await chatService.saveMessage({
                roomId,
                senderId: agentId,
                senderType: "agent",
                senderName: agentName,
                message: answer,
                metadata: {
                    model: data.model,
                    usage: data.usage,
                    toolsUsed,
                    depth,
                    workflowTrace: trace,
                },
            });

            // 2. Phát tán tin nhắn mới tới toàn bộ client trong phòng qua Socket.IO
            broadcastToRoom(io, roomId, "receive_message", saved);

            // 3. Nếu có dữ liệu Workflow Trace (LangGraph), phát tán riêng để Frontend vẽ sơ đồ quan sát
            if (trace) {
                broadcastToRoom(io, roomId, "workflow_trace", trace);
            }

            // 4. Gửi sự kiện cập nhật trạng thái của Agent trở về 'idle' (rảnh rỗi) trên giao diện 3D
            broadcastToRoom(io, roomId, "agent_status", {
                roomId,
                agentId,
                status: "idle",
                speech: null,
            });

            // 5. Tính năng tự động phối hợp nhóm (Autonomous Team Delegation): 
            // Kiểm tra xem câu trả lời của agent có nhắc đến (@mention) agent khác không
            const nextAgents = agentDispatcher.extractMentionedAgents(answer);
            for (const nextAgent of nextAgents) {
                if (nextAgent !== agentId) { // Tránh việc agent tự gọi lại chính nó
                    console.log(`[chat-service MQ] Autonomous delegation: ${agentId} -> ${nextAgent}`);
                    // Tự động điều phối công việc sang agent tiếp theo kèm theo tăng độ sâu (depth + 1)
                    await agentDispatcher.dispatchToAgent({
                        agentId: nextAgent,
                        roomId,
                        prompt: `[Bàn giao nhiệm vụ từ ${agentName}]:\n${answer}`,
                        senderName: agentName,
                        senderId: agentId,
                        depth: depth + 1,
                    });
                }
            }

            channel.ack(msg); // 6. Xác nhận thành công (Acknowledge) với RabbitMQ để hoàn tất chu trình xử lý message
        } catch (error) {
            console.error("[chat-service] Error processing agent reply message:", error);
            channel.nack(msg, false, false); // Nếu lỗi nghiêm trọng, từ chối message và không đưa lại vào queue (hoặc cấu hình DLQ tùy ý)
        }
    });
}