'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '@/hooks/useAuth'

export default function LoginPage() {
    const { login, googleLogin, loading, error } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!email || !password) return
        await login({ email, password })
    }

    async function handleGoogleSuccess(credentialResponse: any) {
        if (credentialResponse.credential) {
            await googleLogin({ idToken: credentialResponse.credential })
        }
    }

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl max-w-md w-full mx-auto">
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
                        placeholder="••••••••"
                    />
                </div>

                {error && <p className="text-red-400 text-xs">{error}</p>}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 transition"
                >
                    {loading ? 'Đang xử lý...' : 'Đăng nhập'}
                </button>
            </form>

            <div className="flex items-center my-4">
                <div className="flex-grow border-t border-zinc-800"></div>
                <span className="px-3 text-xs text-zinc-500 uppercase">Hoặc</span>
                <div className="flex-grow border-t border-zinc-800"></div>
            </div>

            {/* Nút Google Login */}
            <div className="flex justify-center w-full">
                <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => { }}
                    theme="filled_black"
                    shape="rectangular"
                    width="100%"
                />
            </div>

            <p className="mt-6 text-center text-xs text-zinc-500">
                Chưa có tài khoản?{' '}
                <Link href="/register" className="text-blue-400 hover:underline">
                    Đăng ký
                </Link>
            </p>
        </div>
    )
}