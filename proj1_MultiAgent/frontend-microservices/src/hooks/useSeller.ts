'use client'

import { useCallback, useEffect, useState } from 'react'
import { sellerApi } from '@/lib/api/seller'
import { notify } from '@/lib/toast'

/**
 * Custom Hook danh cho Seller Partner (Seller Management Hook):
 * - Quan ly thong tin Hardware Node cho thue cua Seller
 * - Dang ky thiet bi moi len he thong
 * - Gui tin hieu Heartbeat duy tri trang thai truc tuyen tren Marketplace
 */
export function useSeller() {
    const [nodeDetails, setNodeDetails] = useState<any | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    /**
     * Lay chi tiet cau hinh node cua Seller hien tai
     */
    const fetchNodeDetails = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const data = (sellerApi as any).getNodeDetails ? await (sellerApi as any).getNodeDetails() : null
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

    /**
     * Dang ky mot node phan cung moi de chia se tren Marketplace
     */
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

    /**
     * Gui tin hieu heartbeat song con cua may Seller len he thong
     */
    const sendHeartbeat = async () => {
        try {
            const result = (sellerApi as any).pingHeartbeat ? await (sellerApi as any).pingHeartbeat() : null
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
