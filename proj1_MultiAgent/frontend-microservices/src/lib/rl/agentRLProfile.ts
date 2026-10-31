import { RLAlgorithmType } from '@/lib/api'

export interface AgentRLConfig {
    agentId: string
    algorithm: RLAlgorithmType
    algorithmName: string
    mapName: string
    policyName?: string
    episodes: number
    learningRate: number
    discountFactor: number
    epsilonDecay: number
    statesLearned: number
    successRate?: number
    bestReward?: number
    sensorType: string
    steeringMode: string
    flashedAt?: string
    status?: 'active' | 'idle'
}

export const ALGORITHM_LABELS: Record<string, string> = {
    ppo: 'PPO (Proximal Policy Optimization - Actor Critic)',
    sac: 'SAC (Soft Actor-Critic - Max Entropy)',
    sac2: 'SAC v2 (Auto-Alpha + Twin Critics)',
    dreamer: 'Dreamer (World Models + Latent Rollouts)',
    muzero: 'MuZero (DeepMind MCTS Lookahead Planning)',
    dqn: 'DQN (Deep Q-Network + Replay)',
    q_learning: 'Q-Learning (Tabular Baseline)',
}

export const MAP_LABELS: Record<string, string> = {
    office: 'Office 3D Room Map (Văn phòng)',
    grid: 'Cyber Grid Arena (Sa bàn Tọa độ)',
    industrial_factory: 'Nhà máy Công nghiệp 4.0 & Robotics',
    smarthome_iot: 'Biệt thự Smart Home IoT & Sân Vườn',
    smart_city: 'Đô thị Smart City IoT',
    outdoor: 'Khuôn viên ngoài trời (Outdoor Campus)',
}

const STORAGE_PREFIX = 'agent_rl_config_'

export function getDefaultRLConfig(agentId: string): AgentRLConfig {
    return {
        agentId,
        algorithm: 'ppo',
        algorithmName: ALGORITHM_LABELS.ppo,
        mapName: 'office',
        policyName: `policy_${agentId}_v1`,
        episodes: 300,
        learningRate: 0.003,
        discountFactor: 0.99,
        epsilonDecay: 0.995,
        statesLearned: 1420,
        successRate: 94.5,
        bestReward: 128.4,
        sensorType: '8-Beam 13D Continuous LIDAR',
        steeringMode: 'Tiếp tuyến Né Bàn Ghế & Tường',
        flashedAt: new Date().toISOString(),
        status: 'active',
    }
}

export function getAgentRLConfig(agentId: string): AgentRLConfig {
    if (!agentId) return getDefaultRLConfig('unknown')

    if (typeof window === 'undefined') {
        return getDefaultRLConfig(agentId)
    }

    try {
        const stored = localStorage.getItem(`${STORAGE_PREFIX}${agentId}`)
        if (stored) {
            const parsed = JSON.parse(stored) as Partial<AgentRLConfig>
            const defaultConfig = getDefaultRLConfig(agentId)
            const algo = (parsed.algorithm || defaultConfig.algorithm) as RLAlgorithmType
            return {
                ...defaultConfig,
                ...parsed,
                agentId,
                algorithm: algo,
                algorithmName: ALGORITHM_LABELS[algo] || parsed.algorithmName || algo.toUpperCase(),
                mapName: parsed.mapName || 'office',
            }
        }
    } catch (e) {
        console.error('[RL_PROFILE] Lỗi đọc cấu hình RL của agent:', e)
    }

    return getDefaultRLConfig(agentId)
}

export function saveAgentRLConfig(agentId: string, partial: Partial<AgentRLConfig>): AgentRLConfig {
    if (!agentId) throw new Error('Missing agentId')

    const current = getAgentRLConfig(agentId)
    const algo = (partial.algorithm || current.algorithm) as RLAlgorithmType
    const updated: AgentRLConfig = {
        ...current,
        ...partial,
        agentId,
        algorithm: algo,
        algorithmName: ALGORITHM_LABELS[algo] || partial.algorithmName || algo.toUpperCase(),
        flashedAt: new Date().toISOString(),
    }

    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(`${STORAGE_PREFIX}${agentId}`, JSON.stringify(updated))
            window.dispatchEvent(
                new CustomEvent('agent-rl-updated', {
                    detail: { agentId, config: updated },
                })
            )
        } catch (e) {
            console.error('[RL_PROFILE] Lỗi lưu cấu hình RL:', e)
        }
    }

    return updated
}
