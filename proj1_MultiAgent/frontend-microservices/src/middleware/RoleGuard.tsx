// src/middleware/RoleGuard.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getUser, isLoggedIn, User } from '@/lib/auth'
import { ShieldAlert, LogIn, ArrowLeft } from 'lucide-react'

interface RoleGuardProps {
    allowedRoles: string[]
    readOnlyRoles?: string[]
    actionBehavior?: 'disable' | 'hide'
    children: React.ReactNode
    fallback?: React.ReactNode
}

export default function RoleGuard({
    allowedRoles,
    readOnlyRoles = [],
    actionBehavior = 'disable',
    children,
    fallback,
}: RoleGuardProps) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const currentUser = getUser()
        setUser(currentUser)
        setLoading(false)
    }, [])

    if (loading) {
        return (
            <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground text-sm">
                Đang kiểm tra quyền truy cập...
            </div>
        )
    }

    const authenticated = Boolean(user && isLoggedIn())
    // Nếu đã đăng nhập mà không có role cụ thể thì mặc định là 'user'
    const userRole = (user?.role || (authenticated ? 'user' : 'guest')).toLowerCase()

    // Chuẩn hóa mảng allowedRoles và readOnlyRoles về chữ thường
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase())
    const normalizedReadOnly = readOnlyRoles.map((r) => r.toLowerCase())

    // 1. Kiểm tra nếu chưa đăng nhập và route yêu cầu quyền
    if (!authenticated && !normalizedAllowed.includes('guest')) {
        if (fallback) return <>{fallback}</>

        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
                <div className="max-w-md bg-card border border-border p-8 rounded-2xl shadow-xl space-y-4 text-card-foreground">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
                        <LogIn className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">Yêu Cầu Đăng Nhập</h2>
                        <p className="text-muted-foreground text-xs mt-1.5 leading-relaxed">
                            Vui lòng đăng nhập vào tài khoản của bạn để sử dụng tính năng và quản lý tài nguyên.
                        </p>
                    </div>
                    <div className="flex items-center justify-center gap-3 pt-2">
                        <Link
                            href="/login"
                            className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-4 py-2 rounded-xl transition shadow-md"
                        >
                            <LogIn className="w-4 h-4" />
                            <span>Đăng Nhập Ngay</span>
                        </Link>
                        <Link
                            href="/dashboard"
                            className="inline-flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold px-4 py-2 rounded-xl transition border border-border"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Trang Chủ</span>
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    // 2. Kiểm tra quyền truy cập trang (403)
    if (!normalizedAllowed.includes(userRole)) {
        if (fallback) return <>{fallback}</>

        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
                <div className="max-w-md bg-card border border-border p-8 rounded-2xl shadow-xl space-y-4 text-card-foreground">
                    <div className="w-12 h-12 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive mx-auto">
                        <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-destructive">Truy Cập Bị Từ Chối (403)</h2>
                        <p className="text-muted-foreground text-xs mt-1.5 leading-relaxed">
                            Tài khoản của bạn ({userRole}) không có quyền hạn cần thiết để truy cập khu vực này.
                        </p>
                    </div>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold px-4 py-2 rounded-xl transition border border-border mx-auto"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Quay lại trang chính</span>
                    </Link>
                </div>
            </div>
        )
    }

    // 3. Kiểm tra nhóm Read-only (chỉ xem, cấm thao tác)
    const isViewOnly = normalizedReadOnly.includes(userRole)

    if (isViewOnly) {
        if (actionBehavior === 'hide') {
            return null
        }

        return (
            <div className="relative group cursor-not-allowed" title="Tài khoản của bạn chỉ có quyền xem (Read-only)">
                <div className="pointer-events-none opacity-60 select-none">
                    {children}
                </div>
            </div>
        )
    }

    return <>{children}</>
}
