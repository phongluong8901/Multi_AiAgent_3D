'use client'

import { useCallback, useEffect, useState } from 'react'
import { agentsApi, Agent, AgentStatus } from '@/lib/api'

function normalizeAgent(a: Agent): Agent {
    const pos = Array.isArray(a.position) ? a.position : [0, 0, 0]
    return {
        ...a,
        position: [Number(pos[0]) || 0, Number(pos[1]) || 0, Number(pos[2]) || 0],
        status: (a.status as AgentStatus) || 'idle',
        speech: a.speech ?? null,
        color: a.color || '#4299e1',
    }
}

export function useAgents(pollMs = 3000) {
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [connected, setConnected] = useState(false)

    const refresh = useCallback(async () => {
        try {
            const data = await agentsApi.list()
            setAgents((data ?? []).map(normalizeAgent))
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