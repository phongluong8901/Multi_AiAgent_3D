import { Suspense } from 'react'
import AppShell from './AppShell'

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">
                    Loading...
                </div>
            }
        >
            <AppShell>{children}</AppShell>
        </Suspense>
    )
}