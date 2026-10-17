'use client'

import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
    agentsApi,
    promptsApi,
    toolsApi,
    Agent,
    Prompt,
    Tool,
    AgentUpdate,
} from '@/lib/api'

export default function AgentDetailPage() {
    const params = useParams()
    const router = useRouter()
    const id = String(params.id)

    const [agent, setAgent] = useState<Agent | null>(null)
    const [prompts, setPrompts] = useState<Prompt[]>([])
    const [tools, setTools] = useState<Tool[]>([])

    const [name, setName] = useState('')
    const [color, setColor] = useState('#4299e1')
    const [status, setStatus] = useState('idle')
    const [speech, setSpeech] = useState('')
    const [promptId, setPromptId] = useState('')
    const [selectedTools, setSelectedTools] = useState<string[]>([])

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    useEffect(() => {
        async function load() {
            setLoading(true)
            setError('')
            try {
                const [a, p, t] = await Promise.all([
                    agentsApi.get(id),
                    promptsApi.list().catch(() => []),
                    toolsApi.list().catch(() => []),
                ])

                setAgent(a)
                setPrompts(p ?? [])
                setTools(t ?? [])

                setName(a.name ?? '')
                setColor(a.color || '#4299e1')
                setStatus(a.status || 'idle')
                setSpeech(a.speech ?? '')
                setPromptId(a.prompt_id ?? '')

                // tools có thể là object[] từ BE
                const toolIds = Array.isArray(a.tools)
                    ? a.tools.map((x: any) => (typeof x === 'string' ? x : x?.id)).filter(Boolean)
                    : []
                setSelectedTools(toolIds)
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Load failed')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [id])

    function toggleTool(toolId: string) {
        setSelectedTools((prev) =>
            prev.includes(toolId) ? prev.filter((x) => x !== toolId) : [...prev, toolId]
        )
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setMessage('')
        setError('')

        try {
            const payload: AgentUpdate = {
                name: name.trim(),
                color,
                status,
                speech: speech.trim() || null,
                prompt_id: promptId || null,
                tool_ids: selectedTools,
            }

            const updated = await agentsApi.update(id, payload)
            setAgent(updated)
            setMessage('Đã lưu')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Update failed')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete() {
        if (!confirm(`Xóa agent "${id}"?`)) return
        try {
            await agentsApi.remove(id)
            router.push('/agents')
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Delete failed')
        }
    }

    if (loading) {
        return <p className="text-sm text-zinc-400">Loading...</p>
    }

    if (error && !agent) {
        return (
            <div className="space-y-3">
                <p className="text-red-400 text-sm">{error}</p>
                <Link href="/agents" className="text-blue-400 text-sm hover:underline">
                    ← Quay lại
                </Link>
            </div>
        )
    }

    const pos = Array.isArray(agent?.position) ? agent!.position : [0, 0, 0]

    return (
        <div className="max-w-2xl space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                    <h1 className="text-xl font-semibold">{name || id}</h1>
                </div>
                <Link href="/agents" className="text-sm text-zinc-400 hover:text-white">
                    ← Agents
                </Link>
            </div>

            {/* Info nhanh */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                    <p className="text-zinc-500 text-xs">ID</p>
                    <p>{id}</p>
                </div>
                <div>
                    <p className="text-zinc-500 text-xs">Position</p>
                    <p>
                        {pos[0]}, {pos[1]}, {pos[2]}
                    </p>
                </div>
            </div>

            {/* Form edit */}
            <form
                onSubmit={handleSave}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4"
            >
                <h2 className="text-sm font-medium text-zinc-300">Chỉnh sửa</h2>

                <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Name</label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs text-zinc-400 mb-1.5">Color</label>
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="h-10 w-full rounded border border-zinc-700 bg-zinc-800"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-zinc-400 mb-1.5">Status</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        >
                            <option value="idle">idle</option>
                            <option value="working">working</option>
                            <option value="meeting">meeting</option>
                            <option value="blocked">blocked</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Speech</label>
                    <input
                        value={speech}
                        onChange={(e) => setSpeech(e.target.value)}
                        placeholder="Câu nói trên đầu agent..."
                        className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Prompt</label>
                    <select
                        value={promptId}
                        onChange={(e) => setPromptId(e.target.value)}
                        className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    >
                        <option value="">— Không chọn —</option>
                        {prompts.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.title} ({p.id})
                            </option>
                        ))}
                    </select>
                    {promptId && (
                        <p className="mt-1.5 text-[11px] text-zinc-500 line-clamp-4">
                            {prompts.find((p) => p.id === promptId)?.content}
                        </p>
                    )}
                </div>

                <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Tools</label>
                    {tools.length === 0 ? (
                        <p className="text-xs text-zinc-500">Chưa có tool</p>
                    ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto rounded-lg border border-zinc-700 p-3">
                            {tools.map((tool) => (
                                <label
                                    key={tool.id}
                                    className="flex items-start gap-2 text-sm cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedTools.includes(tool.id)}
                                        onChange={() => toggleTool(tool.id)}
                                        className="mt-1"
                                    />
                                    <span>
                                        {tool.name}{' '}
                                        <span className="text-zinc-500 text-xs">({tool.id})</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {message && <p className="text-green-400 text-xs">{message}</p>}
                {error && <p className="text-red-400 text-xs break-all">{error}</p>}

                <div className="flex flex-wrap gap-2 pt-1">
                    <button
                        type="submit"
                        disabled={saving}
                        className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2 text-sm"
                    >
                        {saving ? 'Saving...' : 'Lưu thay đổi'}
                    </button>

                    <Link
                        href="/office"
                        className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
                    >
                        Xem trong Office
                    </Link>

                    <Link
                        href={`/chat/${id}`}
                        className="rounded-lg bg-zinc-100 text-zinc-900 px-4 py-2 text-sm hover:bg-white"
                    >
                        Chat với agent
                    </Link>

                    <button
                        type="button"
                        onClick={handleDelete}
                        className="rounded-lg border border-red-900/50 text-red-400 px-4 py-2 text-sm hover:bg-red-950/40"
                    >
                        Xóa agent
                    </button>
                </div>
            </form>
        </div>
    )
}