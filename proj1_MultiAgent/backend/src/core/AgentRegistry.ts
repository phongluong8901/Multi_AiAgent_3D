import { SimulatedAgent } from '../agents/SimulatedAgent'
import { GatewayState, AgentStatus } from '../types/agent.types'

export class AgentRegistry {
    private agents: Map<string, SimulatedAgent> = new Map()

    constructor() {
        const initialAgents = [
            { id: 'ben', name: 'Ben', color: '#4299e1', status: 'working' as AgentStatus, speech: 'Fixing login bug...', position: [-4.2, 0, -1.2] as [number, number, number] },
            { id: 'cory', name: 'Cory', color: '#48bb78', status: 'idle' as AgentStatus, speech: null, position: [-1.5, 0, -1.2] as [number, number, number] },
            { id: 'allan', name: 'Allan', color: '#ed8936', status: 'meeting' as AgentStatus, speech: 'Standup in 2 min', position: [1.2, 0, -1.2] as [number, number, number] },
            { id: 'luke', name: 'Luke', color: '#9f7aea', status: 'working' as AgentStatus, speech: 'Reviewing PR #42', position: [4.5, 0, 0.2] as [number, number, number] },
        ]

        for (const a of initialAgents) {
            this.agents.set(a.id, new SimulatedAgent(a))
        }
    }

    public getAgent(id: string): SimulatedAgent | undefined {
        return this.agents.get(id)
    }

    public tickAll() {
        for (const agent of this.agents.values()) {
            agent.tick()
        }
    }

    public getState(): GatewayState {
        return {
            agents: Array.from(this.agents.values()).map(a => a.data),
            updatedAt: Date.now(),
        }
    }

    public updateAgentStatus(id: string, status: AgentStatus, speech?: string | null): boolean {
        const agent = this.agents.get(id)
        if (agent) {
            agent.data.status = status
            if (speech !== undefined) {
                agent.data.speech = speech
            }
            return true
        }
        return false
    }
}