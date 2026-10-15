import { Server as HttpServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { ClientSession } from './ClientSession'
import { WebSocketRouter } from './WebSocketRouter'
import { AgentRegistry } from '../core/AgentRegistry'
import crypto from 'crypto'

export class WebSocketManager {
    private wss: WebSocketServer
    private clients: Map<string, ClientSession> = new Map()
    private router: WebSocketRouter

    constructor(server: HttpServer, registry: AgentRegistry) {
        this.wss = new WebSocketServer({ server, path: '/ws' })
        this.router = new WebSocketRouter(registry)

        this.wss.on('connection', (ws: WebSocket) => {
            const clientId = crypto.randomUUID()
            const client = new ClientSession(clientId, ws)
            this.clients.set(clientId, client)

            console.log(`[WS] Client connected: ${clientId}. Total: ${this.clients.size}`)

            // Gửi welcome và state mặc định (Mặc định cho vào room 'global-world')
            client.subscriptions.add('global-world')
            client.send('WELCOME', { clientId })
            client.send('WORLD_STATE', registry.getState())

            // Lắng nghe message từ client gửi lên
            ws.on('message', (data: Buffer) => {
                this.router.handleMessage(client, data.toString())
            })

            ws.on('close', () => {
                this.clients.delete(clientId)
                console.log(`[WS] Client disconnected: ${clientId}. Total: ${this.clients.size}`)
            })
        })
    }

    /**
     * Broadcast dữ liệu. 
     * Nếu truyền topic, chỉ gửi cho những client đã subscribe topic đó (chống chung kênh).
     */
    public broadcast(type: string, payload: unknown, topic: string = 'global-world') {
        for (const client of this.clients.values()) {
            if (client.subscriptions.has(topic)) {
                client.send(type, payload)
            }
        }
    }
}