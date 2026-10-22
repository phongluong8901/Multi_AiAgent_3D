'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { chatsApi, ChatMessage, UserPresence, WorkflowTrace } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { io, Socket } from 'socket.io-client'

export type AgentStatusMeta = {
    agentId: string
    status: 'idle' | 'thinking' | 'working' | 'speaking'
    speech?: string | null
}

interface UseChatProps {
    roomId: string
    onRoomUpdated?: () => void // Callback để hook cha hoặc useRoom biết khi nào cần reload lại phòng
}

export function useChat({ roomId, onRoomUpdated }: UseChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([])
    const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatusMeta>>({})
    const [latestTraces, setLatestTraces] = useState<Record<string, WorkflowTrace>>({})
    const [activeTrace, setActiveTrace] = useState<WorkflowTrace | null>(null)
    const [connected, setConnected] = useState(false)
    const [chatLoading, setChatLoading] = useState(true)

    const socketRef = useRef<Socket | null>(null)

    // 1. Tải lịch sử chat và thông tin hiện diện ban đầu qua REST API
    const loadChatHistory = useCallback(async () => {
        if (!roomId) return
        try {
            setChatLoading(true)
            const [history, presence] = await Promise.all([
                chatsApi.getHistory(roomId, 60).catch(() => []),
                chatsApi.getPresence(roomId).catch(() => ({ roomId, onlineUsers: [] })),
            ])

            setMessages(history)
            if (presence?.onlineUsers) {
                setOnlineUsers(presence.onlineUsers)
            }
        } catch (err: any) {
            console.warn('[useChat] History load error:', err.message)
        } finally {
            setChatLoading(false)
        }
    }, [roomId])

    // 2. Thiết lập kết nối Real-time Socket.IO
    useEffect(() => {
        if (!roomId) return

        loadChatHistory()

        const user = getUser()
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_CHAT_URL || process.env.NEXT_PUBLIC_SOCKET_ROOM_URL || 'http://localhost:4000'
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : ''

        const socket = io(socketUrl, {
            path: '/api/v1/chats/socket.io',
            transports: ['polling', 'websocket'],
            auth: { token },
            extraHeaders: token ? { Authorization: `Bearer ${token}` } : {},
        })

        socketRef.current = socket

        socket.on('connect', () => {
            console.log(`[Chat Socket] Connected to chat service, socket id: ${socket.id}`)
            setConnected(true)

            // Tham gia room socket chat
            socket.emit('join_room', { roomId, userId: user?.id })

            // Cập nhật hiện diện người dùng
            if (user) {
                chatsApi.updatePresence(roomId, {
                    id: user.id,
                    name: user.name || user.email,
                    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${user.name || user.id}`,
                    color: '#3b82f6',
                }).catch(() => { })
            }
        })

        socket.on('disconnect', () => {
            setConnected(false)
        })

        socket.on('connect_error', (err) => {
            console.warn('[Chat Socket] Connection error:', err.message)
            setConnected(false)
        })

        // Lắng nghe tin nhắn mới từ Socket.IO
        socket.on('receive_message', (data: any) => {
            try {
                const newMsg: ChatMessage = data.data || data
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
                console.error('[Chat Socket] Error parsing receive_message event:', err)
            }
        })

        // Lắng nghe cập nhật trạng thái Agent
        socket.on('agent_status', (data: any) => {
            try {
                const statusMeta: AgentStatusMeta = data.data || data
                if (statusMeta.agentId) {
                    setAgentStatuses((prev) => ({
                        ...prev,
                        [statusMeta.agentId]: {
                            agentId: statusMeta.agentId,
                            status: statusMeta.status,
                            speech: statusMeta.speech,
                        },
                    }))
                }
            } catch (err) {
                console.error('[Chat Socket] Error parsing agent_status event:', err)
            }
        })

        // Lắng nghe Workflow Trace từ LangSmith / Agent Dispatcher
        socket.on('workflow_trace', (data: any) => {
            try {
                const trace: WorkflowTrace = data.data || data
                if (trace && trace.agentId) {
                    setLatestTraces((prev) => ({
                        ...prev,
                        [trace.agentId]: trace,
                    }))
                }
            } catch (err) {
                console.error('[Chat Socket] Error parsing workflow_trace event:', err)
            }
        })

        // Lắng nghe sự kiện cập nhật hiện diện người dùng online
        socket.on('room_presence', (data: any) => {
            try {
                const presenceData = data.data || data
                if (presenceData.onlineUsers) {
                    setOnlineUsers(presenceData.onlineUsers)
                }
            } catch (err) {
                console.error('[Chat Socket] Error parsing room_presence event:', err)
            }
        })

        // Lắng nghe sự kiện phòng bị thay đổi
        socket.on('room_updated', () => {
            if (onRoomUpdated) {
                onRoomUpdated()
            }
        })

        // Heartbeat duy trì trạng thái hiện diện online mỗi 30 giây
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
            socket.emit('leave_room', { roomId })
            socket.disconnect()
            socketRef.current = null
        }
    }, [roomId, loadChatHistory, onRoomUpdated])

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
            console.error('[useChat] Send message failed:', err)
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
        chatLoading,
        sendMessage,
        refreshChat: loadChatHistory,
    }
}