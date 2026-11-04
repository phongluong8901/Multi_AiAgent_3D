'use client'

import { useCallback, useEffect, useState } from 'react'
import { usersApi, UserProfile } from '@/lib/api'
import { getToken, getUser, setSession } from '@/lib/auth'
import { notify } from '@/lib/toast'

export function useUser() {
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        setError(null)
        try {
            const prof = await usersApi.getProfile()
            setProfile(prof)

            const token = getToken()
            const local = getUser()
            if (token && local) {
                setSession(token, {
                    id: prof.id,
                    name: prof.name || local.name,
                    email: prof.email || local.email,
                    role: prof.role || local.role || 'user',
                })
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Không tải được hồ sơ'
            setError(msg)

            const local = getUser()
            if (local) {
                setProfile({
                    id: local.id,
                    name: local.name,
                    email: local.email,
                    bio: '',
                })
            }
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        refresh()
    }, [refresh])

    const updateProfile = async (data: {
        name?: string
        bio?: string
        avatar?: string
    }) => {
        setSaving(true)
        setError(null)
        try {
            const updated = await usersApi.updateProfile(data)
            setProfile(updated)

            const token = getToken()
            if (token) {
                setSession(token, {
                    id: updated.id,
                    name: updated.name,
                    email: updated.email,
                    role: updated.role || 'user',
                })
            }

            notify.success('Đã cập nhật hồ sơ')
            return updated
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Cập nhật thất bại'
            setError(msg)
            notify.error('Cập nhật hồ sơ thất bại', { description: msg })
            throw e
        } finally {
            setSaving(false)
        }
    }

    const uploadAvatar = async (file: File) => {
        setSaving(true)
        try {
            const url = await usersApi.updateAvatar(file)
            setProfile((p: any) => (p ? { ...p, avatar: url, avatarUrl: url } : p))
            notify.success('Đã cập nhật ảnh đại diện')
            return url
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Upload avatar thất bại'
            notify.error(msg)
            throw e
        } finally {
            setSaving(false)
        }
    }

    const updateStatus = async (status: 'online' | 'offline' | 'busy') => {
        if (!getToken()) return   // chưa login → bỏ qua, tránh 401
        try {
            await usersApi.updateStatus(status)
            setProfile((p: any) => (p ? { ...p, status } : p))
            notify.success(`Trạng thái: ${status}`)
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Đổi status thất bại'
            notify.error(msg)
            throw e
        }
    }

    return {
        profile,
        loading,
        saving,
        error,
        refresh,
        updateProfile,
        uploadAvatar,
        updateStatus,
    }
}