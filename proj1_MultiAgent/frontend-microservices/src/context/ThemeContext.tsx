'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

/**
 * Cac chu de giao dien (Theme) duoc ho tro:
 * - 'dark': Che do toi tieu chuan
 * - 'light': Che do sang
 * - 'cyberpunk': Che do neon neon cyberpunk dac trung
 * - 'system': Tu dong theo thiet lap he dieu hanh cua nguoi dung
 */
export type Theme = 'dark' | 'light' | 'cyberpunk' | 'system'

interface ThemeContextType {
    theme: Theme
    setTheme: (theme: Theme) => void
    resolvedTheme: 'dark' | 'light' | 'cyberpunk'
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

/**
 * Provider quan ly chu de mau sac toan cuc (Theme Provider):
 * - Tu dong doc va luu chu de lua chon vao localStorage (`app-theme`)
 * - Lang nghe `prefers-color-scheme` khi nguoi dung chon che do `system`
 * - Cap nhat class `dark`, `light` va `theme-cyberpunk` tren the html goc
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('dark')
    const [mounted, setMounted] = useState(false)
    const [systemPrefersLight, setSystemPrefersLight] = useState(false)

    useEffect(() => {
        const saved = (localStorage.getItem('app-theme') as Theme) || 'dark'
        setThemeState(saved)
        setMounted(true)

        if (typeof window !== 'undefined') {
            const mq = window.matchMedia('(prefers-color-scheme: light)')
            setSystemPrefersLight(mq.matches)
            const handler = (e: MediaQueryListEvent) => setSystemPrefersLight(e.matches)
            mq.addEventListener('change', handler)
            return () => mq.removeEventListener('change', handler)
        }
    }, [])

    const resolveTheme = (t: Theme): 'dark' | 'light' | 'cyberpunk' => {
        if (t === 'system') {
            return systemPrefersLight ? 'light' : 'dark'
        }
        return t
    }

    const resolvedTheme = resolveTheme(theme)

    useEffect(() => {
        if (!mounted) return
        const root = document.documentElement
        root.classList.remove('dark', 'light', 'theme-cyberpunk')

        if (resolvedTheme === 'dark') {
            root.classList.add('dark')
            root.style.colorScheme = 'dark'
        } else if (resolvedTheme === 'cyberpunk') {
            root.classList.add('dark', 'theme-cyberpunk')
            root.style.colorScheme = 'dark'
        } else {
            root.classList.add('light')
            root.style.colorScheme = 'light'
        }
    }, [resolvedTheme, mounted])

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme)
        if (typeof window !== 'undefined') {
            localStorage.setItem('app-theme', newTheme)
        }
    }

    return (
        <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

/**
 * Custom hook de lay va thay doi chu de giao dien hien tai
 */
export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}
