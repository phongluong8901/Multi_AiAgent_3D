import { Server as SocketIOServer } from "socket.io";
import { getChannel } from "./rabbitmq";
import { chatService } from "../services/chat.service";
import { broadcastToRoom, agentDispatcher } from "../services/agent.dispatcher";

/**
 * Lắng nghe agent.events từ RabbitMQ:
 * Khi agent phản hồi -> Lưu tin nhắn vào MongoDB và broadcast Socket.IO + SSE
 */
export async function startChatConsumers(io: SocketIOServer) {
    const channel = getChannel();
    if (!channel) {
        console.warn("[chat-service] RabbitMQ channel not available for consumers. Chat will work via direct HTTP only.");
        return;
    }

    const queueName = "chat_agent_reply_queue";
    await channel.assertQueue(queueName, { durable: true });
    await channel.bindQueue(queueName, "agent.events", "agent.reply.#");

    console.log(`[chat-service] Waiting for agent replies on queue: ${queueName}`);

    channel.consume(queueName, async (msg) => {
        if (!msg) return;

        try {
            const data = JSON.parse(msg.content.toString());
            const roomId = data.roomId || data.room_id;
            const agentId = data.agentId || data.agent_id || "agent";
            const agentName = data.agentName || data.agent_name || "AI Assistant";
            const answer = data.content || data.reply || data.answer || "";
            const toolsUsed = data.toolsUsed || data.used_tools || [];
            const depth = data.depth || 0;

            console.log(`[chat-service] Received agent reply event for room: ${roomId} from ${agentId}`);

            if (!roomId) {
                console.warn("[chat-service] Received agent reply without roomId, skipping save.");
                channel.ack(msg);
                return;
            }

            const trace = data.workflow_trace || data.trace || data.workflowTrace;

            // Lưu reply của agent vào database
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

            // Phát tán tin nhắn tới client trong phòng (Socket.IO + SSE)
            broadcastToRoom(io, roomId, "receive_message", saved);

            // Phát tán workflow trace để Frontend hiển thị sơ đồ luồng LangSmith
            if (trace) {
                broadcastToRoom(io, roomId, "workflow_trace", trace);
            }

            // Cập nhật trạng thái Agent trở về idle
            broadcastToRoom(io, roomId, "agent_status", {
                roomId,
                agentId,
                status: "idle",
                speech: null,
            });

            // Kiểm tra xem phản hồi có tag agent khác để phối hợp nhóm tiếp tục không
            const nextAgents = agentDispatcher.extractMentionedAgents(answer);
            for (const nextAgent of nextAgents) {
                if (nextAgent !== agentId) {
                    console.log(`[chat-service MQ] Autonomous delegation: ${agentId} -> ${nextAgent}`);
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

            channel.ack(msg);
        } catch (error) {
            console.error("[chat-service] Error processing agent reply message:", error);
            channel.nack(msg, false, false);
        }
    });
}
