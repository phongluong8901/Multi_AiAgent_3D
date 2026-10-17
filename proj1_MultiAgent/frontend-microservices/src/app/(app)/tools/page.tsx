'use client'

import { useEffect, useState } from 'react'
import { toolsApi, Tool } from '@/lib/api'

export default function ToolsPage() {
    const [tools, setTools] = useState<Tool[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const [id, setId] = useState('')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [saving, setSaving] = useState(false)

    async function load() {
        setLoading(true)
        setError('')
        try {
            const data = await toolsApi.list()
            setTools(data ?? [])
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Load failed')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        try {
            await toolsApi.create({
                id: id.trim() || name.toLowerCase().replace(/\s+/g, '-'),
                name: name.trim(),
                description: description.trim() || undefined,
            })
            setId('')
            setName('')
            setDescription('')
            await load()
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Create failed')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(toolId: string) {
        if (!confirm(`Xóa tool ${toolId}?`)) return
        try {
            await toolsApi.remove(toolId)
            await load()
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Delete failed')
        }
    }

    async function handleTest(toolId: string) {
        try {
            const res = await toolsApi.execute(toolId, { input: 'test' })
            alert(JSON.stringify(res, null, 2))
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Execute failed')
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-semibold">Tools</h1>
                <p className="text-sm text-zinc-400 mt-1">Tools gắn vào agent</p>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
            {loading && <p className="text-zinc-500 text-sm">Loading...</p>}

            <div className="grid sm:grid-cols-2 gap-3">
                {tools.map((t) => (
                    <div
                        key={t.id}
                        className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <h2 className="font-medium">{t.name}</h2>
                                <p className="text-xs text-zinc-500">{t.id}</p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button
                                    onClick={() => handleTest(t.id)}
                                    className="text-xs text-blue-400 hover:underline"
                                >
                                    Test
                                </button>
                                <button
                                    onClick={() => handleDelete(t.id)}
                                    className="text-xs text-red-400 hover:underline"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                        <p className="text-sm text-zinc-400 mt-2">
                            {t.description || '—'}
                        </p>
                    </div>
                ))}
                {!loading && tools.length === 0 && (
                    <p className="text-sm text-zinc-500">Chưa có tool</p>
                )}
            </div>

            <form
                onSubmit={handleCreate}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3 max-w-lg"
            >
                <h2 className="text-sm font-medium text-zinc-300">Tạo tool mới</h2>
                <input
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    placeholder="ID (vd: calculator)"
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Name"
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description"
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm px-4 py-2"
                >
                    {saving ? 'Saving...' : 'Create tool'}
                </button>
            </form>
        </div>
    )
}