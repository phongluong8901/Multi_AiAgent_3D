import { Agent, AgentStatus, GatewayState } from '../types'

const SPEECHES: Record<AgentStatus, string[]> = {
    idle: [null as any, 'Waiting...', 'Coffee break'],
    working: ['Fixing bug...', 'Writing code', 'Reviewing PR', 'Running tests'],
    meeting: ['In standup', 'Discussing plan', 'Sync with team'],
    blocked: ['Need approval', 'Waiting for API key', 'Blocked by review'],
}

function randomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
}

export class AgentManager {
    private agents: Agent[] = [
        {
            id: 'ben',
            name: 'Ben',
            color: '#4299e1',
            status: 'working',
            speech: 'Fixing login bug...',
            position: [-4.2, 0, -1.2],
        },
        {
            id: 'cory',
            name: 'Cory',
            color: '#48bb78',
            status: 'idle',
            speech: null,
            position: [-1.5, 0, -1.2],
        },
        {
            id: 'allan',
            name: 'Allan',
            color: '#ed8936',
            status: 'meeting',
            speech: 'Standup in 2 min',
            position: [1.2, 0, -1.2],
        },
        {
            id: 'luke',
            name: 'Luke',
            color: '#9f7aea',
            status: 'working',
            speech: 'Reviewing PR #42',
            position: [4.5, 0, 0.2],
        },
    ]

    getState(): GatewayState {
        return {
            agents: this.agents,
            updatedAt: Date.now(),
        }
    }

    /** Giả lập agent tự đổi trạng thái */
    tick() {
        this.agents = this.agents.map((agent) => {
            // 40% cơ hội giữ nguyên
            if (Math.random() < 0.4) return agent

            const statuses: AgentStatus[] = ['idle', 'working', 'meeting', 'blocked']
            const newStatus = randomItem(statuses)
            const speechOptions = SPEECHES[newStatus]
            const speech = randomItem(speechOptions)

            return {
                ...agent,
                status: newStatus,
                speech: speech || null,
            }
        })
    }
}