import { Agent, AgentStatus } from '../types/agent.types'

const SPEECHES: Record<AgentStatus, string[]> = {
    idle: [null as any, 'Waiting...', 'Coffee break'],
    working: ['Fixing bug...', 'Writing code', 'Reviewing PR', 'Running tests'],
    meeting: ['In standup', 'Discussing plan', 'Sync with team'],
    blocked: ['Need approval', 'Waiting for API key', 'Blocked by review'],
}

function randomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
}

export class SimulatedAgent {
    public data: Agent

    constructor(data: Agent) {
        this.data = data
    }

    public tick() {
        // 40% cơ hội giữ nguyên
        if (Math.random() < 0.4) return

        const statuses: AgentStatus[] = ['idle', 'working', 'meeting', 'blocked']
        const newStatus = randomItem(statuses)
        const speechOptions = SPEECHES[newStatus]
        const speech = randomItem(speechOptions)

        this.data.status = newStatus
        this.data.speech = speech || null
    }
}