'use client'

import React from 'react'
import Link from 'next/link'
import {
    Bot,
    Cpu,
    Wrench,
    Compass,
    ShieldCheck,
    Sparkles,
    MessageSquare,
    ExternalLink,
    X,
    Activity,
    Layers,
    CheckCircle2
} from 'lucide-react'
import { Agent as AgentType } from '@/lib/api'

type AgentInspectorModalProps = {
    agent: AgentType | null
    isOpen: boolean
    onClose: () => void
    onOpenChat?: (agentId: string) => void
    currentAlgorithm?: string
    mapName?: string
}

export default function AgentInspectorModal({
    agent,
    isOpen,
    onClose,
    onOpenChat,
    currentAlgorithm = 'ppo',
    mapName = 'office'
}: AgentInspectorModalProps) {
    if (!isOpen || !agent) return null

    // Nhận diện Model LLM
    const modelName = agent.model || 'gemini-2.5-flash-lite'
    const toolList = Array.isArray(agent.tools) && agent.tools.length > 0
        ? agent.tools
        : ['workflow_planner_tool', 'web_search_tool', 'text_summarizer']

    const algoLabels: Record<string, string> = {
        ppo: 'PPO (Proximal Policy Optimization - Actor Critic)',
        sac: 'SAC (Soft Actor-Critic - Max Entropy)',
        sac2: 'SAC v2 (Auto-Alpha + Twin Critics)',
        dreamer: 'Dreamer (World Models + Latent Rollouts)',
        muzero: 'MuZero (DeepMind MCTS Lookahead Planning)',
        dqn: 'DQN (Deep Q-Network + Replay)',
        q_learning: 'Q-Learning (Tabular Baseline)'
    }
    const algoLabel = algoLabels[currentAlgorithm.toLowerCase()] || currentAlgorithm.toUpperCase()

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
            {/* Modal Container */}
            <div className="relative w-full max-w-xl bg-zinc-950/95 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden p-6 text-zinc-100 space-y-5">
                {/* Nút đóng */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* 1. Header: Thông tin Định danh Robot / Agent */}
                <div className="flex items-center gap-4 border-b border-zinc-800/80 pb-4">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg border border-white/10"
                        style={{ backgroundColor: `${agent.color || '#3b82f6'}25`, color: agent.color || '#3b82f6' }}
                    >
                        <Bot className="w-8 h-8" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-white">{agent.name}</h2>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                                ID: {agent.id}
                            </span>
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                Đang nạp RL
                            </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                            <span className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${agent.status === 'working' ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400'}`} />
                                <span className="capitalize">{agent.status || 'idle'}</span>
                            </span>
                            <span>•</span>
                            <span>Toạ độ: [{agent.position?.[0]?.toFixed(1) ?? 0}, {agent.position?.[2]?.toFixed(1) ?? 0}]</span>
                            {agent.form && (
                                <>
                                    <span>•</span>
                                    <span className="uppercase text-[10px] text-zinc-300 font-semibold bg-zinc-800 px-1.5 py-0.5 rounded">
                                        {agent.form}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Cấu hình Nạp (Model, Tools, RL Navigation) */}
                <div className="space-y-3 text-xs">
                    {/* Mục Model LLM */}
                    <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-zinc-300 flex items-center gap-2">
                                <Cpu className="w-4 h-4 text-purple-400" />
                                Mô hình Trí tuệ (LLM Model)
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono text-[11px]">
                                {modelName}
                            </span>
                        </div>
                        <p className="text-[11px] text-zinc-400">
                            Mô hình ngôn ngữ lớn phụ trách suy luận, điều phối chuỗi hành động và giao tiếp ngữ cảnh với người dùng.
                        </p>
                    </div>

                    {/* Mục Tools đã nạp */}
                    <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-zinc-300 flex items-center gap-2">
                                <Wrench className="w-4 h-4 text-amber-400" />
                                Bộ Công cụ đã Nạp (Assigned Tools)
                            </span>
                            <span className="text-[10px] text-zinc-500">{toolList.length} công cụ</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {toolList.map((t: any, idx: number) => {
                                const toolName = typeof t === 'string' ? t : t.name || t.id || 'tool'
                                return (
                                    <span
                                        key={idx}
                                        className="px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-200 font-mono text-[11px] flex items-center gap-1.5"
                                    >
                                        <Sparkles className="w-3 h-3 text-amber-400" />
                                        {toolName}
                                    </span>
                                )
                            })}
                        </div>
                    </div>

                    {/* Mục Reinforcement Learning Policy */}
                    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border border-blue-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold text-blue-300 flex items-center gap-2">
                                <Compass className="w-4 h-4 text-blue-400" />
                                Thuật toán RL & Điều hướng Nạp vào {agent.name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                ACTIVE STEERING
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 text-zinc-300">
                            <div className="p-2 rounded-xl bg-zinc-900/70 border border-zinc-800">
                                <span className="text-zinc-500 block text-[10px]">Thuật toán Huấn luyện</span>
                                <strong className="text-white">{algoLabel}</strong>
                            </div>
                            <div className="p-2 rounded-xl bg-zinc-900/70 border border-zinc-800">
                                <span className="text-zinc-500 block text-[10px]">Cảm biến Không gian</span>
                                <strong className="text-cyan-400">8-Beam 13D Continuous LIDAR</strong>
                            </div>
                            <div className="p-2 rounded-xl bg-zinc-900/70 border border-zinc-800">
                                <span className="text-zinc-500 block text-[10px]">Chế độ Né tránh</span>
                                <strong className="text-emerald-400">Tiếp tuyến Né Bàn Ghế & Tường</strong>
                            </div>
                            <div className="p-2 rounded-xl bg-zinc-900/70 border border-zinc-800">
                                <span className="text-zinc-500 block text-[10px]">Môi trường Bản đồ</span>
                                <strong className="text-indigo-400">
                                    {mapName === 'grid' ? 'Cyber Grid Arena' : 'Office 3D Room Map'}
                                </strong>
                            </div>
                        </div>

                        <p className="text-[10px] text-zinc-400 pt-1">
                            ✓ Robot <strong className="text-zinc-200">{agent.name}</strong> ({agent.id}) tự nhận diện mép bàn, ghế sofa, vách kính và tự động uốn lượn né vật cản khi được chỉ định đích.
                        </p>
                    </div>
                </div>

                {/* 3. Action Buttons */}
                <div className="flex items-center justify-between gap-3 pt-2">
                    <Link
                        href="/training"
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-200 transition"
                    >
                        <Compass className="w-4 h-4 text-blue-400" />
                        Mở Phòng RL Training 3D
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
                    </Link>

                    {onOpenChat && (
                        <button
                            onClick={() => {
                                onOpenChat(agent.id)
                                onClose()
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/25 transition"
                        >
                            <MessageSquare className="w-4 h-4" />
                            Mở Chat Trực Tiếp
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
