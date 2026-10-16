import { Server as SocketIOServer } from "socket.io";
import { getChannel } from "./rabbitmq";
import { chatService } from "../services/chat.service";

/**
 * Lắng nghe agent.events từ RabbitMQ:
 * Khi agent phản hồi -> Lưu tin nhắn vào MongoDB và emit Socket.IO `receive_message`
 */
export async function startChatConsumers(io: SocketIOServer) {
    const channel = getChannel();
    if (!channel) {
        console.warn("[chat-service] RabbitMQ channel not available for consumers");
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
            console.log(`[chat-service] Received agent reply event for room: ${data.roomId}`);

            // Lưu reply của agent vào database
            const saved = await chatService.saveMessage({
                roomId: data.roomId,
                senderId: data.agentId || "agent",
                senderType: "agent",
                senderName: data.agentName || "AI Assistant",
                message: data.content || data.reply || "",
                metadata: {
                    model: data.model,
                    usage: data.usage,
                    toolsUsed: data.toolsUsed,
                },
            });

            // Phát tán tin nhắn tới client trong phòng
            io.to(data.roomId).emit("receive_message", saved);

            channel.ack(msg);
        } catch (error) {
            console.error("[chat-service] Error processing agent reply message:", error);
            channel.nack(msg, false, false); // discard faulty message
        }
    });
}
