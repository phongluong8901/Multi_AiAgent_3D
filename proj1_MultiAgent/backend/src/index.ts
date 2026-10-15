import express from 'express'
import cors from 'cors'
import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { AgentManager } from './agents/AgentManager'

const app = express()
const PORT = 4000

app.use(cors())
app.use(express.json())

const server = http.createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

const agentManager = new AgentManager()
const clients = new Set<WebSocket>()

function broadcast(data: unknown) {
    const msg = JSON.stringify(data)
    for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg)
        }
    }
}

// REST health
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', message: 'Backend đang chạy' })
})

// REST lấy state hiện tại
app.get('/api/state', (_req, res) => {
    res.json(agentManager.getState())
})

// WebSocket
wss.on('connection', (ws) => {
    clients.add(ws)
    console.log('Client connected. Total:', clients.size)

    // Gửi state ngay khi connect
    ws.send(JSON.stringify({
        type: 'state',
        payload: agentManager.getState(),
    }))

    ws.on('close', () => {
        clients.delete(ws)
        console.log('Client disconnected. Total:', clients.size)
    })
})

// Mỗi 4 giây agent tự đổi status → broadcast
setInterval(() => {
    agentManager.tick()
    broadcast({
        type: 'state',
        payload: agentManager.getState(),
    })
    console.log('Broadcast state at', new Date().toLocaleTimeString())
}, 4000)

server.listen(PORT, () => {
    console.log(`Backend chạy tại http://localhost:${PORT}`)
    console.log(`WebSocket tại ws://localhost:${PORT}/ws`)
})