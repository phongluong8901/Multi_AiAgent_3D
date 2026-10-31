'use client'

import Link from 'next/link'
import { useAgents } from '@/hooks/useAgents'
import { useLanguage } from '@/context/LanguageContext'

export default function DashboardPage() {
    const { agents, connected } = useAgents()
    const { t } = useLanguage()

    const working = agents.filter((a) => a.status === 'working').length
    const idle = agents.filter((a) => a.status === 'idle').length
    const blocked = agents.filter((a) => a.status === 'blocked').length

    return (
        <div className="space-y-6 w-full max-w-full overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-foreground tracking-tight">{t.nav.dashboard}</h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Hệ thống quản trị mạng lưới Agent & Tác vụ tự động
                    </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-card text-xs w-fit shadow-sm">
                    <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                    <span className="text-foreground font-medium">API: {connected ? t.common.connected : t.common.disconnected}</span>
                </div>
            </div>

            {/* Thống kê tổng quan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Card
                    label="Tổng số Agents"
                    value={agents.length}
                    icon={
                        <svg className="w-4 h-4 text-blue-500 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                    }
                />
                <Card
                    label="Đang hoạt động"
                    value={working}
                    icon={
                        <svg className="w-4 h-4 text-emerald-500 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                    }
                />
                <Card
                    label="Trạng thái nghỉ"
                    value={idle}
                    icon={
                        <svg className="w-4 h-4 text-amber-500 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                    }
                />
                <Card
                    label="Bị chặn / Lỗi"
                    value={blocked}
                    icon={
                        <svg className="w-4 h-4 text-rose-500 dark:text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                        </svg>
                    }
                />
            </div>

            {/* Các liên kết chức năng chính */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link
                    href="/rooms"
                    className="rounded-2xl border border-blue-500/30 bg-card p-5 hover:border-blue-500/60 transition shadow-sm hover:shadow-md group"
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/30">
                            Multi-User & Multi-Agent
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </div>
                    </div>
                    <h2 className="font-bold text-foreground text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">{t.nav.teamRooms}</h2>
                    <p className="text-xs text-muted-foreground mt-1">{t.nav.teamRoomsDesc}</p>
                </Link>

                <Link
                    href="/office"
                    className="rounded-2xl border border-border bg-card p-5 hover:border-primary/50 transition shadow-sm group"
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] px-2.5 py-1 rounded-full bg-secondary text-foreground font-semibold border border-border">
                            Spatial 3D
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center text-muted-foreground group-hover:text-foreground transition">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                                <polyline points="2 17 12 22 22 17" />
                                <polyline points="2 12 12 17 22 12" />
                            </svg>
                        </div>
                    </div>
                    <h2 className="font-semibold text-foreground text-base group-hover:text-primary transition">{t.nav.office3D}</h2>
                    <p className="text-xs text-muted-foreground mt-1">{t.nav.office3DDesc}</p>
                </Link>

                <Link
                    href="/agents"
                    className="rounded-2xl border border-border bg-card p-5 hover:border-primary/50 transition shadow-sm group"
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] px-2.5 py-1 rounded-full bg-secondary text-foreground font-semibold border border-border">
                            Management
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center text-muted-foreground group-hover:text-foreground transition">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                <line x1="8" y1="21" x2="16" y2="21" />
                                <line x1="12" y1="17" x2="12" y2="21" />
                            </svg>
                        </div>
                    </div>
                    <h2 className="font-semibold text-foreground text-base group-hover:text-primary transition">{t.nav.agents}</h2>
                    <p className="text-xs text-muted-foreground mt-1">{t.nav.agentsDesc}</p>
                </Link>
            </div>

            {/* Danh sách Agents chi tiết */}
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3 shadow-sm">
                <h2 className="text-sm font-semibold text-foreground">Danh Sách Agents Khả Dụng</h2>
                <div className="space-y-2">
                    {agents.length === 0 && (
                        <p className="text-xs text-muted-foreground">Chưa có agent — kiểm tra kết nối API hoặc seed data</p>
                    )}
                    {agents.map((a) => (
                        <Link
                            key={a.id}
                            href={`/agents/${a.id}`}
                            className="flex items-center justify-between gap-3 rounded-xl bg-secondary/50 border border-border/80 px-3.5 sm:px-4 py-3 hover:border-primary/40 hover:bg-secondary transition min-w-0"
                        >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span
                                    className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                                    style={{ backgroundColor: a.color }}
                                />
                                <span className="text-sm font-medium text-foreground truncate">{a.name}</span>
                            </div>
                            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-card text-muted-foreground border border-border uppercase shrink-0">
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
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{label}</p>
                <div className="p-2 rounded-xl bg-secondary border border-border">
                    {icon}
                </div>
            </div>
            <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
        </div>
    )
}
