'use client'

import RoleGuard from '@/middleware/RoleGuard'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <RoleGuard allowedRoles={['admin']} fallback={<UnauthorizedView />}>
            <div className="min-h-screen bg-zinc-950 flex">
                {/* Admin Sidebar riêng nếu cần */}
                <div className="flex-1 flex flex-col">{children}</div>
            </div>
        </RoleGuard>
    )
}

function UnauthorizedView() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-center p-6">
            <h1 className="text-2xl font-bold text-red-500 mb-2">403 - Truy cập bị từ chối</h1>
            <p className="text-zinc-400 text-sm">Bạn không có quyền quản trị viên (ADMIN) để vào trang này.</p>
        </div>
    )
}