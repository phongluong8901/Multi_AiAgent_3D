'use client'

import { useState } from 'react'
import Scene from '@/components/Scene'
import TaskPanel from '@/components/ui/TaskPanel'
import AssignTaskDialog, {
    PipelineStep,
} from '@/components/ui/AssignTaskDialog'
import TaskPipelinePanel from '@/components/ui/TaskPipelinePanel'
import { useAgents } from '@/hooks/useAgents'

const MANAGER_ID = 'agent_manager'

export default function OfficePage() {
    const { agents, connected, error } = useAgents()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [taskTitle, setTaskTitle] = useState<string | null>(null)
    const [steps, setSteps] = useState<PipelineStep[]>([])

    const manager = agents.find((a) => a.id === MANAGER_ID)
    const workers = agents
        .filter((a) => a.id !== MANAGER_ID)
        .map((a) => ({ id: a.id, name: a.name }))

    return (
        <div className="relative w-full h-[calc(100vh-3.5rem)]">
            <Scene agents={agents} />
            <TaskPanel />
            <TaskPipelinePanel taskTitle={taskTitle} steps={steps} />

            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                <div className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg">
                    API: {connected ? 'Connected' : 'Disconnected'}
                    {error ? ` — ${error}` : ` — ${agents.length} agents`}
                    <span className="ml-2 text-amber-400">· Mock pipeline</span>
                </div>

                <button
                    type="button"
                    onClick={() => setDialogOpen(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-lg"
                >
                    + Giao task (Mock)
                </button>
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