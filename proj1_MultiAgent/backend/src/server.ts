import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import http from 'http'
import { AgentRegistry } from './core/AgentRegistry'
import { WebSocketManager } from './transport/WebSocketManager'
import { WorkflowManager } from './workflow/WorkflowManager'
import { createApiRouter } from './routes/api.routes'

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors())
app.use(express.json())

const server = http.createServer(app)

// Khởi tạo Core & Transport
const agentRegistry = new AgentRegistry()
const wsManager = new WebSocketManager(server, agentRegistry)

// Khởi tạo WorkflowManager và liên kết với WebSocket broadcast
const workflowManager = new WorkflowManager(agentRegistry, (type, payload) => {
    wsManager.broadcast(type, payload, 'global-world')
})

// Đăng ký REST API routes
app.use('/api', createApiRouter(agentRegistry, workflowManager))

// Mỗi 4 giây agent tự đổi status -> broadcast cho topic 'global-world'
setInterval(() => {
    agentRegistry.tickAll()
    const state = agentRegistry.getState()
    wsManager.broadcast('state', state, 'global-world')
    wsManager.broadcast('WORLD_STATE', state, 'global-world')
    console.log('Broadcast state at', new Date().toLocaleTimeString())
}, 4000)

server.listen(PORT, () => {
    console.log(`Backend chạy tại http://localhost:${PORT}`)
    console.log(`WebSocket tại ws://localhost:${PORT}/ws`)
})