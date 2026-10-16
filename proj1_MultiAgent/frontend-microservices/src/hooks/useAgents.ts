'use client'

import { useCallback, useEffect, useState } from 'react'
import { agentsApi, Agent } from '@/lib/api'

export function useAgents(pollMs = 3000) {
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [connected, setConnected] = useState(false)

    const refresh = useCallback(async () => {
        try {
            const data = await agentsApi.list()
            // Đảm bảo position luôn là tuple 3 số
            const normalized = data.map((a) => ({
                ...a,
                position: (Array.isArray(a.position)
                    ? a.position
                    : [0, 0, 0]) as [number, number, number],
                status: (a.status as Agent['status']) || 'idle',
                speech: a.speech ?? null,
            }))
            setAgents(normalized)
            setConnected(true)
            setError(null)
        } catch (e) {
            setConnected(false)
            setError(e instanceof Error ? e.message : 'Failed to load agents')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        refresh()
        const t = setInterval(refresh, pollMs)
        return () => clearInterval(t)
    }, [refresh, pollMs])

    return { agents, loading, error, connected, refresh }
}