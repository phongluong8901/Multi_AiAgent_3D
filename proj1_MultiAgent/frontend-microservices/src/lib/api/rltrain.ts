import { request } from '../client'

export type Obstacle = {
    x: number
    z: number
    radius: number
}

export type TrajectoryStep = {
    step: number
    agent: {
        x: number
        z: number
        heading: number
        heading_deg: number
    }
    goal: {
        x: number
        z: number
        distance: number
        angle_diff: number
    }
    action: number
    action_name: string
    reward: number
    done: boolean
    lidar: number[]
}

export type EpisodeMetric = {
    episode: number
    reward: number
    steps: number
    success: boolean
    reason: string
    epsilon: number
    states_learned: number
}

export type RLTrainingStatus = {
    is_training: boolean
    agent_id: string
    algorithm?: string
    algorithm_name?: string
    current_episode: number
    total_episodes: number
    progress_percent: number
    epsilon: number
    best_reward: number
    avg_reward_30: number
    success_rate_30: number
    total_success: number
    total_collision: number
    states_learned: number
    live_state: {
        agent: {
            x: number
            z: number
            heading: number
            heading_deg: number
        }
        goal: {
            x: number
            z: number
            distance: number
            angle_diff: number
        }
        lidar: number[]
        obstacles: Obstacle[]
        arena_size: number
        step: number
    }
    latest_trajectory: TrajectoryStep[]
    metrics_history: EpisodeMetric[]
}

export type RLAlgorithmType = 'ppo' | 'sac' | 'sac2' | 'dreamer' | 'muzero' | 'dqn' | 'q_learning'

export type StartTrainParams = {
    agent_id?: string
    episodes?: number
    learning_rate?: number
    discount_factor?: number
    epsilon_decay?: number
    epsilon_min?: number
    speed?: number
    map_name?: string
    algorithm?: RLAlgorithmType
    obstacles?: Obstacle[]
}

export const rlApi = {
    getHealth: () => request<{ status: string; service: string; algorithm?: string; is_training: boolean }>('/rl/health'),

    setAlgorithm: (algorithm: RLAlgorithmType) =>
        request<{ success: boolean; message: string; algorithm: string; algorithm_name: string }>('/rl/algorithm', {
            method: 'POST',
            body: JSON.stringify({ algorithm }),
        }),

    startTraining: (params: StartTrainParams) =>
        request<{ success: boolean; message: string; agent_id: string; algorithm?: string }>('/rl/train/start', {
            method: 'POST',
            body: JSON.stringify(params),
        }),

    pauseTraining: () =>
        request<{ success: boolean; message: string }>('/rl/train/pause', {
            method: 'POST',
        }),

    resetTraining: () =>
        request<{ success: boolean; message: string }>('/rl/train/reset', {
            method: 'POST',
        }),

    getStatus: () => request<RLTrainingStatus>('/rl/train/status'),

    stepManual: (action?: number) =>
        request<{
            observation: any
            action: number
            action_name: string
            reward: number
            done: boolean
            info: any
        }>('/rl/env/step', {
            method: 'POST',
            body: JSON.stringify({ action: action ?? null }),
        }),

    resetEnv: () =>
        request<{ success: boolean; observation: any }>('/rl/env/reset', {
            method: 'POST',
        }),

    setMap: (map_name: string, obstacles?: Obstacle[], arena_size?: number) =>
        request<{ success: boolean; message: string; map_name: string; live_state: any }>('/rl/env/map', {
            method: 'POST',
            body: JSON.stringify({ map_name, obstacles, arena_size }),
        }),

    listPolicies: () =>
        request<Array<{ name: string; agent_id: string; episodes: number; states: number; algorithm?: string; algorithm_name?: string }>>('/rl/policies'),

    savePolicy: (policyName: string, agentId?: string) =>
        request<{ success: boolean; filename: string }>('/rl/policies/save', {
            method: 'POST',
            body: JSON.stringify({ policy_name: policyName, agent_id: agentId }),
        }),

    loadPolicy: (policyName: string) =>
        request<{ success: boolean; message: string; data: any }>('/rl/policies/load', {
            method: 'POST',
            body: JSON.stringify({ policy_name: policyName }),
        }),
}
