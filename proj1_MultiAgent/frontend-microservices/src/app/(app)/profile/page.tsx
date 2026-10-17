'use client'

import { useState, useEffect } from 'react'
import { usersApi, agentsApi, UserProfile, Agent } from '@/lib/api'
import { getUser, setSession, getToken } from '@/lib/auth'
import {
    IconUser,
    IconBot,
    IconSparkles,
    IconCheckCircle,
    IconAlertCircle,
    IconPlus,
    IconX,
    IconLayers,
} from '@/components/ui/icons'

const PRESET_AVATARS = [
    'https://api.dicebear.com/7.x/bottts/svg?seed=Alex',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Sam',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Jordan',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Taylor',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Morgan',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Riley',
]

export default function UserProfilePage() {
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [name, setName] = useState('')
    const [bio, setBio] = useState('')
    const [avatarUrl, setAvatarUrl] = useState('')
    const [status, setStatus] = useState<'online' | 'busy' | 'offline'>('online')
    const [allAgents, setAllAgents] = useState<Agent[]>([])
    const [myAgents, setMyAgents] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [successMessage, setSuccessMessage] = useState('')
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            try {
                const currentUser = getUser()
                const [userProf, agentList, owned] = await Promise.all([
                    usersApi.getProfile().catch(() => null),
                    agentsApi.list().catch(() => []),
                    usersApi.getMyAgents().catch(() => []),
                ])

                const activeProfile: UserProfile = userProf || {
                    id: currentUser?.id || 'guest',
                    name: currentUser?.name || 'Thành viên',
                    email: currentUser?.email || '',
                    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser?.name || 'User'}`,
                    bio: 'Kỹ sư AI & Điều phối nhóm Multi-Agent',
                    role: 'employee',
                    color: '#3b82f6',
                }

                setProfile(activeProfile)
                setName(activeProfile.name || (activeProfile as any).username || '')
                setBio(activeProfile.bio || '')
                setAvatarUrl(activeProfile.avatar || (activeProfile as any).avatarUrl || '')
                setAllAgents(agentList)
                setMyAgents(owned || (activeProfile as any).ownedAgentIds || [])
            } catch (err: any) {
                console.error('Error loading profile:', err)
                setErrorMessage(err.message)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setSuccessMessage('')
        setErrorMessage('')

        try {
            const updated = await usersApi.updateProfile({
                name: name.trim(),
                bio: bio.trim(),
                avatar: avatarUrl.trim(),
            })

            // Cập nhật session local
            const token = getToken()
            if (token && profile) {
                setSession(token, {
                    id: profile.id,
                    name: name.trim(),
                    email: profile.email,
                })
            }

            setProfile((prev) => (prev ? { ...prev, name: name.trim(), bio: bio.trim(), avatar: avatarUrl.trim() } : null))
            setSuccessMessage('Đã cập nhật hồ sơ người dùng thành công!')
            setTimeout(() => setSuccessMessage(''), 4000)
        } catch (err: any) {
            setErrorMessage(err.message || 'Lỗi khi cập nhật hồ sơ')
        } finally {
            setSaving(false)
        }
    }

    const handleToggleAgent = async (agentId: string) => {
        const has = myAgents.includes(agentId)
        try {
            if (has) {
                await usersApi.removeMyAgent(agentId)
                setMyAgents((prev) => prev.filter((id) => id !== agentId))
            } else {
                await usersApi.addMyAgent(agentId)
                setMyAgents((prev) => [...prev, agentId])
            }
        } catch (err: any) {
            alert(`Lỗi: ${err.message}`)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] text-zinc-500 text-sm">
                Đang tải hồ sơ người dùng...
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-16">
            {/* Header Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-zinc-900 border border-zinc-800 p-8 shadow-xl">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    <div className="relative">
                        <img
                            src={avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${name || 'User'}`}
                            alt={name}
                            className="w-20 h-20 rounded-2xl bg-zinc-950 border-2 border-blue-500/40 shadow-inner object-cover"
                        />
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-zinc-900" />
                    </div>

                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
                            <IconUser className="w-3 h-3" />
                            <span>Tài khoản {profile?.role || 'Thành viên'}</span>
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">
                            {name || 'Thành viên'}
                        </h1>
                        <p className="text-xs text-zinc-400 font-mono">
                            {profile?.email}
                        </p>
                    </div>
                </div>
            </div>

            {/* Notification Alerts */}
            {successMessage && (
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                    <IconCheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{successMessage}</span>
                </div>
            )}
            {errorMessage && (
                <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                    <IconAlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            <div className="grid md:grid-cols-3 gap-6">
                {/* Form cập nhật thông tin cá nhân */}
                <div className="md:col-span-2 space-y-6 rounded-3xl bg-zinc-900 border border-zinc-800 p-6 shadow-xl">
                    <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                        <IconUser className="w-4 h-4 text-blue-400" />
                        <h2 className="text-base font-bold text-white">Chỉnh Sửa Thông Tin Cá Nhân</h2>
                    </div>

                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-zinc-300">Tên hiển thị *</label>
                            <input
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Họ và tên của bạn..."
                                className="w-full rounded-xl bg-zinc-950 border border-zinc-700/80 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-zinc-300">Giới thiệu ngắn (Bio / Vai trò)</label>
                            <textarea
                                rows={3}
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                placeholder="Mô tả vai trò của bạn trong dự án, kỹ năng hoặc cách bạn tương tác với Agent..."
                                className="w-full rounded-xl bg-zinc-950 border border-zinc-700/80 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition resize-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-300">Chọn Avatar hoặc nhập URL ảnh</label>
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                                {PRESET_AVATARS.map((url, i) => (
                                    <button
                                        type="button"
                                        key={i}
                                        onClick={() => setAvatarUrl(url)}
                                        className={`shrink-0 w-10 h-10 rounded-xl overflow-hidden border transition ${
                                            avatarUrl === url
                                                ? 'border-blue-500 ring-2 ring-blue-500/40 scale-105'
                                                : 'border-zinc-800 hover:border-zinc-700'
                                        }`}
                                    >
                                        <img src={url} alt={`Avatar ${i}`} className="w-full h-full object-cover bg-zinc-950" />
                                    </button>
                                ))}
                            </div>
                            <input
                                value={avatarUrl}
                                onChange={(e) => setAvatarUrl(e.target.value)}
                                placeholder="https://example.com/avatar.png"
                                className="w-full rounded-xl bg-zinc-950 border border-zinc-700/80 px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
                            />
                        </div>

                        <div className="pt-3 border-t border-zinc-800 flex justify-end">
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-blue-500/25 transition active:scale-95 disabled:opacity-50"
                            >
                                {saving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Danh sách Agent của riêng User này */}
                <div className="space-y-4 rounded-3xl bg-zinc-900 border border-zinc-800 p-6 shadow-xl">
                    <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
                        <IconBot className="w-4 h-4 text-emerald-400" />
                        <div>
                            <h2 className="text-base font-bold text-white">Agent Của Riêng Tôi</h2>
                            <p className="text-[11px] text-zinc-400">Agent bạn sở hữu để mang vào các phòng</p>
                        </div>
                    </div>

                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {allAgents.map((ag) => {
                            const isOwned = myAgents.includes(ag.id)
                            return (
                                <div
                                    key={ag.id}
                                    className={`p-3 rounded-2xl border transition flex items-center justify-between gap-2 ${
                                        isOwned
                                            ? 'bg-blue-950/20 border-blue-500/40 text-blue-200'
                                            : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 truncate">
                                        <div
                                            className="w-3.5 h-3.5 rounded-full shrink-0"
                                            style={{ backgroundColor: ag.color || '#3b82f6' }}
                                        />
                                        <div className="truncate">
                                            <div className="text-xs font-semibold text-white truncate">{ag.name}</div>
                                            <div className="text-[10px] text-zinc-500 font-mono truncate">@{ag.id}</div>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleToggleAgent(ag.id)}
                                        className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition ${
                                            isOwned
                                                ? 'bg-zinc-800 hover:bg-rose-950/40 text-zinc-300 hover:text-rose-300'
                                                : 'bg-blue-600 hover:bg-blue-500 text-white'
                                        }`}
                                    >
                                        {isOwned ? 'Thôi sở hữu' : '+ Nhận'}
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
