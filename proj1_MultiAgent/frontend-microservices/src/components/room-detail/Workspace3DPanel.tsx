'use client'

import { useMemo } from 'react'
import Scene, { MapType } from '@/components/Scene'
import { AgentAction } from '@/components/agents/Agent'
import {
    IconBuilding,
    IconTrees,
    IconLaptop,
    IconArmchair,
    IconUsers,
    IconActivity,
    IconCoffee,
    IconCompass,
    IconTent,
    IconDroplets,
    IconGameController,
    IconUser,
    IconDuck,
    IconAmr,
    IconDrone,
    IconHumanoid,
    IconCpu,
} from '@/components/ui/icons'
import { getAgentRLConfig } from '@/lib/rl/agentRLProfile'
import NvidiaIsaacHud from '@/components/agents/NvidiaIsaacHud'

interface Workspace3DPanelProps {
    mapType: MapType
    roomAgents: any[]
    selected3dAgentId: string
    handleSelectAgent: (id: string) => void
    handleFloorClick: (point: [number, number, number]) => void
    agentTargetActions: Record<
        string,
        { action: AgentAction; targetPos: [number, number, number] }
    >
    handleTriggerAction: (agentId: string, action: AgentAction) => void
}

export function Workspace3DPanel({
    mapType,
    roomAgents,
    selected3dAgentId,
    handleSelectAgent,
    handleFloorClick,
    agentTargetActions,
    handleTriggerAction,
}: Workspace3DPanelProps) {
    const selectedAgent = roomAgents.find((a) => a.id === selected3dAgentId)

    const robotForm = useMemo<'humanoid' | 'duck' | 'amr' | 'drone'>(() => {
        if (!selectedAgent) return 'humanoid'
        if (typeof window !== 'undefined' && selectedAgent.id) {
            const saved = localStorage.getItem(`agent_form:${selectedAgent.id}`)
            if (saved === 'duck' || saved === 'amr' || saved === 'drone' || saved === 'humanoid') return saved
        }
        const lower = ((selectedAgent.name || '') + ' ' + (selectedAgent.id || '')).toLowerCase()
        if (lower.includes('duck') || lower.includes('vit')) return 'duck'
        if (lower.includes('amr') || lower.includes('agv') || lower.includes('xe') || lower.includes('logistics')) return 'amr'
        if (lower.includes('drone') || lower.includes('fly') || lower.includes('bay')) return 'drone'
        return 'humanoid'
    }, [selectedAgent])

    const FormIcon = robotForm === 'duck' ? IconDuck : robotForm === 'amr' ? IconAmr : robotForm === 'drone' ? IconDrone : IconHumanoid
    const formLabel = robotForm === 'duck' ? 'MicroDuck Bipedal' : robotForm === 'amr' ? 'Nova Carter AMR' : robotForm === 'drone' ? 'Cyber Falcon' : 'Project GR00T'

    const agentModelName = useMemo(() => {
        if (!selectedAgent) return 'gemini-2.5-flash-lite'
        if (typeof window !== 'undefined' && selectedAgent.id) {
            const saved = localStorage.getItem(`agent_model:${selectedAgent.id}`)
            if (saved) return saved
        }
        return selectedAgent.model || 'gemini-2.5-flash-lite'
    }, [selectedAgent])

    const agentRLProfile = useMemo(() => {
        if (!selected3dAgentId) return null
        return getAgentRLConfig(selected3dAgentId)
    }, [selected3dAgentId])

    return (
        <div className="relative h-full w-full min-h-0 overflow-hidden">
            <div className="absolute inset-0">
                <Scene
                    agents={roomAgents}
                    mapType={mapType}
                    selectedAgentId={selected3dAgentId}
                    onSelectAgent={handleSelectAgent}
                    onFloorClick={handleFloorClick}
                    agentTargetActions={agentTargetActions}
                />
            </div>

            {/* Badge map */}
            <div className="pointer-events-none absolute left-3 top-3 z-10">
                <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-black/85 px-3 py-1.5 text-[11px] text-zinc-300 shadow-xl backdrop-blur">
                    <span
                        className={`h-2 w-2 rounded-full ${
                            mapType === 'iot'
                                ? 'bg-cyan-400'
                                : mapType === 'outdoor'
                                ? 'bg-emerald-400'
                                : 'bg-blue-400'
                        } animate-pulse`}
                    />
                    {mapType === 'office' ? (
                        <span className="flex items-center gap-1">
                            <IconBuilding className="h-3.5 w-3.5 text-blue-400" />
                            Văn phòng ảo
                        </span>
                    ) : mapType === 'outdoor' ? (
                        <span className="flex items-center gap-1">
                            <IconTrees className="h-3.5 w-3.5 text-emerald-400" />
                            Ngoài trời
                        </span>
                    ) : (
                        <span className="flex items-center gap-1">
                            <IconBuilding className="h-3.5 w-3.5 text-cyan-400" />
                            Đô thị thông minh (IoT)
                        </span>
                    )}
                    <span className="text-zinc-500">·</span>
                    <span className="font-medium text-[#76b900] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#76b900]" />
                        {roomAgents.length} robots
                    </span>
                </div>
            </div>

            {/* Top Right: NVIDIA Isaac Telemetry Bar */}
            <div className="pointer-events-none absolute right-3 top-3 z-10 hidden sm:block">
                <NvidiaIsaacHud
                    compact
                    agentForm={robotForm}
                    agentName={selectedAgent?.name}
                />
            </div>

            {/* HUD điều khiển */}
            <div className="pointer-events-auto absolute bottom-3 left-3 right-3 z-20">
                <div className="mx-auto max-w-xl space-y-2.5 rounded-2xl border border-zinc-700/80 bg-zinc-900/95 p-3 shadow-2xl backdrop-blur-md">
                    <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                        <div className="flex min-w-0 items-center gap-2">
                            <div
                                className="h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-white/20"
                                style={{ backgroundColor: selectedAgent?.color || '#3b82f6' }}
                            />
                            <div className="truncate text-xs font-bold text-white flex items-center gap-1.5">
                                <span>{selectedAgent?.name || 'Chưa chọn Agent'}</span>
                                <span className="inline-flex items-center gap-1 text-[10px] text-[#76b900] bg-[#76b900]/15 border border-[#76b900]/30 px-1.5 py-0.5 rounded-md font-mono">
                                    <FormIcon className="w-3 h-3 text-[#76b900]" />
                                    <span>{formLabel}</span>
                                </span>
                                <span className="font-mono text-[10px] font-normal text-zinc-400">
                                    (@{selected3dAgentId})
                                </span>
                                {selectedAgent?.ownerName && (
                                    <span className="inline-flex items-center gap-0.5 rounded-full border border-blue-500/30 bg-blue-900/40 px-1.5 text-[10px] text-blue-300">
                                        <IconUser className="h-2.5 w-2.5" />
                                        {selectedAgent.ownerName}
                                    </span>
                                )}
                                <span
                                    className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md font-mono font-medium border ${
                                        agentModelName.startsWith('rented:') || agentModelName.startsWith('rental:')
                                            ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                            : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                    }`}
                                    title={`Mô hình LLM: ${agentModelName}`}
                                >
                                    <IconCpu className="w-3 h-3" />
                                    <span className="truncate max-w-[120px]">
                                        {agentModelName.startsWith('rented:') || agentModelName.startsWith('rental:')
                                            ? 'P2P AI'
                                            : agentModelName}
                                    </span>
                                </span>
                                {agentRLProfile && (
                                    <span
                                        className="hidden md:inline-flex items-center gap-1 text-[10px] bg-blue-500/15 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded-md font-mono font-medium"
                                        title={`Thuật toán RL Navigation: ${agentRLProfile.algorithmName || agentRLProfile.algorithm.toUpperCase()}`}
                                    >
                                        <IconCompass className="w-3 h-3 text-blue-400" />
                                        <span>RL: {agentRLProfile.algorithm.toUpperCase()}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => handleSelectAgent(selected3dAgentId)}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-white text-[11px] font-medium transition"
                                title="Xem toàn bộ thông số Model, Prompt, Tools & RL Navigation"
                            >
                                <IconActivity className="w-3 h-3 text-[#76b900]" />
                                <span>Chi tiết</span>
                            </button>
                            <div className="hidden shrink-0 items-center gap-1 rounded-full border border-[#76b900]/30 bg-[#76b900]/10 px-2 py-0.5 font-mono text-[10px] text-[#76b900] sm:flex">
                                <IconGameController className="h-3 w-3" />
                                WASD DRIVE
                            </div>
                        </div>
                    </div>

                    {/* Hội thoại / Lời nói gần nhất của Agent */}
                    {selectedAgent?.speech && (
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-2.5 text-xs text-zinc-200">
                            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-zinc-800/80 text-[10px] text-zinc-400">
                                <span className="flex items-center gap-1 font-semibold text-emerald-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Hội thoại / Kết quả gần nhất:
                                </span>
                                <span className="text-[10px] text-zinc-500 font-mono">@{selected3dAgentId}</span>
                            </div>
                            <div className="max-h-24 overflow-y-auto leading-relaxed break-words whitespace-pre-line text-zinc-200 scrollbar-thin scrollbar-thumb-zinc-700">
                                {selectedAgent.speech}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none">
                        <span className="shrink-0 text-[10px] font-bold uppercase text-zinc-500">
                            Hành động:
                        </span>

                        {mapType === 'office' ? (
                            <>
                                <ActionBtn
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'management_office')}
                                    className="border-amber-500/40 bg-amber-600/20 text-amber-200 hover:bg-amber-600/30"
                                    icon={<IconUser className="h-3.5 w-3.5" />}
                                    label="P. Quản lý"
                                />
                                <ActionBtn
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'research_lab')}
                                    className="border-cyan-500/40 bg-cyan-600/20 text-cyan-200 hover:bg-cyan-600/30"
                                    icon={<IconDuck className="h-3.5 w-3.5" />}
                                    label="P. Nghiên cứu"
                                />
                                <ActionBtn
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'analytics_dept')}
                                    className="border-emerald-500/40 bg-emerald-600/20 text-emerald-200 hover:bg-emerald-600/30"
                                    icon={<IconActivity className="h-3.5 w-3.5" />}
                                    label="P. Phân tích"
                                />
                                <ActionBtn
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'desk')}
                                    className="border-blue-500/40 bg-blue-600/25 text-blue-200 hover:bg-blue-600/35"
                                    icon={<IconLaptop className="h-3.5 w-3.5" />}
                                    label="Bàn làm việc"
                                />
                                <ActionBtn
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'sofa')}
                                    className="border-purple-500/40 bg-purple-600/25 text-purple-200 hover:bg-purple-600/35"
                                    icon={<IconArmchair className="h-3.5 w-3.5" />}
                                    label="Sofa"
                                />
                                <ActionBtn
                                    onClick={() =>
                                        handleTriggerAction(selected3dAgentId, 'roundtable')
                                    }
                                    className="border-amber-500/40 bg-amber-600/25 text-amber-200 hover:bg-amber-600/35"
                                    icon={<IconUsers className="h-3.5 w-3.5" />}
                                    label="Họp"
                                />
                                <ActionBtn
                                    onClick={() =>
                                        handleTriggerAction(selected3dAgentId, 'pingpong')
                                    }
                                    className="border-emerald-500/40 bg-emerald-600/25 text-emerald-200 hover:bg-emerald-600/35"
                                    icon={<IconActivity className="h-3.5 w-3.5" />}
                                    label="Bóng bàn"
                                />
                                <ActionBtn
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'coffee')}
                                    className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                                    icon={<IconCoffee className="h-3.5 w-3.5" />}
                                    label="Cà phê"
                                />
                                <ActionBtn
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'roam')}
                                    className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                                    icon={<IconCompass className="h-3.5 w-3.5" />}
                                    label="Đi dạo"
                                />
                            </>
                        ) : mapType === 'outdoor' ? (
                            <>
                                <ActionBtn
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'picnic')}
                                    className="border-emerald-500/40 bg-emerald-600/25 text-emerald-200 hover:bg-emerald-600/35"
                                    icon={<IconLaptop className="h-3.5 w-3.5" />}
                                    label="Dã ngoại"
                                />
                                <ActionBtn
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'bench')}
                                    className="border-amber-500/40 bg-amber-600/25 text-amber-200 hover:bg-amber-600/35"
                                    icon={<IconArmchair className="h-3.5 w-3.5" />}
                                    label="Ghế"
                                />
                                <ActionBtn
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'gazebo')}
                                    className="border-indigo-500/40 bg-indigo-600/25 text-indigo-200 hover:bg-indigo-600/35"
                                    icon={<IconTent className="h-3.5 w-3.5" />}
                                    label="Gazebo"
                                />
                                <ActionBtn
                                    onClick={() =>
                                        handleTriggerAction(selected3dAgentId, 'fountain')
                                    }
                                    className="border-sky-500/40 bg-sky-600/25 text-sky-200 hover:bg-sky-600/35"
                                    icon={<IconDroplets className="h-3.5 w-3.5" />}
                                    label="Đài phun"
                                />
                                <ActionBtn
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'coffee')}
                                    className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                                    icon={<IconCoffee className="h-3.5 w-3.5" />}
                                    label="Kiosk"
                                />
                                <ActionBtn
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'roam')}
                                    className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                                    icon={<IconCompass className="h-3.5 w-3.5" />}
                                    label="Dạo vườn"
                                />
                            </>
                        ) : (
                            <>
                                <ActionBtn
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'building')}
                                    className="border-cyan-500/40 bg-cyan-600/25 text-cyan-200 hover:bg-cyan-600/35"
                                    icon={<IconBuilding className="h-3.5 w-3.5" />}
                                    label="Trụ sở"
                                />
                                <ActionBtn
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'house')}
                                    className="border-sky-500/40 bg-sky-600/25 text-sky-200 hover:bg-sky-600/35"
                                    icon={<IconArmchair className="h-3.5 w-3.5" />}
                                    label="Khu dân cư"
                                />
                                <ActionBtn
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'industry')}
                                    className="border-amber-500/40 bg-amber-600/25 text-amber-200 hover:bg-amber-600/35"
                                    icon={<IconActivity className="h-3.5 w-3.5" />}
                                    label="Nhà máy"
                                />
                                <ActionBtn
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'crossroad')}
                                    className="border-purple-500/40 bg-purple-600/25 text-purple-200 hover:bg-purple-600/35"
                                    icon={<IconCompass className="h-3.5 w-3.5" />}
                                    label="Giao lộ"
                                />
                                <ActionBtn
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'streetlight')}
                                    className="border-yellow-500/40 bg-yellow-600/25 text-yellow-200 hover:bg-yellow-600/35"
                                    icon={<IconDroplets className="h-3.5 w-3.5" />}
                                    label="Trạm đèn"
                                />
                                <ActionBtn
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'patrol')}
                                    className="border-emerald-500/40 bg-emerald-600/25 text-emerald-200 hover:bg-emerald-600/35"
                                    icon={<IconCompass className="h-3.5 w-3.5" />}
                                    label="Tuần tra"
                                />
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function ActionBtn({
    onClick,
    className,
    icon,
    label,
}: {
    onClick: () => void
    className: string
    icon: React.ReactNode
    label: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 font-medium transition active:scale-95 ${className}`}
        >
            {icon}
            <span>{label}</span>
        </button>
    )
}