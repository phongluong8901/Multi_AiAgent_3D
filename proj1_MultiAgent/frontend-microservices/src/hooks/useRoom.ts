'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { roomsApi, Room } from '@/lib/api/rooms'
import { getToken } from '@/lib/auth'
import { io } from 'socket.io-client'
import { toast } from 'sonner'

/**
 * Hook quản lý dữ liệu Phòng cộng tác (`Room`), xác thực mật khẩu phòng riêng tư (Private Room)
 * và kết nối WebSocket theo dõi danh sách thành viên trực tuyến (`room_presence`).
 *
 * @param roomId Mã định danh phòng
 * @param currentUserId ID của người dùng hiện tại
 * @param currentUserName Tên hiển thị của người dùng hiện tại
 */
export function useRoom(roomId: string, currentUserId?: string, currentUserName?: string) {
    const [room, setRoom] = useState<Room | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [socketOnlineUsers, setSocketOnlineUsers] = useState<any[]>([])

    const isFirstLoadRef = useRef(true)
    const lastLoadTimeRef = useRef(0)
    const isMountedRef = useRef(true)

    /**
     * Tải thông tin chi tiết của phòng từ `room-service` (có cơ chế debounce 1.5s tránh gọi lặp).
     */
    const loadRoomData = useCallback(async (force = false) => {
        if (!roomId) return null
        const now = Date.now()
        // Debounce: tránh gọi lặp lại dồn dập trong 1.5 giây trừ khi bắt buộc (force = true)
        if (!force && now - lastLoadTimeRef.current < 1500) {
            return null
        }
        lastLoadTimeRef.current = now

        try {
            if (isFirstLoadRef.current && isMountedRef.current) {
                setLoading(true)
            }

            let roomData: Room | null = null
            try {
                roomData = await roomsApi.get(roomId)
            } catch (err: any) {
                console.warn('[WARN] [useRoom] Không thể tải thông tin phòng:', err.message)

                if (err.response?.status === 403 || err.status === 403) {
                    const pwd = prompt('[XÁC THỰC] Phòng này là riêng tư. Vui lòng nhập mật khẩu để truy cập:')
                    if (pwd) {
                        try {
                            await roomsApi.join(roomId, { password: pwd })
                            roomData = await roomsApi.get(roomId)
                        } catch (joinErr: any) {
                            toast.error(joinErr.message || 'Mật khẩu không chính xác!')
                            window.location.href = '/rooms'
                            return null
                        }
                    } else {
                        window.location.href = '/rooms'
                        return null
                    }
                }
            }

            if (roomData && isMountedRef.current) {
                setRoom(roomData)
            }
            return roomData
        } catch (err: any) {
            console.warn('[WARN] [useRoom] Lỗi tải dữ liệu phòng:', err.message)
            if (isMountedRef.current) setError(err.message)
            return null
        } finally {
            isFirstLoadRef.current = false
            if (isMountedRef.current) setLoading(false)
        }
    }, [roomId])

    // Quản lý kết nối Socket.IO riêng cho Room (Presence & Room Updates) và dọn dẹp khi unmount
    useEffect(() => {
        isMountedRef.current = true
        if (!roomId || !currentUserId) return

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_ROOM_URL || 'http://localhost:4000'
        const token = getToken() || ''

        const socket = io(socketUrl, {
            path: '/api/v1/rooms/socket.io',
            transports: ['websocket'],
            auth: { token },
            extraHeaders: token ? { Authorization: `Bearer ${token}` } : {},
        })

        socket.on('connect', () => {
            if (!isMountedRef.current) return
            console.log(`[INFO] [Room Socket] Đã kết nối tới phòng ${roomId}, socket id: ${socket.id}`)
            socket.emit('identity', currentUserId)
            socket.emit('join', {
                roomId,
                user: {
                    id: currentUserId,
                    name: currentUserName,
                    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUserName || currentUserId}`,
                    color: '#3b82f6',
                },
            })
            socket.emit('get_presence', roomId)
        })

        socket.on('room_presence', (data: { roomId: string; onlineUsers: any[] }) => {
            if (!isMountedRef.current) return
            if (data?.onlineUsers) {
                setSocketOnlineUsers(data.onlineUsers)
            }
        })

        socket.on('room-updated', async () => {
            if (!isMountedRef.current) return
            console.log('[INFO] [ROOM_SOCKET] Nhận sự kiện cập nhật cấu hình phòng (room-updated)')
            loadRoomData()
        })

        socket.on('connect_error', (err) => {
            console.warn('[WARN] [Room Socket] Cảnh báo kết nối:', err.message)
        })

        return () => {
            isMountedRef.current = false
            socket.emit('leave', roomId)
            socket.removeAllListeners()
            socket.disconnect()
        }
    }, [roomId, currentUserId, currentUserName, loadRoomData])

    return {
        room,
        setRoom,
        loading,
        error,
        socketOnlineUsers,
        loadRoomData,
    }
}
