// src/components/ui/TaskPanel.tsx
'use client'

import { useState } from 'react'
import TaskCard, { Task } from './TaskCard'

const MOCK_TASKS: Task[] = [
    { id: '1', title: 'Fix login bug', agent: 'Ben', status: 'doing' },
    { id: '2', title: 'Update landing page', agent: 'Cory', status: 'todo' },
    { id: '3', title: 'Review PR #42', agent: 'Luke', status: 'doing' },
    { id: '4', title: 'Prepare standup notes', agent: 'Allan', status: 'blocked' },
    { id: '5', title: 'Deploy staging', agent: 'Ben', status: 'done' },
]

export default function TaskPanel() {
    const [taskInput, setTaskInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [msg, setMsg] = useState<string | null>(null)

    const handleRunWorkflow = async (taskText: string) => {
        if (!taskText.trim() || loading) return
        setLoading(true)
        setMsg('Đang gửi lệnh tới LangGraph AI...')

        try {
            const res = await fetch('http://localhost:4000/api/workflow/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task: taskText }),
            })
            const data = await res.json()
            if (data.success) {
                setMsg('Đã kích hoạt LangGraph! Hãy quan sát Ben & Luke.')
            } else {
                setMsg(`Lỗi: ${data.error || 'Thất bại'}`)
            }
        } catch (err: unknown) {
            setMsg('Không thể kết nối đến Backend:4000')
        } finally {
            setLoading(false)
            setTimeout(() => setMsg(null), 4000)
        }
    }

    return (
        <div className="absolute top-4 right-4 w-80 max-h-[85vh] overflow-y-auto bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 rounded-xl shadow-2xl p-4 text-white z-50">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-300">
                    AI Task Workflow
                </h2>
                <span className="text-[11px] text-zinc-500">{MOCK_TASKS.length} sample tasks</span>
            </div>

            {/* Input AI Task Box */}
            <div className="mb-4 p-2.5 bg-zinc-800/90 rounded-lg border border-zinc-700">
                <label className="text-[11px] font-medium text-zinc-400 block mb-1">
                    Giao việc cho Ben (Dev) & Luke (Lead):
                </label>
                <div className="flex gap-1.5">
                    <input
                        type="text"
                        placeholder="VD: Tạo form đăng nhập..."
                        value={taskInput}
                        onChange={(e) => setTaskInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRunWorkflow(taskInput)
                        }}
                        className="flex-1 bg-zinc-900 text-xs text-white px-2.5 py-1.5 rounded border border-zinc-700 focus:outline-none focus:border-blue-500"
                    />
                    <button
                        onClick={() => handleRunWorkflow(taskInput || 'Viết component button có hiệu ứng neon')}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white text-xs px-3 py-1.5 rounded font-medium transition cursor-pointer"
                    >
                        {loading ? 'Đang gọi...' : 'Chạy'}
                    </button>
                </div>
                {msg && (
                    <p className="text-[11px] text-blue-400 mt-2 font-medium animate-pulse">
                        {msg}
                    </p>
                )}
            </div>

            {/* Tasks list */}
            <div className="flex flex-col gap-2">
                <div className="text-[11px] text-zinc-400 font-medium">Bấm vào task để chạy thử:</div>
                {MOCK_TASKS.map((task) => (
                    <div
                        key={task.id}
                        onClick={() => handleRunWorkflow(task.title)}
                        className="cursor-pointer transition active:scale-[0.98]"
                    >
                        <TaskCard task={task} />
                    </div>
                ))}
            </div>
        </div>
    )
}