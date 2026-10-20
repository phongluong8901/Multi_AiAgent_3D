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
    viewMode: 'split' | '3d' | 'chat'
    mapType: MapType
    roomAgents: any[]
    selected3dAgentId: string
    handleSelectAgent: (id: string) => void
    handleFloorClick: (point: [number, number, number]) => void
    agentTargetActions: Record<string, { action: AgentAction; targetPos: [number, number, number] }>
    handleTriggerAction: (agentId: string, action: AgentAction) => void
}

export function Workspace3DPanel({
    viewMode,
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
        <div
            className={`relative h-full transition-all duration-300 ${viewMode === 'split' ? 'w-full lg:w-1/2 border-r border-zinc-800' : 'w-full'
                }`}
        >
            <Scene
                agents={roomAgents}
                mapType={mapType}
                selectedAgentId={selected3dAgentId}
                onSelectAgent={handleSelectAgent}
                onFloorClick={handleFloorClick}
                agentTargetActions={agentTargetActions}
            />

            {/* Floating 3D overlay badge */}
            <div className="absolute top-3 left-3 z-10 pointer-events-none flex flex-col gap-1.5">
                <div className="bg-black/85 backdrop-blur text-[11px] text-zinc-300 px-3 py-1.5 rounded-xl border border-zinc-800 shadow-xl flex items-center gap-2">
                    <span
                        className={`w-2 h-2 rounded-full ${mapType === 'outdoor' ? 'bg-emerald-400' : 'bg-blue-400'
                            } animate-pulse`}
                    />
                    {mapType === 'office' ? (
                        <span className="flex items-center gap-1">
                            <IconBuilding className="w-3.5 h-3.5 text-blue-400" />
                            <span>Không gian Văn Phòng Ảo</span>
                        </span>
                    ) : (
                        <span className="flex items-center gap-1">
                            <IconTrees className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Khuôn Viên Ngoài Trời Sinh Thái</span>
                        </span>
                    )}
                    <span className="text-zinc-500">·</span>
                    <span className="text-blue-400 font-medium">{roomAgents.length} Agents</span>
                </div>
            </div>

            {/* Interactive Agent Movement & Control HUD */}
            <div className="absolute bottom-3 left-3 right-3 z-20 pointer-events-auto">
                <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 rounded-2xl p-3 shadow-2xl space-y-2.5 max-w-xl mx-auto">
                    <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-3.5 h-3.5 rounded-full ring-2 ring-white/20"
                                style={{ backgroundColor: selectedAgent?.color || '#3b82f6' }}
                            />
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                <span>{selectedAgent?.name || 'Chưa chọn Agent'}</span>
                                <span className="text-[10px] text-zinc-400 font-mono font-normal">
                                    (@{selected3dAgentId})
                                </span>
                                {selectedAgent?.ownerName && (
                                    <span className="text-[10px] text-blue-300 bg-blue-900/40 border border-blue-500/30 px-1.5 rounded-full flex items-center gap-0.5">
                                        <IconUser className="w-2.5 h-2.5" />
                                        <span>{selectedAgent.ownerName}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-mono flex items-center gap-1.5">
                            <IconGameController className="w-3 h-3" />
                            <span>WASD / Mũi Tên lái Agent</span>
                        </div>
                    </div>

                    {/* Movement Action Buttons */}
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
                        <span className="text-[10px] uppercase font-bold text-zinc-500 shrink-0">Hành động:</span>

                        {mapType === 'office' ? (
                            <>
                                <button
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'desk')}
                                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 font-medium transition active:scale-95"
                                >
                                    <IconLaptop className="w-3.5 h-3.5" />
                                    <span>Bàn làm việc</span>
                                </button>
                                <button
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'sofa')}
                                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 font-medium transition active:scale-95"
                                >
                                    <IconArmchair className="w-3.5 h-3.5" />
                                    <span>Ngồi Sofa</span>
                                </button>
                                <button
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'roundtable')}
                                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 font-medium transition active:scale-95"
                                >
                                    <IconUsers className="w-3.5 h-3.5" />
                                    <span>Họp Bàn Tròn</span>
                                </button>
                                <button
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'pingpong')}
                                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-medium transition active:scale-95"
                                >
                                    <IconActivity className="w-3.5 h-3.5" />
                                    <span>Chơi Bóng Bàn</span>
                                </button>
                                <button
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'coffee')}
                                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-medium transition active:scale-95"
                                >
                                    <IconCoffee className="w-3.5 h-3.5" />
                                    <span>Quầy Cà Phê</span>
                                </button>
                                <button
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'roam')}
                                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-medium transition active:scale-95"
                                >
                                    <IconCompass className="w-3.5 h-3.5" />
                                    <span>Đi dạo tự do</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'picnic')}
                                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-medium transition active:scale-95"
                                >
                                    <IconLaptop className="w-3.5 h-3.5" />
                                    <span>Bàn Dã Ngoại</span>
                                </button>
                                <button
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'bench')}
                                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 font-medium transition active:scale-95"
                                >
                                    <IconArmchair className="w-3.5 h-3.5" />
                                    <span>Ghế Công Viên</span>
                                </button>
                                <button
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'gazebo')}
                                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-medium transition active:scale-95"
                                >
                                    <IconTent className="w-3.5 h-3.5" />
                                    <span>Chòi Họp Gazebo</span>
                                </button>
                                <button
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'fountain')}
                                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 text-sky-300 font-medium transition active:scale-95"
                                >
                                    <IconDroplets className="w-3.5 h-3.5" />
                                    <span>Đài Phun Nước</span>
                                </button>
                                <button
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'coffee')}
                                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-medium transition active:scale-95"
                                >
                                    <IconCoffee className="w-3.5 h-3.5" />
                                    <span>Quầy Kiosk</span>
                                </button>
                                <button
                                    onClick={() => handleTriggerAction(selected3dAgentId, 'roam')}
                                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-medium transition active:scale-95"
                                >
                                    <IconCompass className="w-3.5 h-3.5" />
                                    <span>Dạo quanh vườn</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}