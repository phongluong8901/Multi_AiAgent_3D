'use client'

import { useCallback, useEffect, useState } from 'react'
import { usersApi } from '@/lib/api'
import { notify } from '@/lib/toast'

/**
 * Custom Hook quan ly danh sach Agent do nguoi dung hien tai so huu:
 * - Lay danh sach `ownedIds` tu user-service
 * - Cho phep nhan them (`addMyAgent`) hoac bo so huu (`removeMyAgent`) thong qua ham `toggleAgent`
 */
export function useOwnedAgents() {
    const [ownedIds, setOwnedIds] = useState<string[]>([])
    const [loading, setLoading] = useState(true)

    /**
     * Tai lai danh sach agent so huu tu backend
     */
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

    /**
     * Chuyen doi trang thai so huu cua mot Agent
     * @param agentId Dinh danh cua Agent can thao tac
     */
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
