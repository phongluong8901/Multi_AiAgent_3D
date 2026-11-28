'use client'

import React, { useState } from 'react'
import { Agent } from '@/lib/api'
import {
    IconX,
    IconWorkflow,
    IconPlay,
    IconCheck,
    IconArrowRight,
    IconLayers,
    IconUser,
    IconSearch,
    IconBarChart,
    IconSparkles,
    IconActivity,
    IconCpu,
} from '@/components/ui/icons'

interface OfficeWorkflowModalProps {
    open: boolean
    onClose: () => void
    agents: Agent[]
    onTriggerWorkflow: (preset: {
        title: string
        steps: Array<{ agentId: string; agentName: string; task: string }>
    }) => void
    isRunning?: boolean
}

export const WORKFLOW_PRESETS = [
    {
        id: 'market_research',
        title: 'Nghiên cứu Thị trường & Đánh giá Rủi ro',
        description: 'P. Nghiên cứu thu thập dữ liệu -> P. Phân tích tính toán số liệu -> P. Quản lý tổng kết quyết định',
        mode: 'sequential',
        steps: [
            {
                agentId: 'agent_search',
                agentName: 'Search & Crawler Bot',
                department: 'Phòng Nghiên cứu',
                color: '#38bdf8',
                task: 'Tìm kiếm dữ liệu thị trường và xu hướng công nghệ mới nhất từ web',
            },
            {
                agentId: 'agent_analyst',
                agentName: 'Data & Metrics Analyst',
                department: 'Phòng Phân tích',
                color: '#fb923c',
                task: 'Phân tích định lượng, tính toán ROI và đánh giá mức độ rủi ro',
            },
            {
                agentId: 'agent_manager',
                agentName: 'Executive PM Lead',
                department: 'Phòng Quản lý',
                color: '#facc15',
                task: 'Thẩm định báo cáo toàn diện và ban hành kết luận điều hành',
            },
        ],
    },
    {
        id: 'ai_benchmark',
        title: 'Kiểm thử Mô hình AI & Đánh giá Accuracy',
        description: 'Lấy benchmark dataset -> Chạy ma trận đánh giá hiệu năng -> Thẩm định tiêu chuẩn chất lượng',
        mode: 'sequential',
        steps: [
            {
                agentId: 'agent_search',
                agentName: 'Search & Crawler Bot',
                department: 'Phòng Nghiên cứu',
                color: '#38bdf8',
                task: 'Trích xuất bộ dữ liệu benchmark và tiêu chuẩn kiểm thử',
            },
            {
                agentId: 'agent_analyst',
                agentName: 'Data & Metrics Analyst',
                department: 'Phòng Phân tích',
                color: '#fb923c',
                task: 'Đo lường Accuracy, Latency, Throughput và đối chiếu độ lệch chuẩn',
            },
            {
                agentId: 'agent_manager',
                agentName: 'Executive PM Lead',
                department: 'Phòng Quản lý',
                color: '#facc15',
                task: 'Kiểm tra checklist KCS và phê duyệt triển khai sản phẩm',
            },
        ],
    },
    {
        id: 'weekly_sync',
        title: 'Đồng bộ Tiến độ Đa phòng ban Hàng tuần',
        description: 'Tập hợp báo cáo nghiên cứu và phân tích vào biên bản tổng kết tuần',
        mode: 'autonomous',
        steps: [
            {
                agentId: 'agent_search',
                agentName: 'Search & Crawler Bot',
                department: 'Phòng Nghiên cứu',
                color: '#38bdf8',
                task: 'Báo cáo các công trình tri thức đã thu thập và trích xuất trong tuần',
            },
            {
                agentId: 'agent_analyst',
                agentName: 'Data & Metrics Analyst',
                department: 'Phòng Phân tích',
                color: '#fb923c',
                task: 'Báo cáo chỉ số KPI, hiệu năng xử lý và các cảnh báo sai số',
            },
            {
                agentId: 'agent_manager',
                agentName: 'Executive PM Lead',
                department: 'Phòng Quản lý',
                color: '#facc15',
                task: 'Tổng hợp kế hoạch hành động tiếp theo và phân bổ tài nguyên',
            },
        ],
    },
]

export default function OfficeWorkflowModal({
    open,
    onClose,
    agents,
    onTriggerWorkflow,
    isRunning = false,
}: OfficeWorkflowModalProps) {
    const [selectedPresetId, setSelectedPresetId] = useState(WORKFLOW_PRESETS[0].id)
    const [workflowMode, setWorkflowMode] = useState<'sequential' | 'autonomous' | 'routing'>('sequential')

    if (!open) return null

    const currentPreset = WORKFLOW_PRESETS.find((p) => p.id === selectedPresetId) || WORKFLOW_PRESETS[0]

    const handleStart = () => {
        onTriggerWorkflow({
            title: currentPreset.title,
            steps: currentPreset.steps.map((s) => {
                const found = agents.find((a) => a.id === s.agentId)
                return {
                    agentId: s.agentId,
                    agentName: found?.name || s.agentName,
                    task: s.task,
                }
            }),
        })
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl text-white">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-zinc-800/80 bg-zinc-900/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400">
                            <IconWorkflow className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <span>Trung Tâm Điều Phối Workflow Văn Phòng</span>
                                <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                                    MULTI-AGENT PIPELINE
                                </span>
                            </h2>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Kích hoạt chuỗi tác vụ tự động giữa các phòng ban chuyên môn
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                    >
                        <IconX className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-4 text-xs">
                    {/* Chế độ phối hợp (Mode Selector) */}
                    <div>
                        <span className="font-semibold text-zinc-300 block mb-2">
                            Chế độ Phối hợp giữa các Agent:
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setWorkflowMode('sequential')}
                                className={`p-2.5 rounded-xl border text-left transition ${
                                    workflowMode === 'sequential'
                                        ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500/40'
                                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                                }`}
                            >
                                <span className="font-bold block text-xs">Sequential</span>
                                <span className="text-[10px] text-zinc-400 mt-0.5 block leading-tight">
                                    Tuần tự pipeline qua từng phòng
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setWorkflowMode('autonomous')}
                                className={`p-2.5 rounded-xl border text-left transition ${
                                    workflowMode === 'autonomous'
                                        ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500/40'
                                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                                }`}
                            >
                                <span className="font-bold block text-xs">Autonomous</span>
                                <span className="text-[10px] text-zinc-400 mt-0.5 block leading-tight">
                                    Tự trị phân tán & trao đổi chéo
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setWorkflowMode('routing')}
                                className={`p-2.5 rounded-xl border text-left transition ${
                                    workflowMode === 'routing'
                                        ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500/40'
                                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white'
                                }`}
                            >
                                <span className="font-bold block text-xs">Routing</span>
                                <span className="text-[10px] text-zinc-400 mt-0.5 block leading-tight">
                                    P. Quản lý điều phối chỉ định
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Danh sách kịch bản sẵn có (Presets) */}
                    <div>
                        <span className="font-semibold text-zinc-300 block mb-2">
                            Chọn Kịch bản Workflow Mẫu:
                        </span>
                        <div className="space-y-2">
                            {WORKFLOW_PRESETS.map((preset) => {
                                const isSelected = selectedPresetId === preset.id
                                return (
                                    <div
                                        key={preset.id}
                                        onClick={() => setSelectedPresetId(preset.id)}
                                        className={`p-3 rounded-xl border cursor-pointer transition ${
                                            isSelected
                                                ? 'bg-zinc-900 border-indigo-500/70 shadow-md ring-1 ring-indigo-500/30'
                                                : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-xs text-white">
                                                {preset.title}
                                            </span>
                                            {isSelected && (
                                                <span className="flex items-center gap-1 text-[10px] text-indigo-400 font-medium">
                                                    <IconCheck className="w-3.5 h-3.5" />
                                                    Đang chọn
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-zinc-400 mt-1">
                                            {preset.description}
                                        </p>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Sơ đồ các bước thực thi (Pipeline Step Breakdown) */}
                    <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800">
                        <span className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider block mb-3">
                            Tiến trình các bước thực thi ({currentPreset.steps.length} Bước):
                        </span>
                        <div className="space-y-3">
                            {currentPreset.steps.map((st, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className="flex flex-col items-center">
                                        <div
                                            className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border"
                                            style={{
                                                borderColor: `${st.color}60`,
                                                backgroundColor: `${st.color}20`,
                                                color: st.color,
                                            }}
                                        >
                                            {i + 1}
                                        </div>
                                        {i < currentPreset.steps.length - 1 && (
                                            <div className="w-px h-6 bg-zinc-800 my-1" />
                                        )}
                                    </div>

                                    <div className="flex-1 bg-zinc-950/80 p-2.5 rounded-lg border border-zinc-800/80">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-white">
                                                {st.agentName}
                                            </span>
                                            <span
                                                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                                                style={{
                                                    backgroundColor: `${st.color}15`,
                                                    color: st.color,
                                                }}
                                            >
                                                {st.department}
                                            </span>
                                        </div>
                                        <p className="text-zinc-400 text-[11px] mt-1">
                                            {st.task}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-zinc-800/80 bg-zinc-900/40">
                    <span className="text-xs text-zinc-400">
                        Agent trong 3D sẽ tự động di chuyển và phản hồi theo tiến trình.
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                        >
                            Đóng
                        </button>
                        <button
                            type="button"
                            onClick={handleStart}
                            disabled={isRunning}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white shadow-lg transition flex items-center gap-1.5 cursor-pointer"
                        >
                            <IconPlay className="w-3.5 h-3.5" />
                            <span>{isRunning ? 'Đang chạy...' : 'Bắt đầu Chạy Workflow'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
