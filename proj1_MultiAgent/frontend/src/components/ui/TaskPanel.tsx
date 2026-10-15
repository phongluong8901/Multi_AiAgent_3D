// src/components/ui/TaskPanel.tsx
'use client'

import TaskCard, { Task } from './TaskCard'

const MOCK_TASKS: Task[] = [
    { id: '1', title: 'Fix login bug', agent: 'Ben', status: 'doing' },
    { id: '2', title: 'Update landing page', agent: 'Cory', status: 'todo' },
    { id: '3', title: 'Review PR #42', agent: 'Luke', status: 'doing' },
    { id: '4', title: 'Prepare standup notes', agent: 'Allan', status: 'blocked' },
    { id: '5', title: 'Deploy staging', agent: 'Ben', status: 'done' },
]

export default function TaskPanel() {
    return (
        <div className="absolute top-4 right-4 w-72 max-h-[80vh] overflow-y-auto bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-xl shadow-2xl p-4 text-white">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-300">
                    Tasks
                </h2>
                <span className="text-[11px] text-zinc-500">{MOCK_TASKS.length} items</span>
            </div>

            <div className="flex flex-col gap-2.5">
                {MOCK_TASKS.map((task) => (
                    <TaskCard key={task.id} task={task} />
                ))}
            </div>
        </div>
    )
}