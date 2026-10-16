import amqplib, { Channel } from "amqplib";

let connection: any = null;
let channel: Channel | null = null;

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://admin:admin123@localhost:5672";

export async function connectRabbitMQ(retries = 10, delay = 3000): Promise<Channel> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            connection = await amqplib.connect(RABBITMQ_URL);

            // Dùng biến local `ch` để tránh lỗi kiểu dữ liệu và null check của TypeScript
            const ch: Channel = await connection.createChannel();
            channel = ch;

            console.log("[chat-service] RabbitMQ connected successfully");

            connection.on("error", (err: any) => {
                console.error("[chat-service] RabbitMQ connection error:", err.message);
            });

            return ch;
        } catch (err: any) {
            console.log(`[chat-service] RabbitMQ connection attempt ${attempt}/${retries} failed: ${err.message}`);
            if (attempt < retries) {
                await new Promise((r) => setTimeout(r, delay));
            }
        }
    }
    throw new Error("[chat-service] Could not connect to RabbitMQ");
}

export function getChannel(): Channel {
    if (!channel) throw new Error("RabbitMQ channel not initialized");
    return channel;
}