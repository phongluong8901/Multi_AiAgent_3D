'use client'

import Link from 'next/link'
import { useAgents } from '@/hooks/useAgents'

export default function DashboardPage() {
    const { agents, connected } = useAgents()

    const working = agents.filter((a) => a.status === 'working').length
    const idle = agents.filter((a) => a.status === 'idle').length
    const blocked = agents.filter((a) => a.status === 'blocked').length

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-white">Dashboard</h1>
                    <p className="text-xs text-zinc-400 mt-1">
                        Hệ thống quản trị mạng lưới Agent & Tác vụ tự động
                    </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-xs">
                    <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                    <span className="text-zinc-300 font-medium">API: {connected ? 'Connected' : 'Disconnected'}</span>
                </div>
            </div>

            {/* Thống kê tổng quan */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card
                    label="Tổng số Agents"
                    value={agents.length}
                    icon={
                        <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                    }
                />
                <Card
                    label="Đang hoạt động"
                    value={working}
                    icon={
                        <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                    }
                />
                <Card
                    label="Trạng thái nghỉ"
                    value={idle}
                    icon={
                        <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                    }
                />
                <Card
                    label="Bị chặn / Lỗi"
                    value={blocked}
                    icon={
                        <svg className="w-4 h-4 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                        </svg>
                    }
                />
            </div>

            {/* Các liên kết chức năng chính */}
            <div className="grid md:grid-cols-3 gap-4">
                <Link
                    href="/rooms"
                    className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-950/40 to-zinc-900 p-5 hover:border-blue-500/60 transition shadow-lg shadow-blue-500/5 group"
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30">
                            Multi-User & Multi-Agent
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </div>
                    </div>
                    <h2 className="font-bold text-white text-base group-hover:text-blue-400 transition">Team Rooms</h2>
                    <p className="text-xs text-zinc-400 mt-1">Vào phòng chung kết hợp nhiều Agent & ra lệnh chéo</p>
                </Link>

                <Link
                    href="/office"
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 hover:border-zinc-700 transition group"
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 font-semibold border border-zinc-700">
                            Spatial 3D
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 group-hover:bg-zinc-700 transition">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                                <polyline points="2 17 12 22 22 17" />
                                <polyline points="2 12 12 17 22 12" />
                            </svg>
                        </div>
                    </div>
                    <h2 className="font-semibold text-white text-base group-hover:text-zinc-200 transition">Office 3D</h2>
                    <p className="text-xs text-zinc-400 mt-1">Xem văn phòng ảo 3D thời gian thực</p>
                </Link>

                <Link
                    href="/agents"
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 hover:border-zinc-700 transition group"
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 font-semibold border border-zinc-700">
                            Management
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 group-hover:bg-zinc-700 transition">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                <line x1="8" y1="21" x2="16" y2="21" />
                                <line x1="12" y1="17" x2="12" y2="21" />
                            </svg>
                        </div>
                    </div>
                    <h2 className="font-semibold text-white text-base group-hover:text-zinc-200 transition">Quản Lý Agent</h2>
                    <p className="text-xs text-zinc-400 mt-1">Cấu hình prompt, tools và mô hình</p>
                </Link>
            </div>

            {/* Danh sách Agents chi tiết */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
                <h2 className="text-sm font-semibold text-zinc-200">Danh Sách Agents Khả Dụng</h2>
                <div className="space-y-2">
                    {agents.length === 0 && (
                        <p className="text-xs text-zinc-500">Chưa có agent — kiểm tra kết nối API hoặc seed data</p>
                    )}
                    {agents.map((a) => (
                        <Link
                            key={a.id}
                            href={`/agents/${a.id}`}
                            className="flex items-center justify-between rounded-xl bg-zinc-950/60 border border-zinc-800/80 px-4 py-3 hover:border-zinc-700 hover:bg-zinc-950 transition"
                        >
                            <div className="flex items-center gap-3">
                                <span
                                    className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                                    style={{ backgroundColor: a.color }}
                                />
                                <span className="text-sm font-medium text-white">{a.name}</span>
                            </div>
                            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-zinc-900 text-zinc-400 border border-zinc-800 uppercase">
                                {a.status}
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}

function Card({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400">{label}</p>
                <div className="p-2 rounded-xl bg-zinc-950 border border-zinc-800">
                    {icon}
                </div>
            </div>
            <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        </div>
    )
}