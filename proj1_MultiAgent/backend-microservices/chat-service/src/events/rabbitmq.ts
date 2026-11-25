import amqplib, { Channel } from "amqplib";

let connection: any = null;
let channel: Channel | null = null;
let reconnecting = false;

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://admin:admin123@localhost:5672";

// Các exchange mà chat-service publish/consume. BẮT BUỘC assert trước khi dùng,
// nếu publish vào exchange chưa tồn tại RabbitMQ sẽ đóng channel (404 NOT_FOUND).
export const CHAT_EXCHANGE = "chat.events";
export const AGENT_EXCHANGE = "agent.events";
export const AGENT_PROMPT_QUEUE = "agent_prompt_queue"; // Queue mà agent-service (FastAPI) consume

// Callback được gọi mỗi khi kết nối (hoặc kết nối lại) thành công -> dùng để đăng ký lại consumers
type ReadyHandler = (ch: Channel) => Promise<void> | void;
const readyHandlers: ReadyHandler[] = [];

export function onRabbitMQReady(handler: ReadyHandler) {
    readyHandlers.push(handler);
    // Nếu đã kết nối sẵn thì chạy ngay
    if (channel) {
        Promise.resolve(handler(channel)).catch((err) =>
            console.error("[chat-service] RabbitMQ ready handler error:", err?.message || err)
        );
    }
}

function scheduleReconnect() {
    if (reconnecting) return;
    reconnecting = true;
    setTimeout(async () => {
        const ch = await connectRabbitMQ(3, 2000).catch(() => null);
        reconnecting = false;
        if (!ch) scheduleReconnect(); // Tiếp tục thử lại cho tới khi broker sống lại
    }, 5000);
}

export async function connectRabbitMQ(retries = 10, delay = 3000): Promise<Channel | null> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            connection = await amqplib.connect(RABBITMQ_URL);

            const ch: Channel = await connection.createChannel();
            await ch.assertExchange(CHAT_EXCHANGE, "topic", { durable: true });
            await ch.assertExchange(AGENT_EXCHANGE, "topic", { durable: true });
            // Khai báo sẵn queue của agent-service (cùng tham số với bên Python) để prompt không bị
            // drop (unroutable) nếu agent-service khởi động chậm hơn chat-service.
            await ch.assertQueue(AGENT_PROMPT_QUEUE, { durable: true });
            await ch.bindQueue(AGENT_PROMPT_QUEUE, AGENT_EXCHANGE, "agent.prompt.#");
            channel = ch;

            console.log("[chat-service] RabbitMQ connected successfully");

            // Auto-reconnect when connection drops
            connection.on("error", (err: any) => {
                console.error("[chat-service] RabbitMQ connection error:", err.message);
                channel = null;
            });
            connection.on("close", () => {
                console.warn("[chat-service] RabbitMQ connection closed, reconnecting...");
                channel = null;
                scheduleReconnect();
            });

            ch.on("error", (err: any) => {
                console.error("[chat-service] RabbitMQ channel error:", err.message);
                channel = null;
            });
            ch.on("close", () => {
                console.warn("[chat-service] RabbitMQ channel closed.");
                channel = null;
            });

            for (const handler of readyHandlers) {
                try {
                    await handler(ch);
                } catch (err: any) {
                    console.error("[chat-service] RabbitMQ ready handler error:", err?.message || err);
                }
            }

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