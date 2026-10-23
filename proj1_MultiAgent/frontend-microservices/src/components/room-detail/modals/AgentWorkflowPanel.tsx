'use client'

import { useState, useEffect } from 'react'
import { Room, Agent, AgentWorkflow, AgentWorkflowMode, WorkflowTransition, roomsApi } from '@/lib/api'
import {
    IconBot,
    IconPlus,
    IconTrash,
    IconSave,
    IconArrowRight,
    IconArrowDown,
    IconWorkflow,
    IconListOrdered,
    IconGitBranch,
    IconSliders,
    IconCheck,
    IconAlertCircle,
} from '@/components/ui/icons'

interface AgentWorkflowPanelProps {
    roomId: string
    room: Room | null
    allAgents: Agent[]
    setRoom: (room: Room) => void
}

export function AgentWorkflowPanel({
    roomId,
    room,
    allAgents,
    setRoom,
}: AgentWorkflowPanelProps) {
    // Lấy cấu hình workflow hiện tại của phòng (hoặc giá trị mặc định)
    const currentWf = room?.workflow || {
        mode: 'autonomous',
        order: [],
        transitions: [],
        enabled: true,
        description: '',
    }

    const [mode, setMode] = useState<AgentWorkflowMode>(currentWf.mode || 'autonomous')
    const [enabled, setEnabled] = useState<boolean>(currentWf.enabled ?? true)
    const [description, setDescription] = useState<string>(currentWf.description || '')
    const [order, setOrder] = useState<string[]>(currentWf.order || [])
    const [transitions, setTransitions] = useState<WorkflowTransition[]>(currentWf.transitions || [])
    const [saving, setSaving] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    // Cập nhật state nếu room thay đổi từ bên ngoài
    useEffect(() => {
        if (room?.workflow) {
            setMode(room.workflow.mode || 'autonomous')
            setEnabled(room.workflow.enabled ?? true)
            setDescription(room.workflow.description || '')
            setOrder(room.workflow.order || [])
            setTransitions(room.workflow.transitions || [])
        }
    }, [room?.workflow])

    // Lọc danh sách các agent đang có mặt trong phòng
    const activeAgentIds = room?.activeAgents || []
    const roomAgents = activeAgentIds
        .map((id) => allAgents.find((a) => a.id === id) || { id, name: id })
        .filter(Boolean)

    const getAgentName = (agentId: string) => {
        if (agentId === 'end') return 'Kết thúc chuỗi'
        const found = allAgents.find((a) => a.id === agentId)
        return found ? found.name : agentId
    }

    // Xử lý thứ tự Sequential
    const handleAddSequentialStep = (agentId: string) => {
        if (!agentId) return
        setOrder((prev) => [...prev, agentId])
    }

    const handleRemoveSequentialStep = (index: number) => {
        setOrder((prev) => prev.filter((_, i) => i !== index))
    }

    const handleMoveStep = (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1
        if (targetIndex < 0 || targetIndex >= order.length) return
        const newOrder = [...order]
        const temp = newOrder[index]
        newOrder[index] = newOrder[targetIndex]
        newOrder[targetIndex] = temp
        setOrder(newOrder)
    }

    // Xử lý quy tắc Routing
    const handleAddTransition = () => {
        const defaultFrom = roomAgents[0]?.id || ''
        const defaultTo = roomAgents[1]?.id || 'end'
        if (!defaultFrom) {
            alert('Cần ít nhất 1 Agent trong phòng để thiết lập quy tắc chuyển tiếp')
            return
        }
        setTransitions((prev) => [
            ...prev,
            { fromAgentId: defaultFrom, toAgentId: defaultTo, condition: '' },
        ])
    }

    const handleUpdateTransition = (
        index: number,
        field: keyof WorkflowTransition,
        value: string
    ) => {
        setTransitions((prev) => {
            const next = [...prev]
            next[index] = { ...next[index], [field]: value }
            return next
        })
    }

    const handleRemoveTransition = (index: number) => {
        setTransitions((prev) => prev.filter((_, i) => i !== index))
    }

    // Lưu workflow lên backend
    const handleSave = async () => {
        setSaving(true)
        setErrorMsg(null)
        setSaveSuccess(false)
        try {
            const payload: AgentWorkflow = {
                mode,
                enabled,
                description: description.trim(),
                order: mode === 'sequential' ? order : [],
                transitions: mode === 'routing' ? transitions : [],
            }

            const updatedRoom = await roomsApi.updateWorkflow(roomId, payload)
            setRoom(updatedRoom)
            setSaveSuccess(true)
            setTimeout(() => setSaveSuccess(false), 3000)
        } catch (err: any) {
            setErrorMsg(err.message || 'Lỗi khi cập nhật cấu hình quy trình')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-4 overflow-y-auto pr-1 flex-1 min-h-[350px]">
            {/* Header giải thích & Switch Kích hoạt */}
            <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                        <IconWorkflow className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-white flex items-center gap-2">
                            <span>Điều Phối Luồng Agent</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                                {mode}
                            </span>
                        </div>
                        <p className="text-[11px] text-zinc-400">
                            Cấu hình cách thức các Agent trong phòng hợp tác, chuyển tiếp hoặc thực thi độc lập
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <label className="text-[11px] font-medium text-zinc-400 cursor-pointer">
                        {enabled ? 'Kích hoạt' : 'Vô hiệu hóa'}
                    </label>
                    <button
                        type="button"
                        onClick={() => setEnabled(!enabled)}
                        className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                            enabled ? 'bg-purple-600' : 'bg-zinc-800'
                        }`}
                    >
                        <span
                            className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                        />
                    </button>
                </div>
            </div>

            {/* Chọn Chế Độ Thực Thi (Workflow Mode) */}
            <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                    <IconSliders className="w-3.5 h-3.5 text-purple-400" />
                    <span>Lựa chọn mô hình vận hành</span>
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* Solo */}
                    <button
                        type="button"
                        onClick={() => setMode('solo')}
                        className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-2 ${
                            mode === 'solo'
                                ? 'bg-purple-950/40 border-purple-500 text-white shadow-lg shadow-purple-500/10'
                                : 'bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold flex items-center gap-1.5 text-purple-400">
                                <IconBot className="w-3.5 h-3.5" />
                                Solo
                            </span>
                            {mode === 'solo' && <IconCheck className="w-3.5 h-3.5 text-purple-400" />}
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-tight">
                            Chạy đơn lẻ. Agent trả lời xong kết thúc, không bàn giao tiếp.
                        </p>
                    </button>

                    {/* Sequential */}
                    <button
                        type="button"
                        onClick={() => setMode('sequential')}
                        className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-2 ${
                            mode === 'sequential'
                                ? 'bg-blue-950/40 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                                : 'bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold flex items-center gap-1.5 text-blue-400">
                                <IconListOrdered className="w-3.5 h-3.5" />
                                Tuần Tự
                            </span>
                            {mode === 'sequential' && <IconCheck className="w-3.5 h-3.5 text-blue-400" />}
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-tight">
                            Pipeline theo thứ tự bước: Agent 1 ➔ Agent 2 ➔ Agent 3.
                        </p>
                    </button>

                    {/* Routing */}
                    <button
                        type="button"
                        onClick={() => setMode('routing')}
                        className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-2 ${
                            mode === 'routing'
                                ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                                : 'bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold flex items-center gap-1.5 text-emerald-400">
                                <IconGitBranch className="w-3.5 h-3.5" />
                                Định Tuyến
                            </span>
                            {mode === 'routing' && <IconCheck className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-tight">
                            Quy tắc rẽ nhánh: Agent nguồn chuyển sang Agent đích.
                        </p>
                    </button>

                    {/* Autonomous */}
                    <button
                        type="button"
                        onClick={() => setMode('autonomous')}
                        className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-2 ${
                            mode === 'autonomous'
                                ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                                : 'bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold flex items-center gap-1.5 text-cyan-400">
                                <IconWorkflow className="w-3.5 h-3.5" />
                                Tự Do
                            </span>
                            {mode === 'autonomous' && <IconCheck className="w-3.5 h-3.5 text-cyan-400" />}
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-tight">
                            Agent tự phân tích và bàn giao linh hoạt qua @mention.
                        </p>
                    </button>
                </div>
            </div>

            {/* Mô tả / Ghi chú mục tiêu của workflow */}
            <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">
                    Mô tả mục tiêu quy trình (Tùy chọn)
                </label>
                <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ví dụ: Tìm kiếm dữ liệu thị trường sau đó chuyển cho chuyên viên tóm tắt báo cáo..."
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-purple-500 transition"
                />
            </div>

            {/* NỘI DUNG CHI TIẾT THEO TỪNG CHẾ ĐỘ */}

            {/* 1. CHẾ ĐỘ SEQUENTIAL (PIPELINE) */}
            {mode === 'sequential' && (
                <div className="space-y-3 p-4 rounded-2xl bg-zinc-950/80 border border-blue-500/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                <IconListOrdered className="w-4 h-4 text-blue-400" />
                                <span>Thứ tự các bước xử lý (Pipeline)</span>
                            </div>
                            <p className="text-[11px] text-zinc-400">
                                Khi người dùng gửi câu hỏi, hệ thống sẽ chạy lần lượt từ Bước 1 đến bước cuối cùng.
                            </p>
                        </div>

                        {/* Dropdown thêm Agent vào chuỗi */}
                        <div className="flex items-center gap-2">
                            <select
                                onChange={(e) => {
                                    if (e.target.value) {
                                        handleAddSequentialStep(e.target.value)
                                        e.target.value = ''
                                    }
                                }}
                                defaultValue=""
                                className="bg-zinc-900 border border-zinc-700 text-xs text-white px-2.5 py-1.5 rounded-xl outline-none focus:border-blue-500"
                            >
                                <option value="" disabled>
                                    + Thêm bước...
                                </option>
                                {roomAgents.map((ag) => (
                                    <option key={ag.id} value={ag.id}>
                                        {ag.name || ag.id}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {order.length === 0 ? (
                        <div className="text-center py-6 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                            Chưa có bước nào trong pipeline. Hãy chọn Agent từ danh sách trên để thêm bước.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {order.map((agentId, idx) => (
                                <div
                                    key={`${agentId}-${idx}`}
                                    className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs font-mono">
                                            {idx + 1}
                                        </span>
                                        <div>
                                            <div className="text-xs font-semibold text-white flex items-center gap-2">
                                                <span>{getAgentName(agentId)}</span>
                                                <span className="text-[10px] text-zinc-400 font-mono">
                                                    ({agentId})
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            disabled={idx === 0}
                                            onClick={() => handleMoveStep(idx, 'up')}
                                            className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-30 transition"
                                            title="Lên trên"
                                        >
                                            <IconArrowDown className="w-3.5 h-3.5 rotate-180" />
                                        </button>
                                        <button
                                            type="button"
                                            disabled={idx === order.length - 1}
                                            onClick={() => handleMoveStep(idx, 'down')}
                                            className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-30 transition"
                                            title="Xuống dưới"
                                        >
                                            <IconArrowDown className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveSequentialStep(idx)}
                                            className="p-1 rounded text-zinc-400 hover:text-rose-400 transition ml-1"
                                            title="Xóa bước này"
                                        >
                                            <IconTrash className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 2. CHẾ ĐỘ ROUTING (QUY TẮC RẼ NHÁNH) */}
            {mode === 'routing' && (
                <div className="space-y-3 p-4 rounded-2xl bg-zinc-950/80 border border-emerald-500/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                <IconGitBranch className="w-4 h-4 text-emerald-400" />
                                <span>Bảng định tuyến chuyển tiếp (Routing Rules)</span>
                            </div>
                            <p className="text-[11px] text-zinc-400">
                                Khi Agent nguồn hoàn tất câu trả lời, công việc sẽ tự động chuyển sang Agent đích.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleAddTransition}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-1 transition"
                        >
                            <IconPlus className="w-3.5 h-3.5" />
                            <span>Thêm quy tắc</span>
                        </button>
                    </div>

                    {transitions.length === 0 ? (
                        <div className="text-center py-6 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                            Chưa có quy tắc chuyển tiếp nào. Nhấn <strong>Thêm quy tắc</strong> để tạo luồng.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {transitions.map((trans, idx) => (
                                <div
                                    key={idx}
                                    className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2"
                                >
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="flex-1 min-w-[140px]">
                                            <label className="text-[10px] text-zinc-400 block mb-1">
                                                Từ Agent:
                                            </label>
                                            <select
                                                value={trans.fromAgentId}
                                                onChange={(e) =>
                                                    handleUpdateTransition(idx, 'fromAgentId', e.target.value)
                                                }
                                                className="w-full bg-zinc-950 border border-zinc-700 text-xs text-white px-2.5 py-1.5 rounded-xl outline-none focus:border-emerald-500"
                                            >
                                                {roomAgents.map((ag) => (
                                                    <option key={ag.id} value={ag.id}>
                                                        {ag.name || ag.id}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="pt-4 text-zinc-500 shrink-0">
                                            <IconArrowRight className="w-4 h-4 text-emerald-400" />
                                        </div>

                                        <div className="flex-1 min-w-[140px]">
                                            <label className="text-[10px] text-zinc-400 block mb-1">
                                                Chuyển sang:
                                            </label>
                                            <select
                                                value={trans.toAgentId}
                                                onChange={(e) =>
                                                    handleUpdateTransition(idx, 'toAgentId', e.target.value)
                                                }
                                                className="w-full bg-zinc-950 border border-zinc-700 text-xs text-white px-2.5 py-1.5 rounded-xl outline-none focus:border-emerald-500"
                                            >
                                                <option value="end">Kết thúc chuỗi (End)</option>
                                                {roomAgents.map((ag) => (
                                                    <option key={ag.id} value={ag.id}>
                                                        {ag.name || ag.id}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleRemoveTransition(idx)}
                                            className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition self-end"
                                            title="Xóa quy tắc này"
                                        >
                                            <IconTrash className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    <div>
                                        <input
                                            type="text"
                                            value={trans.condition || ''}
                                            onChange={(e) =>
                                                handleUpdateTransition(idx, 'condition', e.target.value)
                                            }
                                            placeholder="Ghi chú điều kiện / Nhiệm vụ bàn giao (Tùy chọn)..."
                                            className="w-full bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 px-3 py-1.5 rounded-lg outline-none focus:border-emerald-500 transition"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 3. CHẾ ĐỘ SOLO */}
            {mode === 'solo' && (
                <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-purple-500/30 text-xs text-zinc-300 space-y-1">
                    <div className="font-semibold text-white flex items-center gap-1.5">
                        <IconBot className="w-3.5 h-3.5 text-purple-400" />
                        <span>Chế độ chạy Đơn lẻ (Solo Agent)</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Mỗi Agent khi được nhắc đến (@Agent) hoặc xử lý câu hỏi sẽ hoạt động độc lập. Sau khi trả lời xong câu hỏi, hệ thống sẽ kết thúc phiên và không kích hoạt bất kỳ hành động bàn giao công việc nào cho các Agent khác trong phòng.
                    </p>
                </div>
            )}

            {/* 4. CHẾ ĐỘ AUTONOMOUS */}
            {mode === 'autonomous' && (
                <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-cyan-500/30 text-xs text-zinc-300 space-y-1">
                    <div className="font-semibold text-white flex items-center gap-1.5">
                        <IconWorkflow className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Chế độ Tự do phối hợp (Autonomous Multi-Agent)</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Các Agent trong phòng tự động phát hiện người dùng nhắc đến ai (@mention) hoặc tự nguyện đề xuất bàn giao nhiệm vụ chuyên sâu cho đồng nghiệp phù hợp nhất (dựa trên năng lực Tool và Prompt của từng Agent).
                    </p>
                </div>
            )}

            {/* Thông báo lỗi nếu có */}
            {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
                    <IconAlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{errorMsg}</span>
                </div>
            )}

            {/* Nút Lưu Cấu Hình */}
            <div className="pt-2 flex items-center justify-between border-t border-zinc-800">
                <div className="text-[11px] text-zinc-500">
                    {saveSuccess && (
                        <span className="text-emerald-400 flex items-center gap-1">
                            <IconCheck className="w-3.5 h-3.5" />
                            Đã lưu cấu hình quy trình thành công!
                        </span>
                    )}
                </div>

                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium text-xs transition flex items-center gap-1.5 shadow-lg shadow-purple-600/20 active:scale-95"
                >
                    <IconSave className="w-3.5 h-3.5" />
                    <span>{saving ? 'Đang lưu...' : 'Lưu Quy Trình'}</span>
                </button>
            </div>
        </div>
    )
}
