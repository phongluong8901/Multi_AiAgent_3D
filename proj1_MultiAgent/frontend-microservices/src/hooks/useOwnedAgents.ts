'use client'

import { useCallback, useEffect, useState } from 'react'
import { usersApi } from '@/lib/api'
import { notify } from '@/lib/toast'

export function useOwnedAgents() {
    const [ownedIds, setOwnedIds] = useState<string[]>([])
    const [loading, setLoading] = useState(true)

    const refresh = useCallback(async () => {
        try {
            const ids = await usersApi.getMyAgents()
            setOwnedIds(ids ?? [])
        } catch {
            setOwnedIds([])
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        refresh()
    }, [refresh])

    const toggleAgent = async (agentId: string) => {
        const has = ownedIds.includes(agentId)
        try {
            if (has) {
                await usersApi.removeMyAgent(agentId)
                setOwnedIds((prev) => prev.filter((id) => id !== agentId))
                notify.success('Đã bỏ sở hữu agent')
            } else {
                await usersApi.addMyAgent(agentId)
                setOwnedIds((prev) => [...prev, agentId])
                notify.success('Đã nhận agent')
            }
        } catch (e) {
            notify.error(e instanceof Error ? e.message : 'Lỗi cập nhật agent')
        }
    }

    return { ownedIds, loading, refresh, toggleAgent }
}