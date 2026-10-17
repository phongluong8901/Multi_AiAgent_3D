'use client'

import { PipelineStep } from './AssignTaskDialog'

type Props = {
    taskTitle: string | null
    steps: PipelineStep[]
}

const STATUS_STYLE = {
    pending: 'border-zinc-600 text-zinc-500',
    active: 'border-blue-500 text-blue-300',
    done: 'border-green-500/60 text-green-300',
    error: 'border-red-500/60 text-red-300',
}

const DOT = {
    pending: 'bg-zinc-600',
    active: 'bg-blue-400 animate-pulse',
    done: 'bg-green-400',
    error: 'bg-red-400',
}

export default function TaskPipelinePanel({ taskTitle, steps }: Props) {
    if (!taskTitle && steps.length === 0) {
        return (
            <div className="absolute bottom-4 left-4 w-80 max-h-[40vh] overflow-y-auto bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-xl shadow-2xl p-4 text-white z-10">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Pipeline
                </h2>
                <p className="text-sm text-zinc-500 mt-2">
                    Chưa có task. Bấm &quot;Giao task&quot; để bắt đầu.
                </p>
            </div>
        )
    }

    return (
        <div className="absolute bottom-4 left-4 w-80 max-h-[45vh] overflow-y-auto bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-xl shadow-2xl p-4 text-white z-10">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Pipeline
            </h2>
            {taskTitle && (
                <p className="text-sm font-medium mt-1 mb-3 text-zinc-100">{taskTitle}</p>
            )}

            <div className="space-y-0">
                {steps.map((step, i) => (
                    <div key={step.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${DOT[step.status]}`} />
                            {i < steps.length - 1 && (
                                <span className="w-px flex-1 min-h-[20px] bg-zinc-700 my-1" />
                            )}
                        </div>

                        <div
                            className={`flex-1 mb-3 rounded-lg border px-3 py-2 ${STATUS_STYLE[step.status]}`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium">{step.agentName}</span>
                                <span className="text-[10px] text-zinc-500">{step.at}</span>
                            </div>
                            <p className="text-xs mt-1 leading-snug opacity-90">{step.text}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}