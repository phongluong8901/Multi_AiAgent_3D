import amqplib, { Channel, Connection } from "amqplib";

let connection: Connection | null = null;
let channel: Channel | null = null;

export async function connectRabbitMQ() {
    const url = process.env.RABBITMQ_URL || "amqp://admin:admin123@localhost:5672";
    try {
        connection = await amqplib.connect(url);
        channel = await connection.createChannel();
        await channel.assertExchange("agent.marketplace", "topic", { durable: true });
        console.log("[product-service] Connected to RabbitMQ successfully");
    } catch (error) {
        console.warn("[product-service] RabbitMQ connection failed. Running in offline MQ mode:", (error as any).message);
    }
}

export function getChannel(): Channel | null {
    return channel;
}

export async function publishEvent(routingKey: string, payload: any) {
    if (!channel) return false;
    try {
        channel.publish(
            "agent.marketplace",
            routingKey,
            Buffer.from(JSON.stringify(payload)),
            { persistent: true }
        );
        return true;
    } catch (e) {
        console.error("[product-service] Publish event failed:", e);
        return false;
    }
}
