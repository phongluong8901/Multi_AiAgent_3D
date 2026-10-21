'use client'

import { useState } from 'react'
import { IconLock, IconX } from '@/components/ui/icons'

interface RoomPasswordModalProps {
    isOpen: boolean
    roomName: string
    onClose: () => void
    onSubmit: (password: string) => Promise<void>
}

export function RoomPasswordModal({
    isOpen,
    roomName,
    onClose,
    onSubmit,
}: RoomPasswordModalProps) {
    const [passwordInput, setPasswordInput] = useState('')
    const [joining, setJoining] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!passwordInput.trim()) return

        try {
            setJoining(true)
            setErrorMsg(null)
            await onSubmit(passwordInput.trim())
        } catch (err: any) {
            setErrorMsg(err.message || 'Mật khẩu phòng không chính xác!')
        } finally {
            setJoining(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <div className="flex items-center gap-2 text-amber-400">
                        <IconLock className="h-5 w-5" />
                        <h3 className="text-base font-semibold text-white">Phòng Riêng Tư</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                    >
                        <IconX className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <p className="text-xs text-zinc-400">
                        Phòng <span className="font-medium text-white">{roomName}</span> được bảo vệ bằng mật khẩu. Vui lòng nhập mật khẩu để tiếp tục.
                    </p>

                    <div className="space-y-1.5">
                        <input
                            type="password"
                            autoFocus
                            required
                            value={passwordInput}
                            onChange={(e) => setPasswordInput(e.target.value)}
                            placeholder="Nhập mật khẩu phòng..."
                            className="w-full rounded-xl border border-zinc-700/80 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-amber-500"
                        />
                        {errorMsg && (
                            <p className="text-xs font-medium text-rose-400">{errorMsg}</p>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl px-4 py-2 text-xs font-medium text-zinc-400 transition hover:text-white"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={joining}
                            className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-amber-500 disabled:opacity-50"
                        >
                            {joining ? 'Đang xác thực...' : 'Xác nhận vào phòng'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}