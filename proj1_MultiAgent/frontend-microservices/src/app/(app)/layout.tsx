// src/app/dashboard/layout.tsx (hoặc file layout tương ứng của bạn)
import { Suspense } from 'react'
import AppShell from './AppShell'
import RoleGuard from '@/middleware/RoleGuard'

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">
                    Loading...
                </div>
            }
        >
            <RoleGuard
                allowedRoles={['admin', 'seller', 'user', 'guest']}
                readOnlyRoles={['guest']}
                actionBehavior="disable"
            >
                <AppShell>{children}</AppShell>
            </RoleGuard>
        </Suspense>
    )
}