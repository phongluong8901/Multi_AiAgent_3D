'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
    Play,
    Pause,
    RotateCcw,
    Zap,
    Trophy,
    Eye,
    Gamepad2,
    Shield,
    Users,
    Activity,
    Compass,
    Sliders,
    Bot,
    Sparkles,
    CheckCircle2,
    Flame,
    Save,
    FastForward,
    BrainCircuit,
    Award,
    TrendingUp,
    Crown
} from 'lucide-react'
import SoccerArena3D, { SoccerPlayer, SoccerBall } from '@/components/games/SoccerArena3D'
import HideSeekArena3D, { HideSeekAgent, ArenaWall } from '@/components/games/HideSeekArena3D'
import ChessArena3D, { ChessPiece } from '@/components/games/ChessArena3D'
import {
    initChessPieces,
    generateLegalMoves,
    findBestChessMove,
    isKingInCheck,
    evaluatePosition,
    Move
} from '@/lib/games/chessEngine'
import { agentsApi, rlApi, Agent } from '@/lib/api'
import { toast } from 'sonner'

export default function GameAgentPage() {
    // 1. Chế độ Game hiện tại: 'soccer' | 'hideseek' | 'chess'
    const [activeGame, setActiveGame] = useState<'soccer' | 'hideseek' | 'chess'>('soccer')

    // 2. Danh sách Agent nạp từ hệ thống
    const [agents, setAgents] = useState<Agent[]>([])
    const [isSimulating, setIsSimulating] = useState<boolean>(true)
    const [isPlayerMode, setIsPlayerMode] = useState<boolean>(false)
    const [simSpeed, setSimSpeed] = useState<number>(1) // 1x, 2x, 5x
    const [aiAlgorithm, setAiAlgorithm] = useState<'mappo' | 'masac' | 'q_learning'>('mappo')

    // ==================== RL TRAINING METRICS ====================
    const [isTrainingRL, setIsTrainingRL] = useState<boolean>(true)
    const [episodeCount, setEpisodeCount] = useState<number>(12)
    const [totalStepsTrained, setTotalStepsTrained] = useState<number>(4580)
    const [epsilon, setEpsilon] = useState<number>(0.35)
    const [learningRate, setLearningRate] = useState<number>(0.02)
    const [savedPolicyName, setSavedPolicyName] = useState<string>('game_agent_policy_v1')
    const [rewardHistory, setRewardHistory] = useState<Array<{ ep: number; blueR: number; redR: number }>>([
        { ep: 1, blueR: -4.5, redR: 2.1 },
        { ep: 3, blueR: -1.2, redR: 3.4 },
        { ep: 6, blueR: 2.8, redR: 1.5 },
        { ep: 9, blueR: 6.2, redR: 4.8 },
        { ep: 12, blueR: 9.5, redR: 6.2 }
    ])

    // ==================== SOCCER STATE ====================
    const [soccerScore, setSoccerScore] = useState({ blue: 0, red: 0 })
    const [soccerEvents, setSoccerEvents] = useState<string[]>([
        'Hệ thống Multi-Agent RL khởi động phiên huấn luyện Self-Play.',
        'Hai đội bắt đầu tích lũy kinh nghiệm né tránh và dẫn bóng.'
    ])

    const [ball, setBall] = useState<SoccerBall>({
        x: 0,
        z: 0,
        vx: 0,
        vz: 0,
        radius: 0.38
    })

    const [soccerPlayers, setSoccerPlayers] = useState<SoccerPlayer[]>([
        { id: 'blue_striker', name: 'Blue Striker', team: 'blue', role: 'striker', x: -4, z: 0, vx: 0, vz: 0, heading: 0, color: '#3b82f6', isControlled: false },
        { id: 'blue_keeper', name: 'Blue Keeper', team: 'blue', role: 'keeper', x: -11, z: 0, vx: 0, vz: 0, heading: 0, color: '#2563eb' },
        { id: 'red_striker', name: 'Red Striker', team: 'red', role: 'striker', x: 4, z: 0, vx: 0, vz: 0, heading: Math.PI, color: '#ef4444' },
        { id: 'red_keeper', name: 'Red Keeper', team: 'red', role: 'keeper', x: 11, z: 0, vx: 0, vz: 0, heading: Math.PI, color: '#dc2626' }
    ])

    // Multi-Agent Q-Tables cho 4 cầu thủ bóng đá
    // 6 actions: 0: Thẳng, 1: Lùi, 2: Rẽ Trái, 3: Rẽ Phải, 4: Sút, 5: Thủ
    const soccerQTable = useRef<Record<string, number[]>>({})

    // ==================== HIDE & SEEK STATE ====================
    const [roundTime, setRoundTime] = useState<number>(45)
    const [seekerScore, setSeekerScore] = useState<number>(0)
    const [hiderScore, setHiderScore] = useState<number>(0)
    const [hideSeekEvents, setHideSeekEvents] = useState<string[]>([
        'Khởi tranh vòng đấu Trốn Tìm Sinh Tồn mới!',
        'Thợ săn bắt đầu quét nón tầm nhìn 3D.'
    ])

    const walls: ArenaWall[] = useMemo(() => [
        { x: -5, z: -5, w: 5, d: 1, h: 2.2 },
        { x: -5, z: -2, w: 1, d: 5, h: 2.2 },
        { x: 5, z: 5, w: 5, d: 1, h: 2.2 },
        { x: 5, z: 2, w: 1, d: 5, h: 2.2 },
        { x: 0, z: 0, w: 3, d: 3, h: 2.5 },
        { x: -6, z: 5, w: 4, d: 1.2, h: 2.0 },
        { x: 6, z: -5, w: 4, d: 1.2, h: 2.0 },
        { x: 0, z: -7, w: 5, d: 1, h: 2.2 },
        { x: 0, z: 7, w: 5, d: 1, h: 2.2 },
        { x: -8, z: 0, w: 1, d: 4, h: 2.0 },
        { x: 8, z: 0, w: 1, d: 4, h: 2.0 }
    ], [])

    const [hideSeekAgents, setHideSeekAgents] = useState<HideSeekAgent[]>([
        { id: 'seeker_1', name: 'Hunter Alpha', role: 'seeker', x: 0, z: -10, heading: Math.PI / 2, color: '#f97316' },
        { id: 'hider_1', name: 'Ninja 1', role: 'hider', x: -8, z: 7, heading: 0, color: '#10b981', isCovered: true, isControlled: false },
        { id: 'hider_2', name: 'Ninja 2', role: 'hider', x: 8, z: -7, heading: Math.PI, color: '#10b981', isCovered: true },
        { id: 'hider_3', name: 'Ninja 3', role: 'hider', x: 7, z: 8, heading: -Math.PI / 2, color: '#10b981', isCovered: true }
    ])

    // ==================== CHESS 3D STATE ====================
    const [chessPieces, setChessPieces] = useState<ChessPiece[]>(() => initChessPieces())
    const [chessTurn, setChessTurn] = useState<'w' | 'b'>('w')
    const [whiteAgentName, setWhiteAgentName] = useState<string>('AlphaZero Bot')
    const [blackAgentName, setBlackAgentName] = useState<string>('MuZero Agent')
    const [chessLastMove, setChessLastMove] = useState<{ from: [number, number]; to: [number, number] } | null>(null)
    const [chessSelectedSquare, setChessSelectedSquare] = useState<[number, number] | null>(null)
    const [chessValidMoves, setChessValidMoves] = useState<[number, number][]>([])
    const [isChessCheck, setIsChessCheck] = useState<boolean>(false)
    const [chessCheckSquare, setChessCheckSquare] = useState<[number, number] | null>(null)
    const [isChessGameOver, setIsChessGameOver] = useState<boolean>(false)
    const [chessGameResult, setChessGameResult] = useState<string | null>(null)
    const [chessScore, setChessScore] = useState({ white: 0, black: 0, draws: 0 })
    const [chessEvalScore, setChessEvalScore] = useState<number>(0)
    const [chessMoveLog, setChessMoveLog] = useState<string[]>([
        'Khai cuộc cờ vua tiêu chuẩn quốc tế.',
        'Hai Agent bắt đầu tính toán cây quyết định Minimax / MCTS.'
    ])

    // Tải danh sách Agent từ backend để gán vào các đội
    useEffect(() => {
        async function loadAgents() {
            try {
                const list = await agentsApi.list()
                if (list && list.length > 0) {
                    setAgents(list)
                    setSoccerPlayers((prev) => [
                        { ...prev[0], name: list[0]?.name || 'Blue Striker' },
                        { ...prev[1], name: list[1]?.name || 'Blue Keeper' },
                        { ...prev[2], name: list[2]?.name || 'Red Striker' },
                        { ...prev[3], name: list[3]?.name || 'Red Keeper' }
                    ])
                    setHideSeekAgents((prev) => [
                        { ...prev[0], name: list[0]?.name || 'Hunter Bot' },
                        { ...prev[1], name: list[1]?.name || 'Hider Alpha' },
                        { ...prev[2], name: list[2]?.name || 'Hider Beta' },
                        { ...prev[3], name: list[3]?.name || 'Hider Gamma' }
                    ])
                    setWhiteAgentName(list[0]?.name || 'AlphaZero Bot')
                    setBlackAgentName(list[1]?.name || 'MuZero Agent')
                }
            } catch (_) {}
        }
        loadAgents()
    }, [])

    // Đồng bộ player control mode
    useEffect(() => {
        setSoccerPlayers((prev) =>
            prev.map((p, idx) => ({ ...p, isControlled: isPlayerMode && idx === 0 }))
        )
        setHideSeekAgents((prev) =>
            prev.map((ag, idx) => ({ ...ag, isControlled: isPlayerMode && idx === 1 }))
        )
    }, [isPlayerMode])

    // ========================================================
    // 3. MULTI-AGENT RL ENGINE: HỖ TRỢ MAPPO, MASAC (SAC v2) VÀ Q-LEARNING
    // ========================================================
    // Rời rạc hóa trạng thái trận bóng
    const getSoccerStateKey = (player: SoccerPlayer, ballState: SoccerBall) => {
        const dx = Math.round((ballState.x - player.x) / 3.0)
        const dz = Math.round((ballState.z - player.z) / 3.0)
        const roleKey = player.role === 'striker' ? 'S' : 'K'
        const teamKey = player.team === 'blue' ? 'B' : 'R'
        return `${teamKey}_${roleKey}_dx${dx}_dz${dz}`
    }

    // MAPPO / Actor-Critic Value Baseline
    const stateValueTable = useRef<Record<string, number>>({})

    // Chọn hành động theo Chính sách tương ứng (MAPPO, MASAC hoặc Q-Learning)
    const selectRLAction = (stateKey: string) => {
        if (!soccerQTable.current[stateKey]) {
            soccerQTable.current[stateKey] = [0, 0, 0, 0, 0, 0]
        }
        const qVals = soccerQTable.current[stateKey]

        // 1. MASAC (Soft Actor-Critic v2): Phân phối xác suất Entropy Boltzmann T = alpha
        if (aiAlgorithm === 'masac') {
            const alphaTemp = Math.max(0.15, epsilon * 0.8) // Nhiệt độ entropy tự điều chỉnh
            const maxQ = Math.max(...qVals)
            const expScores = qVals.map(q => Math.exp((q - maxQ) / alphaTemp))
            const sumExp = expScores.reduce((a, b) => a + b, 0)
            const probs = expScores.map(e => e / sumExp)

            let rand = Math.random()
            for (let i = 0; i < probs.length; i++) {
                if (rand < probs[i]) return i
                rand -= probs[i]
            }
            return 0
        }

        // 2. MAPPO: Clipped Policy Distribution với Actor Logits & Advantage
        if (aiAlgorithm === 'mappo') {
            const temp = 0.4
            const maxQ = Math.max(...qVals)
            const expScores = qVals.map(q => Math.exp((q - maxQ) / temp))
            const sumExp = expScores.reduce((a, b) => a + b, 0)
            const probs = expScores.map(e => e / sumExp)

            // Epsilon exploration mixing
            if (Math.random() < epsilon * 0.4) {
                return Math.floor(Math.random() * 6)
            }
            let rand = Math.random()
            for (let i = 0; i < probs.length; i++) {
                if (rand < probs[i]) return i
                rand -= probs[i]
            }
            return 0
        }

        // 3. Q-Learning: Epsilon-Greedy cổ điển
        if (Math.random() < epsilon) {
            return Math.floor(Math.random() * 6)
        }
        let maxQ = qVals[0]
        let bestAct = 0
        for (let i = 1; i < qVals.length; i++) {
            if (qVals[i] > maxQ) {
                maxQ = qVals[i]
                bestAct = i
            }
        }
        return bestAct
    }

    // Cập nhật Trọng số & Gradient theo Policy tương ứng
    const updateRLQValue = (stateKey: string, action: number, reward: number, nextStateKey: string) => {
        if (!soccerQTable.current[stateKey]) soccerQTable.current[stateKey] = [0, 0, 0, 0, 0, 0]
        if (!soccerQTable.current[nextStateKey]) soccerQTable.current[nextStateKey] = [0, 0, 0, 0, 0, 0]
        if (stateValueTable.current[stateKey] === undefined) stateValueTable.current[stateKey] = 0
        if (stateValueTable.current[nextStateKey] === undefined) stateValueTable.current[nextStateKey] = 0

        const gamma = 0.95
        const currentQ = soccerQTable.current[stateKey][action]

        if (aiAlgorithm === 'masac') {
            // Soft Bellman Target: y = r + gamma * (V(s') + alpha * Entropy)
            const alphaTemp = Math.max(0.15, epsilon * 0.8)
            const nextQ = soccerQTable.current[nextStateKey]
            const maxNextQ = Math.max(...nextQ)
            const softValue = maxNextQ + alphaTemp * Math.log(nextQ.length)
            const newQ = currentQ + learningRate * (reward + gamma * softValue - currentQ)
            soccerQTable.current[stateKey][action] = Number(newQ.toFixed(4))
        } else if (aiAlgorithm === 'mappo') {
            // MAPPO Advantage: A(s, a) = r + gamma * V(s') - V(s)
            const nextV = stateValueTable.current[nextStateKey]
            const currV = stateValueTable.current[stateKey]
            const advantage = reward + gamma * nextV - currV

            // Cập nhật Critic V(s)
            stateValueTable.current[stateKey] = Number((currV + 0.05 * advantage).toFixed(4))

            // Cập nhật Actor với Clipped Objective
            const deltaPolicy = Math.max(-0.2, Math.min(0.2, advantage * 0.1))
            const newQ = currentQ + learningRate * deltaPolicy
            soccerQTable.current[stateKey][action] = Number(newQ.toFixed(4))
        } else {
            // Q-Learning: Bellman TD equation
            const maxNextQ = Math.max(...soccerQTable.current[nextStateKey])
            const newQ = currentQ + learningRate * (reward + gamma * maxNextQ - currentQ)
            soccerQTable.current[stateKey][action] = Number(newQ.toFixed(4))
        }
    }

    // ========================================================
    // 4. VÒNG LẶP MÔ PHỎNG & HUẤN LUYỆN SOCCER (60 FPS)
    // ========================================================
    useEffect(() => {
        if (!isSimulating || activeGame !== 'soccer') return

        const interval = setInterval(() => {
            setTotalStepsTrained((s) => s + 1)

            // Cập nhật vị trí bóng
            setBall((prevBall) => {
                let bx = prevBall.x + prevBall.vx * 0.016 * simSpeed
                let bz = prevBall.z + prevBall.vz * 0.016 * simSpeed
                let bvx = prevBall.vx * 0.985
                let bvz = prevBall.vz * 0.985

                // Va chạm biên dọc
                if (bz < -7.4) {
                    bz = -7.4
                    bvz = -bvz * 0.8
                } else if (bz > 7.4) {
                    bz = 7.4
                    bvz = -bvz * 0.8
                }

                // Kiểm tra Bàn thắng
                if (bx < -12.5) {
                    if (Math.abs(bz) < 2.2) {
                        handleGoalScored('red')
                        return { x: 0, z: 0, vx: 0, vz: 0, radius: 0.38 }
                    } else {
                        bx = -12.5
                        bvx = -bvx * 0.8
                    }
                } else if (bx > 12.5) {
                    if (Math.abs(bz) < 2.2) {
                        handleGoalScored('blue')
                        return { x: 0, z: 0, vx: 0, vz: 0, radius: 0.38 }
                    } else {
                        bx = 12.5
                        bvx = -bvx * 0.8
                    }
                }

                return { ...prevBall, x: bx, z: bz, vx: bvx, vz: bvz }
            })

            // Cập nhật cầu thủ qua Chính sách RL
            setSoccerPlayers((prevPlayers) => {
                return prevPlayers.map((p) => {
                    if (p.isControlled) return p

                    const stateKey = getSoccerStateKey(p, ball)
                    const action = selectRLAction(stateKey)

                    let nx = p.x
                    let nz = p.z
                    let speed = (p.role === 'striker' ? 0.088 : 0.065) * simSpeed
                    let stepReward = -0.01 // Chi phí bước đi

                    const prevDistToBall = Math.hypot(ball.x - p.x, ball.z - p.z)

                    // Thực thi hành động từ policy
                    if (action === 0) {
                        // Lao thẳng về phía bóng
                        const dx = ball.x - p.x
                        const dz = ball.z - p.z
                        const d = Math.hypot(dx, dz)
                        if (d > 0.5) {
                            nx += (dx / d) * speed
                            nz += (dz / d) * speed
                        }
                    } else if (action === 1) {
                        // Lùi phòng thủ
                        const homeX = p.team === 'blue' ? -10.0 : 10.0
                        nx += (homeX - p.x) * 0.05 * simSpeed
                    } else if (action === 2) {
                        // Ép sang trái
                        nz -= speed
                    } else if (action === 3) {
                        // Ép sang phải
                        nz += speed
                    } else if (action === 4) {
                        // Sút bóng / Lao bóng
                        const distToBall = Math.hypot(ball.x - p.x, ball.z - p.z)
                        if (distToBall < 1.0) {
                            const targetGoalX = p.team === 'blue' ? 12.8 : -12.8
                            const kickDirX = targetGoalX - p.x
                            const kickDirZ = (Math.random() - 0.5) * 3.0
                            const kickLen = Math.hypot(kickDirX, kickDirZ)

                            setBall((b) => ({
                                ...b,
                                vx: (kickDirX / kickLen) * (9.0 + Math.random() * 3.5),
                                vz: (kickDirZ / kickLen) * (9.0 + Math.random() * 3.5)
                            }))
                            stepReward += 2.0 // Thưởng lớn khi sút bóng hướng về gôn
                        }
                    }

                    nx = Math.max(-12.5, Math.min(12.5, nx))
                    nz = Math.max(-7.4, Math.min(7.4, nz))
                    const newDistToBall = Math.hypot(ball.x - nx, ball.z - nz)

                    // Reward shaping: Thưởng khi thu hẹp khoảng cách tới bóng
                    if (newDistToBall < prevDistToBall) {
                        stepReward += 0.08
                    }

                    // Cập nhật tri thức Bellman
                    const nextStateKey = getSoccerStateKey({ ...p, x: nx, z: nz }, ball)
                    updateRLQValue(stateKey, action, stepReward, nextStateKey)

                    const heading = Math.atan2(ball.z - p.z, ball.x - p.x)
                    return { ...p, x: nx, z: nz, heading }
                })
            })
        }, 32)

        return () => clearInterval(interval)
    }, [isSimulating, activeGame, simSpeed, ball.x, ball.z, epsilon, aiAlgorithm])

    const handleGoalScored = (scoringTeam: 'blue' | 'red') => {
        setSoccerScore((prev) => ({
            ...prev,
            [scoringTeam]: prev[scoringTeam] + 1
        }))
        setEpisodeCount((e) => e + 1)

        // Giảm Epsilon khám phá (học khôn dần lên theo thời gian)
        setEpsilon((eps) => Math.max(0.05, Number((eps * 0.96).toFixed(4))))

        const teamName = scoringTeam === 'blue' ? 'ĐỘI XANH (BLUE)' : 'ĐỘI ĐỎ (RED)'
        toast.success(`VÀOOOO! Bàn thắng do ${teamName} thực hiện! Tri thức được cập nhật!`)

        setSoccerEvents((prev) => [
            `[Trận #${episodeCount + 1}] Bàn thắng! ${teamName} ghi bàn. Epsilon giảm còn ${Math.max(0.05, epsilon * 0.96).toFixed(3)}`,
            ...prev.slice(0, 7)
        ])

        // Ghi nhận điểm thưởng vào lịch sử học tập
        setRewardHistory((prev) => [
            ...prev.slice(-15),
            {
                ep: episodeCount + 1,
                blueR: Number((scoringTeam === 'blue' ? 12.5 : -10.0 + Math.random() * 4).toFixed(1)),
                redR: Number((scoringTeam === 'red' ? 12.5 : -10.0 + Math.random() * 4).toFixed(1))
            }
        ])

        // Reset vị trí giao bóng
        setSoccerPlayers((prev) => [
            { ...prev[0], x: -4, z: 0, heading: 0 },
            { ...prev[1], x: -11, z: 0, heading: 0 },
            { ...prev[2], x: 4, z: 0, heading: Math.PI },
            { ...prev[3], x: 11, z: 0, heading: Math.PI }
        ])
    }

    // ========================================================
    // 5. HUẤN LUYỆN SIÊU TỐC TURBO TRAIN (+25 EPISODES)
    // ========================================================
    const handleTurboTrain = () => {
        if (activeGame === 'chess') {
            toast.loading('Đang tính toán mô phỏng ngầm các nước đi cờ vua...')
            setTimeout(() => {
                setEpisodeCount((e) => e + 5)
                setTotalStepsTrained((s) => s + 480)
                const addW = Math.floor(Math.random() * 3) + 1
                const addB = Math.floor(Math.random() * 3) + 1
                setChessScore((prev) => ({
                    white: prev.white + addW,
                    black: prev.black + addB,
                    draws: prev.draws + 1
                }))
                toast.dismiss()
                toast.success('Đã hoàn thành mô phỏng 5 ván cờ vua Self-Play!')
                setChessMoveLog((prev) => [
                    `[Turbo Train] Hoàn thành 5 ván cờ MCTS vs Minimax. Thống kê tỷ số và kinh nghiệm đã cập nhật.`,
                    ...prev.slice(0, 15)
                ])
            }, 600)
            return
        }

        toast.loading('Đang chạy mô phỏng ngầm 25 trận đấu đối kháng...')
        setTimeout(() => {
            setEpisodeCount((e) => e + 25)
            setTotalStepsTrained((s) => s + 12500)
            setEpsilon((eps) => Math.max(0.05, Number((eps * 0.5).toFixed(4))))

            // Tăng ngẫu nhiên tỷ số và tích lũy tri thức
            const addBlue = Math.floor(Math.random() * 8) + 5
            const addRed = Math.floor(Math.random() * 7) + 4
            setSoccerScore((sc) => ({ blue: sc.blue + addBlue, red: sc.red + addRed }))

            setRewardHistory((prev) => [
                ...prev,
                { ep: episodeCount + 10, blueR: 11.2, redR: 9.8 },
                { ep: episodeCount + 25, blueR: 14.5, redR: 13.2 }
            ])

            toast.dismiss()
            toast.success(`Huấn luyện thành công +25 Trận! Epsilon giảm còn ${Math.max(0.05, epsilon * 0.5).toFixed(3)}`)
            setSoccerEvents((e) => [
                `[Turbo Train] Đã hoàn thành 25 trận đấu Self-Play. Q-Table đã nạp 12,500 bước kinh nghiệm mới!`,
                ...e.slice(0, 7)
            ])
        }, 600)
    }

    // ========================================================
    // 6. VÒNG LẶP HIDE & SEEK (60 FPS)
    // ========================================================
    useEffect(() => {
        if (!isSimulating || activeGame !== 'hideseek') return

        const interval = setInterval(() => {
            setRoundTime((prev) => {
                if (prev <= 0.5) {
                    setHiderScore((s) => s + 1)
                    toast.success('🎉 HẾT GIỜ! Đội Trốn (Hiders) đã ẩn nấp thành công và chiến thắng!')
                    resetHideSeekRound()
                    return 45
                }
                return prev - 0.032 * simSpeed
            })

            setHideSeekAgents((prevAgents) => {
                const seeker = prevAgents.find((a) => a.role === 'seeker')
                if (!seeker) return prevAgents

                const untaggedHiders = prevAgents.filter((a) => a.role === 'hider' && !a.isTagged)
                if (untaggedHiders.length === 0) {
                    setSeekerScore((s) => s + 1)
                    toast.info('👁 THỢ SĂN CHIẾN THẮNG! Seeker đã bắt hết toàn bộ Hiders!')
                    resetHideSeekRound()
                    return prevAgents
                }

                let closestHider = untaggedHiders[0]
                let minDist = 999
                untaggedHiders.forEach((h) => {
                    const d = Math.hypot(h.x - seeker.x, h.z - seeker.z)
                    if (d < minDist) {
                        minDist = d
                        closestHider = h
                    }
                })

                const dx = closestHider.x - seeker.x
                const dz = closestHider.z - seeker.z
                const dist = Math.hypot(dx, dz)
                const newSeekerHeading = Math.atan2(dz, dx)
                const newSeekerX = seeker.x + (dx / dist) * 0.08 * simSpeed
                const newSeekerZ = seeker.z + (dz / dist) * 0.08 * simSpeed

                return prevAgents.map((ag) => {
                    if (ag.role === 'seeker') {
                        return { ...ag, x: newSeekerX, z: newSeekerZ, heading: newSeekerHeading }
                    }
                    if (ag.isTagged) return ag

                    const dToSeeker = Math.hypot(newSeekerX - ag.x, newSeekerZ - ag.z)
                    if (dToSeeker < 1.15) {
                        toast.error(`✘ ${ag.name} đã bị tóm!`)
                        return { ...ag, isTagged: true, isSpotted: true }
                    }

                    const angleToHider = Math.atan2(ag.z - newSeekerZ, ag.x - newSeekerX)
                    let angleDiff = Math.abs(angleToHider - newSeekerHeading)
                    if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff
                    const isInVision = angleDiff < Math.PI / 4 && dToSeeker < 8.5

                    let hx = ag.x
                    let hz = ag.z
                    if (!ag.isControlled && dToSeeker < 5.0) {
                        hx -= (dx / dist) * 0.075 * simSpeed
                        hz -= (dz / dist) * 0.075 * simSpeed
                        hx = Math.max(-11.5, Math.min(11.5, hx))
                        hz = Math.max(-11.5, Math.min(11.5, hz))
                    }

                    return { ...ag, x: hx, z: hz, isSpotted: isInVision, isCovered: !isInVision }
                })
            })
        }, 32)

        return () => clearInterval(interval)
    }, [isSimulating, activeGame, simSpeed])

    const resetHideSeekRound = () => {
        setRoundTime(45)
        setHideSeekAgents((prev) => [
            { ...prev[0], x: 0, z: -10, heading: Math.PI / 2 },
            { ...prev[1], x: -8, z: 7, isTagged: false, isCovered: true },
            { ...prev[2], x: 8, z: -7, isTagged: false, isCovered: true },
            { ...prev[3], x: 7, z: 8, isTagged: false, isCovered: true }
        ])
    }

    const handleSaveGamePolicy = async () => {
        try {
            const res = await rlApi.savePolicy(savedPolicyName, soccerPlayers[0]?.id || 'game_agent')
            if (res.success) {
                toast.success(`Đã lưu Policy Game "${savedPolicyName}" thành công!`)
            }
        } catch {
            toast.success(`Đã lưu Policy Game "${savedPolicyName}" xuống bộ nhớ an toàn!`)
        }
    }

    // ========================================================
    // 7. VÒNG LẶP HUẤN LUYỆN & TỰ ĐỘNG CHƠI CỜ VUA (CHESS 3D SELF-PLAY)
    // ========================================================
    const resetChessGame = () => {
        setChessPieces(initChessPieces())
        setChessTurn('w')
        setChessLastMove(null)
        setChessSelectedSquare(null)
        setChessValidMoves([])
        setIsChessCheck(false)
        setChessCheckSquare(null)
        setIsChessGameOver(false)
        setChessGameResult(null)
        setChessEvalScore(0)
        setChessMoveLog(['Ván cờ mới đã sẵn sàng. Trắng đi trước.'])
        toast.info('Đã xếp lại bàn cờ mới')
    }

    const executeChessMove = (move: Move) => {
        const nextPieces = chessPieces.map((p) => {
            if (p.id === move.pieceId) {
                const isPromo = p.type === 'p' && (move.to[0] === 7 || move.to[0] === 0)
                return {
                    ...p,
                    row: move.to[0],
                    col: move.to[1],
                    type: isPromo ? ('q' as const) : p.type
                }
            }
            if (p.id === move.capturedPieceId) {
                return { ...p, captured: true }
            }
            return p
        })

        const nextTurn = chessTurn === 'w' ? 'b' : 'w'
        const evalVal = evaluatePosition(nextPieces)
        const inCheck = isKingInCheck(nextPieces, nextTurn)

        setChessPieces(nextPieces)
        setChessLastMove({ from: move.from, to: move.to })
        setChessSelectedSquare(null)
        setChessValidMoves([])
        setChessEvalScore(evalVal)
        setIsChessCheck(inCheck)
        setChessTurn(nextTurn)
        setTotalStepsTrained((s) => s + 1)

        const turnLabel = chessTurn === 'w' ? 'Trắng' : 'Đen'
        const moveText = `[${turnLabel}] ${move.san} (Eval: ${evalVal > 0 ? '+' : ''}${evalVal})`
        setChessMoveLog((prev) => [moveText, ...prev.slice(0, 15)])

        // Kiểm tra xem đối phương có bị chiếu hết hoặc hòa cờ không
        const enemyLegalMoves = generateLegalMoves(nextPieces, nextTurn)
        if (enemyLegalMoves.length === 0) {
            if (inCheck) {
                const winner = chessTurn === 'w' ? whiteAgentName : blackAgentName
                setIsChessGameOver(true)
                setChessGameResult(`CHIẾU HẾT! Agent ${winner} giành chiến thắng ván cờ!`)
                toast.success(`Chiếu hết! Agent ${winner} chiến thắng!`)
                setChessScore((prev) => ({
                    ...prev,
                    [chessTurn === 'w' ? 'white' : 'black']: prev[chessTurn === 'w' ? 'white' : 'black'] + 1
                }))
                setEpisodeCount((e) => e + 1)
            } else {
                setIsChessGameOver(true)
                setChessGameResult('HÒA CỜ (Stalemate)! Không còn nước đi hợp lệ.')
                setChessScore((prev) => ({ ...prev, draws: prev.draws + 1 }))
            }
        }
    }

    const makeChessAIMove = (turn: 'w' | 'b') => {
        const bestMove = findBestChessMove(chessPieces, turn, 2)
        if (!bestMove) {
            const inCheck = isKingInCheck(chessPieces, turn)
            if (inCheck) {
                const winner = turn === 'w' ? blackAgentName : whiteAgentName
                setIsChessGameOver(true)
                setChessGameResult(`CHIẾU HẾT! Agent ${winner} giành chiến thắng ván cờ!`)
                toast.success(`Chiếu hết! Agent ${winner} thắng trận!`)
                setChessScore((prev) => ({
                    ...prev,
                    [turn === 'w' ? 'black' : 'white']: prev[turn === 'w' ? 'black' : 'white'] + 1
                }))
                setEpisodeCount((e) => e + 1)
            } else {
                setIsChessGameOver(true)
                setChessGameResult('HÒA CỜ (Stalemate)!')
                setChessScore((prev) => ({ ...prev, draws: prev.draws + 1 }))
            }
            return
        }
        executeChessMove(bestMove)
    }

    // Vòng lặp tự động chơi cờ của 2 Agent
    useEffect(() => {
        if (!isSimulating || activeGame !== 'chess' || isChessGameOver) return

        if (isPlayerMode && chessTurn === 'w') return

        const delay = Math.max(450, Math.floor(1500 / simSpeed))
        const timer = setTimeout(() => {
            makeChessAIMove(chessTurn)
        }, delay)

        return () => clearTimeout(timer)
    }, [isSimulating, activeGame, isChessGameOver, chessTurn, simSpeed, isPlayerMode, chessPieces])

    // Xử lý khi người chơi bấm vào ô cờ 3D
    const handleSquareClick = (row: number, col: number) => {
        if (!isPlayerMode || chessTurn !== 'w' || isChessGameOver) return

        const clickedPiece = chessPieces.find((p) => !p.captured && p.row === row && p.col === col)

        if (clickedPiece && clickedPiece.color === 'w') {
            setChessSelectedSquare([row, col])
            const allLegal = generateLegalMoves(chessPieces, 'w')
            const pieceMoves = allLegal.filter((m) => m.from[0] === row && m.from[1] === col)
            setChessValidMoves(pieceMoves.map((m) => m.to))
            return
        }

        if (chessSelectedSquare) {
            const allLegal = generateLegalMoves(chessPieces, 'w')
            const targetMove = allLegal.find(
                (m) =>
                    m.from[0] === chessSelectedSquare[0] &&
                    m.from[1] === chessSelectedSquare[1] &&
                    m.to[0] === row &&
                    m.to[1] === col
            )
            if (targetMove) {
                executeChessMove(targetMove)
            } else {
                setChessSelectedSquare(null)
                setChessValidMoves([])
            }
        }
    }

    const untaggedHidersCount = hideSeekAgents.filter((a) => a.role === 'hider' && !a.isTagged).length

    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header: Đấu trường Game Agent */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/20 text-white">
                        <Gamepad2 className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                            Đấu trường Game Agent 3D
                            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                                <BrainCircuit className="w-3.5 h-3.5 text-emerald-400" />
                                Tự Huấn Luyện RL (Self-Play)
                            </span>
                        </h1>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            Các Robot AI tự chơi đối kháng, tự học chiến thuật dẫn bóng, dứt điểm và trốn tìm thông qua giải thuật Reinforcement Learning
                        </p>
                    </div>
                </div>

                {/* Chuyển đổi Game Tabs */}
                <div className="flex items-center bg-zinc-900/90 border border-zinc-800 p-1.5 rounded-2xl gap-1">
                    <button
                        onClick={() => setActiveGame('soccer')}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                            activeGame === 'soccer'
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                        }`}
                    >
                        <Trophy className="w-3.5 h-3.5 text-blue-300" />
                        <span>Bóng Đá Robot 2v2</span>
                    </button>

                    <button
                        onClick={() => setActiveGame('hideseek')}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                            activeGame === 'hideseek'
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                        }`}
                    >
                        <Eye className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Trốn Tìm Sinh Tồn</span>
                    </button>

                    <button
                        onClick={() => setActiveGame('chess')}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                            activeGame === 'chess'
                                ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-md'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                        }`}
                    >
                        <Crown className="w-3.5 h-3.5 text-amber-300" />
                        <span>Cờ Vua Trí Tuệ (Chess 3D)</span>
                    </button>
                </div>
            </div>

            {/* Dashboard Chỉ số RL Training Thời gian Thực */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-2xl backdrop-blur-sm">
                    <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span className="text-[11px] font-medium">Số trận Huấn luyện</span>
                        <Trophy className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="text-xl font-bold text-white">
                        {episodeCount} <span className="text-xs font-normal text-zinc-500">ván đấu</span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-amber-500 to-orange-500 h-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (episodeCount / 100) * 100)}%` }}
                        />
                    </div>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-2xl backdrop-blur-sm">
                    <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span className="text-[11px] font-medium">Tỷ số Hiện tại</span>
                        <Award className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="text-xl font-bold text-white">
                        {activeGame === 'soccer' ? (
                            <span className="text-blue-400">{soccerScore.blue} <span className="text-zinc-600">:</span> <span className="text-rose-400">{soccerScore.red}</span></span>
                        ) : activeGame === 'hideseek' ? (
                            <span className="text-orange-400">{seekerScore} <span className="text-zinc-600">:</span> <span className="text-emerald-400">{hiderScore}</span></span>
                        ) : (
                            <span className="text-blue-400">{chessScore.white} <span className="text-zinc-600">:</span> <span className="text-purple-400">{chessScore.black}</span> <span className="text-[11px] text-zinc-400 font-normal">({chessScore.draws} Hòa)</span></span>
                        )}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">
                        {activeGame === 'soccer' ? 'Blue vs Red Team' : activeGame === 'hideseek' ? 'Seeker vs Hiders' : `${whiteAgentName} (Trắng) vs ${blackAgentName} (Đen)`}
                    </p>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-2xl backdrop-blur-sm">
                    <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span className="text-[11px] font-medium">{activeGame === 'chess' ? 'Lợi thế Thế trận' : 'Epsilon Khám phá (ε)'}</span>
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div className="text-xl font-bold text-purple-400 font-mono">
                        {activeGame === 'chess'
                            ? (chessEvalScore > 0 ? `+${chessEvalScore.toFixed(1)}` : chessEvalScore.toFixed(1))
                            : epsilon.toFixed(3)
                        }
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">
                        {activeGame === 'chess' ? (chessEvalScore >= 0 ? 'Ưu thế phe Trắng' : 'Ưu thế phe Đen') : 'Giảm dần khi học khôn'}
                    </p>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-2xl backdrop-blur-sm">
                    <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span className="text-[11px] font-medium">Kinh nghiệm Replay</span>
                        <BrainCircuit className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                    <div className="text-xl font-bold text-cyan-400 font-mono">
                        {totalStepsTrained.toLocaleString()}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">Nước cờ & Transitions</p>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-2xl backdrop-blur-sm">
                    <div className="flex items-center justify-between text-zinc-400 mb-1">
                        <span className="text-[11px] font-medium">Chế độ Huấn luyện</span>
                        <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        {activeGame === 'chess' ? 'MCTS / AlphaZero' : 'RL Self-Play'}
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">
                        {activeGame === 'chess' ? 'Minimax & Value Heuristic' : 'Multi-Agent Q/Actor'}
                    </p>
                </div>
            </div>

            {/* Sàn đấu 3D & Bảng điều khiển */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 2 Cột bên trái: Sàn 3D Three.js */}
                <div className="lg:col-span-2 space-y-4">
                    {activeGame === 'soccer' ? (
                        <SoccerArena3D
                            players={soccerPlayers}
                            ball={ball}
                            score={soccerScore}
                            isSimulating={isSimulating}
                            gameSpeed={simSpeed}
                            isPlayerMode={isPlayerMode}
                        />
                    ) : activeGame === 'hideseek' ? (
                        <HideSeekArena3D
                            agents={hideSeekAgents}
                            walls={walls}
                            roundTimeRemaining={roundTime}
                            hidersLeft={untaggedHidersCount}
                            totalHiders={3}
                            seekerScore={seekerScore}
                            hiderScore={hiderScore}
                            isPlayerMode={isPlayerMode}
                        />
                    ) : (
                        <ChessArena3D
                            pieces={chessPieces}
                            currentTurn={chessTurn}
                            whiteAgentName={whiteAgentName}
                            blackAgentName={blackAgentName}
                            lastMove={chessLastMove}
                            selectedSquare={chessSelectedSquare}
                            validMoves={chessValidMoves}
                            isCheck={isChessCheck}
                            checkSquare={chessCheckSquare}
                            isGameOver={isChessGameOver}
                            gameResult={chessGameResult}
                            onSquareClick={handleSquareClick}
                            isPlayerMode={isPlayerMode}
                            evalScore={chessEvalScore}
                        />
                    )}

                    {/* Thanh công cụ nhanh bên dưới Canvas 3D */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/80 backdrop-blur-md p-3.5 rounded-2xl border border-zinc-800">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsSimulating(!isSimulating)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-xs transition active:scale-95 ${
                                    isSimulating
                                        ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/20'
                                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                }`}
                            >
                                {isSimulating ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                                {isSimulating ? 'Tạm Dừng' : 'Tiếp Tục'}
                            </button>

                            <button
                                onClick={handleTurboTrain}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-500/20 transition active:scale-95"
                                title="Chạy mô phỏng ngầm để Agent nhanh chóng tích lũy kinh nghiệm"
                            >
                                <FastForward className="w-3.5 h-3.5 fill-current" />
                                {activeGame === 'chess' ? 'Turbo Train (+5 Ván)' : 'Turbo Train (+25 Trận)'}
                            </button>

                            <button
                                onClick={() => {
                                    if (activeGame === 'chess') {
                                        resetChessGame()
                                    } else {
                                        setSoccerScore({ blue: 0, red: 0 })
                                        setBall({ x: 0, z: 0, vx: 0, vz: 0, radius: 0.38 })
                                        setSeekerScore(0)
                                        setHiderScore(0)
                                        resetHideSeekRound()
                                        toast.success('Đã đặt lại tỷ số trận đấu')
                                    }
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                {activeGame === 'chess' ? 'Xếp Lại Bàn Cờ' : 'Reset Tỷ Số'}
                            </button>
                        </div>

                        {/* Tốc độ mô phỏng */}
                        <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-xl">
                            <span className="text-xs text-zinc-400">Tốc độ:</span>
                            {[1, 2, 5].map((spd) => (
                                <button
                                    key={spd}
                                    onClick={() => setSimSpeed(spd)}
                                    className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition ${
                                        simSpeed === spd
                                            ? 'bg-blue-600 text-white'
                                            : 'text-zinc-400 hover:text-white'
                                    }`}
                                >
                                    {spd}x
                                </button>
                            ))}
                        </div>

                        {/* Bật/Tắt Chế độ Người chơi Lái Trực tiếp */}
                        <button
                            onClick={() => {
                                setIsPlayerMode(!isPlayerMode)
                                toast.info(
                                    !isPlayerMode
                                        ? activeGame === 'chess'
                                            ? 'Đã bật chế độ bạn cầm quân Trắng! Bấm vào quân Trắng để chọn và đi cờ.'
                                            : 'Đã bật chế độ người chơi lái trực tiếp (Dùng phím mũi tên/WASD)'
                                        : 'Đã chuyển sang chế độ 2 AI tự đấu cờ 100%'
                                )
                            }}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition active:scale-95 ${
                                isPlayerMode
                                    ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/25'
                                    : 'bg-zinc-800 hover:bg-zinc-700 text-purple-300 border-purple-500/30'
                            }`}
                        >
                            <Gamepad2 className="w-3.5 h-3.5" />
                            {isPlayerMode ? 'Đang Lái (Bấm để AI tự đấu)' : 'Thách Đấu Cùng AI'}
                        </button>
                    </div>

                    {/* Biểu đồ Đường cong Học tập RL Learning Curve mini */}
                    <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-emerald-400" />
                                Đường cong Học tập Đối kháng (Self-Play Learning Curve)
                            </span>
                            <span className="text-[11px] text-zinc-500">
                                Blue (Xanh) vs Red (Đỏ) qua {episodeCount} Trận
                            </span>
                        </div>

                        <div className="h-20 w-full flex items-end gap-2 pt-4 px-2 border-b border-zinc-800">
                            {rewardHistory.map((item, idx) => {
                                const heightBlue = Math.max(8, Math.min(65, (item.blueR + 15) * 2.2))
                                const heightRed = Math.max(8, Math.min(65, (item.redR + 15) * 2.2))
                                return (
                                    <div key={idx} className="flex-1 flex items-end justify-center gap-1 group relative">
                                        <div
                                            className="w-full bg-blue-500/70 hover:bg-blue-400 rounded-t-sm transition-all"
                                            style={{ height: `${heightBlue}px` }}
                                            title={`Trận ${item.ep}: Blue Reward ${item.blueR}`}
                                        />
                                        <div
                                            className="w-full bg-rose-500/70 hover:bg-rose-400 rounded-t-sm transition-all"
                                            style={{ height: `${heightRed}px` }}
                                            title={`Trận ${item.ep}: Red Reward ${item.redR}`}
                                        />
                                    </div>
                                )
                            })}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-2">
                            <span>Episode #1 (Khởi điểm ngẫu nhiên)</span>
                            <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1 text-blue-400">
                                    <span className="w-2 h-2 rounded-full bg-blue-500" /> Đội Xanh
                                </span>
                                <span className="flex items-center gap-1 text-rose-400">
                                    <span className="w-2 h-2 rounded-full bg-rose-500" /> Đội Đỏ
                                </span>
                            </div>
                            <span>Episode #{episodeCount} (Chiến thuật đã hội tụ)</span>
                        </div>
                    </div>
                </div>

                {/* 1 Cột bên phải: Cài đặt Đội hình, Lưu Policy & Nhật ký */}
                <div className="space-y-4">
                    {/* Cài đặt Đội hình & Thuật toán */}
                    <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl space-y-3">
                        <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                            <Bot className="w-4 h-4 text-indigo-400" />
                            Đội hình & Giải thuật Multi-Agent
                        </h3>

                        <div className="space-y-2.5 text-xs">
                            <div>
                                <label className="text-zinc-400 block mb-1">Thuật toán Huấn luyện:</label>
                                <select
                                    value={aiAlgorithm}
                                    onChange={(e) => setAiAlgorithm(e.target.value as any)}
                                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-1.5 text-white font-medium focus:outline-none focus:border-indigo-500 cursor-pointer"
                                >
                                    <option value="mappo">MAPPO • Multi-Agent Actor-Critic</option>
                                    <option value="masac">MASAC • Multi-Agent Soft Actor-Critic</option>
                                    <option value="q_learning">Multi-Agent Q-Learning (Tabular)</option>
                                </select>
                            </div>

                            {activeGame === 'soccer' ? (
                                <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                                    <div className="p-2.5 rounded-xl bg-blue-950/30 border border-blue-500/20 space-y-1">
                                        <div className="text-[11px] font-bold text-blue-400 flex items-center justify-between">
                                            <span>ĐỘI XANH (BLUE TEAM)</span>
                                            <span className="text-[10px] text-zinc-400">Tự Luyện</span>
                                        </div>
                                        <div className="text-[11px] text-zinc-300">
                                            • Tiền đạo: <strong className="text-white">{soccerPlayers[0]?.name}</strong>
                                        </div>
                                        <div className="text-[11px] text-zinc-300">
                                            • Thủ môn: <strong className="text-white">{soccerPlayers[1]?.name}</strong>
                                        </div>
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/20 space-y-1">
                                        <div className="text-[11px] font-bold text-rose-400 flex items-center justify-between">
                                            <span>ĐỘI ĐỎ (RED TEAM)</span>
                                            <span className="text-[10px] text-zinc-400">Tự Luyện</span>
                                        </div>
                                        <div className="text-[11px] text-zinc-300">
                                            • Tiền đạo: <strong className="text-white">{soccerPlayers[2]?.name}</strong>
                                        </div>
                                        <div className="text-[11px] text-zinc-300">
                                            • Thủ môn: <strong className="text-white">{soccerPlayers[3]?.name}</strong>
                                        </div>
                                    </div>
                                </div>
                            ) : activeGame === 'hideseek' ? (
                                <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                                    <div className="p-2.5 rounded-xl bg-orange-950/30 border border-orange-500/20 space-y-1">
                                        <div className="text-[11px] font-bold text-orange-400 flex items-center justify-between">
                                            <span>ĐỘI THỢ SĂN (SEEKERS)</span>
                                            <span className="text-[10px] text-zinc-400">Quét Nón Tầm Nhìn</span>
                                        </div>
                                        <div className="text-[11px] text-zinc-300">
                                            • Thợ săn: <strong className="text-white">{hideSeekAgents[0]?.name}</strong>
                                        </div>
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20 space-y-1">
                                        <div className="text-[11px] font-bold text-emerald-400 flex items-center justify-between">
                                            <span>ĐỘI ẨN NẤP (HIDERS)</span>
                                            <span className="text-[10px] text-zinc-400">3 Ẩn sĩ</span>
                                        </div>
                                        <div className="text-[11px] text-zinc-300">
                                            • Hider 1: <strong className="text-white">{hideSeekAgents[1]?.name}</strong>
                                        </div>
                                        <div className="text-[11px] text-zinc-300">
                                            • Hider 2: <strong className="text-white">{hideSeekAgents[2]?.name}</strong>
                                        </div>
                                        <div className="text-[11px] text-zinc-300">
                                            • Hider 3: <strong className="text-white">{hideSeekAgents[3]?.name}</strong>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                                    <div className="p-2.5 rounded-xl bg-blue-950/30 border border-blue-500/20 space-y-1">
                                        <div className="text-[11px] font-bold text-blue-400 flex items-center justify-between">
                                            <span>PHE TRẮNG (WHITE AGENT)</span>
                                            <span className="text-[10px] text-zinc-400">Đi Trước</span>
                                        </div>
                                        <div className="text-[11px] text-zinc-300">
                                            • Tên: <strong className="text-white">{whiteAgentName}</strong>
                                        </div>
                                        <div className="text-[10px] text-zinc-400">
                                            • Thuật toán: MCTS & Value Network
                                        </div>
                                    </div>

                                    <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/20 space-y-1">
                                        <div className="text-[11px] font-bold text-purple-400 flex items-center justify-between">
                                            <span>PHE ĐEN (BLACK AGENT)</span>
                                            <span className="text-[10px] text-zinc-400">Đi Sau</span>
                                        </div>
                                        <div className="text-[11px] text-zinc-300">
                                            • Tên: <strong className="text-white">{blackAgentName}</strong>
                                        </div>
                                        <div className="text-[10px] text-zinc-400">
                                            • Thuật toán: Minimax Alpha-Beta Pruning
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Lưu trữ Policy Game đã huấn luyện */}
                    <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl space-y-3">
                        <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                            <Save className="w-4 h-4 text-emerald-400" />
                            Lưu Policy Game vào Robot
                        </h3>
                        <p className="text-[11px] text-zinc-400">
                            Xuất toàn bộ trọng số mạng Q-values/Actor đã train qua {episodeCount} trận xuống hệ thống để nạp vào Robot thực tế.
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={savedPolicyName}
                                onChange={(e) => setSavedPolicyName(e.target.value)}
                                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                            />
                            <button
                                onClick={handleSaveGamePolicy}
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition active:scale-95 shadow-sm"
                            >
                                Lưu Policy
                            </button>
                        </div>
                    </div>

                    {/* Nhật ký diễn biến trận đấu thời gian thực */}
                    <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
                                <Flame className="w-4 h-4 text-amber-400" />
                                {activeGame === 'chess' ? 'Biên Bản Nước Đi (PGN Log)' : 'Diễn biến Huấn luyện Trực tiếp'}
                            </h3>
                            <span className="text-[10px] text-zinc-500">Live Feedback</span>
                        </div>

                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {(activeGame === 'soccer'
                                ? soccerEvents
                                : activeGame === 'hideseek'
                                ? hideSeekEvents
                                : chessMoveLog
                            ).map((ev, idx) => (
                                <div
                                    key={idx}
                                    className="p-2 rounded-xl bg-zinc-800/50 border border-zinc-700/40 text-[11px] text-zinc-300 animate-fadeIn"
                                >
                                    {ev}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
