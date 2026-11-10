'use client'

import { useCallback, useEffect, useState } from 'react'
import { usersApi, UserProfile } from '@/lib/api'
import { getToken, getUser, setSession } from '@/lib/auth'
import { notify } from '@/lib/toast'

/**
 * Custom Hook quan ly ho so nguoi dung ca nhan (User Profile Hook):
 * - Tai thong tin ca nhan (`getProfile`) va dong bo vao session local
 * - Cap nhat ten hien thi, tieu su bio va avatar ca nhan
 * - Cap nhat trang thai online / offline / busy
 * - Tai len anh dai dien len Cloudinary thong qua user-service
 */
export function useUser() {
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    /**
     * Tai lai thong tin ho so nguoi dung tu user-service
     */
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

    /**
     * Cap nhat thong tin profile ca nhan (name, bio, avatar)
     */
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
            const local = getUser()
            if (token && local) {
                setSession(token, {
                    ...local,
                    name: updated.name || local.name,
                })
            }
            notify.success('Cập nhật hồ sơ thành công')
            return updated
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Cập nhật thất bại'
            setError(msg)
            notify.error('Cập nhật thất bại', { description: msg })
            throw e
        } finally {
            setSaving(false)
        }
    }

    /**
     * Tai len file anh dai dien (Avatar) moi
     */
    const updateAvatar = async (file: File) => {
        setSaving(true)
        setError(null)
        try {
            const newUrl = await usersApi.updateAvatar(file)
            notify.success('Cập nhật avatar thành công')
            await refresh()
            return newUrl
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Tải avatar thất bại'
            setError(msg)
            notify.error('Tải avatar thất bại', { description: msg })
            throw e
        } finally {
            setSaving(false)
        }
    }

    /**
     * Cap nhat trang thai hoat dong (online | offline | busy)
     */
    const updateStatus = async (status: 'online' | 'offline' | 'busy') => {
        setSaving(true)
        try {
            await usersApi.updateStatus(status)
            setProfile((prev) => (prev ? { ...prev, status } : prev))
            notify.success('Đã cập nhật trạng thái')
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Cập nhật trạng thái thất bại'
            notify.error(msg)
            throw e
        } finally {
            setSaving(false)
        }
    }

    return {
        profile,
        loading,
        saving,
        error,
        refresh,
        updateProfile,
        updateAvatar,
        uploadAvatar: updateAvatar,
        updateStatus,
    }
}
