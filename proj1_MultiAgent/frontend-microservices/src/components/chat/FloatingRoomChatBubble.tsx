'use client'

import React, { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { chatsApi, roomsApi, BubbleRoomSummary, Room } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { useChat } from '@/hooks/useChat'
import {
    IconMessageSquare,
    IconUsers,
    IconBot,
    IconX,
    IconExternalLink,
    IconSend,
    IconRefreshCw,
} from '@/components/ui/icons'

const AGENT_SHORT_LABELS: Record<string, string> = {
    agent_manager: 'Manager',
    agent_coder: 'Coder & SQL',
    agent_calculate: 'Quant & Math',
    agent_analysis: 'Data & Sentiment',
    agent_analyst: 'Data Analyst',
    agent_search: 'Search & Wiki',
    agent_summarizer: 'Summarizer',
    agent_ml: 'ML & RL',
    agent_vision: 'Vision & OCR',
}

export default function FloatingRoomChatBubble() {
    const pathname = usePathname()
    const router = useRouter()
    const user = getUser()

    const [isOpen, setIsOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'chat' | 'members'>('chat')
    const [rooms, setRooms] = useState<BubbleRoomSummary[]>([])
    const [selectedRoomId, setSelectedRoomId] = useState<string>('')
    const [selectedRoomDetail, setSelectedRoomDetail] = useState<Room | null>(null)
    const [inputText, setInputText] = useState('')
    const [unreadCount, setUnreadCount] = useState(0)
    const [loadingRooms, setLoadingRooms] = useState(false)

    const messagesEndRef = useRef<HTMLDivElement | null>(null)
    const prevMsgLenRef = useRef<number>(0)

    // Ẩn nút nổi nếu người dùng đang ở trực tiếp bên trong trang chi tiết của chính phòng đó (/rooms/[roomId])
    const isInsideRoomDetail = /^\/rooms\/[^/]+/.test(pathname || '')

    const loadBubbleRooms = async () => {
        try {
            setLoadingRooms(true)
            let list = await chatsApi.getBubbleRooms().catch(() => [])
            if (!list || list.length === 0) {
                const fallbackRooms = await roomsApi.list().catch(() => [])
                list = fallbackRooms.map((r) => ({
                    ...r,
                    roomId: String(r._id || r.id || ''),
                    totalMembers: r.totalMembers ?? r.members?.length ?? 0,
                    onlineCount: r.onlineCount ?? r.onlineUsers?.length ?? 0,
                    offlineCount: r.offlineCount ?? 0,
                    lastMessage: null,
                }))
            }
            setRooms(list)
            if (!selectedRoomId && list.length > 0) {
                const firstId = list[0].roomId || String(list[0]._id || list[0].id || '')
                setSelectedRoomId(firstId)
            }
        } catch (err) {
            console.warn('[FloatingRoomChatBubble] Error loading rooms:', err)
        } finally {
            setLoadingRooms(false)
        }
    }

    useEffect(() => {
        if (!user?.id || isInsideRoomDetail) return
        loadBubbleRooms()
        const timer = setInterval(loadBubbleRooms, 30000)
        return () => clearInterval(timer)
    }, [user?.id, isInsideRoomDetail])

    // Tải chi tiết thành viên Online/Offline của phòng đang chọn (chỉ khi mở bubble)
    useEffect(() => {
        if (!selectedRoomId || !isOpen || isInsideRoomDetail) return
        roomsApi
            .get(selectedRoomId)
            .then((r) => setSelectedRoomDetail(r))
            .catch(() => {})
    }, [selectedRoomId, isOpen, isInsideRoomDetail])

    const {
        messages,
        onlineUsers,
        agentStatuses,
        connected,
        chatLoading,
        sendMessage,
    } = useChat({
        roomId: !isInsideRoomDetail && isOpen ? selectedRoomId : '',
        onRoomUpdated: () => {
            if (selectedRoomId && isOpen) {
                roomsApi.get(selectedRoomId).then(setSelectedRoomDetail).catch(() => {})
            }
        },
    })

    // Tự động cuộn xuống cuối và đếm tin nhắn chưa đọc khi đóng bubble
    useEffect(() => {
        if (messages.length > prevMsgLenRef.current) {
            if (!isOpen && prevMsgLenRef.current > 0) {
                setUnreadCount((c) => c + (messages.length - prevMsgLenRef.current))
            }
            if (isOpen) {
                setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
                }, 60)
            }
        }
        prevMsgLenRef.current = messages.length
    }, [messages.length, isOpen])

    useEffect(() => {
        if (isOpen) {
            setUnreadCount(0)
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            }, 80)
        }
    }, [isOpen, selectedRoomId])

    if (isInsideRoomDetail) {
        return null
    }

    const currentRoom =
        rooms.find((r) => (r.roomId || r._id || r.id) === selectedRoomId) || selectedRoomDetail

    const activeAgents = currentRoom?.activeAgents?.length
        ? currentRoom.activeAgents
        : ['agent_manager', 'agent_coder', 'agent_calculate', 'agent_analysis', 'agent_search']

    // Tính số lượng Online & Offline thời gian thực cho phòng đang chọn
    const rawMembers = (selectedRoomDetail?.members || currentRoom?.members || []).filter(
        (m) => m.memberType !== 'agent' && !String(m.memberId).startsWith('agent_')
    )
    const liveOnlineIds = new Set<string>(onlineUsers.map((u) => String(u.userId)))
    for (const m of rawMembers) {
        if (m.isOnline || m.status === 'online') {
            liveOnlineIds.add(String(m.memberId))
        }
    }
    const totalMembersCount = Math.max(rawMembers.length, liveOnlineIds.size)
    const onlineCount = Math.max(liveOnlineIds.size, currentRoom?.onlineCount ?? 0)
    const offlineCount = Math.max(0, totalMembersCount - onlineCount)

    const busyAgents = Object.values(agentStatuses).filter(
        (a) => a.status === 'thinking' || a.status === 'working' || a.status === 'speaking'
    )

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!inputText.trim() || !selectedRoomId) return
        const msg = inputText.trim()
        setInputText('')
        await sendMessage(msg)
    }

    const handleInsertMention = (agentId: string) => {
        const tag = `@${agentId} `
        if (!inputText.includes(tag.trim())) {
            setInputText((prev) => `${tag}${prev}`)
        }
    }

    return (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
            {/* Cửa sổ Chat Nổi (Khi mở) */}
            {isOpen && (
                <div className="mb-3 flex h-[560px] w-[370px] sm:w-[410px] flex-col overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-950/95 shadow-2xl shadow-black/80 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-200">
                    {/* Header chọn Room + trạng thái Online/Offline */}
                    <div className="border-b border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-900 to-blue-950/50 px-3.5 py-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span
                                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                        connected
                                            ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]'
                                            : 'bg-amber-400'
                                    }`}
                                    title={connected ? 'Đã kết nối Realtime Socket' : 'Đang kết nối...'}
                                />
                                <select
                                    value={selectedRoomId}
                                    onChange={(e) => setSelectedRoomId(e.target.value)}
                                    className="w-full truncate rounded-lg border border-zinc-700/80 bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white focus:border-blue-500 focus:outline-none"
                                >
                                    {rooms.length === 0 ? (
                                        <option value="">Đang tải danh sách phòng...</option>
                                    ) : (
                                        rooms.map((r) => {
                                            const rId = r.roomId || String(r._id || r.id || '')
                                            const on = r.onlineCount ?? 0
                                            const off = r.offlineCount ?? 0
                                            return (
                                                <option key={rId} value={rId}>
                                                    {r.name} ({on} Online • {off} Offline)
                                                </option>
                                            )
                                        })
                                    )}
                                </select>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                                {selectedRoomId && (
                                    <button
                                        type="button"
                                        onClick={() => router.push(`/rooms/${selectedRoomId}`)}
                                        title="Mở toàn màn hình 3D Room"
                                        className="flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[11px] font-semibold text-blue-300 transition hover:bg-blue-500/20"
                                    >
                                        <span>3D Room</span>
                                        <IconExternalLink className="w-3 h-3" />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    title="Thu gọn"
                                    className="rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                                >
                                    <IconX className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Thanh Tab chuyển đổi giữa Chat & Danh sách Online/Offline */}
                        <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px]">
                            <div className="flex items-center gap-1 rounded-lg bg-zinc-900/90 p-0.5 border border-zinc-800">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('chat')}
                                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition ${
                                        activeTab === 'chat'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-zinc-400 hover:text-white'
                                    }`}
                                >
                                    <IconMessageSquare className="w-3 h-3" />
                                    <span>Chat Phòng ({messages.length})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('members')}
                                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition ${
                                        activeTab === 'members'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-zinc-400 hover:text-white'
                                    }`}
                                >
                                    <IconUsers className="w-3 h-3" />
                                    <span>Thành viên</span>
                                </button>
                            </div>

                            <div className="flex items-center gap-2 text-[11px]">
                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                    {onlineCount} Online
                                </span>
                                <span className="text-zinc-600">•</span>
                                <span className="inline-flex items-center gap-1 text-zinc-400">
                                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                                    {offlineCount} Offline
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Nội dung chính: Tab Chat hoặc Tab Thành viên Online/Offline */}
                    {activeTab === 'members' ? (
                        <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
                            {/* Danh sách Đang Online */}
                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                        Đang Online trong phòng ({onlineCount})
                                    </span>
                                    <button
                                        type="button"
                                        onClick={loadBubbleRooms}
                                        className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white"
                                    >
                                        <IconRefreshCw className="w-3 h-3" />
                                        <span>Làm mới</span>
                                    </button>
                                </div>
                                <div className="space-y-1.5">
                                    {onlineUsers.length === 0 &&
                                    rawMembers.filter((m) => m.isOnline).length === 0 ? (
                                        <p className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3 text-xs text-zinc-500">
                                            Chưa có thành viên nào đang trực tuyến.
                                        </p>
                                    ) : (
                                        Array.from(liveOnlineIds).map((uid) => {
                                            const uSocket = onlineUsers.find(
                                                (x) => String(x.userId) === uid
                                            )
                                            const uMember = rawMembers.find(
                                                (x) => String(x.memberId) === uid
                                            )
                                            const displayName =
                                                uSocket?.userName || uMember?.name || `User ${uid.slice(0, 6)}`
                                            const role = uMember?.role || 'participant'
                                            return (
                                                <div
                                                    key={uid}
                                                    className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-950/15 px-3 py-2"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
                                                        <span className="text-xs font-medium text-zinc-100">
                                                            {displayName}
                                                        </span>
                                                    </div>
                                                    <span className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-400">
                                                        {role}
                                                    </span>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Danh sách Đang Offline */}
                            <div>
                                <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                                    <span className="h-2 w-2 rounded-full bg-zinc-500" />
                                    Đang Offline ({offlineCount})
                                </span>
                                <div className="space-y-1.5">
                                    {rawMembers.filter((m) => !liveOnlineIds.has(String(m.memberId)))
                                        .length === 0 ? (
                                        <p className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3 text-xs text-zinc-500">
                                            Tất cả thành viên trong phòng đều đang Online.
                                        </p>
                                    ) : (
                                        rawMembers
                                            .filter((m) => !liveOnlineIds.has(String(m.memberId)))
                                            .map((m) => (
                                                <div
                                                    key={m.memberId}
                                                    className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-3 py-2 opacity-75"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="h-2 w-2 rounded-full bg-zinc-600" />
                                                        <span className="text-xs text-zinc-300">
                                                            {m.name || `User ${m.memberId.slice(0, 6)}`}
                                                        </span>
                                                    </div>
                                                    <span className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] uppercase text-zinc-500">
                                                        {m.role || 'member'}
                                                    </span>
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>

                            {/* Danh sách AI Agents trực chiến trong phòng */}
                            <div>
                                <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-400">
                                    <IconBot className="w-3.5 h-3.5" />
                                    AI Agents Trực Chiến ({activeAgents.length})
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {activeAgents.map((agId) => (
                                        <button
                                            key={agId}
                                            type="button"
                                            onClick={() => {
                                                setActiveTab('chat')
                                                handleInsertMention(agId)
                                            }}
                                            className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-300 transition hover:bg-blue-500/20"
                                        >
                                            @{AGENT_SHORT_LABELS[agId] || agId}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Thanh chọn nhanh @agent_... để gọi Agent ngay từ ngoài Room */}
                            <div className="flex items-center gap-1.5 overflow-x-auto border-b border-zinc-800/80 bg-zinc-900/60 px-3 py-1.5 scrollbar-none">
                                <span className="shrink-0 text-[10px] font-semibold uppercase text-zinc-500">
                                    Gọi nhanh:
                                </span>
                                {activeAgents.map((agId) => (
                                    <button
                                        key={agId}
                                        type="button"
                                        onClick={() => handleInsertMention(agId)}
                                        className="shrink-0 rounded-md border border-zinc-700/80 bg-zinc-800/90 px-2 py-0.5 text-[11px] font-medium text-blue-300 transition hover:border-blue-500/50 hover:bg-blue-500/20"
                                    >
                                        @{AGENT_SHORT_LABELS[agId] || agId.replace('agent_', '')}
                                    </button>
                                ))}
                            </div>

                            {/* Khung danh sách tin nhắn */}
                            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
                                {chatLoading || loadingRooms ? (
                                    <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                                        Đang đồng bộ tin nhắn phòng...
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="flex h-full flex-col items-center justify-center text-center px-4">
                                        <p className="text-xs text-zinc-400">
                                            Chưa có tin nhắn nào trong phòng này.
                                        </p>
                                        <p className="mt-1 text-[11px] text-zinc-500">
                                            Gõ tin nhắn hoặc bấm vào thẻ <code className="text-blue-400">@Agent</code> ở trên để trò chuyện trực tiếp từ bên ngoài!
                                        </p>
                                    </div>
                                ) : (
                                    messages.slice(-50).map((m, idx) => {
                                        const isMe = user?.id && m.senderId === user.id
                                        const isAgent =
                                            m.senderType === 'agent' ||
                                            String(m.senderId).startsWith('agent_')
                                        return (
                                            <div
                                                key={m._id || m.id || idx}
                                                className={`flex flex-col ${
                                                    isMe ? 'items-end' : 'items-start'
                                                }`}
                                            >
                                                <div className="mb-0.5 flex items-center gap-1.5 px-1">
                                                    <span
                                                        className={`flex items-center gap-1 text-[10px] font-semibold ${
                                                            isAgent
                                                                ? 'text-purple-400'
                                                                : isMe
                                                                ? 'text-blue-400'
                                                                : 'text-zinc-400'
                                                        }`}
                                                    >
                                                        {isAgent && <IconBot className="w-3 h-3" />}
                                                        <span>{m.senderName}</span>
                                                    </span>
                                                    {m.createdAt && (
                                                        <span className="text-[9px] text-zinc-600">
                                                            {new Date(m.createdAt).toLocaleTimeString([], {
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            })}
                                                        </span>
                                                    )}
                                                </div>
                                                <div
                                                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                                                        isMe
                                                            ? 'bg-blue-600 text-white rounded-br-sm'
                                                            : isAgent
                                                            ? 'border border-purple-500/30 bg-purple-950/40 text-zinc-100 rounded-bl-sm'
                                                            : 'border border-zinc-800 bg-zinc-900 text-zinc-200 rounded-bl-sm'
                                                    }`}
                                                >
                                                    {m.message}
                                                </div>
                                            </div>
                                        )
                                    })
                                )}

                                {busyAgents.length > 0 && (
                                    <div className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-950/20 px-3 py-1.5 text-[11px] text-blue-300">
                                        <span className="h-2 w-2 animate-ping rounded-full bg-blue-400" />
                                        <span>
                                            {busyAgents.map((a) => a.agentId).join(', ')} đang xử lý...
                                        </span>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Ô nhập tin nhắn */}
                            <form
                                onSubmit={handleSend}
                                className="border-t border-zinc-800 bg-zinc-900/90 p-2.5 flex items-center gap-2"
                            >
                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    placeholder="Nhắn vào phòng hoặc gọi @agent_..."
                                    className="flex-1 rounded-xl border border-zinc-700/80 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                                />
                                <button
                                    type="submit"
                                    disabled={!inputText.trim() || !selectedRoomId}
                                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40"
                                >
                                    <IconSend className="w-3.5 h-3.5" />
                                    <span>Gửi</span>
                                </button>
                            </form>
                        </>
                    )}
                </div>
            )}

            {/* Nút Nổi (Floating Bubble Button) */}
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="group relative flex items-center gap-2.5 rounded-full border border-blue-400/40 bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-xs font-semibold text-white shadow-xl shadow-blue-600/30 transition hover:scale-105 hover:from-blue-500 hover:to-indigo-500 active:scale-95"
                title="Chat nhanh với Room & AI Agents từ mọi trang"
            >
                <span className="relative flex h-5 w-5 items-center justify-center">
                    <IconMessageSquare className="w-4 h-4" />
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-blue-600" />
                </span>
                <span className="hidden sm:inline">
                    {isOpen ? 'Đóng Room Chat' : 'Room Chat'}
                </span>
                <span className="flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {onlineCount}
                </span>

                {unreadCount > 0 && !isOpen && (
                    <span className="absolute -top-1.5 -left-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>
        </div>
    )
}

