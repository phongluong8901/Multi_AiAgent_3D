import { getChannel } from "./rabbitmq";           // Import hàm lấy channel RabbitMQ đã kết nối
import { RoomModel } from "../models/room.model"; // Import Mongoose model để tương tác/cập nhật MongoDB
import { getIO } from "../config/socket";         // Import hàm lấy Socket.IO instance để push realtime xuống client

// Hàm khởi tạo và chạy các RabbitMQ Consumers lắng nghe sự kiện
export async function startRoomConsumers(): Promise<void> {
    const channel = getChannel(); // Lấy kênh giao tiếp RabbitMQ

    // ==========================================
    // --- 1. CONSUMER CHO AGENT EVENTS (Lắng nghe phản hồi từ AI Agent) ---
    // ==========================================
    const AGENT_QUEUE = "room.agent.events";
    const AGENT_EXCHANGE = "agent.events";

    // Khai báo exchange và queue, sau đó bind binding key "agent.reply"
    await channel.assertExchange(AGENT_EXCHANGE, "topic", { durable: true });
    await channel.assertQueue(AGENT_QUEUE, { durable: true });
    await channel.bindQueue(AGENT_QUEUE, AGENT_EXCHANGE, "agent.reply");

    // Lắng nghe message đến từ queue của agent
    channel.consume(AGENT_QUEUE, async (msg) => {
        if (!msg) return; // Nếu message rỗng thì bỏ qua
        try {
            const payload = JSON.parse(msg.content.toString()); // Chuyển đổi nội dung message từ Buffer sang Object JSON
            const { agent_id, room_id, answer, status } = payload; // Trích xuất thông tin payload

            console.log(`[room-service] Agent ${agent_id} replied in room ${room_id}: ${answer?.slice(0, 50)}...`);

            // --- CẬP NHẬT TRẠNG THÁI AGENT TRONG ROOM MODEL (DATABASE) ---
            if (room_id && agent_id) {
                await RoomModel.findOneAndUpdate(
                    { _id: room_id, "members.memberId": agent_id }, // Tìm phòng và đúng thành viên agent đó
                    { $set: { "members.$.status": status || "active" } } // Cập nhật trạng thái status của agent trong mảng members
                );
            }

            channel.ack(msg); // Xác nhận đã xử lý thành công message (để RabbitMQ xóa khỏi queue)
        } catch (err: any) {
            console.error("[room-service] Agent Consumer error:", err.message);
            channel.nack(msg, false, false); // Báo lỗi và từ chối message, không requeue lại nếu xử lý hỏng
        }
    });

    // ==========================================
    // --- 2. CONSUMER CHO ROOM & INVITE EVENTS (Lắng nghe sự kiện phòng & lời mời để làm Realtime) ---
    // ==========================================
    const ROOM_QUEUE = "room.hub.events.queue";
    const ROOM_EXCHANGE = "room.events";

    // Khai báo exchange và queue dành cho các sự kiện room
    await channel.assertExchange(ROOM_EXCHANGE, "topic", { durable: true });
    await channel.assertQueue(ROOM_QUEUE, { durable: true });

    // Bind queue lắng nghe toàn bộ các routing key bắt đầu bằng tiền tố "room.#" (wildcard topic)
    await channel.bindQueue(ROOM_QUEUE, ROOM_EXCHANGE, "room.#");

    // Lắng nghe message từ queue room hub
    channel.consume(ROOM_QUEUE, async (msg) => {
        if (!msg) return; // Bỏ qua nếu không có message
        try {
            const routingKey = msg.fields.routingKey; // Lấy routing key để biết sự kiện cụ thể là gì (ví dụ: room.invite.created)
            const payload = JSON.parse(msg.content.toString()); // Chuyển đổi message thành JSON object

            console.log(`[room-service] Received Room Event [${routingKey}]:`, payload);

            // Xử lý khi có lời mời phòng mới được tạo -> Bắn socket realtime đến đúng cá nhân `userId` được mời
            if (routingKey === "room.invite.created") {
                const { userId, roomId } = payload;
                if (userId) {
                    console.log(`[Socket.IO] Pushing room_invited event to user: ${userId}`);
                    getIO().to(userId).emit("room_invited", { roomId }); // Gửi event socket vào phòng cá nhân của user
                }
            }

            // Xử lý khi phòng cập nhật chung (thành viên vào/ra, gán/hủy agent, thông tin phòng thay đổi)
            if (
                routingKey === "room.updated" ||
                routingKey.startsWith("room.member.") ||
                routingKey.startsWith("room.agent.")
            ) {
                const { roomId } = payload;
                if (roomId) {
                    console.log(`[Socket.IO] Pushing room-updated event [${routingKey}] to room: ${roomId}`);
                    getIO().to(roomId).emit("room-updated", { roomId, routingKey }); // Broadcast sự kiện xuống toàn bộ client trong phòng
                }
            }

            channel.ack(msg); // Xác nhận xử lý message thành công
        } catch (err: any) {
            console.error("[room-service] Room Hub Consumer error:", err.message);
            channel.nack(msg, false, false); // Từ chối message nếu xảy ra ngoại lệ
        }
    });

    console.log("[room-service] Consumers started successfully: listening to agent and room hub events");
}