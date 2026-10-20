import { request } from '../client'

export type RoomMember = {
    memberId: string
    memberType: 'user' | 'agent'
    role: 'owner' | 'admin' | 'participant' | 'observer'
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
    allowGuestJoin?: boolean
}

export type UserAgentBinding = {
    userId: string
    userName: string
    userColor?: string
    agentId: string
    agentName?: string
    assignedAt?: string
}

export type RoomPolicy = {
    tier?: 'standard' | 'premium' | 'enterprise'
    isPublic?: boolean
    maxActiveAgents?: number
    ownedAgentsCount?: number
}

export type Room = {
    _id?: string
    id?: string
    name: string
    description?: string
    ownerId: string
    maxCapacity: number
    policy?: RoomPolicy
    activeAgents: string[]
    userAgents?: UserAgentBinding[]
    settings: RoomSettings
    members: RoomMember[]
    createdAt?: string
    updatedAt?: string
}

export const roomsApi = {
    // 1. User-User Track Routes (Tạo, Lấy danh sách, Cập nhật phòng & Quản lý thành viên)
    list: async (): Promise<Room[]> => {
        const res = await request<{ success: boolean; data: Room[] }>('/rooms/user-user')
        return res?.data ?? []
    },

    get: async (id: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(`/rooms/user-user/${id}`)
        return res.data
    },

    create: async (data: {
        name: string
        description?: string
        ownerId: string
        maxCapacity?: number
        policy?: Partial<RoomPolicy>
        activeAgents?: string[]
        settings?: Partial<RoomSettings>
        initialMember?: RoomMember
    }): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>('/rooms/user-user', {
            method: 'POST',
            body: JSON.stringify(data),
        })
        return res.data
    },

    update: async (id: string, data: Partial<Room>): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(`/rooms/user-user/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        })
        return res.data
    },

    addMember: async (roomId: string, member: Partial<RoomMember>): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `/rooms/user-user/${roomId}/members`,
            { method: 'POST', body: JSON.stringify(member) }
        )
        return res.data
    },

    removeMember: async (roomId: string, memberId: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `/rooms/user-user/${roomId}/members/${memberId}`,
            { method: 'DELETE' }
        )
        return res.data
    },

    // 2. Agent-Agent Track Routes (Đồng bộ, Thêm/Xóa Agent làm việc trong phòng)
    syncAgents: async (roomId: string, activeAgents: string[]): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `/rooms/agent-agent/${roomId}/agents`,
            { method: 'POST', body: JSON.stringify({ activeAgents }) }
        )
        return res.data
    },

    addAgent: async (roomId: string, agentId: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `/rooms/agent-agent/${roomId}/agents/${agentId}`,
            { method: 'POST' }
        )
        return res.data
    },

    removeAgent: async (roomId: string, agentId: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `/rooms/agent-agent/${roomId}/agents/${agentId}`,
            { method: 'DELETE' }
        )
        return res.data
    },

    // 3. User-Agent Track Routes (Phân bổ & Gán Agent cá nhân cho từng User)
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
            `/rooms/user-agent/${roomId}/user-agents`,
            { method: 'POST', body: JSON.stringify(data) }
        )
        return res.data
    },

    removeUserAgent: async (roomId: string, agentId: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `/rooms/user-agent/${roomId}/user-agents/${agentId}`,
            { method: 'DELETE' }
        )
        return res.data
    },
}