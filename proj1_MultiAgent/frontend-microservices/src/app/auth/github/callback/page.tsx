'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

function GithubCallbackInner() {
    const searchParams = useSearchParams()
    const { githubLogin, loading, error } = useAuth()
    const [localError, setLocalError] = useState<string | null>(null)
    const processedCodeRef = useRef<string | null>(null)

    useEffect(() => {
        const code = searchParams.get('code')
        const err = searchParams.get('error')

        if (err) {
            setLocalError(err)
            return
        }
        if (!code) {
            setLocalError('Không nhận được mã GitHub (code)')
            return
        }
        
        // Tránh gọi 2 lần do React StrictMode hoặc re-render
        if (processedCodeRef.current === code) {
            return
        }
        processedCodeRef.current = code

        githubLogin({ code }).catch(() => {
            // error đã set trong hook
        })
    }, [searchParams])

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md w-full text-center">
                <h1 className="text-lg font-semibold text-white mb-2">GitHub OAuth</h1>
                {(loading || (!error && !localError)) && (
                    <p className="text-sm text-zinc-400">Đang xác thực với GitHub...</p>
                )}
                {(error || localError) && (
                    <>
                        <p className="text-red-400 text-sm mb-4">{error || localError}</p>
                        <Link href="/login" className="text-blue-400 text-sm hover:underline">
                            ← Quay lại đăng nhập
                        </Link>
                    </>
                )}
            </div>
        </div>
    )
}

export default function GithubCallbackPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400 text-sm">
                    Loading...
                </div>
            }
        >
            <GithubCallbackInner />
        </Suspense>
    )
}