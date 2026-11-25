'use client'

import React, { useState, useEffect } from 'react'
import { coinsApi, PlanTaskItem, UserWallet } from '@/lib/api/coins'
import { notify } from '@/lib/toast'
import {
    IconX,
    IconCoins,
    IconSparkles,
    IconCheck,
    IconZap,
    IconPlus,
    IconMap,
    IconLightbulb,
    IconBot,
    IconHome,
    IconFactory,
} from '@/components/ui/icons'

function getTaskIcon(code: string) {
    switch (code) {
        case 'MAP_BUILDER':
        case 'MAP_MASTER':
            return <IconMap className="w-5 h-5 text-cyan-400" />
        case 'LED_SPECIALIST':
            return <IconLightbulb className="w-5 h-5 text-amber-400" />
        case 'ROBOT_FLEET':
            return <IconBot className="w-5 h-5 text-purple-400" />
        case 'SMART_HOME_DESIGNER':
            return <IconHome className="w-5 h-5 text-emerald-400" />
        case 'INDUSTRIAL_ENGINEER':
            return <IconFactory className="w-5 h-5 text-orange-400" />
        default:
            return <IconZap className="w-5 h-5 text-amber-400" />
    }
}

interface PlanTasksModalProps {
    isOpen: boolean
    onClose: () => void
    userId: string
    userName?: string
    onWalletUpdate?: (wallet: UserWallet) => void
}

export default function PlanTasksModal({
    isOpen,
    onClose,
    userId,
    userName,
    onWalletUpdate,
}: PlanTasksModalProps) {
    const [tasks, setTasks] = useState<PlanTaskItem[]>([])
    const [wallet, setWallet] = useState<UserWallet | null>(null)
    const [loading, setLoading] = useState(false)
    const [claimingCode, setClaimingCode] = useState<string | null>(null)
    const [faucetLoading, setFaucetLoading] = useState(false)

    useEffect(() => {
        if (isOpen && userId) {
            loadData()
        }
    }, [isOpen, userId])

    const loadData = async () => {
        setLoading(true)
        try {
            const [walletData, tasksData] = await Promise.all([
                coinsApi.getWallet(userId, userName),
                coinsApi.getTasks(userId),
            ])
            if (walletData) {
                setWallet(walletData)
                onWalletUpdate?.(walletData)
            }
            setTasks(tasksData)
        } catch (err) {
            console.error('Lỗi tải dữ liệu PlanTasks:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleClaim = async (task: PlanTaskItem) => {
        if (!task.isCompleted || task.isClaimed) return
        setClaimingCode(task.code)
        try {
            const res = await coinsApi.claimTask(userId, task.code)
            if (res.success) {
                notify.success(res.message || `+${task.rewardCoins} Coins!`)
                if (res.wallet) {
                    setWallet(res.wallet)
                    onWalletUpdate?.(res.wallet)
                }
                // Cập nhật trạng thái task tại chỗ
                setTasks((prev) =>
                    prev.map((t) =>
                        t.code === task.code ? { ...t, isClaimed: true } : t
                    )
                )
            } else {
                notify.error(res.message || 'Chưa thể nhận thưởng')
            }
        } catch (err: any) {
            notify.error(err.message || 'Lỗi nhận thưởng')
        } finally {
            setClaimingCode(null)
        }
    }

    const handleFaucet = async () => {
        setFaucetLoading(true)
        try {
            const res = await coinsApi.faucet(userId)
            if (res.success && res.wallet) {
                notify.success(res.message || '+500 Coins!')
                setWallet(res.wallet)
                onWalletUpdate?.(res.wallet)
            } else {
                notify.error(res.message || 'Lỗi nhận faucet')
            }
        } catch (err: any) {
            notify.error(err.message || 'Lỗi kết nối')
        } finally {
            setFaucetLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-zinc-800 bg-gradient-to-r from-amber-950/40 via-zinc-900 to-zinc-900 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
                            <IconCoins className="w-6 h-6 text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent flex items-center gap-2">
                                <span>PlanTasks & Kiếm Coin Ảo</span>
                                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">
                                    Map Rewards
                                </span>
                            </h2>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Vẽ bản đồ, bố trí Smart LED, Robot tự hành & Smart Home để nhận Coin không giới hạn!
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition"
                    >
                        <IconX className="w-5 h-5" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Bảng tổng quan ví Coin */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-zinc-900 to-zinc-950 border border-amber-500/20 flex items-center justify-between col-span-2">
                            <div>
                                <div className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
                                    <IconCoins className="w-4 h-4 text-amber-400" />
                                    <span>Số dư Ví của bạn</span>
                                </div>
                                <div className="text-3xl font-extrabold text-white mt-1 font-mono tracking-tight flex items-baseline gap-1.5">
                                    <span className="text-amber-400">{wallet?.balance?.toLocaleString() ?? '500'}</span>
                                    <span className="text-xs text-zinc-400 font-normal">Coins</span>
                                </div>
                                <div className="text-[11px] text-zinc-500 mt-1">
                                    Tổng đã tích lũy: <strong className="text-zinc-300">{wallet?.totalEarned?.toLocaleString() ?? '500'}</strong> Coins
                                </div>
                            </div>

                            <button
                                onClick={handleFaucet}
                                disabled={faucetLoading}
                                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition shadow-lg shadow-amber-500/20 flex items-center gap-1.5 shrink-0"
                            >
                                <IconSparkles className="w-4 h-4" />
                                <span>{faucetLoading ? 'Đang nhận...' : '+500 Faucet'}</span>
                            </button>
                        </div>

                        {/* Tỷ lệ thưởng vẽ Map */}
                        <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex flex-col justify-between text-xs">
                            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                                Cơ chế thưởng tự động
                            </span>
                            <div className="space-y-1.5 mt-2 text-zinc-300 text-[11px]">
                                <div className="flex justify-between">
                                    <span>Lưu 1 Map 3D:</span>
                                    <strong className="text-amber-400 font-mono">+30 Coins</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span>Mỗi Smart LED / Đèn:</span>
                                    <strong className="text-amber-400 font-mono">+10 Coins</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span>Mỗi Robot (Duck, AMR):</span>
                                    <strong className="text-amber-400 font-mono">+20 Coins</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span>Mỗi đồ Smart Home:</span>
                                    <strong className="text-amber-400 font-mono">+15 Coins</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Danh sách các nhiệm vụ Plan Tasks */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                                <IconZap className="w-4 h-4 text-amber-400" />
                                <span>Danh sách Nhiệm vụ Plan Tasks</span>
                            </h3>
                            <span className="text-[11px] text-zinc-500">
                                Tự động ghi nhận khi bạn thiết kế trong Map Studio
                            </span>
                        </div>

                        {loading ? (
                            <div className="py-12 text-center text-zinc-500 text-sm">
                                Đang tải danh sách nhiệm vụ...
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {tasks.map((task) => {
                                    const progressPercent = Math.min(
                                        100,
                                        Math.round((task.currentProgress / task.targetCount) * 100)
                                    )

                                    return (
                                        <div
                                            key={task.code}
                                            className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                        >
                                            <div className="flex items-start gap-3.5 min-w-0">
                                                <div className="w-11 h-11 rounded-2xl bg-zinc-900 border border-zinc-700/60 flex items-center justify-center shrink-0">
                                                    {getTaskIcon(task.code)}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-semibold text-sm text-zinc-100 truncate">
                                                            {task.title}
                                                        </h4>
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono font-bold shrink-0">
                                                            +{task.rewardCoins} Coins
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-zinc-400 mt-0.5">
                                                        {task.description}
                                                    </p>

                                                    {/* Progress bar */}
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <div className="w-36 h-2 bg-zinc-800 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full transition-all duration-500 ${
                                                                    task.isCompleted
                                                                        ? 'bg-emerald-400'
                                                                        : 'bg-amber-400'
                                                                }`}
                                                                style={{ width: `${progressPercent}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[10px] font-mono text-zinc-400">
                                                            {task.currentProgress} / {task.targetCount} {task.unit}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Button */}
                                            <div className="shrink-0 self-end sm:self-center">
                                                {task.isClaimed ? (
                                                    <div className="flex items-center gap-1 text-xs text-zinc-500 font-medium px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800">
                                                        <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
                                                        <span>Đã nhận thưởng</span>
                                                    </div>
                                                ) : task.isCompleted ? (
                                                    <button
                                                        onClick={() => handleClaim(task)}
                                                        disabled={claimingCode === task.code}
                                                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-bold text-xs transition shadow-lg shadow-emerald-500/25 flex items-center gap-1.5 animate-pulse"
                                                    >
                                                        <IconSparkles className="w-4 h-4" />
                                                        <span>
                                                            {claimingCode === task.code ? 'Đang nhận...' : 'Nhận Thưởng'}
                                                        </span>
                                                    </button>
                                                ) : (
                                                    <div className="text-xs text-zinc-500 bg-zinc-900/60 px-3 py-1.5 rounded-xl border border-zinc-800 font-mono">
                                                        Chưa đạt
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between text-xs text-zinc-500">
                    <span className="flex items-center gap-1.5">
                        <IconLightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Mẹo: Cứ mỗi lần bạn bấm &quot;Lưu lên Cloud&quot;, hệ thống sẽ tự động cộng coin dựa trên số lượng LED và Robot!</span>
                    </span>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition font-medium"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    )
}
