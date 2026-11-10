/**
 * Node trong do thi thuc thi quy trinh Multi-Agent (Workflow Trace Node):
 * Dai dien cho mot buoc thuc thi cu the: nhan input, truy xuat tri thuc, goi LLM hoac thuc thi Tool.
 */
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

/**
 * Ban ghi vet hoan chinh cua mot luong hoi thoai / suy luan (Workflow Trace):
 * Theo doi do tre (latency), trang thai va chuoi cac buoc Agent da thuc hien.
 */
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
