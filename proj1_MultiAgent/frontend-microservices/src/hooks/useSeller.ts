'use client'

import { useCallback, useEffect, useState } from 'react'
import { sellerApi } from '@/lib/api/seller'
import { notify } from '@/lib/toast'

export function useSeller() {
    const [nodeDetails, setNodeDetails] = useState<any | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchNodeDetails = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await sellerApi.getNodeDetails()
            setNodeDetails(data)
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Không tải được thông tin node'
            setError(msg)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchNodeDetails()
    }, [fetchNodeDetails])

    const registerNode = async (nodeData: any) => {
        setSaving(true)
        setError(null)
        try {
            const result = await sellerApi.registerNode(nodeData)
            setNodeDetails(result)
            notify.success('Đăng ký Hardware Node thành công')
            return result
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Đăng ký node thất bại'
            setError(msg)
            notify.error('Đăng ký node thất bại', { description: msg })
            throw e
        } finally {
            setSaving(false)
        }
    }

    const sendHeartbeat = async () => {
        try {
            const result = await sellerApi.pingHeartbeat()
            return result
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Gửi heartbeat thất bại'
            notify.error(msg)
            throw e
        }
    }

    return {
        nodeDetails,
        loading,
        saving,
        error,
        fetchNodeDetails,
        registerNode,
        sendHeartbeat,
    }
}