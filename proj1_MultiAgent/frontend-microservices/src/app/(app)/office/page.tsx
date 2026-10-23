'use client'

import { useState } from 'react'
import Scene from '@/components/Scene'
import { MapType } from '@/lib/maps/mapRegistry'
import TaskPanel from '@/components/ui/TaskPanel'
import AssignTaskDialog, {
    PipelineStep,
} from '@/components/ui/AssignTaskDialog'
import TaskPipelinePanel from '@/components/ui/TaskPipelinePanel'
import { useAgents } from '@/hooks/useAgents'
import {
    IconBuilding,
    IconTrees,
    IconGlobe,
    IconPalette,
    IconPlus,
    IconUsers,
} from '@/components/ui/icons'

const MANAGER_ID = 'agent_manager'

export default function OfficePage() {
    const { agents, connected, error } = useAgents()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [mapType, setMapType] = useState<MapType>('office')
    const [taskTitle, setTaskTitle] = useState<string | null>(null)
    const [steps, setSteps] = useState<PipelineStep[]>([])

    const manager = agents.find((a) => a.id === MANAGER_ID)
    const workers = agents
        .filter((a) => a.id !== MANAGER_ID)
        .map((a) => ({ id: a.id, name: a.name }))

    return (
        <div className="relative w-full h-[calc(100vh-4rem)]">
            <Scene agents={agents} mapType={mapType} />
            <TaskPanel />
            <TaskPipelinePanel taskTitle={taskTitle} steps={steps} />

            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                <div className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg border border-zinc-800 backdrop-blur flex items-center">
                    <span>API: {connected ? 'Connected' : 'Disconnected'}</span>
                    <span>{error ? ` — ${error}` : ` — ${agents.length} agents`}</span>
                    <span className="ml-2 font-medium text-zinc-300">
                        · {mapType === 'iot' ? 'Smart City (IoT)' : mapType === 'outdoor' ? 'Outdoor Campus' : 'Virtual Office'}
                    </span>
                </div>

                <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-zinc-800 backdrop-blur">
                    <button
                        type="button"
                        onClick={() => setMapType('office')}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 ${
                            mapType === 'office' ? 'bg-blue-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        <IconBuilding className="w-3.5 h-3.5" />
                        <span>Office</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setMapType('outdoor')}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 ${
                            mapType === 'outdoor' ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        <IconTrees className="w-3.5 h-3.5" />
                        <span>Outdoor</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setMapType('iot')}
                        className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 ${
                            mapType === 'iot' ? 'bg-cyan-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                        }`}
                    >
                        <IconGlobe className="w-3.5 h-3.5" />
                        <span>Smart City</span>
                    </button>
                    <a
                        href="/maps/setup"
                        className="bg-zinc-800 hover:bg-zinc-700 text-cyan-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-cyan-500/30 transition flex items-center gap-1.5"
                    >
                        <IconPalette className="w-3.5 h-3.5" />
                        <span>Vẽ Map 3D</span>
                    </a>
                    <button
                        type="button"
                        onClick={() => setDialogOpen(true)}
                        className="bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow transition flex items-center gap-1"
                    >
                        <IconPlus className="w-3.5 h-3.5" />
                        <span>Task</span>
                    </button>
                    <a
                        href="/rooms"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow transition flex items-center gap-1.5"
                    >
                        <IconUsers className="w-3.5 h-3.5" />
                        <span>Rooms →</span>
                    </a>
                </div>
            </div>

            <AssignTaskDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                managerId={MANAGER_ID}
                managerName={manager?.name ?? 'Manager Agent'}
                workers={workers}
                useMock={true}
                onPipelineUpdate={(next, title) => {
                    setSteps(next)
                    setTaskTitle(title)
                }}
            />
        </div>
    )
}