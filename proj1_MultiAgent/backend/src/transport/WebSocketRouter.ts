import { ClientSession } from './ClientSession'
import { AgentRegistry } from '../core/AgentRegistry'

export class WebSocketRouter {
    private registry: AgentRegistry

    constructor(registry: AgentRegistry) {
        this.registry = registry
    }

    public handleMessage(client: ClientSession, rawData: string) {
        try {
            const message = JSON.parse(rawData)
            const { type, payload } = message

            switch (type) {
                case 'SUBSCRIBE_TOPIC':
                    if (payload?.topic) {
                        client.subscriptions.add(payload.topic)
                        client.send('ACK', { message: `Subscribed to ${payload.topic}` })
                    }
                    break

                case 'UNSUBSCRIBE_TOPIC':
                    if (payload?.topic) {
                        client.subscriptions.delete(payload.topic)
                        client.send('ACK', { message: `Unsubscribed from ${payload.topic}` })
                    }
                    break

                case 'AGENT_INTERACTION':
                    // Xử lý khi user click hoặc ra lệnh cho agent từ 3D frontend
                    console.log(`[Action] Client ${client.id} interacted with agent:`, payload)
                    // Ví dụ: Đổi trạng thái agent ngay lập tức khi user bấm vào
                    if (payload.agentId && payload.action) {
                        this.registry.updateAgentStatus(payload.agentId, 'working', `Executing: ${payload.action}`)
                    }
                    break

                default:
                    client.send('ERROR', { message: `Unknown message type: ${type}` })
            }
        } catch (err) {
            client.send('ERROR', { message: 'Invalid JSON format' })
        }
    }
}