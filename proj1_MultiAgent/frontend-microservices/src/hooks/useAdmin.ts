'use client'

import { useCallback, useState } from 'react'
import { adminApi } from '@/lib/api/admin'
import { notify } from '@/lib/toast'

export function useAdmin() {
    const [users, setUsers] = useState<any[]>([])
    const [hardwareNodes, setHardwareNodes] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchUsers = useCallback(async (params?: { page?: number; limit?: number; search?: string }) => {
        setLoading(true)
        setError(null)
        try {
            const data = await adminApi.getUsers(params)
            // Tùy thuộc vào cấu trúc trả về của backend (vd: data.users hoặc trực tiếp mảng data)
            setUsers(Array.isArray(data) ? data : data?.users || data?.data || [])
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Không thể tải danh sách người dùng'
            setError(msg)
            notify.error(msg)
        } finally {
            setLoading(false)
        }
    }, [])

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

    const updateUserRole = async (payload: { userId: string; role: string }) => {
        setActionLoading(true)
        try {
            const updated = await adminApi.updateUserRole(payload)
            notify.success('Cập nhật quyền người dùng thành công')
            // Cập nhật state local nếu cần
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

    const deleteUser = async (userId: string) => {
        setActionLoading(true)
        try {
            await adminApi.deleteUser(userId)
            notify.success('Đã xóa người dùng thành công')
            setUsers((prev) => prev.filter((u) => u.id !== userId && u._id !== userId))
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