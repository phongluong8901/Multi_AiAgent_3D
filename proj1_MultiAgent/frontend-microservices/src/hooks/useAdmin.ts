'use client'

import { useCallback, useState } from 'react'
import { adminApi } from '@/lib/api/admin'
import { notify } from '@/lib/toast'

/**
 * Custom Hook quan tri he thong (Admin Management Hook):
 * - Quan ly danh sach nguoi dung toan he thong (`users`)
 * - Quan ly danh sach cac Hardware Nodes dang ket noi (`hardwareNodes`)
 * - Cap nhat phan quyen (User Role: admin, seller, user, guest)
 * - Xoa nguoi dung va lay thong ke he thong
 */
export function useAdmin() {
    const [users, setUsers] = useState<any[]>([])
    const [hardwareNodes, setHardwareNodes] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    /**
     * Lay danh sach tat ca nguoi dung trong he thong
     */
    const fetchUsers = useCallback(async (params?: { page?: number; limit?: number; search?: string }) => {
        setLoading(true)
        setError(null)
        try {
            const data = await adminApi.getUsers(params)
            setUsers(Array.isArray(data) ? data : data?.users || data?.data || [])
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Không thể tải danh sách người dùng'
            setError(msg)
            notify.error(msg)
        } finally {
            setLoading(false)
        }
    }, [])

    /**
     * Lay danh sach tat ca cac node phan cung (GPU/NPU) trong he thong
     */
    const fetchHardwareNodes = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await adminApi.getHardwareNodes()
            setHardwareNodes(Array.isArray(data) ? data : data?.nodes || data?.data || [])
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Không thể tải danh sách hardware nodes'
            setError(msg)
            notify.error(msg)
        } finally {
            setLoading(false)
        }
    }, [])

    /**
     * Cap nhat vai tro (role) cua nguoi dung
     */
    const updateUserRole = async (payload: { userId: string; role: string }) => {
        setActionLoading(true)
        try {
            const updated = await adminApi.updateUserRole(payload)
            notify.success('Cập nhật quyền người dùng thành công')
            setUsers((prev) =>
                prev.map((u) => (u.id === payload.userId || u._id === payload.userId ? { ...u, role: payload.role } : u))
            )
            return updated
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Cập nhật quyền thất bại'
            notify.error(msg)
            throw e
        } finally {
            setActionLoading(false)
        }
    }

    /**
     * Xoa mem tai khoan nguoi dung khoi he thong
     */
    const deleteUser = async (id: string) => {
        setActionLoading(true)
        try {
            await adminApi.deleteUser(id)
            notify.success('Xóa người dùng thành công')
            setUsers((prev) => prev.filter((u) => u.id !== id && u._id !== id))
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Xóa người dùng thất bại'
            notify.error(msg)
            throw e
        } finally {
            setActionLoading(false)
        }
    }

    return {
        users,
        hardwareNodes,
        loading,
        actionLoading,
        error,
        fetchUsers,
        fetchHardwareNodes,
        updateUserRole,
        deleteUser,
    }
}
