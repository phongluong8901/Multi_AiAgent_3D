import { Server as SocketIOServer } from "socket.io";
import { getChannel, onRabbitMQReady, AGENT_EXCHANGE } from "./rabbitmq";
import { agentDispatcher, ChatType } from "../services/agent.dispatcher";

/**
 * Lắng nghe agent.events từ RabbitMQ:
 * Khi agent phản hồi -> chuyển giao cho AgentDispatcher xử lý chuẩn hóa (lưu DB, Socket.IO, workflow handoff).
 */
export async function startChatConsumers(io: SocketIOServer) {
    agentDispatcher.setIO(io);

    // Đăng ký consumer lại tự động mỗi khi RabbitMQ connect hoặc reconnect
    onRabbitMQReady(async (channel) => {
        const queueName = "chat_agent_reply_queue";
        await channel.assertExchange(AGENT_EXCHANGE, "topic", { durable: true });
        await channel.assertQueue(queueName, { durable: true });
        await channel.bindQueue(queueName, AGENT_EXCHANGE, "agent.reply.#");

        // Lắng nghe sự kiện thay đổi agent trong room từ room-service (room.agent.added, removed, synced)
        const roomEventsQueue = "chat_room_agent_events_queue";
        await channel.assertExchange("room.events", "topic", { durable: true });
        await channel.assertQueue(roomEventsQueue, { durable: true });
        await channel.bindQueue(roomEventsQueue, "room.events", "room.agent.#");
        await channel.bindQueue(roomEventsQueue, "room.events", "room.agents.#");
        await channel.bindQueue(roomEventsQueue, "room.events", "room.workflow.#");
        await channel.bindQueue(roomEventsQueue, "room.events", "room.updated");

        console.log(`[chat-service] Registered consumers on queues: ${queueName}, ${roomEventsQueue}`);

        // Xử lý sự kiện đồng bộ agent & workflow trong phòng
        channel.consume(roomEventsQueue, async (msg) => {
            if (!msg) return;
            try {
                const data = JSON.parse(msg.content.toString());
                const roomId = data.roomId || data.room_id;
                const activeAgents = data.activeAgents;
                const workflow = data.workflow;

                if (roomId) {
                    if (Array.isArray(activeAgents)) {
                        agentDispatcher.updateRoomAgentsCache(roomId, activeAgents);
                        io.to(roomId).emit("room_agents_updated", { roomId, activeAgents });
                        console.log(`[chat-service MQ] Synced active agents for room ${roomId}:`, activeAgents);
                    }
                    if (workflow !== undefined) {
                        agentDispatcher.updateRoomWorkflowCache(roomId, workflow, activeAgents);
                        io.to(roomId).emit("room_workflow_updated", { roomId, workflow });
                        console.log(`[chat-service MQ] Synced workflow for room ${roomId}:`, workflow);
                    }
                }
                channel.ack(msg);
            } catch (err) {
                console.error("[chat-service MQ] Error in roomEventsQueue:", err);
                channel.ack(msg);
            }
        });

        channel.consume(queueName, async (msg) => {
            if (!msg) return;

            try {
                const data = JSON.parse(msg.content.toString());
                const roomId = data.roomId || data.room_id;
                const agentId = data.agentId || data.agent_id || "agent";

                // Nếu reply này xuất phát từ direct HTTP call thì bỏ qua để tránh duplicate tin nhắn trong phòng
                if (data.source === "http") {
                    channel.ack(msg);
                    return;
                }

                if (!roomId) {
                    console.warn("[chat-service MQ] Received agent reply without roomId, skipping save.");
                    channel.ack(msg);
                    return;
                }

                const answer = data.content || data.reply || data.answer || "";
                const usedTools = data.toolsUsed || data.used_tools || [];
                const trace = data.workflow_trace || data.trace || data.workflowTrace;
                const ctx = data.context || {};
                const depth = typeof data.depth === "number" ? data.depth : (ctx.depth || 0);
                const typeChat: ChatType = ctx.typeChat || (depth > 0 ? "workflow" : "agent");
                const rootTypeChat: ChatType = ctx.rootTypeChat || typeChat;

                const initiatorAgentId = ctx.initiatorAgentId;
                const userGoal = ctx.userGoal;
                const visitedAgents = Array.isArray(ctx.visitedAgents) ? ctx.visitedAgents : [];

                console.log(`[chat-service MQ] Received reply for agent '${agentId}' in room '${roomId}' (depth ${depth})`);

                await agentDispatcher.handleAgentReply({
                    agentId,
                    agentName: data.agentName || data.agent_name,
                    roomId,
                    answer,
                    usedTools,
                    trace,
                    depth,
                    typeChat,
                    rootTypeChat,
                    senderId: ctx.senderId,
                    model: data.model,
                    usage: data.usage,
                    initiatorAgentId,
                    userGoal,
                    visitedAgents,
                });

                channel.ack(msg);
            } catch (error) {
                console.error("[chat-service MQ] Error processing agent reply message:", error);
                channel.nack(msg, false, false);
            }
        });
    });

    const activeChannel = getChannel();
    if (!activeChannel) {
        console.warn("[chat-service] RabbitMQ channel not yet connected. Will bind consumers as soon as connection is established.");
    }
}