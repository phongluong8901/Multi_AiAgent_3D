'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { chatsApi, ChatMessage, UserPresence, WorkflowTrace, ChatAttachment, ChatType } from '@/lib/api'
import { getUser, getToken } from '@/lib/auth'
import { io, Socket } from 'socket.io-client'

/**
 * Thông tin trạng thái thời gian thực của từng AI Agent trong phòng cộng tác.
 * Bao gồm trạng thái suy luận, lời thoại hiện tại và công cụ đang thực thi.
 */
export type AgentStatusMeta = {
    agentId: string
    status: 'idle' | 'thinking' | 'working' | 'speaking' | 'error'
    speech?: string | null
    activeTool?: string | null
    usedTools?: string[]
}

/**
 * Tham số đầu vào cho hook `useChat`.
 */
interface UseChatProps {
    roomId: string
    typeChat?: ChatType
    onRoomUpdated?: () => void
}

/**
 * Hook quản lý toàn bộ luồng hội thoại thời gian thực (Socket.IO & REST API) trong phòng làm việc:
 * - Đồng bộ lịch sử tin nhắn và danh sách người dùng trực tuyến (`onlineUsers`)
 * - Xử lý luồng token streaming (`agent_stream` & `agent_stream_chunk`)
 * - Cập nhật trạng thái suy nghĩ, thực thi công cụ (`activeTool`) và khôi phục lỗi (`error`) của Agent
 * - Tự động dọn dẹp kết nối WebSocket khi component unmount để chống rò rỉ bộ nhớ (memory leak)
 */
export function useChat({ roomId, typeChat, onRoomUpdated }: UseChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([])
    const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatusMeta>>({})
    const [latestTraces, setLatestTraces] = useState<Record<string, WorkflowTrace>>({})
    const [activeTrace, setActiveTrace] = useState<WorkflowTrace | null>(null)
    const [connected, setConnected] = useState(false)
    const [chatLoading, setChatLoading] = useState(true)

    const socketRef = useRef<Socket | null>(null)
    const isMountedRef = useRef<boolean>(true)
    const onRoomUpdatedRef = useRef(onRoomUpdated)
    onRoomUpdatedRef.current = onRoomUpdated

    /**
     * Tải lịch sử tin nhắn và danh sách hiện diện ban đầu qua REST API.
     */
    const loadChatHistory = useCallback(async () => {
        if (!roomId) return
        try {
            if (isMountedRef.current) setChatLoading(true)
            const [history, presence] = await Promise.all([
                chatsApi.getHistory(roomId, typeChat, 100).catch(() => []),
                chatsApi.getPresence(roomId).catch(() => ({ roomId, onlineUsers: [] })),
            ])

            if (!isMountedRef.current) return
            setMessages(history)
            if (presence?.onlineUsers) {
                setOnlineUsers(presence.onlineUsers)
            }
        } catch (err: any) {
            console.warn('[WARN] [useChat] Lỗi tải lịch sử phòng chat:', err.message)
        } finally {
            if (isMountedRef.current) setChatLoading(false)
        }
    }, [roomId, typeChat])

    /**
     * Khôi phục trạng thái của Agent về `idle` sau khi gặp lỗi (`error`).
     */
    const clearAgentError = useCallback((agentId: string) => {
        setAgentStatuses((prev) => {
            if (!prev[agentId]) return prev
            return {
                ...prev,
                [agentId]: {
                    ...prev[agentId],
                    status: 'idle',
                    activeTool: null,
                },
            }
        })
    }, [])

    // Thiết lập kết nối Real-time Socket.IO và dọn dẹp triệt để khi unmount
    useEffect(() => {
        isMountedRef.current = true
        if (!roomId) return

        loadChatHistory()

        const user = getUser()
        const socketUrl =
            process.env.NEXT_PUBLIC_SOCKET_CHAT_URL ||
            process.env.NEXT_PUBLIC_SOCKET_ROOM_URL ||
            'http://localhost:4000'
        const token = getToken() || ''

        const socket = io(socketUrl, {
            path: '/api/v1/chats/socket.io',
            transports: ['websocket'],
            reconnectionAttempts: 5,
            reconnectionDelay: 3000,
            timeout: 8000,
            auth: { token },
            extraHeaders: token ? { Authorization: `Bearer ${token}` } : {},
        })

        socketRef.current = socket
        let loggedErrorOnce = false

        socket.on('connect', () => {
            if (!isMountedRef.current) return
            loggedErrorOnce = false
            console.log(`[INFO] [Chat Socket] Đã kết nối dịch vụ chat, socket id: ${socket.id}`)
            setConnected(true)

            // Tham gia kênh phòng chat
            socket.emit('join_room', { roomId, userId: user?.id })

            if (user) {
                chatsApi
                    .updatePresence(roomId, {
                        id: user.id,
                        name: user.name || user.email,
                        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${user.name || user.id}`,
                        color: '#3b82f6',
                    })
                    .catch(() => {})
            }
        })

        socket.on('disconnect', () => {
            if (!isMountedRef.current) return
            setConnected(false)
        })

        socket.on('connect_error', (err) => {
            if (!isMountedRef.current) return
            if (!loggedErrorOnce) {
                loggedErrorOnce = true
                console.warn('[WARN] [Chat Socket] Cảnh báo kết nối (sẽ tự động thử lại):', err.message)
            }
            setConnected(false)
        })

        // Lắng nghe tin nhắn hoàn chỉnh từ Socket.IO
        socket.on('receive_message', (data: any) => {
            if (!isMountedRef.current) return
            try {
                const newMsg: ChatMessage = data.data || data
                setMessages((prev) => {
                    const exists = prev.some(
                        (m) => (m._id && m._id === newMsg._id) || (m.id && m.id === newMsg.id)
                    )
                    if (exists) return prev

                    // Thay thế tin nhắn tạm (optimistic) hoặc tin nhắn đang stream của cùng Agent
                    const tempIdx = prev.findIndex(
                        (m) =>
                            ((m.id?.startsWith('temp_') || m._id?.startsWith('temp_')) &&
                                m.senderId === newMsg.senderId &&
                                m.message === newMsg.message) ||
                            ((m.id?.startsWith('stream_') || (m as any).metadata?.isStreaming) &&
                                m.senderId === newMsg.senderId)
                    )
                    if (tempIdx !== -1) {
                        const next = [...prev]
                        next[tempIdx] = newMsg
                        return next
                    }

                    return [...prev, newMsg]
                })

                // Cập nhật lời thoại cuối và đưa trạng thái Agent về idle khi đã gửi xong tin nhắn hoàn chỉnh
                if (newMsg.senderType === 'agent' || newMsg.senderId?.startsWith('agent_')) {
                    setAgentStatuses((prev) => ({
                        ...prev,
                        [newMsg.senderId]: {
                            agentId: newMsg.senderId,
                            status: 'idle',
                            speech: newMsg.message,
                            activeTool: null,
                            usedTools: newMsg.metadata?.usedTools || prev[newMsg.senderId]?.usedTools,
                        },
                    }))
                }
            } catch (err) {
                console.error('[ERROR] [Chat Socket] Lỗi xử lý sự kiện receive_message:', err)
            }
        })

        /**
         * Hàm xử lý chung cho cả sự kiện `agent_stream` và `agent_stream_chunk`.
         * Hỗ trợ cả luồng gửi toàn bộ nội dung tích lũy (`content`) lẫn từng mảnh (`chunk` / `delta` / `token`).
         */
        const handleStreamPayload = (data: any) => {
            if (!isMountedRef.current) return
            try {
                const streamData = data?.data || data
                if (!streamData) return

                const agentId = streamData.agentId || streamData.agent_id
                if (!agentId) return

                // Nếu nhận sự kiện báo lỗi trong quá trình stream
                if (streamData.type === 'error' || streamData.error) {
                    const errText = String(streamData.error || streamData.message || 'Lỗi suy luận từ mô hình AI')
                    setAgentStatuses((prev) => ({
                        ...prev,
                        [agentId]: {
                            agentId,
                            status: 'error',
                            speech: errText,
                            activeTool: null,
                        },
                    }))
                    return
                }

                // Nếu là sự kiện bắt đầu/kết thúc công cụ trong luồng stream
                if (streamData.type === 'tool_start' && streamData.tool) {
                    setAgentStatuses((prev) => ({
                        ...prev,
                        [agentId]: {
                            agentId,
                            status: 'working',
                            speech: `Đang thực thi công cụ: ${streamData.tool}...`,
                            activeTool: streamData.tool,
                            usedTools: Array.from(new Set([...(prev[agentId]?.usedTools || []), streamData.tool])),
                        },
                    }))
                    return
                }

                const fullContent = streamData.content !== undefined ? String(streamData.content) : null
                const deltaChunk =
                    streamData.chunk !== undefined
                        ? String(streamData.chunk)
                        : streamData.delta !== undefined
                        ? String(streamData.delta)
                        : streamData.token !== undefined
                        ? String(streamData.token)
                        : null

                if (!fullContent && !deltaChunk) return

                const streamId = streamData.streamId || `stream_${agentId}`
                const resolvedTypeChat: ChatType = streamData.typeChat || 'agent'
                const rootTypeChat: ChatType = streamData.rootTypeChat || resolvedTypeChat
                const isDone = Boolean(streamData.done || streamData.type === 'done')
                const toolsList: string[] | undefined = streamData.usedTools || streamData.tools_used

                setMessages((prev) => {
                    const existingIdx = prev.findIndex(
                        (m) =>
                            m.id === streamId ||
                            (m.id?.startsWith('stream_') && m.senderId === agentId)
                    )
                    const prevText = existingIdx !== -1 ? prev[existingIdx].message || '' : ''
                    const mergedText =
                        fullContent !== null
                            ? fullContent
                            : prevText + (deltaChunk || '')

                    const streamMsg: ChatMessage = {
                        id: streamId,
                        roomId: streamData.roomId || roomId,
                        typeChat: resolvedTypeChat,
                        senderId: agentId,
                        senderName: streamData.agentName || agentId,
                        senderType: 'agent',
                        message: mergedText,
                        targetAgentId: agentId,
                        createdAt:
                            existingIdx !== -1
                                ? prev[existingIdx].createdAt
                                : new Date().toISOString(),
                        metadata: {
                            ...(existingIdx !== -1 ? prev[existingIdx].metadata : {}),
                            isStreaming: !isDone,
                            rootTypeChat,
                            depth: streamData.depth || 0,
                            ...(toolsList ? { usedTools: toolsList } : {}),
                        },
                    }

                    if (existingIdx !== -1) {
                        const next = [...prev]
                        next[existingIdx] = streamMsg
                        return next
                    }
                    return [...prev, streamMsg]
                })

                const displaySpeech = (fullContent ?? deltaChunk ?? '').slice(-150)
                setAgentStatuses((prev) => ({
                    ...prev,
                    [agentId]: {
                        agentId,
                        status: isDone ? 'idle' : 'speaking',
                        speech: displaySpeech || prev[agentId]?.speech || null,
                        activeTool: isDone ? null : prev[agentId]?.activeTool || null,
                        usedTools: toolsList || prev[agentId]?.usedTools,
                    },
                }))
            } catch (err) {
                console.error('[ERROR] [Chat Socket] Lỗi xử lý sự kiện agent_stream:', err)
            }
        }

        socket.on('agent_stream', handleStreamPayload)
        socket.on('agent_stream_chunk', handleStreamPayload)

        // Lắng nghe cập nhật trạng thái Agent (thinking, working, speaking, idle, error)
        socket.on('agent_status', (data: any) => {
            if (!isMountedRef.current) return
            try {
                const raw = data?.data || data
                if (raw && raw.agentId) {
                    setAgentStatuses((prev) => {
                        const prevSpeech = prev[raw.agentId]?.speech
                        const activeTool =
                            raw.tool ||
                            raw.activeTool ||
                            (raw.status === 'working' ? prev[raw.agentId]?.activeTool : null)
                        return {
                            ...prev,
                            [raw.agentId]: {
                                agentId: raw.agentId,
                                status: raw.status || 'idle',
                                // Giữ lại lời thoại cuối khi về trạng thái idle để hiển thị trên bong bóng 3D
                                speech: raw.speech || prevSpeech || null,
                                activeTool: activeTool || null,
                                usedTools: raw.usedTools || prev[raw.agentId]?.usedTools,
                            },
                        }
                    })
                }
            } catch (err) {
                console.error('[ERROR] [Chat Socket] Lỗi xử lý sự kiện agent_status:', err)
            }
        })

        // Lắng nghe dữ liệu vết thực thi chuỗi tác vụ (Workflow Trace)
        socket.on('workflow_trace', (data: any) => {
            if (!isMountedRef.current) return
            try {
                const trace: WorkflowTrace = data.data || data
                if (trace && trace.agentId) {
                    setLatestTraces((prev) => ({
                        ...prev,
                        [trace.agentId]: trace,
                    }))
                }
            } catch (err) {
                console.error('[ERROR] [Chat Socket] Lỗi xử lý sự kiện workflow_trace:', err)
            }
        })

        // Lắng nghe danh sách thành viên trực tuyến trong phòng
        socket.on('room_presence', (data: any) => {
            if (!isMountedRef.current) return
            try {
                const presenceData = data.data || data
                if (presenceData.onlineUsers) {
                    setOnlineUsers(presenceData.onlineUsers)
                }
            } catch (err) {
                console.error('[ERROR] [Chat Socket] Lỗi xử lý sự kiện room_presence:', err)
            }
        })

        socket.on('room_updated', () => {
            if (isMountedRef.current && onRoomUpdatedRef.current) {
                onRoomUpdatedRef.current()
            }
        })

        socket.on('room_agents_updated', () => {
            if (isMountedRef.current && onRoomUpdatedRef.current) {
                onRoomUpdatedRef.current()
            }
        })

        return () => {
            isMountedRef.current = false
            socket.emit('leave_room', { roomId })
            socket.removeAllListeners()
            socket.disconnect()
            socketRef.current = null
        }
    }, [roomId, loadChatHistory])

    /**
     * Gửi tin nhắn mới vào phòng cộng tác (hỗ trợ đính kèm file và định tuyến theo kênh:
     * `team`, `direct`, `agent`, `meeting`, `workflow`).
     * Tự động dùng Socket.IO nếu đang kết nối, hoặc fallback sang HTTP REST API.
     */
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

        // Tự động suy luận kênh chat (typeChat) dựa theo người nhận nếu không truyền cụ thể
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
                console.error('[ERROR] [useChat] Gửi tin nhắn qua REST fallback thất bại:', err)
                throw err
            }
        }
    }

    /**
     * Tải lên file đính kèm (hình ảnh, CSV, Excel, PDF) trước khi gửi vào khung hội thoại.
     */
    const uploadAndAttachFile = async (file: File): Promise<ChatAttachment | null> => {
        try {
            const attachment = await chatsApi.uploadFile(file)
            return attachment
        } catch (err) {
            console.error('[ERROR] [useChat] Lỗi tải file đính kèm:', err)
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
        clearAgentError,
        refreshChat: loadChatHistory,
    }
}
