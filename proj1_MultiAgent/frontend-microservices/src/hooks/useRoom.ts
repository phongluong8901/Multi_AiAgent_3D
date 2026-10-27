'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { roomsApi, Room } from '@/lib/api/rooms'
import { getUser } from '@/lib/auth'
import { io } from 'socket.io-client'
import { toast } from 'sonner'

export function useRoom(roomId: string, currentUserId?: string, currentUserName?: string) {
    const [room, setRoom] = useState<Room | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [socketOnlineUsers, setSocketOnlineUsers] = useState<any[]>([])

    const isFirstLoadRef = useRef(true)

    const loadRoomData = useCallback(async () => {
        if (!roomId) return null
        try {
            if (isFirstLoadRef.current) {
                setLoading(true)
            }

            let roomData = null
            try {
                roomData = await roomsApi.get(roomId)
            } catch (err: any) {
                console.warn('[useRoom] Không thể tải thông tin phòng:', err.message)

                if (err.response?.status === 403 || err.status === 403) {
                    const pwd = prompt('🔒 Phòng này là riêng tư. Vui lòng nhập mật khẩu để truy cập:')
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

            if (roomData) {
                setRoom(roomData)
            }
            return roomData
        } catch (err: any) {
            console.warn('[useRoom] Room load error:', err.message)
            setError(err.message)
            return null
        } finally {
            isFirstLoadRef.current = false
            setLoading(false)
        }
    }, [roomId])

    // Quản lý kết nối Socket.IO riêng cho Room (Presence, Room Updates)
    useEffect(() => {
        if (!roomId || !currentUserId) return

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_ROOM_URL || 'http://localhost:4000'
        const token = localStorage.getItem('token') || ''

        const socket = io(socketUrl, {
            path: '/api/v1/rooms/socket.io',
            transports: ['polling', 'websocket'],
            auth: { token },
            extraHeaders: token ? { Authorization: `Bearer ${token}` } : {},
        })

        socket.on('connect', () => {
            console.log(`[Room Socket] Connected to room ${roomId}, socket id: ${socket.id}`)
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
            if (data?.onlineUsers) {
                setSocketOnlineUsers(data.onlineUsers)
            }
        })

        socket.on('room-updated', async () => {
            console.log('🔄 [Room Socket] Received room-updated event')
            loadRoomData()
        })

        socket.on('connect_error', (err) => {
            console.warn('[Room Socket] Connection warning:', err.message)
        })

        return () => {
            socket.emit('leave', roomId)
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