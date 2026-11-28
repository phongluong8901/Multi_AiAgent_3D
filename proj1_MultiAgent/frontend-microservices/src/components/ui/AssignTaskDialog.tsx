'use client'

import { useState } from 'react'
import {
    buildMockPipeline,
    runMockPipelineAnimation,
    MockAgentRef,
} from '@/lib/mockPipeline'

export type PipelineStep = {
    id: string
    agentId: string
    agentName: string
    text: string
    status: 'pending' | 'active' | 'done' | 'error'
    at: string
}

type Props = {
    open: boolean
    onClose: () => void
    managerId?: string
    managerName?: string
    workers?: MockAgentRef[]
    onPipelineUpdate: (steps: PipelineStep[], taskTitle: string) => void
    /** true = mock, false = gọi API sau này */
    useMock?: boolean
}

export default function AssignTaskDialog({
    open,
    onClose,
    managerId = 'agent_manager',
    managerName = 'Manager Agent',
    workers = [],
    onPipelineUpdate,
    useMock = true,
}: Props) {
    const [title, setTitle] = useState('')
    const [detail, setDetail] = useState('')
    const [loading, setLoading] = useState(false)

    if (!open) return null

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!title.trim()) return

        setLoading(true)
        const taskTitle = title.trim()

        if (useMock) {
            const manager = { id: managerId, name: managerName }
            const initial = buildMockPipeline(taskTitle, manager, workers)
            onPipelineUpdate(initial, taskTitle)
            runMockPipelineAnimation(initial, (steps) => {
                onPipelineUpdate(steps, taskTitle)
            })
            setTitle('')
            setDetail('')
            setLoading(false)
            onClose()
            return
        }

        // TODO: sau này gọi agentsApi.chat(managerId, message)
        setLoading(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={onClose} />

            <div className="relative w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
                <h2 className="text-lg font-semibold text-white">Giao task (Mock)</h2>
                <p className="text-xs text-zinc-400 mt-1">
                    Giả lập luồng Manager → team — chưa gọi API
                </p>

                <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                    <div>
                        <label className="block text-xs text-zinc-400 mb-1">Tiêu đề task</label>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                            placeholder="Fix login bug..."
                            className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-zinc-400 mb-1">Chi tiết (optional)</label>
                        <textarea
                            value={detail}
                            onChange={(e) => setDetail(e.target.value)}
                            rows={3}
                            placeholder="Mô tả thêm..."
                            className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 resize-none"
                        />
                    </div>

                    <div className="flex gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 rounded-lg border border-zinc-700 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-2.5 text-sm font-medium"
                        >
                            {loading ? '...' : 'Chạy mock'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}