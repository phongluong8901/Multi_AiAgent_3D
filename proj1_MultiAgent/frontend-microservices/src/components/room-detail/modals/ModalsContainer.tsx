'use client'

import { useState, useEffect } from 'react'
import { Agent, Room, UserPresence, WorkflowTrace, roomsApi, usersApi, InviteUser } from '@/lib/api'
import WorkflowTraceModal from '@/components/ui/WorkflowTraceModal'
import UserAgentAssignmentModal from '@/components/ui/UserAgentAssignmentModal'
import { IconX, IconPlus, IconUsers, IconUser, IconBot } from '@/components/ui/icons'
import { getUser } from '@/lib/auth'

interface ModalsContainerProps {
    roomId: string
    room: Room | null
    allAgents: Agent[]
    onlineUsers: UserPresence[]
    addAgentModalOpen: boolean
    setAddAgentModalOpen: (open: boolean) => void
    handleAddAgentToRoom: (agentId: string) => void
    traceModalOpen: boolean
    setTraceModalOpen: (open: boolean) => void
    activeTrace: WorkflowTrace | null
    latestTraces: Record<string, WorkflowTrace>
    setActiveTrace: (trace: WorkflowTrace) => void
    assignmentModalOpen: boolean
    setAssignmentModalOpen: (open: boolean) => void
    setRoom: (room: Room) => void
    currentTab?: 'members' | 'agents' | 'invite'
    setCurrentTab?: (tab: 'members' | 'agents' | 'invite') => void
}

export function ModalsContainer({
    roomId,
    room,
    allAgents,
    onlineUsers,
    addAgentModalOpen,
    setAddAgentModalOpen,
    handleAddAgentToRoom,
    traceModalOpen,
    setTraceModalOpen,
    activeTrace,
    latestTraces,
    setActiveTrace,
    assignmentModalOpen,
    setAssignmentModalOpen,
    setRoom,
    currentTab = 'members',
    setCurrentTab,
}: ModalsContainerProps) {
    const me = getUser()
    const myId = String(me?.id || '').trim()

    const [localTab, setLocalTab] = useState<'members' | 'agents' | 'invite'>(currentTab)
    const activeTab = currentTab || localTab

    const handleSwitchTab = (tab: 'members' | 'agents' | 'invite') => {
        setLocalTab(tab)
        if (setCurrentTab) setCurrentTab(tab)
    }

    // --- State cho chức năng Tìm kiếm & Mời thành viên kết hợp Online Users ---
    const [searchQuery, setSearchQuery] = useState('')
    const [onlineUserList, setOnlineUserList] = useState<InviteUser[]>([])
    const [loadingOnline, setLoadingOnline] = useState(false)
    const [invitingId, setInvitingId] = useState<string | null>(null)

    // Tải danh sách user online khi mở tab Mời hoặc khi nhập ô tìm kiếm
    useEffect(() => {
        let cancelled = false
            ; (async () => {
                setLoadingOnline(true)
                try {
                    // Gọi listOnline kèm query nếu có để backend lọc
                    const list = await usersApi.listOnline(searchQuery.trim() || undefined)
                    if (!cancelled) {
                        // Loại bỏ chính mình ra khỏi danh sách gợi ý mời
                        setOnlineUserList(list.filter((u) => String(u.id) !== myId))
                    }
                } catch {
                    if (!cancelled) setOnlineUserList([])
                } finally {
                    if (!cancelled) setLoadingOnline(false)
                }
            })()
        return () => {
            cancelled = true
        }
    }, [searchQuery, myId])

    const handleSendInvite = async (u: InviteUser) => {
        const uid = String(u.id || '').trim()
        if (!uid) return
        setInvitingId(uid)
        try {
            const updated = await roomsApi.invite(roomId, {
                userId: uid,
                inviteeEmail: u.email,
                userName: u.username,
            })
            setRoom(updated)
            alert(`✅ Đã gửi lời mời tới ${u.username}. Khi họ đồng ý sẽ tự động vào phòng.`)
        } catch (e: any) {
            alert(e.message || 'Gửi lời mời thất bại')
        } finally {
            setInvitingId(null)
        }
    }

    // Hàm đá/xóa thành viên ra khỏi phòng
    const handleRemoveMember = async (memberId: string) => {
        if (!confirm(`Xóa thành viên ${memberId} khỏi phòng này?`)) return
        try {
            const updated = await roomsApi.removeMember(roomId, memberId)
            setRoom(updated)
        } catch (err: any) {
            alert(`Lỗi khi xóa thành viên: ${err.message}`)
        }
    }

    const isMember = (userId: string) => {
        if (room?.ownerId === userId) return true
        return room?.members?.some((m) => m.memberId === userId)
    }

    const isManagementOpen = assignmentModalOpen || addAgentModalOpen

    const handleCloseManagement = () => {
        setAssignmentModalOpen(false)
        setAddAgentModalOpen(false)
    }

    return (
        <>
            {/* Modal Quản lý Phòng Hợp nhất (Thành viên - Agent - Mời) */}
            {isManagementOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
                    <div className="w-full max-w-2xl rounded-3xl bg-zinc-900 border border-zinc-800 p-5 sm:p-6 shadow-2xl space-y-5 flex flex-col max-h-[90vh]">

                        {/* Header & Tabs */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                                    <IconUsers className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                                        <span>Quản Lý Phòng</span>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-normal">
                                            {room?.name}
                                        </span>
                                    </h3>
                                    <p className="text-xs text-zinc-400">
                                        Quản lý danh sách thành viên, phân bổ Agent và mời người cộng tác
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={handleCloseManagement}
                                className="text-zinc-400 hover:text-white transition w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center self-end sm:self-center shrink-0 hover:bg-zinc-700"
                                title="Đóng modal"
                            >
                                <IconX className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-950 border border-zinc-800 shrink-0 overflow-x-auto text-xs font-medium">
                            <button
                                onClick={() => handleSwitchTab('members')}
                                className={`flex-1 py-1.5 px-3 rounded-lg transition text-center whitespace-nowrap ${activeTab === 'members'
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-zinc-400 hover:text-white'
                                    }`}
                            >
                                Thành viên ({room?.members?.length || 1})
                            </button>
                            <button
                                onClick={() => handleSwitchTab('agents')}
                                className={`flex-1 py-1.5 px-3 rounded-lg transition text-center whitespace-nowrap ${activeTab === 'agents'
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-zinc-400 hover:text-white'
                                    }`}
                            >
                                Phân bổ Agent ({room?.activeAgents?.length || 0})
                            </button>
                            <button
                                onClick={() => handleSwitchTab('invite')}
                                className={`flex-1 py-1.5 px-3 rounded-lg transition text-center whitespace-nowrap ${activeTab === 'invite'
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'text-zinc-400 hover:text-white'
                                    }`}
                            >
                                + Mời thành viên
                            </button>
                        </div>

                        {/* TAB 1: DANH SÁCH THÀNH VIÊN */}
                        {activeTab === 'members' && (
                            <div className="space-y-3 overflow-y-auto pr-1 flex-1 min-h-[300px]">
                                <div className="flex items-center justify-between text-xs text-zinc-400 pb-1">
                                    <span>Danh sách thành viên hiện diện trong phòng:</span>
                                    <button
                                        onClick={() => handleSwitchTab('invite')}
                                        className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                                    >
                                        <IconPlus className="w-3.5 h-3.5" />
                                        <span>Mời thêm người</span>
                                    </button>
                                </div>

                                <div className="space-y-2.5">
                                    {/* Chủ sở hữu phòng */}
                                    {(() => {
                                        const ownerId = room?.ownerId || 'Chủ phòng'
                                        const ownerAgents = (room?.userAgents || []).filter((b) => b.userId === ownerId)
                                        return (
                                            <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-blue-500/30 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500 text-blue-400 flex items-center justify-center font-bold text-xs">
                                                            {ownerId.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-xs text-white flex items-center gap-2">
                                                                <span>{ownerId}</span>
                                                                <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono">
                                                                    Owner
                                                                </span>
                                                            </div>
                                                            <div className="text-[10px] text-zinc-500 mt-0.5">
                                                                Chủ sở hữu phòng • Đang quản lý {ownerAgents.length} Agent
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                        {ownerAgents.length} Agent
                                                    </span>
                                                </div>

                                                {ownerAgents.length > 0 ? (
                                                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-800/60">
                                                        <span className="text-[10px] text-zinc-500 font-medium">Agent:</span>
                                                        {ownerAgents.map((ag) => (
                                                            <span
                                                                key={ag.agentId}
                                                                className="text-[10px] bg-blue-950/60 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1 font-mono"
                                                            >
                                                                <IconBot className="w-3 h-3 text-blue-400" />
                                                                <span>{ag.agentName || ag.agentId}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] text-zinc-500 italic pt-1">
                                                        Chưa nhận quản lý riêng Agent nào
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })()}

                                    {/* Các thành viên khác */}
                                    {room?.members?.map((m: any, idx: number) => {
                                        if (m.memberId === room?.ownerId) return null
                                        const memberAgents = (room?.userAgents || []).filter((b) => b.userId === m.memberId)
                                        return (
                                            <div
                                                key={idx}
                                                className="p-3.5 rounded-2xl bg-zinc-950/50 border border-zinc-800/80 hover:border-zinc-700 transition space-y-2"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-zinc-800 text-zinc-300 flex items-center justify-center font-bold text-xs">
                                                            {m.memberId?.charAt(0).toUpperCase() || 'U'}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-xs text-white flex items-center gap-2">
                                                                <span>{m.memberId}</span>
                                                                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono uppercase">
                                                                    {m.role || 'participant'}
                                                                </span>
                                                            </div>
                                                            <div className="text-[10px] text-zinc-500 mt-0.5">
                                                                Tham gia: {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : 'Vừa xong'}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-xl border ${memberAgents.length > 0
                                                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                                            }`}>
                                                            {memberAgents.length} Agent
                                                        </span>

                                                        <button
                                                            onClick={() => handleRemoveMember(m.memberId)}
                                                            className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition flex items-center gap-1 active:scale-95"
                                                            title="Mời rời khỏi phòng"
                                                        >
                                                            <IconX className="w-3.5 h-3.5" />
                                                            <span>Xóa</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                {memberAgents.length > 0 && (
                                                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-zinc-800/60">
                                                        <span className="text-[10px] text-zinc-500 font-medium">Agent:</span>
                                                        {memberAgents.map((ag) => (
                                                            <span
                                                                key={ag.agentId}
                                                                className="text-[10px] bg-zinc-900 text-zinc-300 border border-zinc-800 px-2 py-0.5 rounded-lg flex items-center gap-1 font-mono"
                                                            >
                                                                <IconBot className="w-3 h-3 text-zinc-400" />
                                                                <span>{ag.agentName || ag.agentId}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* TAB 2: QUẢN LÝ & PHÂN BỔ AGENT */}
                        {activeTab === 'agents' && (
                            <div className="flex-1 overflow-hidden min-h-[300px]">
                                <UserAgentAssignmentModal
                                    roomId={roomId}
                                    isOpen={true}
                                    onClose={handleCloseManagement}
                                    allAgents={allAgents}
                                    activeAgentIds={room?.activeAgents || []}
                                    userAgents={room?.userAgents || []}
                                    onlineUsers={onlineUsers}
                                    onUpdate={(updatedRoom) => setRoom(updatedRoom)}
                                    isEmbedded={true}
                                />
                            </div>
                        )}

                        {/* TAB 3: MỜI THÀNH VIÊN VÀO PHÒNG (Tích hợp danh sách online nhanh) */}
                        {activeTab === 'invite' && (
                            <div className="space-y-4 overflow-y-auto pr-1 flex-1 min-h-[300px]">
                                <div>
                                    <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                                        Tìm kiếm hoặc chọn nhanh người dùng online để mời:
                                    </label>
                                    <div className="relative">
                                        <input
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Lọc theo username / email..."
                                            className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-blue-500 transition shadow-inner"
                                            autoFocus
                                        />
                                        {loadingOnline && (
                                            <span className="absolute right-3.5 top-2.5 text-xs text-zinc-500 animate-pulse">
                                                Đang tải...
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-1.5 text-[11px] text-zinc-500">
                                        Danh sách các user đang trực tuyến trên hệ thống. Nhấn <strong>Mời</strong> để gửi lời mời vào phòng.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    {onlineUserList.map((u) => {
                                        const uid = String(u.id)
                                        const alreadyIn = isMember(uid)
                                        const isInviting = invitingId === uid

                                        return (
                                            <div
                                                key={uid}
                                                className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800 hover:border-zinc-700 transition"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-300 border border-blue-500/30 flex items-center justify-center font-bold text-xs uppercase">
                                                        {(u.username || '?').charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-xs text-white flex items-center gap-2">
                                                            <span>{u.username}</span>
                                                            <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded">
                                                                {u.status || 'online'}
                                                            </span>
                                                        </div>
                                                        <div className="text-[11px] text-zinc-400">{u.email}</div>
                                                    </div>
                                                </div>

                                                {alreadyIn ? (
                                                    <span className="text-[11px] text-emerald-400 font-medium px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                                        Đã trong phòng
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => handleSendInvite(u)}
                                                        disabled={isInviting}
                                                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs transition flex items-center gap-1.5 active:scale-95 shadow"
                                                    >
                                                        <IconPlus className="w-3.5 h-3.5" />
                                                        <span>{isInviting ? 'Đang gửi...' : 'Mời'}</span>
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}

                                    {!loadingOnline && onlineUserList.length === 0 && (
                                        <div className="text-center py-8 text-xs text-zinc-500">
                                            Không tìm thấy user nào đang online phù hợp.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal LangSmith Workflow Execution Trace */}
            {traceModalOpen && (
                <WorkflowTraceModal
                    trace={activeTrace || Object.values(latestTraces)[0] || null}
                    onClose={() => setTraceModalOpen(false)}
                    allTraces={latestTraces}
                    onSelectTrace={setActiveTrace}
                />
            )}
        </>
    )
}