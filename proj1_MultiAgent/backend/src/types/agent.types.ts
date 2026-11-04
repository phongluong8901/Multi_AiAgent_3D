export type AgentStatus = 'idle' | 'working' | 'meeting' | 'blocked'

export type Agent = {
    id: string
    name: string
    color: string
    status: AgentStatus
    speech: string | null
    position: [number, number, number]
}

export type GatewayState = {
    agents: Agent[]
    updatedAt: number
}