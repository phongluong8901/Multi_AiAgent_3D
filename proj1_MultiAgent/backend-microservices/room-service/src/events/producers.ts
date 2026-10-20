import { getChannel } from "./rabbitmq";

const EXCHANGE = "room.events";

export async function publishRoomEvent(
    routingKey: "room.created" | "room.updated" | "room.deleted" | "room.member.joined" | "room.member.left" | "room.agent.assigned" | "room.agent.unassigned",
    payload: Record<string, any>
): Promise<void> {
    try {
        const channel = getChannel();
        await channel.assertExchange(EXCHANGE, "topic", { durable: true });
        channel.publish(
            EXCHANGE,
            routingKey,
            Buffer.from(JSON.stringify(payload)),
            { contentType: "application/json", persistent: true }
        );
        console.log(`[room-service] Published event: ${routingKey}`, payload);
    } catch (err: any) {
        console.error(`[room-service] Failed to publish event ${routingKey}: ${err.message}`);
    }
}
