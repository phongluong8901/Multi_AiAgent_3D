import { request } from './client'

export type RoomMember = {
    memberId: string
    memberType: 'user' | 'agent'
    role: 'owner' | 'participant' | 'observer'
    name?: string
    color?: string
    avatar?: string
    status?: string
    joinedAt?: string
}

export type RoomSettings = {
    allowCrossCommands: boolean
    autonomousHandoff: boolean
    maxAutoTurns: number
}

export type UserAgentBinding = {
    userId: string
    userName: string
    userColor?: string
    agentId: string
    agentName?: string
    assignedAt?: string
}

export type Room = {
    _id?: string
    id?: string
    name: string
    description?: string
    maxCapacity: number
    activeAgents: string[]
    userAgents?: UserAgentBinding[]
    settings: RoomSettings
    members: RoomMember[]
    createdAt?: string
    updatedAt?: string
}

export const roomsApi = {
    list: async (): Promise<Room[]> => {
        const res = await request<{ success: boolean; data: Room[] }>('/rooms')
        return res?.data ?? []
    },

    get: async (id: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(`/rooms/${id}`)
        return res.data
    },

    create: async (data: {
        name: string
        description?: string
        maxCapacity?: number
        activeAgents?: string[]
        settings?: Partial<RoomSettings>
    }): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>('/rooms', {
            method: 'POST',
            body: JSON.stringify(data),
        })
        return res.data
    },

    update: async (id: string, data: Partial<Room>): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(`/rooms/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        })
        return res.data
    },

    addMember: async (roomId: string, member: Partial<RoomMember>): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `/rooms/${roomId}/members`,
            { method: 'POST', body: JSON.stringify(member) }
        )
        return res.data
    },

    removeMember: async (roomId: string, memberId: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `/rooms/${roomId}/members/${memberId}`,
            { method: 'DELETE' }
        )
        return res.data
    },

    syncAgents: async (roomId: string, activeAgents: string[]): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `/rooms/${roomId}/agents`,
            { method: 'POST', body: JSON.stringify({ activeAgents }) }
        )
        return res.data
    },

    addAgent: async (roomId: string, agentId: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `/rooms/${roomId}/agents/${agentId}`,
            { method: 'POST' }
        )
        return res.data
    },

    removeAgent: async (roomId: string, agentId: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `/rooms/${roomId}/agents/${agentId}`,
            { method: 'DELETE' }
        )
        return res.data
    },

    assignUserAgent: async (
        roomId: string,
        data: {
            userId: string
            userName: string
            userColor?: string
            agentId: string
            agentName?: string
        }
    ): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `/rooms/${roomId}/user-agents`,
            { method: 'POST', body: JSON.stringify(data) }
        )
        return res.data
    },

    removeUserAgent: async (roomId: string, agentId: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `/rooms/${roomId}/user-agents/${agentId}`,
            { method: 'DELETE' }
        )
        return res.data
    },
}