export { API_BASE, request } from '../client'

import type { Agent as BaseAgent } from './agents'
export type Agent = BaseAgent & {
    description?: string
}

export type { AgentStatus, AgentCreate, AgentUpdate } from './agents'
export { agentsApi } from './agents'

export type { UserProfile, InviteUser } from './users'

export { usersApi } from './users'

export type {
    Room,
    RoomMember,
    RoomSettings,
    UserAgentBinding,
} from './rooms'
export { roomsApi } from './rooms'

export interface UserSearchItem {
    id: string
    username: string
    email: string
    avatarUrl?: string
}


export type { ChatMessage, UserPresence, ChatAttachment } from './chats'
export { chatsApi } from './chats'

export type { Prompt } from './prompts'
export { promptsApi } from './prompts'

export type { Tool } from './tools'
export { toolsApi } from './tools'

export type { AIModel } from './models'
export { listModels } from './models'

export type { WorkflowTrace, WorkflowTraceNode } from './types'

export {
    authService,
    type RegisterPayload,
    type LoginPayload,
    type VerifyOtpPayload,
    type ResendOtpPayload,
    type GoogleAuthPayload,
    type GithubAuthPayload,
} from './auth'

