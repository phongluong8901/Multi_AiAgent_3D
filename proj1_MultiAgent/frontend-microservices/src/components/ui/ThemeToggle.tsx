'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useTheme, Theme } from '@/context/ThemeContext'
import { Sun, Moon, Sparkles, Laptop, Check } from 'lucide-react'

export default function ThemeToggle() {
    const { theme, setTheme, resolvedTheme } = useTheme()
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const options: { id: Theme; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
        { id: 'dark', label: 'Tối (Dark)', icon: Moon },
        { id: 'light', label: 'Sáng (Light)', icon: Sun },
        { id: 'cyberpunk', label: 'Neon Cyberpunk', icon: Sparkles },
        { id: 'system', label: 'Hệ thống (System)', icon: Laptop },
    ]

    const CurrentIcon =
        resolvedTheme === 'light'
            ? Sun
            : resolvedTheme === 'cyberpunk'
            ? Sparkles
            : Moon

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="w-8 h-8 rounded-xl bg-secondary/80 hover:bg-secondary border border-border text-foreground flex items-center justify-center transition shadow-sm"
                title={`Chủ đề: ${theme} (Bấm để thay đổi)`}
            >
                <CurrentIcon className="w-4 h-4 text-foreground/80 hover:text-foreground transition-transform" />
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl border border-border bg-card/95 backdrop-blur-xl p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60 mb-1">
                        Giao Diện Theme
                    </div>
                    <div className="space-y-0.5">
                        {options.map((opt) => {
                            const Icon = opt.icon
                            const isSelected = theme === opt.id
                            return (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => {
                                        setTheme(opt.id)
                                        setOpen(false)
                                    }}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition ${
                                        isSelected
                                            ? 'bg-primary/15 text-primary font-semibold'
                                            : 'text-foreground/80 hover:bg-secondary hover:text-foreground'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Icon className="w-3.5 h-3.5 shrink-0" />
                                        <span>{opt.label}</span>
                                    </div>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

