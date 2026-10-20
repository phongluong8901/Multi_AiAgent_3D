'use client'

import RoleGuard from '@/middleware/RoleGuard'

export default function SellerLayout({ children }: { children: React.ReactNode }) {
    return (
        <RoleGuard allowedRoles={['admin', 'seller', 'user', 'guest']} readOnlyRoles={['user', 'guest']}>
            <div className="min-h-screen bg-zinc-950 flex flex-col">
                {children}
            </div>
        </RoleGuard>
    )
}