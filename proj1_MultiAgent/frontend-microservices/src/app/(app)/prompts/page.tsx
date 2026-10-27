'use client'

import { useEffect, useState } from 'react'
import { promptsApi, Prompt } from '@/lib/api'
import { toast } from 'sonner'
import { useConfirm } from '@/context/ConfirmContext'

export default function PromptsPage() {
    const { confirm } = useConfirm()
    const [prompts, setPrompts] = useState<Prompt[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // form tạo nhanh
    const [id, setId] = useState('')
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [saving, setSaving] = useState(false)

    async function load() {
        setLoading(true)
        setError('')
        try {
            const data = await promptsApi.list()
            setPrompts(data ?? [])
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
            await promptsApi.create({
                id: id.trim() || title.toLowerCase().replace(/\s+/g, '-'),
                title: title.trim(),
                content: content.trim(),
            })
            setId('')
            setTitle('')
            setContent('')
            toast.success('Đã tạo Prompt thành công!')
            await load()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Tạo prompt thất bại')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(promptId: string) {
        const isConfirmed = await confirm({
            title: 'Xóa Prompt',
            description: `Bạn có chắc muốn xóa prompt "${promptId}"?`,
            confirmText: 'Xóa Prompt',
            variant: 'danger',
        })
        if (!isConfirmed) return
        try {
            await promptsApi.remove(promptId)
            toast.success(`Đã xóa prompt "${promptId}"`)
            await load()
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Xóa prompt thất bại')
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-semibold">Prompts</h1>
                <p className="text-sm text-zinc-400 mt-1">System prompts cho agent</p>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
            {loading && <p className="text-zinc-500 text-sm">Loading...</p>}

            <div className="grid gap-3">
                {prompts.map((p) => (
                    <div
                        key={p.id}
                        className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="font-medium">{p.title}</h2>
                                <p className="text-xs text-zinc-500 mt-0.5">{p.id}</p>
                            </div>
                            <button
                                onClick={() => handleDelete(p.id)}
                                className="text-xs text-red-400 hover:underline shrink-0"
                            >
                                Delete
                            </button>
                        </div>
                        <pre className="mt-3 text-xs text-zinc-300 whitespace-pre-wrap bg-zinc-800/60 rounded-lg p-3 max-h-40 overflow-y-auto">
                            {p.content}
                        </pre>
                    </div>
                ))}
                {!loading && prompts.length === 0 && (
                    <p className="text-sm text-zinc-500">Chưa có prompt</p>
                )}
            </div>

            <form
                onSubmit={handleCreate}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3"
            >
                <h2 className="text-sm font-medium text-zinc-300">Tạo prompt mới</h2>
                <input
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    placeholder="ID (vd: dev-assistant)"
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Title"
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                    rows={4}
                    placeholder="Nội dung system prompt..."
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm px-4 py-2"
                >
                    {saving ? 'Saving...' : 'Create prompt'}
                </button>
            </form>
        </div>
    )
}