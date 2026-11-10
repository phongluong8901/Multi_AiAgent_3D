// src/events/producers.ts
import { getChannel } from "./rabbitmq";

// Khai báo hằng số tên Exchange dùng chung
const EXCHANGE = "room.events";

// Hàm bất đồng bộ dùng để phát (publish) sự kiện lên RabbitMQ Exchange
export async function publishRoomEvent(
    // Định nghĩa các routing key hợp lệ được phép truyền vào
    routingKey:
        | "room.created"
        | "room.updated"
        | "room.deleted"
        | "room.member.joined"
        | "room.member.left"
        | "room.agent.assigned"
        | "room.agent.unassigned"
        | "room.agents.synced"
        | "room.agent.added"
        | "room.agent.removed"
        | "room.workflow.updated"
        | "room.invite.created"
        | "room.invite.accepted"
        | "room.invite.declined",
    payload: Record<string, any>
): Promise<void> {
    try {
        // Lấy kênh (channel) giao tiếp hiện tại với RabbitMQ
        const channel = getChannel();
        // Đảm bảo Exchange đã được khai báo với kiểu "topic" và trạng thái "durable"
        await channel.assertExchange(EXCHANGE, "topic", { durable: true });
        // Tiến hành phát message vào RabbitMQ Exchange với routingKey tương ứng
        channel.publish(
            EXCHANGE,                                    // Tên exchange nhận message
            routingKey,                                  // Routing key để phân loại sự kiện (ví dụ: room.created)
            Buffer.from(JSON.stringify(payload)),        // Chuyển đổi payload (object) thành chuỗi JSON rồi đưa vào Buffer
            { contentType: "application/json", persistent: true } // Cấu hình message bền vững (persistent) và định dạng JSON
        );
        // In thông báo ra log
        console.log(`[room-service] Published event: ${routingKey}`, payload);
    } catch (err: any) {
        console.error(`[room-service] Failed to publish event ${routingKey}: ${err.message}`);
    }
}