import { getChannel } from "./rabbitmq";

const CHAT_EXCHANGE = "chat.events";
const AGENT_EXCHANGE = "agent.events";

export async function publishChatMessage(payload: {
    messageId: string;
    roomId: string;
    senderId: string;
    senderName: string;
    senderType: "user" | "agent" | "system";
    message: string;
    targetAgentId?: string;
    createdAt?: Date;
}) {
    const channel = getChannel();
    if (!channel) {
        console.warn("[chat-service] RabbitMQ channel not available to publish message");
        return;
    }

    const routingKey = payload.targetAgentId 
        ? `chat.message.direct.${payload.targetAgentId}`
        : "chat.message.broadcast";

    channel.publish(
        CHAT_EXCHANGE,
        routingKey,
        Buffer.from(JSON.stringify(payload)),
        { persistent: true }
    );
    console.log(`[chat-service] Published event ${routingKey} to ${CHAT_EXCHANGE}`);
}

export async function publishAgentPrompt(payload: {
    agentId: string;
    roomId: string;
    userPrompt: string;
    userName: string;
    userId: string;
}) {
    const channel = getChannel();
    if (!channel) return;

    const routingKey = `agent.prompt.${payload.agentId}`;
    channel.publish(
        AGENT_EXCHANGE,
        routingKey,
        Buffer.from(JSON.stringify(payload)),
        { persistent: true }
    );
    console.log(`[chat-service] Published prompt request to agent ${payload.agentId}`);
}
