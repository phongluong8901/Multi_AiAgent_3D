'use client'

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { AlertTriangle, AlertCircle, Info, CheckCircle2, Trash2, X } from 'lucide-react'

export type ConfirmVariant = 'danger' | 'warning' | 'info' | 'success'

export interface ConfirmOptions {
    title?: string
    description: React.ReactNode
    confirmText?: string
    cancelText?: string
    variant?: ConfirmVariant
    icon?: React.ComponentType<{ className?: string }>
}

export interface AlertModalOptions {
    title?: string
    description: React.ReactNode
    buttonText?: string
    variant?: ConfirmVariant
}

interface ConfirmContextType {
    confirm: (options: ConfirmOptions | string) => Promise<boolean>
    alert: (options: AlertModalOptions | string) => Promise<void>
}

const ConfirmContext = createContext<ConfirmContextType | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)
    const [isAlertOnly, setIsAlertOnly] = useState(false)
    const [options, setOptions] = useState<ConfirmOptions>({
        title: 'Xác nhận hành động',
        description: '',
        confirmText: 'Xác nhận',
        cancelText: 'Hủy',
        variant: 'danger',
    })

    const resolverRef = useRef<((value: boolean) => void) | null>(null)

    const confirm = useCallback((opts: ConfirmOptions | string): Promise<boolean> => {
        return new Promise((resolve) => {
            resolverRef.current = resolve
            setIsAlertOnly(false)
            if (typeof opts === 'string') {
                setOptions({
                    title: 'Xác nhận hành động',
                    description: opts,
                    confirmText: 'Xác nhận',
                    cancelText: 'Hủy',
                    variant: 'danger',
                })
            } else {
                setOptions({
                    title: opts.title ?? 'Xác nhận hành động',
                    description: opts.description,
                    confirmText: opts.confirmText ?? 'Xác nhận',
                    cancelText: opts.cancelText ?? 'Hủy',
                    variant: opts.variant ?? 'danger',
                    icon: opts.icon,
                })
            }
            setIsOpen(true)
        })
    }, [])

    const alertModal = useCallback((opts: AlertModalOptions | string): Promise<void> => {
        return new Promise((resolve) => {
            resolverRef.current = () => resolve()
            setIsAlertOnly(true)
            if (typeof opts === 'string') {
                setOptions({
                    title: 'Thông báo',
                    description: opts,
                    confirmText: 'Đã hiểu',
                    variant: 'info',
                })
            } else {
                setOptions({
                    title: opts.title ?? 'Thông báo',
                    description: opts.description,
                    confirmText: opts.buttonText ?? 'Đã hiểu',
                    variant: opts.variant ?? 'info',
                })
            }
            setIsOpen(true)
        })
    }, [])

    const handleConfirm = () => {
        setIsOpen(false)
        if (resolverRef.current) {
            resolverRef.current(true)
            resolverRef.current = null
        }
    }

    const handleCancel = () => {
        setIsOpen(false)
        if (resolverRef.current) {
            resolverRef.current(false)
            resolverRef.current = null
        }
    }

    // Handle ESC key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                handleCancel()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen])

    const variant = options.variant || 'danger'

    const getIconAndColors = () => {
        if (options.icon) {
            const CustomIcon = options.icon
            return {
                icon: <CustomIcon className="w-6 h-6" />,
                badgeBg: 'bg-zinc-800 text-zinc-300 border-zinc-700',
                buttonBg: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30',
            }
        }

        switch (variant) {
            case 'danger':
                return {
                    icon: <Trash2 className="w-6 h-6 text-rose-400" />,
                    badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                    buttonBg: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40',
                }
            case 'warning':
                return {
                    icon: <AlertTriangle className="w-6 h-6 text-amber-400" />,
                    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                    buttonBg: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/40',
                }
            case 'success':
                return {
                    icon: <CheckCircle2 className="w-6 h-6 text-emerald-400" />,
                    badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                    buttonBg: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40',
                }
            case 'info':
            default:
                return {
                    icon: <Info className="w-6 h-6 text-blue-400" />,
                    badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                    buttonBg: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40',
                }
        }
    }

    const { icon, badgeBg, buttonBg } = getIconAndColors()

    return (
        <ConfirmContext.Provider value={{ confirm, alert: alertModal }}>
            {children}

            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
                        onClick={handleCancel}
                    />

                    {/* Dialog Container */}
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="relative w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl p-6 text-white z-10 transition-all transform animate-in zoom-in-95 duration-200"
                    >
                        {/* Close button */}
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="absolute top-4 right-4 p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                            aria-label="Đóng"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-start gap-4">
                            {/* Icon badge */}
                            <div className={`p-3 rounded-xl border shrink-0 ${badgeBg}`}>
                                {icon}
                            </div>

                            {/* Content */}
                            <div className="flex-1 pt-0.5">
                                <h3 className="text-lg font-semibold text-white leading-tight">
                                    {options.title}
                                </h3>
                                <div className="mt-2 text-sm text-zinc-300 leading-relaxed break-words">
                                    {options.description}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-6 flex items-center justify-end gap-3 pt-2">
                            {!isAlertOnly && (
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-white border border-zinc-700/80 transition"
                                >
                                    {options.cancelText || 'Hủy'}
                                </button>
                            )}
                            <button
                                type="button"
                                autoFocus
                                onClick={handleConfirm}
                                className={`px-5 py-2.5 rounded-xl text-sm font-medium shadow-lg transition ${buttonBg}`}
                            >
                                {options.confirmText || 'Xác nhận'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    )
}

export function useConfirm() {
    const context = useContext(ConfirmContext)
    if (!context) {
        throw new Error('useConfirm must be used within a ConfirmProvider')
    }
    return context
}
