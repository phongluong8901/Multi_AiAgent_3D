'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { chatsApi, ChatMessage, UserPresence, WorkflowTrace } from '@/lib/api'
import { roomsApi, Room } from '@/lib/api/rooms' // <--- Import thêm roomsApi và Room type
import { getUser } from '@/lib/auth'

export type AgentStatusMeta = {
    agentId: string
    status: 'idle' | 'thinking' | 'working' | 'speaking'
    speech?: string | null
}

export function useRoomCollaboration(roomId: string) {
    const [room, setRoom] = useState<Room | null>(null) // <--- State lưu thông tin chi tiết phòng
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([])
    const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatusMeta>>({})
    const [latestTraces, setLatestTraces] = useState<Record<string, WorkflowTrace>>({})
    const [activeTrace, setActiveTrace] = useState<WorkflowTrace | null>(null)
    const [connected, setConnected] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const isFirstLoadRef = useRef(true)
    const eventSourceRef = useRef<EventSource | null>(null)

    // 1. Tải thông tin phòng và lịch sử chat ban đầu
    const loadInitialData = useCallback(async () => {
        if (!roomId) return
        try {
            if (isFirstLoadRef.current) {
                setLoading(true)
            }

            // Thêm kiểm tra phòng và bắt lỗi nếu chưa có quyền (đặc biệt với phòng Private)
            let roomData = null
            try {
                roomData = await roomsApi.get(roomId)
            } catch (err: any) {
                // Nếu là phòng private mà chưa join, api get room có thể báo lỗi
                console.warn('[useRoomCollaboration] Không thể tải thông tin phòng (có thể do chưa join phòng private):', err.message)

                // Kiểm tra xem user hiện tại có phải chủ phòng hoặc đã ở trong danh sách chưa
                // Nếu chưa, có thể yêu cầu nhập password ngay tại đây hoặc đẩy về Hub
                const currentUser = getUser()
                const isOwnerOrMember = err.response?.data?.data?.members?.some((m: any) => m.memberId === currentUser?.id)

                if (err.response?.status === 403 || err.status === 403) {
                    const pwd = prompt('🔒 Phòng này là riêng tư. Vui lòng nhập mật khẩu để truy cập:')
                    if (pwd) {
                        try {
                            await roomsApi.join(roomId, { password: pwd })
                            roomData = await roomsApi.get(roomId) // Thử tải lại sau khi join thành công
                        } catch (joinErr: any) {
                            alert(joinErr.message || 'Mật khẩu không chính xác!')
                            window.location.href = '/rooms'
                            return
                        }
                    } else {
                        window.location.href = '/rooms'
                        return
                    }
                }
            }

            const [history, presence] = await Promise.all([
                chatsApi.getHistory(roomId, 60).catch(() => []),
                chatsApi.getPresence(roomId).catch(() => ({ roomId, onlineUsers: [] })),
            ])

            if (roomData) setRoom(roomData)
            setMessages(history)
            if (presence?.onlineUsers) {
                setOnlineUsers(presence.onlineUsers)
            }
        } catch (err: any) {
            console.warn('[useRoomCollaboration] Data load error:', err.message)
            setError(err.message)
        } finally {
            isFirstLoadRef.current = false
            setLoading(false)
        }
    }, [roomId])


    // 2. Thiết lập kết nối Real-Time Server-Sent Events (SSE)
    useEffect(() => {
        if (!roomId) return

        loadInitialData()

        const user = getUser()

        // Báo cáo User hiện diện vào phòng
        if (user) {
            chatsApi.updatePresence(roomId, {
                id: user.id,
                name: user.name || user.email,
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${user.name || user.id}`,
                color: '#3b82f6',
            }).catch(() => { })
        }

        const streamUrl = chatsApi.getEventStreamUrl(roomId)
        const es = new EventSource(streamUrl)
        eventSourceRef.current = es

        es.onopen = () => {
            setConnected(true)
            setError(null)
        }

        es.onerror = () => {
            setConnected(false)
        }

        // Lắng nghe sự kiện tin nhắn mới
        es.addEventListener('receive_message', (e: MessageEvent) => {
            try {
                const parsed = JSON.parse(e.data)
                const newMsg: ChatMessage = parsed.data || parsed
                setMessages((prev) => {
                    const exists = prev.some((m) => (m._id && m._id === newMsg._id) || (m.id && m.id === newMsg.id))
                    if (exists) return prev

                    const tempIdx = prev.findIndex(
                        (m) =>
                            (m.id?.startsWith('temp_') || m._id?.startsWith('temp_')) &&
                            m.senderId === newMsg.senderId &&
                            m.message === newMsg.message
                    )
                    if (tempIdx !== -1) {
                        const next = [...prev]
                        next[tempIdx] = newMsg
                        return next
                    }

                    return [...prev, newMsg]
                })
            } catch (err) {
                console.error('Error parsing receive_message event:', err)
            }
        })

        // Lắng nghe trạng thái Agent thay đổi
        es.addEventListener('agent_status', (e: MessageEvent) => {
            try {
                const parsed = JSON.parse(e.data)
                const data: AgentStatusMeta = parsed.data || parsed
                if (data.agentId) {
                    setAgentStatuses((prev) => ({
                        ...prev,
                        [data.agentId]: {
                            agentId: data.agentId,
                            status: data.status,
                            speech: data.speech,
                        },
                    }))
                }
            } catch (err) {
                console.error('Error parsing agent_status event:', err)
            }
        })

        // Lắng nghe cập nhật danh sách người dùng online
        es.addEventListener('room_presence', (e: MessageEvent) => {
            try {
                const parsed = JSON.parse(e.data)
                const data = parsed.data || parsed
                if (data.onlineUsers) {
                    setOnlineUsers(data.onlineUsers)
                }
            } catch (err) { }
        })

        // --- BỔ SUNG: Lắng nghe sự kiện cập nhật thông tin phòng (Member joined, Agent assigned, v.v.) ---
        es.addEventListener('room_updated', () => {
            loadInitialData() // Tự động fetch lại thông tin phòng mới nhất khi có thay đổi từ RabbitMQ event
        })

        const heartbeat = setInterval(() => {
            const u = getUser()
            if (u) {
                chatsApi.updatePresence(roomId, {
                    id: u.id,
                    name: u.name || u.email,
                }).catch(() => { })
            }
        }, 30000)

        return () => {
            clearInterval(heartbeat)
            es.close()
            eventSourceRef.current = null
        }
    }, [roomId, loadInitialData])

    // 3. Hàm gửi tin nhắn
    const sendMessage = async (text: string, targetAgentId?: string) => {
        if (!text.trim() || !roomId) return

        const currentUser = getUser()
        const senderId = currentUser?.id || 'guest_user'
        const senderName = currentUser?.name || currentUser?.email || 'Anonymous'

        const optimisticMsg: ChatMessage = {
            id: `temp_${Date.now()}`,
            roomId,
            senderId,
            senderName,
            senderType: 'user',
            message: text.trim(),
            createdAt: new Date().toISOString(),
        }

        setMessages((prev) => [...prev, optimisticMsg])

        try {
            await chatsApi.send({
                roomId,
                senderId,
                senderName,
                senderType: 'user',
                message: text.trim(),
                targetAgentId,
            })
        } catch (err: any) {
            console.error('[useRoomCollaboration] Send message failed:', err)
        }
    }

    return {
        room, // Trả về thông tin phòng (owner, members, activeAgents, policy, settings...)
        messages,
        onlineUsers,
        agentStatuses,
        latestTraces,
        activeTrace,
        setActiveTrace,
        connected,
        loading,
        error,
        sendMessage,
        refresh: loadInitialData,
    }
}