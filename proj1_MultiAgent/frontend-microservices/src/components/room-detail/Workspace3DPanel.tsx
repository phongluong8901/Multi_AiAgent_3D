'use client'

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
} from '@/components/ui/icons'

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
                        className={`h-2 w-2 rounded-full ${mapType === 'outdoor' ? 'bg-emerald-400' : 'bg-blue-400'
                            } animate-pulse`}
                    />
                    {mapType === 'office' ? (
                        <span className="flex items-center gap-1">
                            <IconBuilding className="h-3.5 w-3.5 text-blue-400" />
                            Văn phòng ảo
                        </span>
                    ) : (
                        <span className="flex items-center gap-1">
                            <IconTrees className="h-3.5 w-3.5 text-emerald-400" />
                            Ngoài trời
                        </span>
                    )}
                    <span className="text-zinc-500">·</span>
                    <span className="font-medium text-blue-400">
                        {roomAgents.length} agents
                    </span>
                </div>
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
                            <div className="truncate text-xs font-bold text-white">
                                {selectedAgent?.name || 'Chưa chọn Agent'}
                                <span className="ml-1 font-mono text-[10px] font-normal text-zinc-400">
                                    (@{selected3dAgentId})
                                </span>
                                {selectedAgent?.ownerName && (
                                    <span className="ml-1 inline-flex items-center gap-0.5 rounded-full border border-blue-500/30 bg-blue-900/40 px-1.5 text-[10px] text-blue-300">
                                        <IconUser className="h-2.5 w-2.5" />
                                        {selectedAgent.ownerName}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="hidden shrink-0 items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 font-mono text-[10px] text-blue-400 sm:flex">
                            <IconGameController className="h-3 w-3" />
                            WASD
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none">
                        <span className="shrink-0 text-[10px] font-bold uppercase text-zinc-500">
                            Hành động:
                        </span>

                        {mapType === 'office' ? (
                            <>
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
                        ) : (
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