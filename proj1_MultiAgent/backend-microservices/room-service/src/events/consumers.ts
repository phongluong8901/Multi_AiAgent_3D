import { getChannel } from "./rabbitmq";
import { RoomModel } from "../models/room.model"; // <--- Import model để update db
import { io } from "../index";

export async function startRoomConsumers(): Promise<void> {
    const channel = getChannel();

    // --- 1. CONSUMER CHO AGENT EVENTS (Giữ nguyên logic cũ của bạn) ---
    const AGENT_QUEUE = "room.agent.events";
    const AGENT_EXCHANGE = "agent.events";

    await channel.assertExchange(AGENT_EXCHANGE, "topic", { durable: true });
    await channel.assertQueue(AGENT_QUEUE, { durable: true });
    await channel.bindQueue(AGENT_QUEUE, AGENT_EXCHANGE, "agent.reply");

    channel.consume(AGENT_QUEUE, async (msg) => {
        if (!msg) return;
        try {
            const payload = JSON.parse(msg.content.toString());
            const { agent_id, room_id, answer, status } = payload;

            console.log(`[room-service] Agent ${agent_id} replied in room ${room_id}: ${answer?.slice(0, 50)}...`);

            // --- CẬP NHẬT TRẠNG THÁI AGENT TRONG ROOM MODEL ---
            if (room_id && agent_id) {
                await RoomModel.findOneAndUpdate(
                    { _id: room_id, "members.memberId": agent_id },
                    { $set: { "members.$.status": status || "active" } }
                );
            }

            channel.ack(msg);
        } catch (err: any) {
            console.error("[room-service] Agent Consumer error:", err.message);
            channel.nack(msg, false, false);
        }
    });

    // --- 2. CONSUMER CHO ROOM & INVITE EVENTS (Bổ sung mới để làm realtime lời mời) ---
    const ROOM_QUEUE = "room.hub.events.queue";
    const ROOM_EXCHANGE = "room.events";

    await channel.assertExchange(ROOM_EXCHANGE, "topic", { durable: true });
    await channel.assertQueue(ROOM_QUEUE, { durable: true });

    // Bind lắng nghe toàn bộ các sự kiện bắt đầu bằng "room.invite."
    await channel.bindQueue(ROOM_QUEUE, ROOM_EXCHANGE, "room.invite.#");
    // Bind lắng nghe cả sự kiện thay đổi phòng chung nếu cần
    await channel.bindQueue(ROOM_QUEUE, ROOM_EXCHANGE, "room.updated");

    channel.consume(ROOM_QUEUE, async (msg) => {
        if (!msg) return;
        try {
            const routingKey = msg.fields.routingKey;
            const payload = JSON.parse(msg.content.toString());

            console.log(`[room-service] Received Room Event [${routingKey}]:`, payload);

            // Xử lý khi có lời mời phòng mới được tạo -> Bắn socket realtime đến đúng userId được mời
            if (routingKey === "room.invite.created") {
                const { userId, roomId } = payload;
                if (userId) {
                    console.log(`[Socket.IO] Pushing room_invited event to user: ${userId}`);
                    io.to(userId).emit("room_invited", { roomId });
                }
            }

            // Xử lý khi phòng cập nhật chung
            if (routingKey === "room.updated") {
                const { roomId } = payload;
                if (roomId) {
                    io.to(roomId).emit("room-updated", { roomId });
                }
            }

            channel.ack(msg);
        } catch (err: any) {
            console.error("[room-service] Room Hub Consumer error:", err.message);
            channel.nack(msg, false, false);
        }
    });

    console.log("[room-service] Consumers started successfully: listening to agent and room hub events");
}