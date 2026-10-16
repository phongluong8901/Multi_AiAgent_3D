'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    agentsApi,
    promptsApi,
    toolsApi,
    listModels,
    Prompt,
    Tool,
    AIModel,
} from '@/lib/api'

export default function SetupAgentPage() {
    const router = useRouter()

    const [id, setId] = useState('')
    const [name, setName] = useState('')
    const [color, setColor] = useState('#4299e1')
    const [promptId, setPromptId] = useState('')
    const [modelId, setModelId] = useState('')
    const [selectedTools, setSelectedTools] = useState<string[]>([])

    const [prompts, setPrompts] = useState<Prompt[]>([])
    const [tools, setTools] = useState<Tool[]>([])
    const [models, setModels] = useState<AIModel[]>([])

    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [loadingMeta, setLoadingMeta] = useState(true)

    useEffect(() => {
        Promise.all([promptsApi.list(), toolsApi.list(), listModels()])
            .then(([p, t, m]) => {
                setPrompts(p ?? [])
                setTools(t ?? [])
                setModels(m ?? [])
                if (m?.[0]) setModelId(m[0].id)
            })
            .catch((e) => console.error(e))
            .finally(() => setLoadingMeta(false))
    }, [])

    function toggleTool(toolId: string) {
        setSelectedTools((prev) =>
            prev.includes(toolId)
                ? prev.filter((x) => x !== toolId)
                : [...prev, toolId]
        )
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const agentId = (
                id.trim() || name.toLowerCase().replace(/\s+/g, '-')
            ).trim()

            // BE hiện nhận prompt_id + tool_ids
            // model_id: gửi kèm nếu BE hỗ trợ; không thì chỉ lưu ý trên UI
            const payload: Parameters<typeof agentsApi.create>[0] = {
                id: agentId,
                name: name.trim(),
                color,
                status: 'idle',
                speech: null,
                pos_x: 0,
                pos_y: 0,
                pos_z: 0,
                prompt_id: promptId || null,
                tool_ids: selectedTools,
            }

            // Nếu sau này AgentCreate có model_id, bỏ comment dòng dưới:
            // ;(payload as any).model_id = modelId || null

            await agentsApi.create(payload)

            // Tạm lưu model preference phía client (khi BE chưa có field)
            if (typeof window !== 'undefined' && modelId) {
                localStorage.setItem(`agent_model:${agentId}`, modelId)
            }

            router.push('/agents')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Create failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-lg space-y-6">
            <div>
                <h1 className="text-xl font-semibold">Setup Agent</h1>
                <p className="text-sm text-zinc-400 mt-1">
                    Chọn Prompt, Tools và Model AI
                </p>
            </div>

            <form
                onSubmit={handleSubmit}
                className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5"
            >
                {/* ID */}
                <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">ID (unique)</label>
                    <input
                        value={id}
                        onChange={(e) => setId(e.target.value)}
                        placeholder="ben"
                        className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                    />
                </div>

                {/* Name */}
                <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Name</label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        placeholder="Ben"
                        className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                    />
                </div>

                {/* Color */}
                <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Color</label>
                    <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="h-10 w-20 rounded border border-zinc-700 bg-zinc-800"
                    />
                </div>

                {/* Prompt */}
                <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Prompt</label>
                    <select
                        value={promptId}
                        onChange={(e) => setPromptId(e.target.value)}
                        disabled={loadingMeta}
                        className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                    >
                        <option value="">— Không chọn —</option>
                        {prompts.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.title} ({p.id})
                            </option>
                        ))}
                    </select>
                    {promptId && (
                        <p className="mt-1.5 text-[11px] text-zinc-500 line-clamp-3">
                            {prompts.find((p) => p.id === promptId)?.content}
                        </p>
                    )}
                    <p className="mt-1 text-[11px] text-zinc-600">
                        Quản lý tại <a href="/prompts" className="text-blue-400 hover:underline">/prompts</a>
                    </p>
                </div>

                {/* Model AI */}
                <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Model AI</label>
                    <select
                        value={modelId}
                        onChange={(e) => setModelId(e.target.value)}
                        disabled={loadingMeta}
                        className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                    >
                        {models.length === 0 && <option value="">— Không có model —</option>}
                        {models.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.name} · {m.provider}
                            </option>
                        ))}
                    </select>
                    {modelId && (
                        <p className="mt-1.5 text-[11px] text-zinc-500">
                            {models.find((m) => m.id === modelId)?.description}
                        </p>
                    )}
                    <p className="mt-1 text-[11px] text-zinc-600">
                        Xem list tại <a href="/models" className="text-blue-400 hover:underline">/models</a>
                        {' '}(BE chưa có field model trên agent thì chỉ lưu preference FE)
                    </p>
                </div>

                {/* Tools */}
                <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Tools</label>
                    {loadingMeta ? (
                        <p className="text-xs text-zinc-500">Đang tải...</p>
                    ) : tools.length === 0 ? (
                        <p className="text-xs text-zinc-500">
                            Chưa có tool — tạo tại{' '}
                            <a href="/tools" className="text-blue-400 hover:underline">/tools</a>
                        </p>
                    ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto rounded-lg border border-zinc-700 p-3">
                            {tools.map((tool) => (
                                <label
                                    key={tool.id}
                                    className="flex items-start gap-2 text-sm cursor-pointer hover:bg-zinc-800/50 rounded px-1 py-1"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedTools.includes(tool.id)}
                                        onChange={() => toggleTool(tool.id)}
                                        className="mt-1"
                                    />
                                    <span>
                                        <span className="text-white">{tool.name}</span>
                                        <span className="text-zinc-500 text-xs ml-1">({tool.id})</span>
                                        {tool.description && (
                                            <span className="block text-xs text-zinc-500">
                                                {tool.description}
                                            </span>
                                        )}
                                    </span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {error && (
                    <p className="text-red-400 text-xs break-all whitespace-pre-wrap">{error}</p>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm px-4 py-2.5 transition"
                >
                    {loading ? 'Creating...' : 'Create agent'}
                </button>
            </form>
        </div>
    )
}