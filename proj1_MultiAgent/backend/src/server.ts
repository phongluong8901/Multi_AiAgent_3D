import express from 'express'
import cors from 'cors'
import http from 'http'
import { AgentRegistry } from './core/AgentRegistry'
import { WebSocketManager } from './transport/WebSocketManager'
import { createApiRouter } from './routes/api.routes'

const app = express()
const PORT = 4000

app.use(cors())
app.use(express.json())

const server = http.createServer(app)

// Khởi tạo Core & Transport
const agentRegistry = new AgentRegistry()
const wsManager = new WebSocketManager(server, agentRegistry)

// Đăng ký REST API routes
app.use('/api', createApiRouter(agentRegistry))

// Mỗi 4 giây agent tự đổi status -> broadcast riêng cho topic 'global-world'
setInterval(() => {
    agentRegistry.tickAll()
    wsManager.broadcast('WORLD_STATE', agentRegistry.getState(), 'global-world')
    console.log('Broadcast state at', new Date().toLocaleTimeString())
}, 4000)

server.listen(PORT, () => {
    console.log(`Backend chạy tại http://localhost:${PORT}`)
    console.log(`WebSocket tại ws://localhost:${PORT}/ws`)
})