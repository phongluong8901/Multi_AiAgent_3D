import amqplib, { Channel } from "amqplib";

/**
 * RabbitMQ Connection and Channel instances.
 * connection: Lưu trữ kết nối vật lý tới RabbitMQ broker.
 * channel: Kênh giao tiếp logic dùng để publish và consume events.
 */
let connection: any = null;
let channel: Channel | null = null;

/**
 * Khởi tạo kết nối tới RabbitMQ và cấu hình Topic Exchange cho marketplace.
 */
export async function connectRabbitMQ(): Promise<Channel | null> {
    const url = process.env.RABBITMQ_URL || "amqp://admin:admin123@localhost:5672";
    try {
        connection = await amqplib.connect(url);
        if (connection) {
            channel = await connection.createChannel();
            if (channel) {
                await channel.assertExchange("agent.marketplace", "topic", { durable: true });
                console.log("[product-service] Connected to RabbitMQ successfully");
                return channel;
            }
        }
        return null;
    } catch (error) {
        console.warn("[product-service] RabbitMQ connection failed. Running in offline MQ mode:", (error as any).message);
        return null;
    }
}

/**
 * Lấy kênh RabbitMQ hiện hành.
 */
export function getChannel(): Channel | null {
    return channel;
}

/**
 * Phát tán sự kiện (publish event) vào RabbitMQ exchange "agent.marketplace".
 * @param routingKey Routing key cho event (vd: order.created, inventory.updated)
 * @param payload Dữ liệu sự kiện cần gửi đi
 */
export async function publishEvent(routingKey: string, payload: any): Promise<boolean> {
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
