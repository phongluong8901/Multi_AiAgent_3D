// src/components/ui/TaskCard.tsx
import StatusBadge from './StatusBadge'

export type Task = {
    id: string
    title: string
    agent: string
    status: 'todo' | 'doing' | 'done' | 'blocked'
}

export default function TaskCard({ task }: { task: Task }) {
    return (
        <div className="bg-zinc-800/80 border border-zinc-700 rounded-lg p-3 hover:border-zinc-500 transition">
            <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-sm text-white leading-snug">{task.title}</p>
                <StatusBadge status={task.status} />
            </div>
            <p className="text-[11px] text-zinc-400">@{task.agent}</p>
        </div>
    )
}