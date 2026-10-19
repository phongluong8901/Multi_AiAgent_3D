import amqp from "amqplib";
import { sendEmail } from "../email/user.email";
import dotenv from "dotenv";

dotenv.config();

const QUEUE_NAME = "email_queue";

export const startEmailWorker = async () => {
    try {
        const amqpUrl = process.env.RABBITMQ_URL || "amqp://admin:admin123@localhost:5672";
        const connection = await amqp.connect(amqpUrl);
        const channel = await connection.createChannel();

        await channel.assertQueue(QUEUE_NAME, { durable: true });
        channel.prefetch(1); // Xử lý từng message một

        console.log("[Email Worker] Waiting for messages in queue...");

        channel.consume(QUEUE_NAME, async (msg) => {
            if (msg !== null) {
                try {
                    const data = JSON.parse(msg.content.toString());
                    console.log(`[Email Worker] Processing email for: ${data.email}`);

                    // Thực hiện gửi email thực tế
                    await sendEmail(data.email, data.subject, data.htmlContent);

                    // Xác nhận đã xử lý xong message thành công
                    channel.ack(msg);
                    console.log(`[Email Worker] Email sent successfully to ${data.email}`);
                } catch (error) {
                    console.error("[Email Worker] Error sending email:", error);
                    // Nạp lại vào hàng đợi hoặc từ chối (ở đây từ chối và không requeue nếu lỗi nặng)
                    channel.nack(msg, false, false);
                }
            }
        });
    } catch (error) {
        console.error("[Email Worker] Failed to start worker:", error);
    }
};