export { API_BASE, request } from '../client'

import type { Agent as BaseAgent } from './agents'
export type Agent = BaseAgent & {
    description?: string
}

export type { AgentStatus, AgentCreate, AgentUpdate, AgentStreamEvent } from './agents'
export { agentsApi } from './agents'

export type { UserProfile, InviteUser } from './users'
export { usersApi } from './users'

export type {
    Room,
    RoomMember,
    RoomSettings,
    UserAgentBinding,
    RoomPresenceSummary,
    RoomPresenceUser,
    AgentWorkflow,
    AgentWorkflowMode,
    WorkflowTransition,
} from './rooms'
export { roomsApi } from './rooms'

export interface UserSearchItem {
    id: string
    username: string
    email: string
    avatarUrl?: string
}

export type {
    ChatMessage,
    UserPresence,
    ChatAttachment,
    ChatType,
    BubbleRoomSummary,
} from './chats'
export { chatsApi } from './chats'

export type { Prompt } from './prompts'
export { promptsApi } from './prompts'

export type { Tool } from './tools'
export { toolsApi } from './tools'

export type { AIModel } from './models'
export { listModels } from './models'
export { ownerApi, type RentalSessionData, type OwnerDashboardData } from './owner'

export type { WorkflowTrace, WorkflowTraceNode } from './types'

export {
    authService,
    type RegisterPayload,
    type LoginPayload,
    type VerifyOtpPayload,
    type ResendOtpPayload,
    type GoogleAuthPayload,
    type GithubAuthPayload,
    type HuggingfaceAuthPayload,
} from './auth'

export { mapsApi, type CloudMapDesign } from './maps'
export {
    labApi,
    type LabStage,
    type LabTemplate,
    type LabSynthesisResponse,
    type GeneratedFileList,
    type GeneratedFileInfo,
} from './lab'
export {
    rlApi,
    type RLAlgorithmType,
    type RLTrainingStatus,
    type EpisodeMetric,
    type TrajectoryStep,
    type Obstacle,
} from './rltrain'
