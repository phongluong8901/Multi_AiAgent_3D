'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { setSession } from '@/lib/auth'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('demo@claw.local')
    const [password, setPassword] = useState('demo')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            // Mock login — sau này gọi backend thật
            if (!email || !password) {
                setError('Nhập email và mật khẩu')
                return
            }

            // Giả lập API
            await new Promise((r) => setTimeout(r, 400))

            setSession('mock-token-123', {
                id: '1',
                name: 'Demo User',
                email,
            })

            router.replace('/dashboard')
        } catch {
            setError('Đăng nhập thất bại')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl">
            <h1 className="text-2xl font-semibold text-white mb-1">Đăng nhập</h1>
            <p className="text-zinc-400 text-sm mb-6">Claw Office — AI Agent Workspace</p>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                        placeholder="you@example.com"
                    />
                </div>

                <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Mật khẩu</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                    />
                </div>

                {error && <p className="text-red-400 text-xs">{error}</p>}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 transition"
                >
                    {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </button>
            </form>

            <p className="mt-6 text-center text-xs text-zinc-500">
                Chưa có tài khoản?{' '}
                <Link href="/register" className="text-blue-400 hover:underline">
                    Đăng ký
                </Link>
            </p>
        </div>
    )
}