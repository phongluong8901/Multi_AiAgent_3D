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
    allowCrossCommands?: boolean
    autonomousHandoff?: boolean
    maxAutoTurns?: number
    allowGuestJoin?: boolean
}

export type RoomPolicy = {
    tier?: 'standard' | 'premium' | 'enterprise'
    isPublic?: boolean
    password?: string
    maxActiveAgents?: number
    ownedAgentsCount?: number
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
    ownerId?: string
    maxCapacity: number
    activeAgents: string[]
    userAgents?: UserAgentBinding[]
    policy?: RoomPolicy
    settings: RoomSettings
    members: RoomMember[]
    createdAt?: string
    updatedAt?: string
}

export type RoomCreate = {
    name: string
    description?: string
    maxCapacity?: number
    ownerName?: string
    ownerId?: string
    policy?: RoomPolicy
    settings?: Partial<RoomSettings>
}

// Bổ sung kiểu dữ liệu cho UserSearchItem và InvitePayload
export type UserSearchItem = {
    id: string
    username: string
    email: string
    avatarUrl?: string
}

export type InvitePayload = {
    inviteeUserId: string
    inviteeEmail?: string
    inviteeName?: string
}

// Prefix khớp room-service
const UU = '/rooms/user-user'
const AA = '/rooms/agent-agent'
const UA = '/rooms/user-agent'

export const roomsApi = {
    list: async (): Promise<Room[]> => {
        const res = await request<{ success: boolean; data: Room[] }>(UU)
        return res?.data ?? []
    },

    get: async (id: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(`${UU}/${id}`)
        return res.data
    },

    create: async (data: RoomCreate): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(UU, {
            method: 'POST',
            body: JSON.stringify(data),
        })
        return res.data
    },

    join: async (
        roomId: string,
        data?: { name?: string; avatar?: string; color?: string; password?: string }
    ): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `${UU}/${roomId}/join`,
            { method: 'POST', body: JSON.stringify(data || {}) }
        )
        return res.data
    },

    update: async (id: string, data: Partial<Room>): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(`${UU}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        })
        return res.data
    },

    addMember: async (
        roomId: string,
        member: Partial<RoomMember>
    ): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `${UU}/${roomId}/members`,
            { method: 'POST', body: JSON.stringify(member) }
        )
        return res.data
    },

    removeMember: async (roomId: string, memberId: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `${UU}/${roomId}/members/${memberId}`,
            { method: 'DELETE' }
        )
        return res.data
    },

    syncAgents: async (roomId: string, activeAgents: string[]): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `${AA}/${roomId}/agents`,
            { method: 'POST', body: JSON.stringify({ activeAgents }) }
        )
        return res.data
    },

    addAgent: async (roomId: string, agentId: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `${AA}/${roomId}/agents/${agentId}`,
            { method: 'POST' }
        )
        return res.data
    },

    removeAgent: async (roomId: string, agentId: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `${AA}/${roomId}/agents/${agentId}`,
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
            `${UA}/${roomId}/user-agents`,
            { method: 'POST', body: JSON.stringify(data) }
        )
        return res.data
    },

    removeUserAgent: async (roomId: string, agentId: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `${UA}/${roomId}/user-agents/${agentId}`,
            { method: 'DELETE' }
        )
        return res.data
    },

    remove: async (id: string): Promise<void> => {
        await request(`${UU}/${id}`, { method: 'DELETE' })
    },

    // Cập nhật hàm invite nhận `InvitePayload`
    invite: async (
        roomId: string,
        data: InvitePayload
    ): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `${UU}/${roomId}/invites`,
            { method: 'POST', body: JSON.stringify(data) }
        )
        return res.data
    },

    // Bổ sung hàm searchUsers để phục vụ tính năng tìm kiếm thành viên
    searchUsers: async (query: string): Promise<{ users: UserSearchItem[] }> => {
        const res = await request<{ success: boolean; users: UserSearchItem[] }>(
            `/users/search?q=${encodeURIComponent(query)}`
        )
        return { users: res?.users || [] }
    },

    acceptInvite: async (roomId: string, name?: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `${UU}/${roomId}/invites/accept`,
            { method: 'POST', body: JSON.stringify({ name }) }
        )
        return res.data
    },

    declineInvite: async (roomId: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `${UU}/${roomId}/invites/decline`,
            { method: 'POST' }
        )
        return res.data
    },

    myInvites: async (): Promise<Room[]> => {
        const res = await request<{ success: boolean; data: Room[] }>(
            `${UU}/invites/me`
        )
        return res?.data ?? []
    },

    leave: async (roomId: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(
            `${UU}/${roomId}/leave`,
            { method: 'POST' }
        )
        return res.data
    },
}