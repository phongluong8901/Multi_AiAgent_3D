import { PipelineStep } from '@/components/ui/AssignTaskDialog'

export type MockAgentRef = {
    id: string
    name: string
}

/** Giả lập các bước xử lý task sau khi giao cho Manager */
export function buildMockPipeline(
    taskTitle: string,
    manager: MockAgentRef,
    workers: MockAgentRef[]
): PipelineStep[] {
    const now = () => new Date().toLocaleTimeString()
    const w = workers.length ? workers : [
        { id: 'dev-1', name: 'Dev Agent' },
        { id: 'qa-1', name: 'QA Agent' },
    ]

    return [
        {
            id: 'm1',
            agentId: manager.id,
            agentName: manager.name,
            text: `Nhận task: "${taskTitle}"`,
            status: 'done',
            at: now(),
        },
        {
            id: 'm2',
            agentId: manager.id,
            agentName: manager.name,
            text: `Phân tích & chia việc cho ${w.length} agent`,
            status: 'done',
            at: now(),
        },
        {
            id: 'w1',
            agentId: w[0].id,
            agentName: w[0].name,
            text: `Đang làm: ${taskTitle}`,
            status: 'active',
            at: now(),
        },
        ...(w[1]
            ? [
                {
                    id: 'w2',
                    agentId: w[1].id,
                    agentName: w[1].name,
                    text: 'Chờ review / test sau khi dev xong',
                    status: 'pending' as const,
                    at: now(),
                },
            ]
            : []),
        {
            id: 'm3',
            agentId: manager.id,
            agentName: manager.name,
            text: 'Theo dõi tiến độ team',
            status: 'pending',
            at: now(),
        },
    ]
}

/** Chạy mock theo thời gian: pending → active → done */
export function runMockPipelineAnimation(
    initial: PipelineStep[],
    onUpdate: (steps: PipelineStep[]) => void,
    intervalMs = 1800
): () => void {
    const steps = initial.map((s) => ({ ...s }))
    let i = 0

    // Reset: chỉ bước đầu done, còn lại pending
    for (let k = 0; k < steps.length; k++) {
        if (k === 0) steps[k].status = 'done'
        else if (k === 1) steps[k].status = 'active'
        else steps[k].status = 'pending'
    }
    onUpdate(steps.map((s) => ({ ...s })))

    const timer = setInterval(() => {
        // complete current active
        const activeIdx = steps.findIndex((s) => s.status === 'active')
        if (activeIdx >= 0) {
            steps[activeIdx].status = 'done'
            steps[activeIdx].at = new Date().toLocaleTimeString()
        }

        // next pending → active
        const nextIdx = steps.findIndex((s) => s.status === 'pending')
        if (nextIdx >= 0) {
            steps[nextIdx].status = 'active'
            steps[nextIdx].at = new Date().toLocaleTimeString()
            onUpdate(steps.map((s) => ({ ...s })))
        } else {
            onUpdate(steps.map((s) => ({ ...s })))
            clearInterval(timer)
        }

        i++
        if (i > steps.length + 2) clearInterval(timer)
    }, intervalMs)

    return () => clearInterval(timer)
}