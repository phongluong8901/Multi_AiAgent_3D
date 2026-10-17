// import amqp, { Channel, Connection } from "amqplib";

// let connection: Connection;
// let channel: Channel;

// const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://localhost:5672";
// const QUEUE_NAME = "email_queue";

// export async function connectRabbitMQ() {
//     try {
//         connection = await amqp.connect(RABBITMQ_URL);
//         channel = await connection.createChannel();
//         await channel.assertQueue(QUEUE_NAME, { durable: true });
//         console.log("Connected to RabbitMQ successfully!");
//     } catch (error) {
//         console.error("Failed to connect to RabbitMQ:", error);
//     }
// }

// export async function publishToEmailQueue(data: { email: string; username: string; otp: string; type: string }) {
//     try {
//         if (!channel) {
//             console.error("RabbitMQ channel is not initialized.");
//             return;
//         }
//         channel.sendToQueue(
//             QUEUE_NAME,
//             Buffer.from(JSON.stringify(data)),
//             { persistent: true } // Đảm bảo message không bị mất khi RabbitMQ sập
//         );
//         console.log(`[x] Sent email task to queue for: ${data.email}`);
//     } catch (error) {
//         console.error("Error publishing to RabbitMQ:", error);
//     }
// }