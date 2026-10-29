'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light' | 'cyberpunk' | 'system'

interface ThemeContextType {
    theme: Theme
    setTheme: (theme: Theme) => void
    resolvedTheme: 'dark' | 'light' | 'cyberpunk'
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('dark')
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        const saved = (localStorage.getItem('app-theme') as Theme) || 'dark'
        setThemeState(saved)
        setMounted(true)
    }, [])

    const resolveTheme = (t: Theme): 'dark' | 'light' | 'cyberpunk' => {
        if (t === 'system') {
            if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
                return 'light'
            }
            return 'dark'
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

export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}

