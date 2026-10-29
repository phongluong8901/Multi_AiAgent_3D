import { Suspense } from 'react'
import AppShell from './AppShell'

// Opt out of instant-navigation validation for the authenticated app layout
export const instant = false

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">
                    Đang tải giao diện...
                </div>
            }
        >
            <AppShell>{children}</AppShell>
        </Suspense>
    )
}
