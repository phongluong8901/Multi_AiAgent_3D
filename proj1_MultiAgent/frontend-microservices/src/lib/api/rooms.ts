import { request } from '../client'

export type RoomMember = {
    memberId: string
    memberType: 'user' | 'agent'
    role: 'owner' | 'admin' | 'participant' | 'observer'
    name?: string
    color?: string
    avatar?: string
    status?: string
    isOnline?: boolean
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

export type AgentWorkflowMode = 'solo' | 'sequential' | 'routing' | 'autonomous'

export type WorkflowTransition = {
    fromAgentId: string
    toAgentId: string
    condition?: string
}

export type AgentWorkflow = {
    mode: AgentWorkflowMode
    order?: string[]
    stepTools?: Record<number, string>
    agentTools?: Record<string, string[]>
    transitions?: WorkflowTransition[]
    enabled?: boolean
    description?: string
}

export type RoomPresenceUser = {
    userId: string
    userName: string
    avatar?: string
    color?: string
    joinedAt?: string
    lastSeen?: number
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
    workflow?: AgentWorkflow
    // Thống kê Online / Offline từ room-service
    totalMembers?: number
    onlineCount?: number
    offlineCount?: number
    onlineUsers?: RoomPresenceUser[]
    offlineMembers?: RoomMember[]
    createdAt?: string
    updatedAt?: string
}

export type RoomPresenceSummary = {
    totalRooms: number
    totalUsers: number
    totalOnline: number
    totalOffline: number
    rooms: Array<{
        roomId: string
        roomName: string
        totalMembers: number
        onlineCount: number
        offlineCount: number
        onlineUsers: RoomPresenceUser[]
    }>
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

export type UserSearchItem = {
    id: string
    username: string
    email: string
    avatarUrl?: string
}

export type InvitePayload = {
    userId: string
    userName?: string
    inviteeEmail?: string
}

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

    getPresenceSummary: async (): Promise<RoomPresenceSummary> => {
        const res = await request<{ success: boolean; data: RoomPresenceSummary }>(
            `${UU}/presence/summary`
        )
        return (
            res?.data ?? {
                totalRooms: 0,
                totalUsers: 0,
                totalOnline: 0,
                totalOffline: 0,
                rooms: [],
            }
        )
    },

    getRoomPresence: async (
        roomId: string
    ): Promise<{
        roomId: string
        roomName: string
        totalMembers: number
        onlineCount: number
        offlineCount: number
        onlineUsers: RoomPresenceUser[]
        offlineMembers: RoomMember[]
        members: RoomMember[]
    }> => {
        const res = await request<{ success: boolean; data: any }>(`${UU}/${roomId}/presence`)
        return res.data
    },

    updateRoomPresence: async (
        roomId: string,
        user: { id: string; name: string; avatar?: string; color?: string },
        status: 'online' | 'offline' = 'online'
    ): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(`${UU}/${roomId}/presence`, {
            method: 'POST',
            body: JSON.stringify({ user, status }),
        })
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
        const res = await request<{ success: boolean; data: Room }>(`${UU}/${roomId}/join`, {
            method: 'POST',
            body: JSON.stringify(data || {}),
        })
        return res.data
    },

    update: async (id: string, data: Partial<Room>): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(`${UU}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        })
        return res.data
    },

    addMember: async (roomId: string, member: Partial<RoomMember>): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(`${UU}/${roomId}/members`, {
            method: 'POST',
            body: JSON.stringify(member),
        })
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
        const res = await request<{ success: boolean; data: Room }>(`${AA}/${roomId}/agents`, {
            method: 'POST',
            body: JSON.stringify({ activeAgents }),
        })
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

    invite: async (roomId: string, data: InvitePayload): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(`${UU}/${roomId}/invites`, {
            method: 'POST',
            body: JSON.stringify(data),
        })
        return res.data
    },

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
        const res = await request<{ success: boolean; data: Room[] }>(`${UU}/invites/me`)
        return res?.data ?? []
    },

    leave: async (roomId: string): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(`${UU}/${roomId}/leave`, {
            method: 'POST',
        })
        return res.data
    },

    updateWorkflow: async (roomId: string, workflow: AgentWorkflow): Promise<Room> => {
        const res = await request<{ success: boolean; data: Room }>(`${UU}/${roomId}/workflow`, {
            method: 'PUT',
            body: JSON.stringify(workflow),
        })
        return res.data
    },
}
