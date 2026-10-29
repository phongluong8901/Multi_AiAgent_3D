'use client'

import Link from 'next/link'
import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
    Play,
    Pause,
    RotateCcw,
    Save,
    Upload,
    BrainCircuit,
    Zap,
    Crosshair,
    ShieldAlert,
    Award,
    Activity,
    Compass,
    Settings2,
    Sliders,
    Eye,
    CheckCircle2,
    Bot,
    Sparkles,
    Orbit,
    GitBranch,
    BarChart3,
    Building2,
    Target,
    Cpu
} from 'lucide-react'
import RLArena3D from '@/components/training/RLArena3D'
import AgentInspectorModal from '@/components/agents/AgentInspectorModal'
import { rlApi, RLTrainingStatus, RLAlgorithmType, agentsApi, Agent } from '@/lib/api'
import { OFFICE_OBSTACLES } from '@/lib/rl/rlNavigator'
import { toast } from 'sonner'

const CYBER_GRID_OBSTACLES = [
    { x: -4, z: -3, radius: 1.2, type: 'pillar' },
    { x: 4, z: -4, radius: 1.4, type: 'pillar' },
    { x: 0, z: 0, radius: 1.5, type: 'pillar' },
    { x: -4.5, z: 4, radius: 1.3, type: 'pillar' },
    { x: 4.5, z: 4, radius: 1.3, type: 'pillar' },
    { x: 0, z: 6, radius: 1.1, type: 'pillar' },
    { x: -6, z: 0, radius: 1.2, type: 'pillar' },
    { x: 6, z: 0, radius: 1.2, type: 'pillar' },
]

export default function RLTrainingPage() {
    // Trạng thái Agent & Huấn luyện
    const [agents, setAgents] = useState<Agent[]>([])
    const [selectedAgentId, setSelectedAgentId] = useState<string>('agent_manager')
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)

    // Siêu tham số (Hyperparameters)
    const [selectedAlgorithm, setSelectedAlgorithm] = useState<RLAlgorithmType>('ppo')
    const [episodes, setEpisodes] = useState<number>(300)
    const [learningRate, setLearningRate] = useState<number>(0.003) // Default 0.003 for neural net RL
    const [discountFactor, setDiscountFactor] = useState<number>(0.99)
    const [epsilonDecay, setEpsilonDecay] = useState<number>(0.995)
    const [trainingSpeed, setTrainingSpeed] = useState<number>(0.0) // 0s = Max speed

    // Dữ liệu thời gian thực từ BE
    const [status, setStatus] = useState<RLTrainingStatus | null>(null)
    const [loading, setLoading] = useState<boolean>(false)
    const [isTestMode, setIsTestMode] = useState<boolean>(false)
    const [selectedMap, setSelectedMap] = useState<'office' | 'grid'>('office')
    const [inspectorOpen, setInspectorOpen] = useState(false)
    const [policyName, setPolicyName] = useState<string>('policy_rl_v1')
    const [savedPolicies, setSavedPolicies] = useState<Array<{ name: string; episodes: number; states: number; algorithm?: string }>>([])

    const pollingRef = useRef<NodeJS.Timeout | null>(null)
    const testIntervalRef = useRef<NodeJS.Timeout | null>(null)

    // 1. Tải danh sách Agents từ hệ thống
    useEffect(() => {
        async function initData() {
            try {
                const agentList = await agentsApi.list()
                if (agentList && agentList.length > 0) {
                    setAgents(agentList)
                    setSelectedAgentId(agentList[0].id)
                    setSelectedAgent(agentList[0])
                }
                loadPolicies()
            } catch (e) {
                console.error('Lỗi nạp danh sách Agents:', e)
            }
        }
        initData()
    }, [])

    useEffect(() => {
        const found = agents.find((a) => a.id === selectedAgentId)
        if (found) setSelectedAgent(found)
    }, [selectedAgentId, agents])

    // Đồng bộ thuật toán từ trạng thái Backend khi nạp lại hoặc chuyển đổi
    useEffect(() => {
        if (status?.algorithm && status.algorithm !== selectedAlgorithm) {
            setSelectedAlgorithm(status.algorithm as RLAlgorithmType)
        }
    }, [status?.algorithm])

    // 2. Tải danh sách Policy đã lưu
    const loadPolicies = async () => {
        try {
            const list = await rlApi.listPolicies()
            setSavedPolicies(list)
        } catch (_) {}
    }

    // 3. Polling liên tục trạng thái huấn luyện từ Backend (mỗi 600ms khi đang train)
    const fetchStatus = async () => {
        try {
            const res = await rlApi.getStatus()
            setStatus(res)
        } catch (_) {}
    }

    useEffect(() => {
        fetchStatus()
        pollingRef.current = setInterval(fetchStatus, 700)
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current)
        }
    }, [])

    // Chuyển đổi thuật toán RL
    const handleAlgorithmChange = async (newAlgo: RLAlgorithmType) => {
        setSelectedAlgorithm(newAlgo)
        // Điều chỉnh learning rate gợi ý theo thuật toán
        if (newAlgo === 'ppo' || newAlgo === 'sac' || newAlgo === 'sac2' || newAlgo === 'muzero') setLearningRate(0.003)
        else if (newAlgo === 'dreamer' || newAlgo === 'dqn') setLearningRate(0.005)
        else setLearningRate(0.15)

        try {
            const res = await rlApi.setAlgorithm(newAlgo)
            if (res.success) {
                const toastMessages: Record<string, string> = {
                    ppo: 'PPO (Actor-Critic) đã được kích hoạt',
                    sac: 'SAC (Soft Actor-Critic) đã được kích hoạt',
                    sac2: 'SAC v2 (Auto-Alpha Entropy) đã được kích hoạt',
                    dreamer: 'Dreamer (World Model) đã được kích hoạt',
                    muzero: 'MuZero (DeepMind MCTS) đã được kích hoạt',
                    dqn: 'DQN (Deep Q-Network) đã được kích hoạt',
                    q_learning: 'Q-Learning (Tabular) đã được kích hoạt'
                }
                toast.success(toastMessages[newAlgo] || `Đã chọn ${newAlgo.toUpperCase()}`)
                fetchStatus()
            }
        } catch {
            toast.info(`Chuyển sang ${newAlgo.toUpperCase()}`)
        }
    }

    // 4. Các nút điều khiển huấn luyện
    const handleStartTraining = async () => {
        setLoading(true)
        setIsTestMode(false)
        if (testIntervalRef.current) clearInterval(testIntervalRef.current)

        try {
            const res = await rlApi.startTraining({
                agent_id: selectedAgentId,
                episodes,
                learning_rate: learningRate,
                discount_factor: discountFactor,
                epsilon_decay: epsilonDecay,
                speed: trainingSpeed,
                map_name: selectedMap,
                obstacles: currentObstacles as any,
                algorithm: selectedAlgorithm,
            })
            if (res.success) {
                toast.success(res.message)
            }
        } catch (e: any) {
            toast.error(e?.message || 'Không thể kết nối tới RL Train Service (Port 5009)')
        } finally {
            setLoading(false)
            fetchStatus()
        }
    }

    const handlePauseTraining = async () => {
        try {
            await rlApi.pauseTraining()
            toast.info('Đã tạm dừng tiến trình huấn luyện')
            fetchStatus()
        } catch (e: any) {
            toast.error(e?.message || 'Lỗi gửi lệnh tạm dừng')
        }
    }

    const handleResetTraining = async () => {
        try {
            setIsTestMode(false)
            if (testIntervalRef.current) clearInterval(testIntervalRef.current)
            await rlApi.resetTraining()
            toast.success('Đã reset toàn bộ thông số và sa bàn')
            fetchStatus()
        } catch (e: any) {
            toast.error(e?.message || 'Lỗi reset')
        }
    }

    // 5. Chế độ Test Inference (Agent tự di chuyển bằng tri thức Q-Table đã học)
    const handleToggleTestMode = () => {
        if (isTestMode) {
            setIsTestMode(false)
            if (testIntervalRef.current) clearInterval(testIntervalRef.current)
            toast.info('Đã tắt chế độ lái thử nghiệm')
        } else {
            setIsTestMode(true)
            toast.success('Bật chế độ lái tự động dựa trên Policy đã huấn luyện!')
            testIntervalRef.current = setInterval(async () => {
                try {
                    const stepRes = await rlApi.stepManual()
                    if (stepRes.done) {
                        toast.info(`Tập lái kết thúc: ${stepRes.info.reason === 'goal_reached' ? 'Đã tới đích!' : 'Va chạm'}`)
                    }
                    fetchStatus()
                } catch (_) {}
            }, 250)
        }
    }

    const handleSavePolicy = async () => {
        if (!policyName.trim()) return
        try {
            const res = await rlApi.savePolicy(policyName, selectedAgentId)
            if (res.success) {
                toast.success(`Đã lưu Policy "${policyName}" thành công!`)
                loadPolicies()
            }
        } catch (e: any) {
            toast.error(e?.message || 'Lỗi lưu policy')
        }
    }

    const handleLoadPolicy = async (name: string) => {
        try {
            const res = await rlApi.loadPolicy(name)
            if (res.success) {
                toast.success(res.message)
                fetchStatus()
            }
        } catch (e: any) {
            toast.error(e?.message || 'Lỗi nạp policy')
        }
    }

    // Danh sách vật cản hiện tại tương ứng với môi trường đã chọn
    const currentObstacles = useMemo(() => {
        if (selectedMap === 'office') {
            if (
                status?.live_state?.obstacles &&
                status.live_state.obstacles.length > 5 &&
                status.live_state.obstacles.some((o: any) => o.type === 'desk')
            ) {
                return status.live_state.obstacles
            }
            return OFFICE_OBSTACLES
        }
        return CYBER_GRID_OBSTACLES
    }, [selectedMap, status?.live_state?.obstacles])

    // Chuyển đổi môi trường trực tiếp trên cả giao diện và gọi BE
    const handleMapChange = async (newMap: 'office' | 'grid') => {
        setSelectedMap(newMap)
        try {
            const res = await rlApi.setMap(newMap)
            if (res.success) {
                toast.success(
                    newMap === 'office'
                        ? '🏢 Đã chuyển sang sa bàn: Văn phòng Thực tế (Office 3D Room)'
                        : '🎯 Đã chuyển sang sa bàn: Cyber Grid Arena'
                )
                fetchStatus()
            }
        } catch {
            toast.info(
                newMap === 'office'
                    ? '🏢 Chuyển sang mô hình Văn phòng 3D'
                    : '🎯 Chuyển sang Sa bàn Cyber'
            )
        }
    }

    // Dữ liệu an toàn hiển thị
    const liveState = {
        agent: status?.live_state?.agent || { x: 0, z: -5, heading: 0, heading_deg: 0 },
        goal: status?.live_state?.goal || { x: 0, z: 6, distance: 11 },
        lidar: status?.live_state?.lidar || [8, 8, 8, 8, 8, 8, 8, 8],
        obstacles: currentObstacles,
        arena_size: selectedMap === 'office' ? 28 : 20,
        step: status?.live_state?.step || 0,
    }

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 max-w-7xl mx-auto text-zinc-100">
            {/* Module RL Navigation vs Locomotion Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-800/60">
                <div className="flex items-center gap-1.5 p-1 bg-zinc-900/90 border border-zinc-800 rounded-xl">
                    <span className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white flex items-center gap-2 shadow-sm">
                        <Compass className="w-3.5 h-3.5" />
                        RL Navigation (LIDAR Cảm biến & Né vật cản)
                    </span>
                    <Link
                        href="/training/body"
                        className="px-3 py-1.5 text-xs font-medium rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center gap-2 transition"
                    >
                        <Bot className="w-3.5 h-3.5 text-indigo-400" />
                        RL Locomotion 3D (Khớp Thân, Tập Đứng & Đi)
                        <span className="text-[10px] px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30 font-semibold">
                            Body AI
                        </span>
                    </Link>
                </div>

                <Link
                    href="/agent-body-studio"
                    className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400 hover:text-indigo-400 transition"
                >
                    <Sliders className="w-3.5 h-3.5" />
                    Thiết kế khung robot tại Agent Body Studio
                </Link>
            </div>

            {/* Header Page */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800/80">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/20 text-white">
                            <BrainCircuit className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                                Đấu trường RL Training 3D
                                <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                                    {selectedAlgorithm === 'ppo' && <Sparkles className="w-3.5 h-3.5 text-blue-400" />}
                                    {selectedAlgorithm === 'sac' && <Zap className="w-3.5 h-3.5 text-amber-400" />}
                                    {selectedAlgorithm === 'sac2' && <Zap className="w-3.5 h-3.5 text-orange-400" />}
                                    {selectedAlgorithm === 'dreamer' && <Orbit className="w-3.5 h-3.5 text-purple-400" />}
                                    {selectedAlgorithm === 'muzero' && <GitBranch className="w-3.5 h-3.5 text-emerald-400" />}
                                    {selectedAlgorithm === 'dqn' && <BrainCircuit className="w-3.5 h-3.5 text-cyan-400" />}
                                    {selectedAlgorithm === 'q_learning' && <BarChart3 className="w-3.5 h-3.5 text-zinc-400" />}
                                    <span>
                                        {selectedAlgorithm === 'ppo'
                                            ? 'PPO Actor-Critic'
                                            : selectedAlgorithm === 'sac'
                                            ? 'SAC Soft Actor-Critic'
                                            : selectedAlgorithm === 'sac2'
                                            ? 'SAC v2 Auto-Alpha'
                                            : selectedAlgorithm === 'dreamer'
                                            ? 'Dreamer World Model'
                                            : selectedAlgorithm === 'muzero'
                                            ? 'MuZero DeepMind MCTS'
                                            : selectedAlgorithm === 'dqn'
                                            ? 'DQN Deep Q-Network'
                                            : 'Q-Learning Tabular'}
                                    </span>
                                    <span className="text-zinc-600">•</span>
                                    <span className="text-zinc-400">13D Continuous LIDAR</span>
                                </span>
                            </h1>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Huấn luyện Reinforcement Learning giúp AI Agent tự học điều hướng, né vật cản và tìm đường ngắn nhất tới đích
                            </p>
                        </div>
                    </div>
                </div>

                {/* Chọn Thuật toán, Môi trường & Agent */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 p-2 rounded-2xl">
                        <span className="text-xs text-zinc-400 pl-2 flex items-center gap-1.5">
                            <BrainCircuit className="w-3.5 h-3.5 text-blue-400" />
                            Thuật toán:
                        </span>
                        <select
                            value={selectedAlgorithm}
                            onChange={(e) => handleAlgorithmChange(e.target.value as any)}
                            className="bg-zinc-800 border border-zinc-700 text-xs rounded-xl px-3 py-1.5 text-white font-semibold focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                            <option value="ppo">PPO • Actor-Critic (Khuyên dùng)</option>
                            <option value="sac">SAC • Soft Actor-Critic (Max-Entropy)</option>
                            <option value="sac2">SAC v2 • Auto-Alpha (Entropy Tự động)</option>
                            <option value="dreamer">Dreamer • World Models (Latent Rollouts)</option>
                            <option value="muzero">MuZero • DeepMind MCTS Lookahead</option>
                            <option value="dqn">DQN • Deep Q-Network + Replay</option>
                            <option value="q_learning">Q-Learning • Tabular Baseline</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 p-2 rounded-2xl">
                        <span className="text-xs text-zinc-400 pl-2 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                            Môi trường:
                        </span>
                        <select
                            value={selectedMap}
                            onChange={(e) => handleMapChange(e.target.value as any)}
                            className="bg-zinc-800 border border-zinc-700 text-xs rounded-xl px-3 py-1.5 text-white font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                            <option value="office">Office 3D Room • Văn phòng Thực tế</option>
                            <option value="grid">Cyber Grid Arena • Sa bàn Lưới Tọa độ</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 p-2 rounded-2xl">
                        <span className="text-xs text-zinc-400 pl-2 flex items-center gap-1.5">
                            <Bot className="w-3.5 h-3.5 text-emerald-400" />
                            Nạp RL vào Robot:
                        </span>
                        <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-xl px-2.5 py-1">
                            <span
                                className="w-2.5 h-2.5 rounded-full ring-2 ring-white/10 shrink-0"
                                style={{ backgroundColor: selectedAgent?.color || '#3b82f6' }}
                            />
                            <select
                                value={selectedAgentId}
                                onChange={(e) => setSelectedAgentId(e.target.value)}
                                className="bg-transparent text-xs text-white font-semibold focus:outline-none cursor-pointer"
                            >
                                {agents.map((ag) => (
                                    <option key={ag.id} value={ag.id} className="bg-zinc-900 text-white">
                                        {ag.name} ({ag.id})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={() => setInspectorOpen(true)}
                            className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                            title={`Xem cấu hình Model, Tools và Chính sách RL đang nạp vào ${selectedAgent?.name || 'Agent'}`}
                        >
                            <Cpu className="w-3.5 h-3.5 text-blue-400" />
                            <span>Cấu hình Nạp:</span>
                            <span className="text-white font-bold underline decoration-blue-500 underline-offset-2">
                                {selectedAgent?.name || 'Agent'}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Metrics Dashboard Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-zinc-900/60 border border-zinc-800/80 p-3.5 rounded-2xl backdrop-blur-sm">
                    <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span className="text-[11px] font-medium">Tiến độ Episode</span>
                        <Activity className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="text-lg font-bold text-white">
                        {status?.current_episode ?? 0}{' '}
                        <span className="text-xs font-normal text-zinc-500">/ {status?.total_episodes ?? episodes}</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-300"
                            style={{ width: `${status?.progress_percent ?? 0}%` }}
                        />
                    </div>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/80 p-3.5 rounded-2xl backdrop-blur-sm">
                    <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span className="text-[11px] font-medium">Tỷ lệ Thành công</span>
                        <Award className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="text-lg font-bold text-emerald-400">
                        {status?.success_rate_30 ?? 0}%
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">30 episode gần nhất</p>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/80 p-3.5 rounded-2xl backdrop-blur-sm">
                    <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span className="text-[11px] font-medium">Best Reward</span>
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="text-lg font-bold text-amber-400">
                        {status?.best_reward ?? 0}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">Avg: {status?.avg_reward_30 ?? 0}</p>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/80 p-3.5 rounded-2xl backdrop-blur-sm">
                    <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span className="text-[11px] font-medium">
                            {selectedAlgorithm === 'ppo'
                                ? 'PPO Clip (ε)'
                                : selectedAlgorithm === 'sac' || selectedAlgorithm === 'sac2'
                                ? 'Entropy Temp (α)'
                                : selectedAlgorithm === 'dreamer'
                                ? 'Imagination Rollout'
                                : selectedAlgorithm === 'muzero'
                                ? 'MCTS Tree Search'
                                : 'Epsilon (Khám phá)'}
                        </span>
                        <Crosshair className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div className="text-lg font-bold text-purple-400">
                        {selectedAlgorithm === 'ppo'
                            ? '0.20'
                            : selectedAlgorithm === 'sac2'
                            ? (status?.epsilon?.toFixed(3) ?? '0.200')
                            : selectedAlgorithm === 'sac'
                            ? '0.20'
                            : selectedAlgorithm === 'dreamer'
                            ? 'H = 5 steps'
                            : selectedAlgorithm === 'muzero'
                            ? 'N = 25 sims'
                            : (status?.epsilon ?? 1.0)}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">
                        {selectedAlgorithm === 'ppo'
                            ? 'Clipping surrogate'
                            : selectedAlgorithm === 'sac2'
                            ? 'Auto-Alpha điều chỉnh entropy'
                            : selectedAlgorithm === 'sac'
                            ? 'Max-entropy exploration'
                            : selectedAlgorithm === 'dreamer'
                            ? 'World model latent dreams'
                            : selectedAlgorithm === 'muzero'
                            ? 'PUCT exploration lookahead'
                            : 'Giảm dần theo hàm mũ'}
                    </p>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/80 p-3.5 rounded-2xl backdrop-blur-sm">
                    <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span className="text-[11px] font-medium">
                            {selectedAlgorithm === 'ppo'
                                ? 'Mạng Nơ-ron PPO'
                                : selectedAlgorithm === 'sac2'
                                ? 'Twin Critics v2 (64)'
                                : selectedAlgorithm === 'sac'
                                ? 'Twin Critics Replay'
                                : selectedAlgorithm === 'dreamer'
                                ? 'World Model Mơ mộng'
                                : selectedAlgorithm === 'muzero'
                                ? 'MCTS Lookahead Search'
                                : selectedAlgorithm === 'dqn'
                                ? 'Kinh nghiệm Replay'
                                : 'Trạng thái Q-Table'}
                        </span>
                        <BrainCircuit className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                    <div className="text-lg font-bold text-cyan-400">
                        {selectedAlgorithm === 'ppo'
                            ? 'Actor-Critic (48)'
                            : selectedAlgorithm === 'sac2'
                            ? `${status?.states_learned ?? 0} exp`
                            : selectedAlgorithm === 'sac'
                            ? `${status?.states_learned ?? 0} exp`
                            : selectedAlgorithm === 'dreamer'
                            ? `${status?.states_learned ?? 0} dreams`
                            : selectedAlgorithm === 'muzero'
                            ? `${status?.states_learned ?? 0} mcts`
                            : selectedAlgorithm === 'dqn'
                            ? `${status?.states_learned ?? 0} exp`
                            : `${status?.states_learned ?? 0}`}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">
                        {selectedAlgorithm === 'ppo'
                            ? 'Continuous 13-D Vector'
                            : selectedAlgorithm === 'sac2'
                            ? 'Twin Q + Auto α + Replay 8k'
                            : selectedAlgorithm === 'sac'
                            ? 'Twin Q + Soft Policy Target'
                            : selectedAlgorithm === 'dreamer'
                            ? 'Residual Dynamics + Value'
                            : selectedAlgorithm === 'muzero'
                            ? 'DeepMind Tree Planning'
                            : selectedAlgorithm === 'dqn'
                            ? 'Buffer 4,000 steps'
                            : 'States đã học'}
                    </p>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/80 p-3.5 rounded-2xl backdrop-blur-sm">
                    <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span className="text-[11px] font-medium">Va chạm / Về đích</span>
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    </div>
                    <div className="text-lg font-bold text-white flex items-center gap-1.5">
                        <span className="text-rose-400">{status?.total_collision ?? 0}</span>
                        <span className="text-zinc-600">/</span>
                        <span className="text-emerald-400">{status?.total_success ?? 0}</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">Va chạm / Đích</p>
                </div>
            </div>

            {/* Sàn đấu 3D Three.js & Bảng điều khiển */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 2 Cột bên trái: Three.js 3D Arena */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="relative">
                        <RLArena3D
                            agentState={liveState.agent}
                            goalState={liveState.goal}
                            lidar={liveState.lidar}
                            obstacles={liveState.obstacles}
                            trajectory={status?.latest_trajectory || []}
                            isTraining={status?.is_training ?? false}
                            agentColor={selectedAgent?.color || '#3b82f6'}
                            agentName={selectedAgent?.name || 'Agent'}
                            mapName={selectedMap}
                            arenaSize={liveState.arena_size}
                        />

                        {/* Overlay định danh con Robot đang được nạp tri thức */}
                        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950/85 backdrop-blur-md border border-zinc-800 text-xs shadow-xl pointer-events-none">
                            <span
                                className="w-2.5 h-2.5 rounded-full animate-pulse shadow-sm"
                                style={{ backgroundColor: selectedAgent?.color || '#3b82f6' }}
                            />
                            <span className="text-zinc-400 font-medium">Đang nạp RL:</span>
                            <span className="text-white font-bold">{selectedAgent?.name || 'Agent'}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                                {selectedAgent?.id}
                            </span>
                        </div>

                        {/* Nút hành động nhanh nổi trên Canvas 3D */}
                        <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 bg-zinc-950/80 backdrop-blur-md p-3 rounded-2xl border border-zinc-800">
                            <div className="flex items-center gap-2">
                                {!status?.is_training ? (
                                    <button
                                        onClick={handleStartTraining}
                                        disabled={loading}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/20 transition active:scale-95"
                                    >
                                        <Play className="w-3.5 h-3.5 fill-current" />
                                        {status && status.current_episode > 0 && status.current_episode >= status.total_episodes
                                            ? `Huấn luyện Tiếp (+${episodes} Eps)`
                                            : status && status.current_episode > 0
                                            ? 'Tiếp tục Huấn luyện'
                                            : 'Bắt đầu Huấn luyện'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handlePauseTraining}
                                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs shadow-lg shadow-amber-500/20 transition active:scale-95"
                                    >
                                        <Pause className="w-3.5 h-3.5 fill-current" />
                                        Tạm dừng
                                    </button>
                                )}

                                <button
                                    onClick={handleResetTraining}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition"
                                    title="Xóa toàn bộ tri thức Q-Table và đặt lại từ đầu"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Reset (Học lại)
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleToggleTestMode}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                                        isTestMode
                                            ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/20'
                                            : 'bg-zinc-800 hover:bg-zinc-700 text-purple-300 border-purple-500/30'
                                    }`}
                                >
                                    <Eye className="w-3.5 h-3.5" />
                                    {isTestMode ? 'Dừng Test Lái' : 'Test Policy Thực tế'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Biểu đồ phần thưởng Reward Curve mini */}
                    <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-blue-400" />
                                Đồ thị Phần thưởng Huấn luyện (Reward / Episode)
                            </span>
                            <span className="text-[11px] text-zinc-500">
                                {status?.metrics_history?.length || 0} điểm dữ liệu gần nhất
                            </span>
                        </div>

                        <div className="h-28 w-full flex items-end gap-1 pt-2 border-b border-zinc-800 overflow-x-auto">
                            {status?.metrics_history && status.metrics_history.length > 0 ? (
                                status.metrics_history.map((m, idx) => {
                                    const minR = -60
                                    const maxR = 120
                                    const norm = Math.max(0, Math.min(100, ((m.reward - minR) / (maxR - minR)) * 100))
                                    return (
                                        <div
                                            key={idx}
                                            title={`Episode ${m.episode}: Reward ${m.reward} (${m.success ? 'Đích' : m.reason})`}
                                            className="flex-1 min-w-[3px] rounded-t-sm transition-all duration-300 hover:opacity-80"
                                            style={{
                                                height: `${Math.max(6, norm)}%`,
                                                backgroundColor: m.success ? '#10b981' : m.reward < -20 ? '#ef4444' : '#3b82f6',
                                            }}
                                        />
                                    )
                                })
                            ) : (
                                <div className="w-full text-center text-xs text-zinc-600 pb-8">
                                    Chưa có dữ liệu huấn luyện. Hãy bấm &quot;Bắt đầu Huấn luyện&quot; để vẽ biểu đồ.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 1 Cột bên phải: Bảng điều khiển Siêu tham số & Radar Lidar */}
                <div className="space-y-4">
                    {/* Cảm biến Radar LIDAR 8 hướng */}
                    <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                                <Compass className="w-4 h-4 text-cyan-400" />
                                Cảm biến 8 Hướng Lidar Radar
                            </h3>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                Max 8m
                            </span>
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-center text-xs">
                            {['Thẳng', 'Trước-Trái', 'Trái', 'Sau-Trái', 'Sau', 'Sau-Phải', 'Phải', 'Trước-Phải'].map((dir, idx) => {
                                const dist = liveState.lidar?.[idx] ?? 8.0
                                const isDanger = dist < 1.8
                                const isCaution = dist < 3.2
                                return (
                                    <div
                                        key={idx}
                                        className={`p-2 rounded-xl border transition ${
                                            isDanger
                                                ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                                                : isCaution
                                                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                                                : 'bg-zinc-800/40 border-zinc-700/40 text-cyan-400'
                                        }`}
                                    >
                                        <div className="text-[10px] text-zinc-400 truncate">{dir}</div>
                                        <div className="font-bold text-sm mt-0.5">{dist}m</div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Điều chỉnh Siêu tham số Hyperparameters */}
                    <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl space-y-4">
                        <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                            <Sliders className="w-4 h-4 text-indigo-400" />
                            Siêu tham số Huấn luyện (Hyperparameters)
                        </h3>

                        <div className="space-y-3 text-xs">
                            <div>
                                <div className="flex justify-between text-zinc-400 mb-1">
                                    <span>Số Episode:</span>
                                    <strong className="text-white">{episodes}</strong>
                                </div>
                                <input
                                    type="range"
                                    min="50"
                                    max="2000"
                                    step="50"
                                    value={episodes}
                                    onChange={(e) => setEpisodes(Number(e.target.value))}
                                    className="w-full accent-blue-500 cursor-pointer"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between text-zinc-400 mb-1">
                                    <span>Tốc độ Học (Learning Rate &alpha;):</span>
                                    <strong className="text-white">{learningRate}</strong>
                                </div>
                                <input
                                    type="range"
                                    min="0.05"
                                    max="0.5"
                                    step="0.01"
                                    value={learningRate}
                                    onChange={(e) => setLearningRate(Number(e.target.value))}
                                    className="w-full accent-blue-500 cursor-pointer"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between text-zinc-400 mb-1">
                                    <span>Hệ số Chiết khấu (Discount &gamma;):</span>
                                    <strong className="text-white">{discountFactor}</strong>
                                </div>
                                <input
                                    type="range"
                                    min="0.8"
                                    max="0.99"
                                    step="0.01"
                                    value={discountFactor}
                                    onChange={(e) => setDiscountFactor(Number(e.target.value))}
                                    className="w-full accent-blue-500 cursor-pointer"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between text-zinc-400 mb-1">
                                    <span>Độ trễ quan sát trực quan:</span>
                                    <strong className="text-white">{trainingSpeed === 0 ? 'Tốc độ tối đa' : `${trainingSpeed}s / bước`}</strong>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="0.05"
                                    step="0.005"
                                    value={trainingSpeed}
                                    onChange={(e) => setTrainingSpeed(Number(e.target.value))}
                                    className="w-full accent-blue-500 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Lưu trữ & Tải Chính sách (Policy Management) */}
                    <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl space-y-3">
                        <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                            <Save className="w-4 h-4 text-emerald-400" />
                            Lưu trữ Policy đã huấn luyện
                        </h3>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={policyName}
                                onChange={(e) => setPolicyName(e.target.value)}
                                placeholder="Tên file policy..."
                                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                            />
                            <button
                                onClick={handleSavePolicy}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition"
                            >
                                Lưu
                            </button>
                        </div>

                        {savedPolicies.length > 0 && (
                            <div className="space-y-1.5 pt-2">
                                <span className="text-[11px] text-zinc-400 font-medium">Policy có sẵn trong kho:</span>
                                <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                                    {savedPolicies.map((p) => (
                                        <div
                                            key={p.name}
                                            className="flex items-center justify-between p-2 rounded-xl bg-zinc-800/60 border border-zinc-700/40 text-xs"
                                        >
                                            <div>
                                                <div className="font-semibold text-white">{p.name}</div>
                                                <div className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                                                    {p.algorithm && (
                                                        <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-mono text-[9px] uppercase">
                                                            {p.algorithm}
                                                        </span>
                                                    )}
                                                    <span>{p.episodes} eps</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleLoadPolicy(p.name)}
                                                className="px-2 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-[11px] text-zinc-200"
                                            >
                                                Nạp
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal Xem Cấu hình Nạp Agent (Model, Tools, RL Navigation) */}
            <AgentInspectorModal
                isOpen={inspectorOpen}
                onClose={() => setInspectorOpen(false)}
                agent={selectedAgent}
                currentAlgorithm={selectedAlgorithm}
                mapName={selectedMap}
            />
        </div>
    )
}
