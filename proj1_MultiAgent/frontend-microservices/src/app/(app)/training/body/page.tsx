'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
    Activity,
    ArrowLeft,
    Bot,
    Compass,
    Cpu,
    Download,
    FastForward,
    Flame,
    Layers,
    Pause,
    Play,
    RotateCcw,
    Save,
    Settings2,
    SlidersHorizontal,
    Sparkles,
    TrendingUp,
    Zap,
    CircleCheck,
    TriangleAlert,
    ExternalLink,
} from 'lucide-react'
import LocomotionArena3D from '@/components/training/LocomotionArena3D'
import {
    createInitialQuadrupedState,
    extractObservation,
    stepPhysics,
    computeCPGPattern,
    ContinuousActorCriticPolicy,
    QuadrupedState,
    LocomotionTask,
    LocomotionAlgorithm,
    TrainingMetrics,
} from '@/lib/rl/locomotionEngine'
import { agentBodiesApi, CloudAgentBody } from '@/lib/api/agentBodies'
import { notify } from '@/lib/toast'

export default function BodyLocomotionTrainingPage() {
    // ─── Cấu hình Huấn luyện ──────────────────────────────────
    const [task, setTask] = useState<LocomotionTask>('stand')
    const [algorithm, setAlgorithm] = useState<LocomotionAlgorithm>('cpg_ppo')
    const [maxEpisodes, setMaxEpisodes] = useState<number>(300)
    const [learningRate, setLearningRate] = useState<number>(0.003)
    const [simSpeed, setSimSpeed] = useState<number>(1) // 1x, 2x, 5x, 10x
    const [selectedBodyId, setSelectedBodyId] = useState<string>('default_quadruped')
    const [cloudBodies, setCloudBodies] = useState<CloudAgentBody[]>([])

    // ─── Trạng thái Mô phỏng Thời gian thực ──────────────────
    const [robotState, setRobotState] = useState<QuadrupedState>(createInitialQuadrupedState())
    const [isTraining, setIsTraining] = useState<boolean>(false)
    const [metrics, setMetrics] = useState<TrainingMetrics>({
        episode: 1,
        step: 0,
        episodeReward: 0,
        bestReward: -999,
        forwardVelocity: 0,
        heightError: 0,
        tiltError: 0,
        torqueRms: 0,
        footContactRatio: 1.0,
        loss: 0.12,
        history: [],
    })

    const [trailPoints, setTrailPoints] = useState<[number, number, number][]>([])

    // Ref lưu policy và vòng lặp mô phỏng
    const policyRef = useRef<ContinuousActorCriticPolicy>(new ContinuousActorCriticPolicy(28, 8, 64))
    const stateRef = useRef<QuadrupedState>(createInitialQuadrupedState())
    const animFrameRef = useRef<number | null>(null)
    const isTrainingRef = useRef<boolean>(false)
    const simTimeRef = useRef<number>(0)
    const epRewardRef = useRef<number>(0)
    const currentEpisodeRef = useRef<number>(1)

    // Tải danh sách body custom từ Cloud nếu có
    useEffect(() => {
        agentBodiesApi
            .getBodies()
            .then((res) => {
                if (res?.data) {
                    setCloudBodies(res.data)
                }
            })
            .catch(() => {})
    }, [])

    // ─── Reset môi trường cho Episode mới ──────────────────────
    const resetEpisode = useCallback(() => {
        const fresh = createInitialQuadrupedState()
        stateRef.current = fresh
        setRobotState(fresh)
        epRewardRef.current = 0
        simTimeRef.current = 0
        setTrailPoints([])
    }, [])

    // ─── Vòng lặp Mô phỏng Động lực học (Physics Loop) ─────────
    const runSimulationStep = useCallback(() => {
        if (!isTrainingRef.current) return

        const stepsPerTick = simSpeed // Mô phỏng nhanh nhiều bước vật lý trong 1 frame
        const dt = 0.02

        for (let i = 0; i < stepsPerTick; i++) {
            simTimeRef.current += dt
            const curState = stateRef.current
            const obs = extractObservation(curState)

            // Lấy action từ Policy
            let actions = policyRef.current.forwardAction(obs, true)

            // Nếu dùng CPG, kết hợp nhịp oscillator
            let cpgOffsets: number[] | undefined = undefined
            if (algorithm === 'cpg_ppo') {
                cpgOffsets = task === 'walk' ? computeCPGPattern(simTimeRef.current) : undefined
            }

            // Bước tính vật lý
            const { nextState, reward, done } = stepPhysics(curState, actions, task, dt, cpgOffsets)
            stateRef.current = nextState
            epRewardRef.current += reward

            // Cập nhật policy weights theo reward signal
            policyRef.current.updateWeights(reward * 0.1, learningRate)

            // Kết thúc episode nếu ngã hoặc đạt 250 bước
            const epStep = (metrics.step % 250) + 1
            if (done || epStep >= 250) {
                const finalReward = epRewardRef.current
                currentEpisodeRef.current += 1

                setMetrics((prev) => {
                    const newBest = Math.max(prev.bestReward, finalReward)
                    const hist = [
                        ...prev.history.slice(-25),
                        {
                            episode: currentEpisodeRef.current,
                            reward: Math.round(finalReward * 10) / 10,
                            height: Math.round(nextState.posY * 100) / 100,
                            speed: Math.round(Math.max(0, nextState.velX) * 100) / 100,
                        },
                    ]
                    return {
                        ...prev,
                        episode: currentEpisodeRef.current,
                        episodeReward: Math.round(finalReward * 10) / 10,
                        bestReward: Math.round(newBest * 10) / 10,
                        history: hist,
                    }
                })

                resetEpisode()
                break
            }
        }

        // Cập nhật state hiển thị UI
        const s = stateRef.current
        setRobotState({ ...s })

        setMetrics((prev) => ({
            ...prev,
            step: prev.step + stepsPerTick,
            forwardVelocity: Math.round(Math.max(0, s.velX) * 100) / 100,
            heightError: Math.round(Math.abs(s.posY - 0.5) * 100) / 100,
            tiltError: Math.round(Math.hypot(s.roll, s.pitch) * (180 / Math.PI) * 10) / 10,
            footContactRatio: Math.round((s.footContacts.filter(Boolean).length / 4) * 100),
        }))

        // Lưu vết vạch đường đi
        if (Math.random() < 0.15) {
            setTrailPoints((prev) => [...prev.slice(-40), [s.posX, 0.01, s.posZ]])
        }

        animFrameRef.current = requestAnimationFrame(runSimulationStep)
    }, [simSpeed, algorithm, task, learningRate, metrics.step, resetEpisode])

    // Điều khiển Bắt đầu / Tạm dừng
    const toggleTraining = () => {
        if (isTraining) {
            isTrainingRef.current = false
            setIsTraining(false)
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
            notify.info('Đã tạm dừng mô phỏng huấn luyện.')
        } else {
            isTrainingRef.current = true
            setIsTraining(true)
            animFrameRef.current = requestAnimationFrame(runSimulationStep)
            notify.success(`Bắt đầu huấn luyện task: ${task.toUpperCase()} với thuật toán ${algorithm.toUpperCase()}`)
        }
    }

    // Đặt lại toàn bộ
    const handleResetAll = () => {
        isTrainingRef.current = false
        setIsTraining(false)
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        policyRef.current = new ContinuousActorCriticPolicy(28, 8, 64)
        currentEpisodeRef.current = 1
        setMetrics({
            episode: 1,
            step: 0,
            episodeReward: 0,
            bestReward: -999,
            forwardVelocity: 0,
            heightError: 0,
            tiltError: 0,
            torqueRms: 0,
            footContactRatio: 1.0,
            loss: 0.12,
            history: [],
        })
        resetEpisode()
        notify.success('Đã reset toàn bộ chỉ số và mạng nơ-ron.')
    }

    // Lưu chính sách vận động (Policy JSON)
    const handleSavePolicy = () => {
        const policyData = {
            task,
            algorithm,
            episodes: metrics.episode,
            bestReward: metrics.bestReward,
            actionDim: 8,
            stateDim: 28,
            weights: {
                w1_a: policyRef.current.w1_a,
                b1_a: policyRef.current.b1_a,
                w2_mu: policyRef.current.w2_mu,
                b2_mu: policyRef.current.b2_mu,
            },
            timestamp: new Date().toISOString(),
        }
        const blob = new Blob([JSON.stringify(policyData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `locomotion_policy_${task}_${algorithm}_ep${metrics.episode}.json`
        a.click()
        URL.revokeObjectURL(url)
        notify.success(`Đã lưu file chính sách locomotion_${task}.json thành công!`)
    }

    return (
        <div className="relative flex flex-col h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#07090e] text-white font-sans">
            {/* ===== THANH TIÊU ĐỀ TOP BAR ===== */}
            <header className="h-14 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur px-4 flex items-center justify-between gap-4 shrink-0 z-20">
                <div className="flex items-center gap-3 min-w-0">
                    <Link
                        href="/training"
                        className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition text-xs font-medium flex items-center gap-1.5"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>RL Nav (LIDAR)</span>
                    </Link>

                    <div className="h-4 w-px bg-zinc-800" />

                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-purple-950/60 border border-purple-500/40 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-purple-400" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="font-bold text-sm tracking-tight flex items-center gap-2">
                                <span>3D Body Locomotion RL Training</span>
                                <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-500/40 px-1.5 py-0.5 rounded font-mono">
                                    Continuous Action (8-DOF)
                                </span>
                            </h1>
                            <p className="text-[11px] text-zinc-400 truncate">
                                Huấn luyện động lực học vật lý cho Robot 4 chân: Tập đứng thăng bằng & bước đi nhịp nhàng
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs shrink-0">
                    <Link
                        href="/agent-body-studio"
                        className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-medium transition flex items-center gap-1.5"
                        title="Thiết kế thêm các khớp hoặc tinh chỉnh xương trong Body Studio"
                    >
                        <Layers className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Body Studio ↗</span>
                    </Link>

                    <button
                        onClick={handleSavePolicy}
                        className="px-3 py-1.5 rounded-xl bg-purple-950/80 hover:bg-purple-900/80 text-purple-200 border border-purple-500/40 font-medium transition flex items-center gap-1.5"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>Lưu Policy</span>
                    </button>

                    <button
                        onClick={handleResetAll}
                        className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
                        title="Đặt lại toàn bộ"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                        onClick={toggleTraining}
                        className={`px-4 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 shadow-lg transition ${
                            isTraining
                                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
                                : 'bg-[#76b900] hover:bg-[#8bd400] text-black shadow-lime-500/25'
                        }`}
                    >
                        {isTraining ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        <span>{isTraining ? 'Tạm Dừng' : 'Bắt Đầu Huấn Luyện'}</span>
                    </button>
                </div>
            </header>

            {/* ===== KHU VỰC CHÍNH 3 CỘT ===== */}
            <div className="flex flex-1 min-h-0 relative">
                {/* 1. CỘT TRÁI: CẤU HÌNH NHIỆM VỤ & SIÊU THAM SỐ */}
                <aside className="w-80 border-r border-zinc-800 bg-zinc-900/50 backdrop-blur flex flex-col shrink-0 z-10 overflow-y-auto">
                    {/* Mục Nhiệm vụ huấn luyện */}
                    <div className="p-3.5 border-b border-zinc-800 space-y-2.5">
                        <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                            <Compass className="w-4 h-4 text-purple-400" />
                            Nhiệm Vụ Vận Động (Task)
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: 'stand', label: 'Tập Đứng Thẳng', desc: 'Giữ thăng bằng h=0.5m, triệt tiêu rung lắc' },
                                { id: 'walk', label: 'Tập Bước Đi (Trot)', desc: 'Phối hợp nhịp chéo 4 chân tiến tới +X' },
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setTask(item.id as LocomotionTask)
                                        resetEpisode()
                                    }}
                                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                                        task === item.id
                                            ? 'bg-purple-950/60 border-purple-500 text-white ring-1 ring-purple-500/50'
                                            : 'bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                                    }`}
                                >
                                    <span className="text-xs font-bold">{item.label}</span>
                                    <span className="text-[10px] text-zinc-500 mt-1 line-clamp-2">{item.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mục Thuật toán RL */}
                    <div className="p-3.5 border-b border-zinc-800 space-y-2.5">
                        <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-cyan-400" />
                            Thuật Toán Huấn Luyện
                        </div>
                        <div className="space-y-1.5">
                            {[
                                {
                                    id: 'cpg_ppo',
                                    name: 'CPG + PPO Hybrid (Khuyên dùng)',
                                    tag: 'State-of-the-Art',
                                    desc: 'Phát nhịp bước đi cơ sở kết hợp PPO tinh chỉnh bù trừ địa hình',
                                },
                                {
                                    id: 'ppo',
                                    name: 'Continuous PPO (Gaussian Policy)',
                                    tag: 'On-Policy',
                                    desc: 'Tối ưu hoá chính sách cắt tỉa tỉ lệ, tính ổn định cao',
                                },
                                {
                                    id: 'sac',
                                    name: 'Continuous SAC (Soft Actor-Critic)',
                                    tag: 'Off-Policy',
                                    desc: 'Tối đa hoá Entropy, học khám phá dáng đi tự nhiên linh hoạt',
                                },
                            ].map((algo) => (
                                <button
                                    key={algo.id}
                                    onClick={() => setAlgorithm(algo.id as LocomotionAlgorithm)}
                                    className={`w-full p-2.5 rounded-xl border text-left transition ${
                                        algorithm === algo.id
                                            ? 'bg-cyan-950/40 border-cyan-500 text-white ring-1 ring-cyan-500/40'
                                            : 'bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold">{algo.name}</span>
                                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                                            {algo.tag}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 mt-1">{algo.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mục Mẫu Robot Body */}
                    <div className="p-3.5 border-b border-zinc-800 space-y-2">
                        <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                            <Bot className="w-4 h-4 text-[#76b900]" />
                            Mẫu Body Khớp Động Học
                        </div>
                        <select
                            value={selectedBodyId}
                            onChange={(e) => setSelectedBodyId(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 outline-none focus:border-[#76b900]"
                        >
                            <option value="default_quadruped">Quadruped Dog Robot (Mặc định 8-DOF)</option>
                            {cloudBodies.map((b) => (
                                <option key={b.bodyId} value={b.bodyId}>
                                    {b.name} ({b.joints.length} khớp - {b.category})
                                </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-zinc-500">
                            Khớp điều khiển: 4 hông (Hip roll/pitch) + 4 gối (Knee) cùng 4 cảm biến tiếp xúc mặt đất.
                        </p>
                    </div>

                    {/* Siêu tham số & Tốc độ mô phỏng */}
                    <div className="p-3.5 space-y-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                            <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                            Siêu Tham Số & Tốc Độ Mô Phỏng
                        </div>

                        {/* Tốc độ mô phỏng */}
                        <div>
                            <span className="text-[11px] text-zinc-400 block mb-1.5">Tốc độ chạy mô phỏng vật lý:</span>
                            <div className="grid grid-cols-4 gap-1.5">
                                {[1, 2, 5, 10].map((spd) => (
                                    <button
                                        key={spd}
                                        onClick={() => setSimSpeed(spd)}
                                        className={`py-1.5 rounded-lg border text-xs font-mono font-bold transition ${
                                            simSpeed === spd
                                                ? 'bg-amber-500 text-black border-amber-400'
                                                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                                        }`}
                                    >
                                        {spd}x
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Learning Rate */}
                        <div>
                            <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                                <span>Tốc độ học (Learning Rate):</span>
                                <span className="font-mono text-cyan-300">{learningRate}</span>
                            </div>
                            <input
                                type="range"
                                min={0.0005}
                                max={0.01}
                                step={0.0005}
                                value={learningRate}
                                onChange={(e) => setLearningRate(parseFloat(e.target.value))}
                                className="w-full accent-cyan-400 h-1 bg-zinc-800 rounded-lg cursor-pointer"
                            />
                        </div>

                        {/* Ghi chú về Vật lý */}
                        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 text-[11px] text-zinc-400 space-y-1.5">
                            <div className="font-bold text-zinc-200 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                Động lực học & Ma sát:
                            </div>
                            <p className="text-[10px] leading-relaxed">
                                • Sàn có hệ số ma sát Coulomb $\mu = 0.8$.
                                <br />
                                • Trọng lực thực tế $g = 9.81 m/s^2$, khối lượng thân $8.5 kg$.
                                <br />
                                • Lực lò xo hồi tiếp động cơ $Kp = 75 Nm/rad$, giảm chấn $Kd = 4.5$.
                            </p>
                        </div>
                    </div>
                </aside>

                {/* 2. CỘT GIỮA: 3D PHYSICS VIEWPORT */}
                <div className="flex-1 relative min-w-0 min-h-0">
                    <LocomotionArena3D
                        state={robotState}
                        task={task}
                        targetHeight={0.5}
                        trailPoints={trailPoints}
                        robotColor="#76b900"
                    />
                </div>

                {/* 3. CỘT PHẢI: TELEMETRY THỜI GIAN THỰC & ĐỒ THỊ */}
                <aside className="w-80 border-l border-zinc-800 bg-zinc-900/50 backdrop-blur flex flex-col shrink-0 z-10 overflow-y-auto p-3.5 space-y-4">
                    {/* Bảng chỉ số chính */}
                    <div className="space-y-2">
                        <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <Activity className="w-4 h-4 text-emerald-400" />
                                Chỉ Số Huấn Luyện
                            </span>
                            <span className="text-[10px] font-mono text-zinc-500">Live Telemetry</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                                <span className="text-[10px] text-zinc-500 uppercase block">Episode</span>
                                <strong className="text-lg font-mono text-white">{metrics.episode}</strong>
                            </div>
                            <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                                <span className="text-[10px] text-zinc-500 uppercase block">Reward Hiện Tại</span>
                                <strong className={`text-lg font-mono ${metrics.episodeReward >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {metrics.episodeReward}
                                </strong>
                            </div>
                            <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                                <span className="text-[10px] text-zinc-500 uppercase block">Reward Cao Nhất</span>
                                <strong className="text-lg font-mono text-amber-400">
                                    {metrics.bestReward === -999 ? '---' : metrics.bestReward}
                                </strong>
                            </div>
                            <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                                <span className="text-[10px] text-zinc-500 uppercase block">Tốc Độ Tiến (v_x)</span>
                                <strong className="text-lg font-mono text-cyan-400">{metrics.forwardVelocity} m/s</strong>
                            </div>
                        </div>
                    </div>

                    {/* Trạng thái Thăng Bằng & Độ Cao */}
                    <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5 text-xs">
                        <div className="font-semibold text-zinc-300 flex items-center justify-between">
                            <span>Độ Thăng Bằng & Ổn Định:</span>
                            {robotState.isFallen ? (
                                <span className="text-rose-400 font-bold flex items-center gap-1">
                                    <TriangleAlert className="w-3.5 h-3.5" /> Bị Ngã
                                </span>
                            ) : (
                                <span className="text-emerald-400 font-bold flex items-center gap-1">
                                    <CircleCheck className="w-3.5 h-3.5" /> Thăng Bằng
                                </span>
                            )}
                        </div>

                        <div className="space-y-1.5 font-mono text-[11px]">
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Độ cao thân z:</span>
                                <span className="text-zinc-200">{robotState.posY.toFixed(3)} m (chuẩn: 0.50m)</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Sai số độ nghiêng (Tilt):</span>
                                <span className="text-zinc-200">{metrics.tiltError}°</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Chân chạm đất:</span>
                                <span className="text-emerald-400">{metrics.footContactRatio}% (4/4)</span>
                            </div>
                        </div>
                    </div>

                    {/* Đồ thị Reward qua các Episode */}
                    <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                        <div className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <TrendingUp className="w-4 h-4 text-cyan-400" />
                                Đường Cong Hội Tụ Reward
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">25 ep gần nhất</span>
                        </div>

                        {metrics.history.length === 0 ? (
                            <div className="h-28 flex items-center justify-center text-xs text-zinc-600 border border-dashed border-zinc-800 rounded-xl">
                                Đang chờ hoàn thành Episode đầu tiên...
                            </div>
                        ) : (
                            <div className="h-28 flex items-end gap-1 pt-2 border-b border-zinc-800">
                                {metrics.history.map((h, idx) => {
                                    const minR = -20
                                    const maxR = 80
                                    const norm = Math.max(5, Math.min(100, ((h.reward - minR) / (maxR - minR)) * 100))
                                    return (
                                        <div
                                            key={idx}
                                            className="flex-1 bg-gradient-to-t from-cyan-600 to-emerald-400 rounded-t transition-all"
                                            style={{ height: `${norm}%` }}
                                            title={`Ep ${h.episode}: Reward ${h.reward} (Cao ${h.height}m - ${h.speed}m/s)`}
                                        />
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Lời khuyên huấn luyện */}
                    <div className="p-3 rounded-2xl bg-purple-950/20 border border-purple-500/30 text-[11px] text-zinc-300 space-y-1">
                        <div className="font-bold text-purple-300 flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-purple-400" />
                            Chiến lược Locomotion:
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-relaxed">
                            1. Để robot học tốt nhất, hãy bắt đầu với <strong>Tập Đứng Thẳng</strong> khoảng 150 episodes.
                            <br />
                            2. Khi robot giữ được độ cao vững chắc, chuyển sang <strong>Tập Bước Đi (Trot)</strong> để học tiến về trước.
                        </p>
                    </div>
                </aside>
            </div>
        </div>
    )
}

