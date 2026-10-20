import amqplib, { Channel } from "amqplib";

let connection: any = null;
let channel: Channel | null = null;

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://admin:admin123@localhost:5672";

export async function connectRabbitMQ(retries = 10, delay = 3000): Promise<Channel | null> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            connection = await amqplib.connect(RABBITMQ_URL);

            const ch: Channel = await connection.createChannel();
            channel = ch;

            console.log("[chat-service] RabbitMQ connected successfully");

            // Auto-reconnect when connection drops
            connection.on("error", (err: any) => {
                console.error("[chat-service] RabbitMQ connection error:", err.message);
                channel = null;
            });
            connection.on("close", () => {
                console.warn("[chat-service] RabbitMQ connection closed, will retry on next publish.");
                channel = null;
                // Attempt silent reconnect after 5s
                setTimeout(() => connectRabbitMQ(3, 2000).catch(() => {}), 5000);
            });

            ch.on("error", (err: any) => {
                console.error("[chat-service] RabbitMQ channel error:", err.message);
                channel = null;
            });
            ch.on("close", () => {
                console.warn("[chat-service] RabbitMQ channel closed.");
                channel = null;
            });

            return ch;
        } catch (err: any) {
            console.log(`[chat-service] RabbitMQ connection attempt ${attempt}/${retries} failed: ${err.message}`);
            if (attempt < retries) {
                await new Promise((r) => setTimeout(r, delay));
            }
        }
    }
    console.warn("[chat-service] Could not connect to RabbitMQ. Running without message queue.");
    return null;
}

/** Returns the active channel, or null if unavailable (caller should handle gracefully) */
export function getChannel(): Channel | null {
    return channel;
}