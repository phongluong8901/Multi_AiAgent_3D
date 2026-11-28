'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/hooks/useUser'
import { useOwnedAgents } from '@/hooks/useOwnedAgents'
import { useAgents } from '@/hooks/useAgents'
import { useLanguage } from '@/context/LanguageContext'

const PRESET_AVATARS = [
    'https://api.dicebear.com/7.x/bottts/svg?seed=Alex',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Sam',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Jordan',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Taylor',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Morgan',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Riley',
]

export default function ProfilePage() {
    const { t } = useLanguage()
    const { profile, loading, saving, updateProfile, uploadAvatar, updateStatus } =
        useUser()
    const { agents } = useAgents()
    const { ownedIds, toggleAgent, loading: agentsLoading } = useOwnedAgents()

    const [name, setName] = useState('')
    const [bio, setBio] = useState('')
    const [avatarUrl, setAvatarUrl] = useState('')
    const [formReady, setFormReady] = useState(false)

    // Đồng bộ form khi profile load xong (1 lần)
    if (profile && !formReady) {
        setName(profile.name || '')
        setBio(profile.bio || '')
        setAvatarUrl(profile.avatar || profile.avatarUrl || '')
        setFormReady(true)
    }

    if (loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center text-sm text-zinc-500">
                {t.common.loading}
            </div>
        )
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault()
        await updateProfile({
            name: name.trim(),
            bio: bio.trim(),
            avatar: avatarUrl.trim(),
        })
    }

    const node = profile?.hardwareNode

    return (
        <div className="mx-auto max-w-4xl w-full space-y-6 sm:space-y-8 pb-16 overflow-hidden">
            {/* Banner */}
            <div className="rounded-2xl sm:rounded-3xl border border-zinc-800 bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-zinc-900 p-5 sm:p-8">
                <div className="flex flex-col items-start gap-4 sm:gap-6 sm:flex-row sm:items-center">
                    <div className="relative shrink-0">
                        <img
                            src={
                                avatarUrl ||
                                `https://api.dicebear.com/7.x/bottts/svg?seed=${name || 'User'}`
                            }
                            alt={name}
                            className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl border-2 border-blue-500/40 object-cover"
                        />
                        <span
                            className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full ring-4 ring-zinc-900 ${profile?.status === 'online'
                                    ? 'bg-emerald-500'
                                    : profile?.status === 'busy'
                                        ? 'bg-amber-500'
                                        : 'bg-zinc-500'
                                }`}
                        />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs text-blue-400">
                            {profile?.role || 'Thành viên'}
                        </p>
                        <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
                            {profile?.name || 'Thành viên'}
                        </h1>
                        <p className="font-mono text-xs text-zinc-400 truncate">{profile?.email}</p>
                    </div>
                    <div className="sm:ml-auto w-full sm:w-auto">
                        <select
                            value={profile?.status || 'online'}
                            onChange={(e) =>
                                updateStatus(e.target.value as 'online' | 'offline' | 'busy')
                            }
                            className="w-full sm:w-auto rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-white"
                        >
                            <option value="online">Online</option>
                            <option value="busy">Busy</option>
                            <option value="offline">Offline</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Cấu hình AI Hardware Node */}
            <div className="rounded-2xl sm:rounded-3xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3 gap-2">
                    <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-200">
                        Thông số AI Hardware Node
                    </h2>
                    <Link
                        href="/node-checker"
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium transition shrink-0"
                    >
                        Kiểm tra &rarr;
                    </Link>
                </div>

                {node && node.canRunAI ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-xs">
                        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-3.5 space-y-1">
                            <span className="text-zinc-500 block">Trạng thái Node:</span>
                            <div className="flex items-center gap-2">
                                <span
                                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${node.status === 'BUSY'
                                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                            : node.status === 'IDLE'
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                                        }`}
                                >
                                    {node.status || 'IDLE'}
                                </span>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-3.5 space-y-1">
                            <span className="text-zinc-500 block">Cấu hình Phần cứng:</span>
                            <p className="font-semibold text-zinc-200">
                                {node.cpuCores} Cores | &ge; {node.deviceMemoryGB} GB RAM
                            </p>
                        </div>

                        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-3.5 space-y-1">
                            <span className="text-zinc-500 block">Bộ tăng tốc AI:</span>
                            <p className={`font-medium ${node.hasWebGPU ? 'text-emerald-400' : 'text-zinc-400'}`}>
                                {node.hasWebGPU ? node.gpuName || 'WebGPU Enabled' : 'CPU Mode Only'}
                            </p>
                        </div>

                        <div className="sm:col-span-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between flex-wrap gap-2">
                            <span className="text-zinc-400 text-[11px]">Model nhận chạy:</span>
                            <div className="flex flex-wrap gap-1">
                                {node.recommendedModels?.map((m: string) => (
                                    <span
                                        key={m}
                                        className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono"
                                    >
                                        {m}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-zinc-400 bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800 gap-3">
                        <span>Chưa đăng ký hoặc kích hoạt Node tính toán phân tán.</span>
                        <Link
                            href="/node-checker"
                            className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white font-semibold text-[11px] hover:bg-blue-500 transition text-center shrink-0"
                        >
                            Kích hoạt Node ngay
                        </Link>
                    </div>
                )}
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Form */}
                <form
                    onSubmit={handleSave}
                    className="space-y-4 rounded-2xl sm:rounded-3xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6 md:col-span-2"
                >
                    <h2 className="border-b border-zinc-800 pb-3 text-base font-bold text-white">
                        {t.common.edit} {t.nav.profile}
                    </h2>

                    <div>
                        <label className="mb-1.5 block text-xs text-zinc-400">Tên *</label>
                        <input
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs text-zinc-400">Bio</label>
                        <textarea
                            rows={3}
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <label className="mb-1.5 block text-xs text-zinc-400">Avatar</label>
                        <div className="mb-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                            {PRESET_AVATARS.map((url) => (
                                <button
                                    key={url}
                                    type="button"
                                    onClick={() => setAvatarUrl(url)}
                                    className={`h-10 w-10 shrink-0 overflow-hidden rounded-xl border ${avatarUrl === url
                                            ? 'border-blue-500 ring-2 ring-blue-500/40'
                                            : 'border-zinc-800'
                                        }`}
                                >
                                    <img src={url} alt="" className="h-full w-full object-cover" />
                                </button>
                            ))}
                        </div>
                        <input
                            value={avatarUrl}
                            onChange={(e) => setAvatarUrl(e.target.value)}
                            placeholder="URL ảnh hoặc chọn preset"
                            className="mb-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-xs text-white outline-none focus:border-blue-500"
                        />
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) uploadAvatar(f)
                            }}
                            className="text-xs text-zinc-400 w-full"
                        />
                    </div>

                    <div className="flex justify-end border-t border-zinc-800 pt-3">
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full sm:w-auto rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition"
                        >
                            {saving ? t.common.saving : t.common.save}
                        </button>
                    </div>
                </form>

                {/* Owned agents */}
                <div className="space-y-3 rounded-2xl sm:rounded-3xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
                    <h2 className="border-b border-zinc-800 pb-3 text-base font-bold text-white">
                        Agent của tôi
                    </h2>
                    {agentsLoading ? (
                        <p className="text-xs text-zinc-500">{t.common.loading}</p>
                    ) : (
                        <div className="max-h-80 space-y-2 overflow-y-auto">
                            {agents.map((ag) => {
                                const owned = ownedIds.includes(ag.id)
                                return (
                                    <div
                                        key={ag.id}
                                        className={`flex items-center justify-between gap-2 rounded-2xl border p-3 ${owned
                                                ? 'border-blue-500/40 bg-blue-950/20'
                                                : 'border-zinc-800 bg-zinc-950'
                                            }`}
                                    >
                                        <div className="flex min-w-0 items-center gap-2">
                                            <span
                                                className="h-3 w-3 shrink-0 rounded-full"
                                                style={{ backgroundColor: ag.color }}
                                            />
                                            <div className="truncate">
                                                <p className="truncate text-xs font-semibold text-white">
                                                    {ag.name}
                                                </p>
                                                <p className="font-mono text-[10px] text-zinc-500">
                                                    @{ag.id}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => toggleAgent(ag.id)}
                                            className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${owned
                                                    ? 'bg-zinc-800 text-zinc-300 hover:text-rose-300'
                                                    : 'bg-blue-600 text-white hover:bg-blue-500'
                                                }`}
                                        >
                                            {owned ? 'Bỏ' : '+ Nhận'}
                                        </button>
                                    </div>
                                )
                            })}
                            {agents.length === 0 && (
                                <p className="text-xs text-zinc-500">Chưa có agent</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
