'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { chatsApi, ChatMessage, UserPresence, WorkflowTrace, ChatAttachment, ChatType } from '@/lib/api'
import { getUser, getToken } from '@/lib/auth'
import { io, Socket } from 'socket.io-client'

export type AgentStatusMeta = {
    agentId: string
    status: 'idle' | 'thinking' | 'working' | 'speaking'
    speech?: string | null
}

interface UseChatProps {
    roomId: string
    typeChat?: ChatType
    onRoomUpdated?: () => void
}

export function useChat({ roomId, typeChat = 'team', onRoomUpdated }: UseChatProps) {
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
                chatsApi.getHistory(roomId, typeChat, 60).catch(() => []),
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
    }, [roomId, typeChat])

    // 2. Thiết lập kết nối Real-time Socket.IO
    useEffect(() => {
        if (!roomId) return

        loadChatHistory()

        const user = getUser()
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_CHAT_URL || process.env.NEXT_PUBLIC_SOCKET_ROOM_URL || 'http://localhost:4000'
        const token = getToken() || ''

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

        socket.on('room_updated', () => {
            if (onRoomUpdated) {
                onRoomUpdated()
            }
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
            socket.emit('leave_room', { roomId })
            socket.disconnect()
            socketRef.current = null
        }
    }, [roomId, loadChatHistory, onRoomUpdated])

    // 3. Hàm gửi tin nhắn (Hỗ trợ đính kèm attachments và phân loại typeChat: team, direct, agent, workflow)
    const sendMessage = async (
        text: string,
        attachments?: ChatAttachment[],
        targetAgentId?: string,
        targetUserId?: string,
        specificTypeChat?: ChatType
    ) => {
        if ((!text.trim() && (!attachments || attachments.length === 0)) || !roomId) return

        const currentUser = getUser()
        const senderId = currentUser?.id || 'guest_user'
        const senderName = currentUser?.name || currentUser?.email || 'Anonymous'

        // Xác định typeChat tự động dựa theo người nhận
        let resolvedTypeChat: ChatType = specificTypeChat || typeChat || 'team'
        if (!specificTypeChat) {
            if (targetUserId) {
                resolvedTypeChat = 'direct'
            } else if (targetAgentId || text.includes('@agent_')) {
                resolvedTypeChat = 'agent'
            }
        }

        const optimisticMsg: ChatMessage = {
            id: `temp_${Date.now()}`,
            roomId,
            typeChat: resolvedTypeChat,
            senderId,
            senderName,
            senderType: 'user',
            message: text.trim() || '[Đã gửi file đính kèm]',
            targetUserId,
            targetAgentId,
            attachments: attachments || [],
            createdAt: new Date().toISOString(),
        }

        setMessages((prev) => [...prev, optimisticMsg])

        // Nếu socket đang kết nối, emit trực tiếp qua socket; nếu không thì dùng REST API fallback
        if (socketRef.current && socketRef.current.connected) {
            socketRef.current.emit('send_message', {
                roomId,
                typeChat: resolvedTypeChat,
                senderId,
                senderName,
                senderType: 'user',
                message: text.trim() || '[Đã gửi file đính kèm]',
                targetUserId,
                targetAgentId,
                attachments: attachments || [],
            })
        } else {
            try {
                await chatsApi.send({
                    roomId,
                    typeChat: resolvedTypeChat,
                    senderId,
                    senderName,
                    senderType: 'user',
                    message: text.trim() || '[Đã gửi file đính kèm]',
                    targetUserId,
                    targetAgentId,
                    attachments: attachments || [],
                })
            } catch (err: any) {
                console.error('[useChat] Send message failed:', err)
            }
        }
    }

    // 4. Hàm upload file (Ảnh hoặc CSV/Excel) trước khi gửi
    const uploadAndAttachFile = async (file: File): Promise<ChatAttachment | null> => {
        try {
            const attachment = await chatsApi.uploadFile(file)
            return attachment
        } catch (err) {
            console.error('[useChat] Upload file error:', err)
            throw err
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
        uploadAndAttachFile,
        refreshChat: loadChatHistory,
    }
}