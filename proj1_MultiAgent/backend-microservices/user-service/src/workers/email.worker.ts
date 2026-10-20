import amqp from "amqplib";
import { sendEmail } from "../email/user.email";
import dotenv from "dotenv";

dotenv.config();

// Khai báo hằng số tên hàng đợi cần lắng nghe sự kiện gửi email
const QUEUE_NAME = "email_queue";

// Định nghĩa và export hàm bất đồng bộ startEmailWorker để khởi chạy worker xử lý email nền
export const startEmailWorker = async () => {
    try {
        const amqpUrl = process.env.RABBITMQ_URL || "amqp://admin:admin123@localhost:5672";

        const connection = await amqp.connect(amqpUrl); // Thiết lập kết nối mạng đến RabbitMQ broker
        const channel = await connection.createChannel(); // Tạo kênh giao tiếp (channel) từ kết nối

        // Khai báo hàng đợi (đảm bảo hàng đợi tồn tại với thuộc tính bền vững durable: true)
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        channel.prefetch(1); // Giới hạn worker chỉ xử lý 1 message tại một thời điểm trước khi nhận xác nhận (fair dispatch)

        console.log("[Email Worker] Waiting for messages in queue...");

        // Đăng ký hàm tiêu thụ (consume) tin nhắn từ hàng đợi email_queue
        channel.consume(QUEUE_NAME, async (msg) => {
            if (msg !== null) {
                try {
                    // Chuyển đổi dữ liệu tin nhắn từ dạng Buffer sang chuỗi rồi parse thành đối tượng JSON chứa thông tin email
                    const data = JSON.parse(msg.content.toString());
                    console.log(`[Email Worker] Processing email for: ${data.email}`);

                    // Thực hiện gọi hàm gửi email thực tế đến địa chỉ người nhận
                    await sendEmail(data.email, data.subject, data.htmlContent);

                    // Gửi tín hiệu xác nhận (ACK) rằng message đã được xử lý thành công để RabbitMQ xóa nó khỏi hàng đợi
                    channel.ack(msg);
                    console.log(`[Email Worker] Email sent successfully to ${data.email}`);
                } catch (error) {
                    console.error("[Email Worker] Error sending email:", error);
                    // Gửi tín hiệu từ chối (NACK) và đặt tham số requeue = false để không đẩy lại tin nhắn bị lỗi vào hàng đợi (tránh lặp vô hạn)
                    channel.nack(msg, false, false);
                }
            }
        });
    } catch (error) {
        console.error("[Email Worker] Failed to start worker:", error);
    }
};