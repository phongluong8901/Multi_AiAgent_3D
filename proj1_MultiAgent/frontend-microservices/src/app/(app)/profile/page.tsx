'use client'

import { useState } from 'react'
import { useUser } from '@/hooks/useUser'
import { useOwnedAgents } from '@/hooks/useOwnedAgents'
import { useAgents } from '@/hooks/useAgents'

const PRESET_AVATARS = [
    'https://api.dicebear.com/7.x/bottts/svg?seed=Alex',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Sam',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Jordan',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Taylor',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Morgan',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Riley',
]

export default function ProfilePage() {
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
                Đang tải hồ sơ...
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

    return (
        <div className="mx-auto max-w-4xl space-y-8 pb-16">
            {/* Banner */}
            <div className="rounded-3xl border border-zinc-800 bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-zinc-900 p-8">
                <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
                    <div className="relative">
                        <img
                            src={
                                avatarUrl ||
                                `https://api.dicebear.com/7.x/bottts/svg?seed=${name || 'User'}`
                            }
                            alt={name}
                            className="h-20 w-20 rounded-2xl border-2 border-blue-500/40 object-cover"
                        />
                        <span
                            className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full ring-4 ring-zinc-900 ${profile?.status === 'online'
                                ? 'bg-emerald-500'
                                : profile?.status === 'busy'
                                    ? 'bg-amber-500'
                                    : 'bg-zinc-500'
                                }`}
                        />
                    </div>
                    <div>
                        <p className="text-xs text-blue-400">
                            {profile?.role || 'Thành viên'}
                        </p>
                        <h1 className="text-2xl font-bold text-white">
                            {profile?.name || 'Thành viên'}
                        </h1>
                        <p className="font-mono text-xs text-zinc-400">{profile?.email}</p>
                    </div>
                    <div className="sm:ml-auto">
                        <select
                            value={profile?.status || 'online'}
                            onChange={(e) =>
                                updateStatus(e.target.value as 'online' | 'offline' | 'busy')
                            }
                            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-white"
                        >
                            <option value="online">Online</option>
                            <option value="busy">Busy</option>
                            <option value="offline">Offline</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Form */}
                <form
                    onSubmit={handleSave}
                    className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 md:col-span-2"
                >
                    <h2 className="border-b border-zinc-800 pb-3 text-base font-bold text-white">
                        Chỉnh sửa hồ sơ
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
                        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
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
                            className="text-xs text-zinc-400"
                        />
                    </div>

                    <div className="flex justify-end border-t border-zinc-800 pt-3">
                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                        >
                            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </button>
                    </div>
                </form>

                {/* Owned agents */}
                <div className="space-y-3 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
                    <h2 className="border-b border-zinc-800 pb-3 text-base font-bold text-white">
                        Agent của tôi
                    </h2>
                    {agentsLoading ? (
                        <p className="text-xs text-zinc-500">Đang tải...</p>
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
                                            className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium ${owned
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