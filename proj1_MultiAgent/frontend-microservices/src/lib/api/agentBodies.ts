import { request } from '../client'
import { AgentBodyDesign } from '../agentBody/agentBodyTypes'

export interface CloudAgentBody extends AgentBodyDesign {
    bodyId: string
    userId?: string
    userName?: string
    isPublic?: boolean
    tags?: string[]
    createdAt?: string
    updatedAt: string
}

export interface TrainingSpec {
    bodyId: string
    name: string
    spawnHeight: number
    linkCount: number
    jointCount: number
    dof: number
    actionDim: number
    observationDim: number
    totalMass: number
    urdfPath: string
    actuatedJoints: { name: string; type: string; lower: number; upper: number; effort: number; velocity: number }[]
}

type SaveBodyPayload = AgentBodyDesign & { userId?: string; userName?: string; isPublic?: boolean; tags?: string[] }

export const agentBodiesApi = {
    saveBody: (payload: SaveBodyPayload) =>
        request<{ success: boolean; message: string; data: CloudAgentBody }>('/agent-bodies', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    getBodies: (params?: { userId?: string; search?: string; category?: string }) => {
        const q = new URLSearchParams()
        if (params?.userId) q.set('userId', params.userId)
        if (params?.search) q.set('search', params.search)
        if (params?.category) q.set('category', params.category)
        const qs = q.toString() ? `?${q.toString()}` : ''
        return request<{ success: boolean; count: number; data: CloudAgentBody[] }>(`/agent-bodies${qs}`)
    },

    getBodyById: (bodyId: string) =>
        request<{ success: boolean; data: CloudAgentBody }>(`/agent-bodies/${bodyId}`),

    getTrainingSpec: (bodyId: string) =>
        request<{ success: boolean; data: TrainingSpec }>(`/agent-bodies/${bodyId}/training-spec`),

    deleteBody: (bodyId: string) =>
        request<{ success: boolean; message: string }>(`/agent-bodies/${bodyId}`, { method: 'DELETE' }),

    cloneBody: (bodyId: string, payload?: { newName?: string; userId?: string; userName?: string }) =>
        request<{ success: boolean; message: string; data: CloudAgentBody }>(`/agent-bodies/${bodyId}/clone`, {
            method: 'POST',
            body: JSON.stringify(payload || {}),
        }),
}

