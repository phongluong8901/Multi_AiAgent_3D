'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useLanguage, Language } from '@/context/LanguageContext'
import { Languages, Check } from 'lucide-react'

export default function LanguageToggle() {
    const { language, setLanguage } = useLanguage()
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

    const options: { id: Language; label: string; code: string }[] = [
        { id: 'vi', label: 'Tiếng Việt', code: 'VI' },
        { id: 'en', label: 'English', code: 'EN' },
    ]

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="h-8 px-2.5 rounded-xl bg-secondary/80 hover:bg-secondary border border-border text-foreground flex items-center gap-1.5 transition shadow-sm font-medium text-xs"
                title={`Ngôn ngữ: ${language.toUpperCase()} (Bấm để thay đổi)`}
                aria-label="Change Language"
            >
                <Languages className="w-3.5 h-3.5 text-foreground/80 transition-transform" />
                <span className="font-mono text-[11px] font-semibold text-foreground/90 uppercase">
                    {language}
                </span>
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-44 rounded-2xl border border-border bg-card/95 backdrop-blur-xl p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60 mb-1">
                        Ngôn Ngữ / Language
                    </div>
                    <div className="space-y-0.5">
                        {options.map((opt) => {
                            const isSelected = language === opt.id
                            return (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => {
                                        setLanguage(opt.id)
                                        setOpen(false)
                                    }}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition ${
                                        isSelected
                                            ? 'bg-primary/15 text-primary font-semibold'
                                            : 'text-foreground/80 hover:bg-secondary hover:text-foreground'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="px-1.5 py-0.5 rounded-md bg-secondary border border-border font-mono text-[10px] font-bold text-foreground/90">
                                            {opt.code}
                                        </span>
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

