'use client'

import { IconPlus } from '@/components/ui/icons'

interface RoomsHeaderProps {
    onCreateClick: () => void
}

export function RoomsHeader({ onCreateClick }: RoomsHeaderProps) {
    return (
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-zinc-900 p-8 backdrop-blur">
            <div className="relative z-10 max-w-2xl space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
                    Multi-User & Multi-Agent Collaboration Hub
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-white">
                    Phòng Làm Việc Nhóm Đa Agent
                </h1>
                <p className="text-sm leading-relaxed text-zinc-400">
                    Nhiều người dùng tham gia chung một phòng, kết hợp AI Agent, phân quyền chủ
                    phòng và chia sẻ tài liệu.
                </p>
                <div className="pt-2">
                    <button
                        type="button"
                        onClick={onCreateClick}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-500 hover:to-indigo-500 active:scale-95"
                    >
                        <IconPlus className="h-4 w-4" />
                        Tạo Room Nhóm Mới
                    </button>
                </div>
            </div>
        </div>
    )
}