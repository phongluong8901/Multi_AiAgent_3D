import { getChannel } from "./rabbitmq";

/**
 * Lắng nghe agent.events để cập nhật trạng thái agent trong room.
 * Ví dụ: khi agent trả lời xong → cập nhật status của agent trong room.
 */
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
            const { agent_id, room_id, answer } = payload;
            console.log(`[room-service] Agent ${agent_id} replied in room ${room_id}: ${answer?.slice(0, 50)}...`);
            // TODO: có thể cập nhật trạng thái agent trong RoomModel nếu cần
            channel.ack(msg);
        } catch (err: any) {
            console.error("[room-service] Consumer error:", err.message);
            channel.nack(msg, false, false);
        }
    });

    console.log("[room-service] Consumer started: listening to agent.reply events");
}
