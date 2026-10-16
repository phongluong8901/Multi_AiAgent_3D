'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { clearSession, getUser, isLoggedIn, User } from '@/lib/auth'

const NAV = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/agents', label: 'Agents' },
    { href: '/prompts', label: 'Prompts' },
    { href: '/tools', label: 'Tools' },
    { href: '/models', label: 'Models' },
    { href: '/office', label: 'Office' },
    { href: '/chat', label: 'Chat' },
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
        <div className="min-h-screen bg-zinc-950 text-white">
            <header className="h-14 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-50">
                <div className="h-full max-w-7xl mx-auto px-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                        <Link href="/dashboard" className="font-semibold tracking-tight">
                            Claw Office
                        </Link>
                        <nav className="hidden sm:flex items-center gap-1">
                            {NAV.map((item) => {
                                const active = pathname.startsWith(item.href)
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`px-3 py-1.5 rounded-lg text-sm transition ${active
                                                ? 'bg-zinc-800 text-white'
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
                        <span className="text-xs text-zinc-400 hidden sm:inline">
                            {user?.name ?? user?.email}
                        </span>
                        <button
                            onClick={logout}
                            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className={pathname.startsWith('/office') ? '' : 'max-w-7xl mx-auto px-4 py-6'}>
                {children}
            </main>
        </div>
    )
}