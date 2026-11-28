import amqplib, { Channel } from "amqplib";

let connection: any = null;
let channel: Channel | null = null;

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://admin:admin123@localhost:5672";

export async function connectRabbitMQ(retries = 10, delay = 3000): Promise<Channel> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            connection = await amqplib.connect(RABBITMQ_URL);

            // Tạo channel và gán vào biến local `ch` có kiểu chắc chắn là Channel
            const ch: Channel = await connection.createChannel();
            channel = ch; // Lưu vào biến toàn cục để dùng qua getChannel()

            console.log("[room-service] RabbitMQ connected successfully");

            connection.on("error", (err: any) => {
                console.error("[room-service] RabbitMQ connection error:", err.message);
            });

            return ch;
        } catch (err: any) {
            console.log(`[room-service] RabbitMQ connection attempt ${attempt}/${retries} failed: ${err.message}`);
            if (attempt < retries) {
                await new Promise((r) => setTimeout(r, delay));
            }
        }
    }
    throw new Error("[room-service] Could not connect to RabbitMQ");
}

export function getChannel(): Channel {
    if (!channel) throw new Error("RabbitMQ channel not initialized");
    return channel;
}