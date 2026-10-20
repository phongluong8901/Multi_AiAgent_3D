import { Router } from 'express'
import { AgentRegistry } from '../core/AgentRegistry'
import { WorkflowManager } from '../workflow/WorkflowManager'

export function createApiRouter(registry: AgentRegistry, workflowManager?: WorkflowManager) {
    const router = Router()

    router.get('/health', (_req, res) => {
        res.json({ status: 'ok', message: 'Backend & LangGraph đang chạy' })
    })

    router.get('/state', (_req, res) => {
        res.json(registry.getState())
    })

    // Webhook cập nhật trạng thái agent thủ công
    router.post('/agents/:id/status', (req, res) => {
        const { id } = req.params
        const { status, speech } = req.body

        const updated = registry.updateAgentStatus(id, status, speech)
        if (!updated) {
            return res.status(404).json({ error: 'Agent not found' })
        }

        res.json({ success: true })
    })

    // Cho phép GET /workflow/start để test nhanh trên trình duyệt URL
    router.get('/workflow/start', async (req, res) => {
        const task = (req.query.task as string) || 'Viết tính năng đăng nhập cơ bản bằng Next.js'
        if (!workflowManager) {
            return res.status(500).json({ error: 'WorkflowManager chưa được khởi tạo!' })
        }

        res.json({
            success: true,
            message: 'Đã tiếp nhận task (GET test) và khởi chạy LangGraph',
            task,
        })

        // Thực thi workflow bất đồng bộ
        workflowManager.runTask(task).catch((err) => {
            console.error('[Workflow Error]:', err)
        })
    })

    // Kích hoạt LangGraph Workflow từ TaskPanel / UI (POST)
    router.post('/workflow/start', async (req, res) => {
        const { task } = req.body || {}
        const taskText = task || 'Viết tính năng đăng nhập cơ bản'

        if (!workflowManager) {
            return res.status(500).json({ error: 'WorkflowManager chưa được khởi tạo!' })
        }

        // Phản hồi HTTP ngay để giao diện không bị treo
        res.json({
            success: true,
            message: 'Đã tiếp nhận task và khởi chạy LangGraph',
            task: taskText,
        })

        // Thực thi workflow bất đồng bộ
        workflowManager.runTask(taskText).catch((err) => {
            console.error('[Workflow Error]:', err)
        })
    })

    return router
}