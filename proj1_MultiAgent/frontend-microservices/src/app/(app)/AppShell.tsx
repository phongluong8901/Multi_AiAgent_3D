'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { clearSession, getUser, isLoggedIn, User } from '@/lib/auth'
import { notify } from '@/lib/toast'
import Sidebar from './Siderbar' // Đường dẫn trỏ tới file Sidebar vừa tạo

const NAV = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/rooms', label: 'Team Rooms' },
    { href: '/office', label: '3D Office' },
    { href: '/maps/setup', label: 'Map Studio 3D' },
    { href: '/agents', label: 'Agents' },
    { href: '/prompts', label: 'Prompts' },
    { href: '/tools', label: 'Tools' },
    { href: '/models', label: 'Models' },
    { href: '/chat', label: 'Chat' },
    { href: '/profile', label: 'Profile' },
    { href: '/seller-profile', label: 'Seller-Profile' },
    { href: '/admin-dashboard', label: 'Admin-Dashboard' },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [ready, setReady] = useState(false)

    useEffect(() => {
        if (!isLoggedIn()) {
            router.replace('/login')
            return
        }
        setUser(getUser())
        setReady(true)
    }, [router])

    function logout() {
        clearSession()
        notify.success('Đã đăng xuất')
        router.replace('/login')
    }

    if (!ready) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">
                Loading...
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
            {/* Top Header Ngang Cũ */}
            <header className="h-14 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-50">
                <div className="h-full max-w-7xl mx-auto px-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                        <Link href="/dashboard" className="font-semibold tracking-tight flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                                </svg>
                            </div>
                            <span className="font-bold bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">Claw Office</span>
                        </Link>
                        <nav className="hidden sm:flex items-center gap-1">
                            {NAV.map((item) => {
                                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`px-3 py-1.5 rounded-lg text-sm transition font-medium ${active
                                            ? 'bg-zinc-800 text-white shadow-sm'
                                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                                            }`}
                                    >
                                        {item.label}
                                    </Link>
                                )
                            })}
                        </nav>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href="/profile"
                            className="text-xs text-zinc-300 hover:text-white flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-full transition"
                            title="Chỉnh sửa hồ sơ cá nhân"
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            <span className="font-medium">{user?.name ?? user?.email}</span>
                        </Link>
                        <button
                            onClick={logout}
                            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition font-medium"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Layout chính kết hợp Sidebar dọc và Main Content */}
            <div className="flex flex-1">
                <Sidebar />
                <main className={`flex-1 ${pathname.startsWith('/office') || pathname.startsWith('/maps/setup') || pathname.includes('/rooms/') ? '' : 'max-w-7xl mx-auto px-4 py-6'}`}>
                    {children}
                </main>
            </div>
        </div>
    )
}