'use client'

import { useEffect, useState, useMemo } from 'react'
import { promptsApi, Prompt } from '@/lib/api'
import { toast } from 'sonner'
import { useConfirm } from '@/context/ConfirmContext'
import {
    IconFileText,
    IconPlus,
    IconTrash,
    IconSearch,
    IconCopy,
    IconCheck,
} from '@/components/ui/icons'

/**
 * Trang quản lý System Prompts (PromptsPage).
 * Cho phép xem danh sách, tìm kiếm, sao chép nhanh, tạo mới và xóa các mẫu System Prompt
 * dùng để lắp ráp vào phần đầu (Head) của AI Agent.
 */
export default function PromptsPage() {
    const { confirm } = useConfirm()
    const [prompts, setPrompts] = useState<Prompt[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [copiedId, setCopiedId] = useState<string | null>(null)

    // State form tạo nhanh Prompt mới
    const [id, setId] = useState('')
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [saving, setSaving] = useState(false)

    /**
     * Tải danh sách System Prompts từ Agent Service API.
     */
    async function load() {
        setLoading(true)
        setError('')
        try {
            const data = await promptsApi.list()
            setPrompts(data ?? [])
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Không thể tải danh sách Prompts')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    /**
     * Lọc danh sách Prompts theo từ khóa tìm kiếm (title, id, content).
     */
    const filteredPrompts = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        if (!q) return prompts
        return prompts.filter(
            (p) =>
                p.title.toLowerCase().includes(q) ||
                p.id.toLowerCase().includes(q) ||
                (p.content || '').toLowerCase().includes(q)
        )
    }, [prompts, searchQuery])

    /**
     * Tạo mới một System Prompt và làm mới danh sách.
     */
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

    /**
     * Xác nhận và xóa một System Prompt theo ID.
     */
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

    /**
     * Sao chép nội dung System Prompt vào clipboard.
     */
    function handleCopyContent(prompt: Prompt) {
        navigator.clipboard?.writeText(prompt.content || '')
        setCopiedId(prompt.id)
        toast.success(`Đã sao chép nội dung "${prompt.title}"`)
        setTimeout(() => {
            setCopiedId((prev) => (prev === prompt.id ? null : prev))
        }, 2000)
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold flex items-center gap-2">
                        <IconFileText className="w-5 h-5 text-blue-400" />
                        <span>System Prompts</span>
                    </h1>
                    <p className="text-sm text-zinc-400 mt-1">
                        Quản lý kho chỉ thị vai trò (System Prompts) để gắn vào bộ não AI Agent
                    </p>
                </div>

                <div className="relative w-full sm:w-72">
                    <IconSearch className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm kiếm prompt theo tên, ID..."
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-800 pl-9 pr-3 py-2 text-xs text-zinc-200 outline-none focus:border-blue-500 transition"
                    />
                </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
            {loading && <p className="text-zinc-500 text-sm">Đang tải danh sách prompts...</p>}

            <div className="grid gap-3">
                {filteredPrompts.map((p) => (
                    <div
                        key={p.id}
                        className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700/80 transition"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="font-medium text-zinc-100">{p.title}</h2>
                                <p className="text-xs text-zinc-500 font-mono mt-0.5">{p.id}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => handleCopyContent(p)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 transition"
                                    title="Sao chép nội dung Prompt"
                                >
                                    {copiedId === p.id ? (
                                        <>
                                            <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
                                            <span className="text-emerald-400">Đã chép</span>
                                        </>
                                    ) : (
                                        <>
                                            <IconCopy className="w-3.5 h-3.5 text-zinc-400" />
                                            <span>Sao chép</span>
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(p.id)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 text-xs text-red-400 transition"
                                >
                                    <IconTrash className="w-3.5 h-3.5" />
                                    <span>Xóa</span>
                                </button>
                            </div>
                        </div>
                        <pre className="mt-3 text-xs text-zinc-300 whitespace-pre-wrap bg-zinc-800/60 rounded-lg p-3 max-h-40 overflow-y-auto border border-zinc-800">
                            {p.content}
                        </pre>
                    </div>
                ))}
                {!loading && filteredPrompts.length === 0 && (
                    <p className="text-sm text-zinc-500">Không tìm thấy prompt nào phù hợp.</p>
                )}
            </div>

            <form
                onSubmit={handleCreate}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3"
            >
                <h2 className="text-sm font-medium text-zinc-300 flex items-center gap-1.5">
                    <IconPlus className="w-4 h-4 text-blue-400" />
                    <span>Tạo System Prompt mới</span>
                </h2>
                <input
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    placeholder="ID định danh (vd: dev-assistant, để trống sẽ tự sinh từ tiêu đề)"
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Tiêu đề Prompt (vd: Chuyên gia Phân tích Dữ liệu)"
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                    rows={4}
                    placeholder="Nội dung chỉ thị hệ thống (System Prompt)..."
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium px-4 py-2 transition"
                >
                    <IconPlus className="w-4 h-4" />
                    <span>{saving ? 'Đang lưu...' : 'Tạo Prompt'}</span>
                </button>
            </form>
        </div>
    )
}
