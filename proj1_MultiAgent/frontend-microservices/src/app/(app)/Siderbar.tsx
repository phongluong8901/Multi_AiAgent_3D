'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const SIDEBAR_EXTRA_NAV = [
    { href: '/lab', label: 'Agent Lab 3D', badge: 'AI Gen', icon: LabIcon },
    { href: '/store', label: 'Agent Store', badge: 'Shop', icon: StoreIcon },
    { href: '/firmware', label: 'ESP32 Robot 3D', badge: 'AI Sim', icon: RobotIcon },
    { href: '/node-checker', label: 'Kiểm tra Node AI', badge: 'Hot', icon: NodeIcon },
    { href: '/user-models', label: 'Đối tác Mô hình', icon: ModelsIcon },
    { href: '/seller', label: 'Quản lý Seller & Node', badge: 'Pro', icon: SellerIcon },
    { href: '/admin', label: 'Quản trị Hệ thống', badge: 'Admin', icon: AdminIcon },
]

export default function Sidebar() {
    const pathname = usePathname()
    const [expanded, setExpanded] = useState(false)

    return (
        <aside
            onMouseEnter={() => setExpanded(true)}
            onMouseLeave={() => setExpanded(false)}
            className={`border-r border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md hidden md:flex flex-col justify-between transition-all duration-300 sticky top-14 h-[calc(100vh-3.5rem)] z-40 ${expanded ? 'w-64 p-4' : 'w-16 p-2 items-center'
                }`}
        >
            <div className="space-y-4 w-full">
                <div className={`px-2 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase ${!expanded && 'text-center'}`}>
                    {expanded ? 'Mạng lưới AI Node' : 'AI'}
                </div>

                <div className="space-y-1">
                    {SIDEBAR_EXTRA_NAV.map((item) => {
                        const active = pathname === item.href
                        const Icon = item.icon
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                title={!expanded ? item.label : undefined}
                                className={`flex items-center gap-3 py-2.5 rounded-xl text-xs font-medium transition group relative ${expanded ? 'px-3' : 'justify-center px-2'
                                    } ${active
                                        ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20 shadow-sm'
                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                                    }`}
                            >
                                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-blue-400' : 'text-zinc-400 group-hover:text-white'}`} />

                                {expanded && (
                                    <span className="truncate flex-1">{item.label}</span>
                                )}

                                {expanded && item.badge && (
                                    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md border ${item.badge === 'Admin'
                                            ? 'bg-red-500/20 text-red-300 border-red-400/30'
                                            : item.badge === 'Shop'
                                            ? 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                                            : 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                                        }`}>
                                        {item.badge}
                                    </span>
                                )}
                            </Link>
                        )
                    })}
                </div>
            </div>

            {/* Hint nhỏ dưới chân sidebar */}
            <div className={`text-[10px] text-zinc-600 text-center pb-2 ${expanded ? 'block' : 'hidden'}`}>
                Rê chuột để mở rộng
            </div>
        </aside>
    )
}

// ─── SVG ICONS ──────────────────────────────────────────────────
function NodeIcon(props: any) {
    return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" /></svg>
}

function ModelsIcon(props: any) {
    return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
}

function SellerIcon(props: any) {
    return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
}

function RobotIcon(props: any) {
    return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8.01" y2="16" /><line x1="16" y1="16" x2="16.01" y2="16" /></svg>
}

function StoreIcon(props: any) {
    return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
            <path d="M2 7h20" />
            <path d="M22 7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2" />
        </svg>
    )
}

function AdminIcon(props: any) {
    return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
}

function LabIcon(props: any) {
    return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2v7.31" />
            <path d="M14 9.3V2" />
            <path d="M8.5 2h7" />
            <path d="M14 9.3a6.5 6.5 0 1 1-4 0" />
            <path d="M5.52 16h12.96" />
        </svg>
    )
}