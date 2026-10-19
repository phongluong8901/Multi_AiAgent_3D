import amqp from "amqplib";

let connection: any = null;
let channel: any = null;

const QUEUE_NAME = "email_queue";

export const connectRabbitMQ = async () => {
    try {
        const amqpUrl = process.env.RABBITMQ_URL || "amqp://admin:admin123@localhost:5672";
        connection = await amqp.connect(amqpUrl);
        channel = await connection.createChannel();

        // Khai báo hàng đợi (nếu chưa có thì tự động tạo)
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        console.log("[RabbitMQ] Connected and queue asserted successfully.");
    } catch (error) {
        console.error("[RabbitMQ] Connection failed:", error);
    }
};

/** Gửi message (sự kiện) vào hàng đợi */
export const sendToQueue = async (data: object) => {
    try {
        if (!channel) {
            console.error("[RabbitMQ] Channel is not initialized.");
            return;
        }
        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(data)), {
            persistent: true, // Đảm bảo message không bị mất khi RabbitMQ restart
        });
    } catch (error) {
        console.error("[RabbitMQ] Failed to send message to queue:", error);
    }
};

export { channel };