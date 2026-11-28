import { WebSocket } from 'ws'

export class ClientSession {
    public id: string
    public ws: WebSocket
    public subscriptions: Set<string> = new Set() // Lưu các kênh/topic client đang theo dõi

    constructor(id: string, ws: WebSocket) {
        this.id = id
        this.ws = ws
    }

    public send(type: string, payload: unknown) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type,
                payload,
                timestamp: Date.now()
            }))
        }
    }
}