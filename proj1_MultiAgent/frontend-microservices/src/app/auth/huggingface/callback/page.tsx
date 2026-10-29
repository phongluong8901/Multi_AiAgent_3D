'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

function HuggingfaceCallbackInner() {
    const searchParams = useSearchParams()
    const { huggingfaceLogin, loading, error } = useAuth()
    const [localError, setLocalError] = useState<string | null>(null)
    const processedCodeRef = useRef<string | null>(null)

    useEffect(() => {
        const code = searchParams.get('code')
        const err = searchParams.get('error') || searchParams.get('error_description')

        if (err) {
            setLocalError(err)
            return
        }
        if (!code) {
            setLocalError('Không nhận được mã xác thực Hugging Face (code)')
            return
        }
        
        // Tránh gọi 2 lần do React StrictMode hoặc re-render
        if (processedCodeRef.current === code) {
            return
        }
        processedCodeRef.current = code

        huggingfaceLogin({ code }).catch(() => {
            // error đã được quản lý trong hook useAuth
        })
    }, [searchParams])

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md w-full text-center shadow-xl">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Sparkles className="w-6 h-6" />
                </div>
                <h1 className="text-lg font-semibold text-white mb-2">Hugging Face OAuth</h1>
                {(loading || (!error && !localError)) && (
                    <div className="space-y-3">
                        <div className="inline-block w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-zinc-400">Đang xác thực tài khoản với Hugging Face...</p>
                    </div>
                )}
                {(error || localError) && (
                    <div className="mt-2">
                        <p className="text-rose-400 text-sm mb-4 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">
                            {error || localError}
                        </p>
                        <Link href="/login" className="inline-flex items-center gap-1.5 text-amber-400 text-sm hover:underline font-medium">
                            ← Quay lại trang đăng nhập
                        </Link>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function HuggingfaceCallbackPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400 text-sm">
                    Đang tải Hugging Face OAuth...
                </div>
            }
        >
            <HuggingfaceCallbackInner />
        </Suspense>
    )
}
