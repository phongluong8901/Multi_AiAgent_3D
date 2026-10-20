// src/middleware/RoleGuard.tsx
'use client'

import { useEffect, useState } from 'react'
import { getUser, User } from '@/lib/auth'

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
    fallback
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
            <div className="min-h-[50vh] flex items-center justify-center text-zinc-400 text-sm">
                Đang kiểm tra quyền truy cập...
            </div>
        )
    }

    // Chuẩn hóa role về chữ thường (nếu user chưa đăng nhập thì là 'guest')
    const userRole = (user?.role || 'guest').toLowerCase()

    // Chuẩn hóa mảng allowedRoles và readOnlyRoles về chữ thường để so sánh chính xác tuyệt đối
    const normalizedAllowed = allowedRoles.map(r => r.toLowerCase())
    const normalizedReadOnly = readOnlyRoles.map(r => r.toLowerCase())

    // 1. Kiểm tra quyền truy cập trang
    if (!normalizedAllowed.includes(userRole)) {
        if (fallback) return <>{fallback}</>

        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
                <div className="max-w-md bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-xl">
                    <h2 className="text-xl font-bold text-red-500 mb-2">Truy cập bị từ chối (403)</h2>
                    <p className="text-zinc-400 text-sm mb-6">
                        Tài khoản của bạn không có quyền hạn cần thiết để truy cập khu vực này.
                    </p>
                    <a
                        href="/dashboard"
                        className="inline-block bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                        Quay lại trang chính
                    </a>
                </div>
            </div>
        )
    }

    // 2. Kiểm tra nhóm Read-only (chỉ xem, cấm thao tác)
    const isViewOnly = normalizedReadOnly.includes(userRole)

    if (isViewOnly) {
        if (actionBehavior === 'hide') {
            return null
        }

        return (
            <div className="relative group cursor-not-allowed" title="Tài khoản của bạn chỉ có quyền xem (Read-only)">
                <div className="pointer-events-none opacity-50 select-none">
                    {children}
                </div>
            </div>
        )
    }

    return <>{children}</>
}