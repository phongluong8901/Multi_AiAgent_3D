import { AgentRegistry } from '../core/AgentRegistry'
import { createOfficeGraph } from './officeGraph'

export class WorkflowManager {
    private registry: AgentRegistry
    private broadcastFn: (type: string, payload: unknown) => void
    private graph: any

    constructor(
        registry: AgentRegistry,
        broadcastFn: (type: string, payload: unknown) => void
    ) {
        this.registry = registry
        this.broadcastFn = broadcastFn

        // Khởi tạo LangGraph và đăng ký callback lắng nghe sự kiện từ từng node
        this.graph = createOfficeGraph((agentId: string, status: string, speech: string) => {
            // 1. Cập nhật state nội bộ của Agent trong Registry
            this.registry.updateAgentStatus(agentId, status as any, speech)

            // 2. Ghi log hoạt động tại Backend
            console.log(`[LangGraph Log] Agent [${agentId}] -> Status: ${status} | Speech: ${speech}`)

            // 3. Broadcast real-time xuống Next.js 3D Frontend ngay lập tức
            const state = this.registry.getState()
            this.broadcastFn('state', state)
            this.broadcastFn('WORLD_STATE', state)
        })
    }

    /**
     * Chạy Task thông qua LangGraph Multi-Agent Workflow
     */
    public async runTask(taskDescription: string) {
        console.log(`\n[WorkflowManager] Starting task: "${taskDescription}"`)

        try {
            await this.graph.invoke({
                task: taskDescription,
                benOutput: '',
                lukeReview: '',
                currentAgent: 'system',
                status: 'running'
            })
            console.log('[WorkflowManager] Completed LangGraph workflow successfully!\n')
        } catch (error) {
            console.error('[WorkflowManager Error]:', error)
        }
    }
}