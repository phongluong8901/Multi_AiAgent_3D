'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '@/hooks/useAuth'

export default function RegisterPage() {
    const { register, googleLogin, startGithubLogin, startHuggingfaceLogin, loading, error } = useAuth()
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!name || !email || !password) return
        await register({ username: name, email, password })
    }

    async function handleGoogleSuccess(credentialResponse: any) {
        if (credentialResponse.credential) {
            await googleLogin({ idToken: credentialResponse.credential })
        }
    }

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl max-w-md w-full mx-auto">
            <h1 className="text-2xl font-semibold text-white mb-1">Đăng ký</h1>
            <p className="text-zinc-400 text-sm mb-6">Tạo tài khoản Claw Office</p>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Tên</label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
                        placeholder="Nguyễn Văn A"
                    />
                </div>

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
                    {loading ? 'Đang tạo...' : 'Tạo tài khoản & Nhận OTP'}
                </button>
            </form>

            <div className="flex items-center my-4">
                <div className="flex-grow border-t border-zinc-800" />
                <span className="px-3 text-xs text-zinc-500 uppercase">Hoặc</span>
                <div className="flex-grow border-t border-zinc-800" />
            </div>

            <div className="space-y-3">
                <div className="flex justify-center w-full [&_div]:w-full">
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => { }}
                        theme="filled_black"
                        shape="rectangular"
                        width="100%"
                        text="signup_with"
                    />
                </div>

                <button
                    type="button"
                    onClick={startGithubLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#24292f] hover:bg-[#32383f] disabled:opacity-50 text-white text-sm font-medium py-2.5 border border-zinc-700 transition"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path
                            fillRule="evenodd"
                            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                            clipRule="evenodd"
                        />
                    </svg>
                    Đăng ký với GitHub
                </button>

                {/* Hugging Face */}
                <button
                    type="button"
                    onClick={startHuggingfaceLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2.5 rounded-lg bg-[#272115] hover:bg-[#382f1d] disabled:opacity-50 text-amber-200 text-sm font-medium py-2.5 border border-amber-500/30 hover:border-amber-500/60 shadow-sm transition"
                >
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" fill="#FFD21E" />
                        <circle cx="8" cy="10" r="1.5" fill="#18181B" />
                        <circle cx="16" cy="10" r="1.5" fill="#18181B" />
                        <path d="M8 14.5C9.2 16.2 10.5 17 12 17C13.5 17 14.8 16.2 16 14.5" stroke="#18181B" strokeWidth="1.8" strokeLinecap="round" />
                        <path d="M4.5 14C3.8 14.5 3 15.5 3 17C3 18.7 4.3 20 6 20C7.2 20 8.2 19.3 8.7 18.2" stroke="#18181B" strokeWidth="1.5" strokeLinecap="round" />
                        <path d="M19.5 14C20.2 14.5 21 15.5 21 17C21 18.7 19.7 20 18 20C16.8 20 15.8 19.3 15.3 18.2" stroke="#18181B" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    Đăng ký với Hugging Face
                </button>
            </div>

            <p className="mt-6 text-center text-xs text-zinc-500">
                Đã có tài khoản?{' '}
                <Link href="/login" className="text-blue-400 hover:underline">
                    Đăng nhập
                </Link>
            </p>
        </div>
    )
}