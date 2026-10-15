import { Router } from 'express'
import { AgentRegistry } from '../core/AgentRegistry'

export function createApiRouter(registry: AgentRegistry) {
    const router = Router()

    router.get('/health', (_req, res) => {
        res.json({ status: 'ok', message: 'Backend đang chạy' })
    })

    router.get('/state', (_req, res) => {
        res.json(registry.getState())
    })

    // Webhook mẫu để update agent từ bên ngoài
    router.post('/agents/:id/status', (req, res) => {
        const { id } = req.params
        const { status, speech } = req.body
        registry.updateAgentStatus(id, status, speech)
        res.json({ success: true })
    })

    return router
}