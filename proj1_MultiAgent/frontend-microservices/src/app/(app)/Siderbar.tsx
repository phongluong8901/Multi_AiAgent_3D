'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const SIDEBAR_EXTRA_NAV = [
    { href: '/node-checker', label: 'Kiểm tra Node AI', badge: 'Hot', icon: NodeIcon },
    { href: '/user-models', label: 'Đối tác Mô hình', icon: ModelsIcon },
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
                                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/30">
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