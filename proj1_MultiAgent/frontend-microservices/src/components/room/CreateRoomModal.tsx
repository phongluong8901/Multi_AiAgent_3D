'use client'

import { Agent } from '@/lib/api'
import { IconX, IconGlobe, IconLock } from '@/components/ui/icons'

interface CreateRoomModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (e: React.FormEvent) => void
    roomName: string
    setRoomName: (val: string) => void
    description: string
    setDescription: (val: string) => void
    tier: 'standard' | 'premium' | 'enterprise'
    setTier: (tier: 'standard' | 'premium' | 'enterprise') => void
    ownedAgentsCount: number
    setOwnedAgentsCount: (val: number) => void
    availableAgents: Agent[]
    selectedAgents: string[]
    toggleAgentSelection: (id: string) => void
    submitting: boolean

    // Nhận state từ trang cha (RoomsHubPage)
    isPublic: boolean
    setIsPublic: (val: boolean) => void
    password: string
    setPassword: (val: string) => void
}

export function CreateRoomModal({
    isOpen,
    onClose,
    onSubmit,
    roomName,
    setRoomName,
    description,
    setDescription,
    tier,
    setTier,
    ownedAgentsCount,
    setOwnedAgentsCount,
    availableAgents,
    selectedAgents,
    toggleAgentSelection,
    submitting,
    isPublic,
    setIsPublic,
    password,
    setPassword,
}: CreateRoomModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-lg space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white">Tạo Phòng Nhóm Mới</h3>
                        <p className="mt-0.5 text-xs text-zinc-400">
                            Thiết lập không gian làm việc đa Agent
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                    >
                        <IconX className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-zinc-300">Tên phòng *</label>
                        <input
                            required
                            value={roomName}
                            onChange={(e) => setRoomName(e.target.value)}
                            placeholder="ví dụ: AI Research Lab"
                            className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-zinc-300">Mô tả</label>
                        <textarea
                            rows={2}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Mục tiêu nhóm..."
                            className="w-full resize-none rounded-xl border border-zinc-700/80 bg-zinc-950 px-3.5 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-blue-500"
                        />
                    </div>

                    {/* Lựa chọn Chế độ phòng: Public / Private */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-zinc-300">Chế độ phòng</label>
                            <div className="relative">
                                <select
                                    value={isPublic ? 'public' : 'private'}
                                    onChange={(e) => setIsPublic(e.target.value === 'public')}
                                    className="w-full appearance-none rounded-xl border border-zinc-700/80 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-blue-500 pr-8"
                                >
                                    <option value="public">Công khai (Public)</option>
                                    <option value="private">Riêng tư (Private)</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                                    {isPublic ? (
                                        <IconGlobe className="h-4 w-4 text-blue-400" />
                                    ) : (
                                        <IconLock className="h-4 w-4 text-amber-400" />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-zinc-300">Tier</label>
                            <select
                                value={tier}
                                onChange={(e) => setTier(e.target.value as typeof tier)}
                                className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                            >
                                <option value="standard">Standard</option>
                                <option value="premium">Premium</option>
                                <option value="enterprise">Enterprise</option>
                            </select>
                        </div>
                    </div>

                    {/* Hiển thị ô nhập mật khẩu nếu chọn chế độ Private */}
                    {!isPublic && (
                        <div className="space-y-1.5 animate-in fade-in duration-200">
                            <label className="text-xs font-medium text-amber-300 flex items-center gap-1.5">
                                <IconLock className="h-3.5 w-3.5" />
                                <span>Mật khẩu bảo vệ phòng *</span>
                            </label>
                            <input
                                type="password"
                                required={!isPublic}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Nhập mật khẩu khóa phòng..."
                                className="w-full rounded-xl border border-amber-500/40 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-amber-500"
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-zinc-300">
                                Giới hạn Agent sở hữu
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={10}
                                value={ownedAgentsCount}
                                onChange={(e) =>
                                    setOwnedAgentsCount(parseInt(e.target.value, 10) || 3)
                                }
                                className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-zinc-300">
                            Chọn AI Agent trong phòng
                        </label>
                        <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto pr-1 pt-1">
                            {(availableAgents.length > 0
                                ? availableAgents
                                : [
                                    { id: 'agent_manager', name: 'Manager Agent' },
                                    { id: 'agent_ml', name: 'ML Expert' },
                                    { id: 'agent_analyst', name: 'Data Analyst' },
                                    { id: 'agent_search', name: 'Search Expert' },
                                    { id: 'agent_summarizer', name: 'Summarizer Agent' },
                                ]
                            ).map((ag) => {
                                const checked = selectedAgents.includes(ag.id)
                                return (
                                    <div
                                        key={ag.id}
                                        onClick={() => toggleAgentSelection(ag.id)}
                                        className={`flex cursor-pointer select-none items-center gap-2 rounded-xl border p-2.5 text-xs transition ${checked
                                                ? 'border-blue-500/50 bg-blue-600/15 font-medium text-white'
                                                : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            readOnly
                                            className="pointer-events-none rounded border-zinc-700 text-blue-600"
                                        />
                                        <span className="truncate">{ag.name}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-zinc-800 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl px-4 py-2 text-xs font-medium text-zinc-400 transition hover:text-white"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow transition hover:bg-blue-500 disabled:opacity-50"
                        >
                            {submitting ? 'Đang tạo...' : 'Tạo phòng ngay'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}