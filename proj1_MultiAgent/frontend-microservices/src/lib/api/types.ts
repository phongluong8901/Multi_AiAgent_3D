export type WorkflowTraceNode = {
    id: string
    name: string
    type: 'input' | 'retriever' | 'llm' | 'tool' | 'output' | 'error'
    status: 'completed' | 'running' | 'error' | 'pending'
    inputs?: any
    outputs?: any
    error?: string
    stackTrace?: string
    latencyMs?: number
    tool_calls?: any[]
}

export type WorkflowTrace = {
    traceId: string
    agentId: string
    agentName: string
    roomId?: string
    userMessage: string
    status: 'completed' | 'running' | 'error'
    startTime: string
    totalLatencyMs: number
    error?: string | null
    errorNode?: string | null
    nodes: WorkflowTraceNode[]
}