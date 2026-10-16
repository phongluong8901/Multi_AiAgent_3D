'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { setSession } from '@/lib/auth'

export default function RegisterPage() {
    const router = useRouter()
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            if (!name || !email || !password) {
                setError('Điền đầy đủ thông tin')
                return
            }

            await new Promise((r) => setTimeout(r, 400))

            setSession('mock-token-123', {
                id: '1',
                name,
                email,
            })

            router.replace('/dashboard')
        } catch {
            setError('Đăng ký thất bại')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl">
            <h1 className="text-2xl font-semibold text-white mb-1">Đăng ký</h1>
            <p className="text-zinc-400 text-sm mb-6">Tạo tài khoản Claw Office</p>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Tên</label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
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
                    {loading ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
            </form>

            <p className="mt-6 text-center text-xs text-zinc-500">
                Đã có tài khoản?{' '}
                <Link href="/login" className="text-blue-400 hover:underline">
                    Đăng nhập
                </Link>
            </p>
        </div>
    )
}