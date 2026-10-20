'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { chatsApi, ChatMessage, UserPresence, WorkflowTrace } from '@/lib/api'
import { getUser } from '@/lib/auth'

export type AgentStatusMeta = {
    agentId: string
    status: 'idle' | 'thinking' | 'working' | 'speaking'
    speech?: string | null
}

export function useRoomCollaboration(roomId: string) {
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

    // 1. Tải lịch sử chat ban đầu
    const loadInitialHistory = useCallback(async () => {
        if (!roomId) return
        try {
            if (isFirstLoadRef.current) {
                setLoading(true)
            }
            const [history, presence] = await Promise.all([
                chatsApi.getHistory(roomId, 60),
                chatsApi.getPresence(roomId).catch(() => ({ roomId, onlineUsers: [] })),
            ])
            setMessages(history)
            if (presence?.onlineUsers) {
                setOnlineUsers(presence.onlineUsers)
            }
        } catch (err: any) {
            console.warn('[useRoomCollaboration] History load error:', err.message)
            setError(err.message)
        } finally {
            isFirstLoadRef.current = false
            setLoading(false)
        }
    }, [roomId])

    // 2. Thiết lập kết nối Real-Time Server-Sent Events (SSE)
    useEffect(() => {
        if (!roomId) return

        loadInitialHistory()

        const user = getUser()

        // Báo cáo User hiện diện vào phòng
        if (user) {
            chatsApi.updatePresence(roomId, {
                id: user.id,
                name: user.name || user.email,
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${user.name || user.id}`,
                color: '#3b82f6',
            }).catch(() => {})
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
                    // Tránh duplicate tin nhắn nếu đã có id
                    const exists = prev.some((m) => (m._id && m._id === newMsg._id) || (m.id && m.id === newMsg.id))
                    if (exists) return prev

                    // Thay thế tin nhắn tạm (optimistic) của cùng người gửi và cùng nội dung
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

        // Lắng nghe trạng thái Agent thay đổi (thinking / working / speaking / idle)
        es.addEventListener('agent_status', (e: MessageEvent) => {
            try {
                const parsed = JSON.parse(e.data)
                const data: AgentStatusMeta = parsed.data || parsed
                if (data.agentId) {
                    setAgentStatuses((prev) => {
                        const current = prev[data.agentId]
                        if (current && current.status === data.status && current.speech === data.speech) {
                            return prev
                        }
                        return {
                            ...prev,
                            [data.agentId]: {
                                agentId: data.agentId,
                                status: data.status,
                                speech: data.speech,
                            },
                        }
                    })
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
            } catch (err) {
                console.error('Error parsing room_presence event:', err)
            }
        })

        // Lắng nghe người dùng mới gia nhập
        es.addEventListener('user_joined', (e: MessageEvent) => {
            try {
                const parsed = JSON.parse(e.data)
                const data = parsed.data || parsed
                if (data.onlineUsers) {
                    setOnlineUsers(data.onlineUsers)
                }
            } catch (err) {}
        })

        // Lắng nghe người dùng rời phòng
        es.addEventListener('user_left', (e: MessageEvent) => {
            try {
                const parsed = JSON.parse(e.data)
                const data = parsed.data || parsed
                if (data.onlineUsers) {
                    setOnlineUsers(data.onlineUsers)
                }
            } catch (err) {}
        })

        // Lắng nghe workflow trace (LangSmith visualizer)
        es.addEventListener('workflow_trace', (e: MessageEvent) => {
            try {
                const parsed = JSON.parse(e.data)
                const trace: WorkflowTrace = parsed.data || parsed
                if (trace && trace.traceId) {
                    setLatestTraces((prev) => ({
                        ...prev,
                        [trace.traceId]: trace,
                    }))
                    // Nếu gặp sự cố, tự động mở popup để xem lỗi tại node nào
                    if (trace.status === 'error') {
                        setActiveTrace(trace)
                    }
                }
            } catch (err) {
                console.error('Error parsing workflow_trace event:', err)
            }
        })

        // Heartbeat báo cáo presence định kỳ (30s)
        const heartbeat = setInterval(() => {
            const u = getUser()
            if (u) {
                chatsApi.updatePresence(roomId, {
                    id: u.id,
                    name: u.name || u.email,
                }).catch(() => {})
            }
        }, 30000)

        return () => {
            clearInterval(heartbeat)
            es.close()
            eventSourceRef.current = null
        }
    }, [roomId, loadInitialHistory])

    // 3. Hàm gửi tin nhắn (hỗ trợ mention hoặc ra lệnh chéo cho Agent)
    const sendMessage = async (text: string, targetAgentId?: string) => {
        if (!text.trim() || !roomId) return

        const currentUser = getUser()
        const senderId = currentUser?.id || 'guest_user'
        const senderName = currentUser?.name || currentUser?.email || 'Anonymous'

        // Optimistic UI: thêm tin nhắn vào feed ngay lập tức
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
            // Hiển thị thông báo lỗi
            setMessages((prev) => [
                ...prev,
                {
                    id: `err_${Date.now()}`,
                    roomId,
                    senderId: 'system',
                    senderName: 'System',
                    senderType: 'system',
                    message: `Không thể gửi tin nhắn: ${err.message}`,
                    createdAt: new Date().toISOString(),
                },
            ])
        }
    }

    return {
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
        refresh: loadInitialHistory,
    }
}
