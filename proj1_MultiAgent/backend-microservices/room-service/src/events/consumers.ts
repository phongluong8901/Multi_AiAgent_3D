import { getChannel } from "./rabbitmq";
import { RoomModel } from "../models/room.model"; // <--- Import model để update db

export async function startRoomConsumers(): Promise<void> {
    const channel = getChannel();
    const QUEUE = "room.agent.events";
    const EXCHANGE = "agent.events";

    await channel.assertExchange(EXCHANGE, "topic", { durable: true });
    await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(QUEUE, EXCHANGE, "agent.reply");

    channel.consume(QUEUE, async (msg) => {
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
            console.error("[room-service] Consumer error:", err.message);
            channel.nack(msg, false, false);
        }
    });

    console.log("[room-service] Consumer started: listening to agent.reply events");
}