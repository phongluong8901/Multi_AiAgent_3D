'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

function VerifyOtpContent() {
    const searchParams = useSearchParams()
    const emailParam = searchParams.get('email') || ''

    const [email, setEmail] = useState(emailParam)
    const [otp, setOtp] = useState('')
    const { verifyOtp, resendOtp, loading, error, message } = useAuth()

    useEffect(() => {
        if (emailParam) {
            setEmail(emailParam)
        }
    }, [emailParam])

    async function handleVerify(e: React.FormEvent) {
        e.preventDefault()
        if (!email || !otp || otp.length !== 6) return
        await verifyOtp({ email, otp })
    }

    async function handleResend() {
        if (!email) return
        await resendOtp({ email })
    }

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl max-w-md w-full">
                <h1 className="text-2xl font-semibold text-white mb-1">Xác thực tài khoản</h1>
                <p className="text-zinc-400 text-sm mb-6">
                    Nhập mã OTP 6 chữ số đã được gửi đến email: <span className="text-white font-medium">{email || 'của bạn'}</span>
                </p>

                <form onSubmit={handleVerify} className="space-y-4">
                    <div>
                        <label className="block text-xs text-zinc-400 mb-1.5">Mã OTP (6 số)</label>
                        <input
                            type="text"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                            className="w-full text-center tracking-widest text-lg font-mono rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-white outline-none focus:border-blue-500"
                            placeholder="123456"
                        />
                    </div>

                    {error && <p className="text-red-400 text-xs">{error}</p>}
                    {message && <p className="text-green-400 text-xs">{message}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 transition"
                    >
                        {loading ? 'Đang xác thực...' : 'Xác thực OTP'}
                    </button>
                </form>

                <div className="flex items-center justify-between mt-4 text-xs text-zinc-400">
                    <span>Không nhận được mã?</span>
                    <button
                        type="button"
                        onClick={handleResend}
                        disabled={loading}
                        className="text-blue-400 hover:underline disabled:opacity-50"
                    >
                        Gửi lại mã
                    </button>
                </div>

                <p className="mt-6 text-center text-xs text-zinc-500">
                    Đã có tài khoản?{' '}
                    <Link href="/login" className="text-blue-400 hover:underline">
                        Đăng nhập ngay
                    </Link>
                </p>
            </div>
        </div>
    )
}

export default function VerifyOtpPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400 text-sm">Loading...</div>}>
            <VerifyOtpContent />
        </Suspense>
    )
}