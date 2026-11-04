import { useState } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { Bot, Globe, FolderOpen, Play, Sliders, Activity, Cpu } from 'lucide-react';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { useTelemetryStore } from '../../../stores/useTelemetryStore';
import { httpClient } from '../../../services/httpClient';
import { findConnectedProcess } from '../utils/flowGraphUtils';
import { NodeExecutionHeader, getNodeCardBorderClass } from '../components/NodeExecutionHeader';

export function AutomationNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
    const deleteNode = useWorkflowStore((s) => s.deleteNode);
    const nodes = useWorkflowStore((s) => s.nodes);
    const edges = useWorkflowStore((s) => s.edges);
    const activeExecutingNodeId = useWorkflowStore((s) => s.activeExecutingNodeId);
    const executionStatus = useWorkflowStore((s) => s.executionStatusMap[id]);
    const addLog = useTelemetryStore((s) => s.addLog);

    const isExecuting = activeExecutingNodeId === id;

    // Tìm kiếm thông tin tiến trình đầu vào từ đồ thị
    const connectedProc = findConnectedProcess(id, nodes, edges);
    const targetName = connectedProc?.name || 'Process';
    const targetPid = connectedProc?.pid;

    const defaultSearchQuery = `How to fix high RAM CPU usage ${targetName} Windows`;

    const [actionType, setActionType] = useState<string>(data.action_type || 'search_google');
    const [searchQuery, setSearchQuery] = useState<string>(
        data.search_query || defaultSearchQuery
    );
    const [folderPath, setFolderPath] = useState<string>(data.folder_path || 'C:\\');
    const [isRunning, setIsRunning] = useState(false);

    data.action_type = actionType;
    data.search_query = searchQuery;
    data.folder_path = folderPath;
    if (targetPid) data.pid = targetPid;

    const handleTestRun = async () => {
        setIsRunning(true);
        try {
            const payload = {
                action_type: actionType,
                search_query: searchQuery,
                folder_path: folderPath,
                command: data.command || 'Stop-Process -Name chrome',
                pid: targetPid,
                proc_name: targetName,
            };

            const res = await httpClient.testAction(payload);

            if (res.result?.status === 'executed') {
                if (actionType === 'search_google') {
                    addLog('ACTION', `[PC AUTOMATION] Đã mở Chrome tìm kiếm giải pháp: "${payload.search_query}"`);
                } else if (actionType === 'open_folder') {
                    addLog('ACTION', `[PC AUTOMATION] Đã mở Windows Explorer tại: "${payload.folder_path}"`);
                } else if (actionType === 'open_taskmgr') {
                    addLog('ACTION', `[PC AUTOMATION] Đã khởi chạy Task Manager thành công`);
                } else {
                    addLog('ACTION', `[PC AUTOMATION] Đã thực thi hành động: ${JSON.stringify(res.result)}`);
                }
            } else if (res.result?.status === 'cooldown') {
                addLog('ALERT', `[PC AUTOMATION] ${res.result.reason}`);
            } else {
                addLog('ACTION', `[PC AUTOMATION] Thực thi kết quả: ${JSON.stringify(res.result || res)}`);
            }
        } catch (err: any) {
            addLog('ALERT', `[PC AUTOMATION] Lỗi khi thực thi test action: ${err.message}`);
        } finally {
            setTimeout(() => setIsRunning(false), 500);
        }
    };

    return (
        <div className="relative h-full w-full min-w-[290px] min-h-[200px]">
            {/* Thanh co giãn kích thước Node Resizer */}
            <NodeResizer
                minWidth={280}
                minHeight={190}
                isVisible={selected}
                lineClassName="!border-purple-500 !border-dashed"
                handleClassName="!w-2.5 !h-2.5 !bg-zinc-950 !border-2 !border-purple-500 !rounded"
            />

            <div
                className={`h-full w-full rounded-xl bg-zinc-900 border-2 transition-all select-none flex flex-col justify-between overflow-hidden shadow-xl ${
                    getNodeCardBorderClass('END', isExecuting, executionStatus, !!connectedProc, 'border-purple-500/40 shadow-purple-950/20 hover:border-purple-500')
                }`}
            >
                <Handle
                    type="target"
                    position={Position.Left}
                    className="!w-3 !h-3 !bg-rose-400 !border-2 !border-zinc-900"
                />

                {/* Header tích hợp Live Tracer Progress & Tier END Badge */}
                <NodeExecutionHeader
                    id={id}
                    tier="END"
                    tierBadge="PC AUTO"
                    title="PC Automation Card"
                    subtitle="Windows Desktop Helper"
                    icon={<Bot className="w-4 h-4 text-purple-400" />}
                    extraRight={
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            WINDOWS
                        </span>
                    }
                    onDelete={() => deleteNode(id)}
                />

                {/* Target Process Indicator */}
                <div className="px-3 py-1 bg-zinc-950/60 border-b border-zinc-800/60 flex items-center justify-between text-[10px] shrink-0">
                    <span className="text-zinc-500 flex items-center gap-1">
                        <Cpu className="w-3 h-3 text-purple-400" /> Đầu vào Target:
                    </span>
                    {connectedProc ? (
                        <span className="font-mono text-purple-300 font-semibold truncate max-w-[170px]">
                            {connectedProc.name} {connectedProc.pid ? `(PID: ${connectedProc.pid})` : ''}
                        </span>
                    ) : (
                        <span className="text-zinc-500 italic">Kế thừa từ node kết nối</span>
                    )}
                </div>

                {/* Body */}
                <div className="p-3 space-y-2.5 text-xs flex-1 flex flex-col justify-between">
                    <div>
                        <label className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
                            Chọn Hành Động Tự Động Hóa:
                        </label>
                        <select
                            value={actionType}
                            onChange={(e) => setActionType(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-purple-500 cursor-pointer"
                        >
                            <option value="search_google">Mở Chrome & Tìm kiếm nguyên nhân lỗi</option>
                            <option value="open_folder">Mở Thư mục Windows Explorer</option>
                            <option value="open_taskmgr">Mở Windows Task Manager</option>
                            <option value="spawn_command">Thực thi lệnh PowerShell / Batch</option>
                        </select>
                    </div>

                    {/* Subview cấu hình tương ứng */}
                    <div className="flex-1 flex flex-col justify-center">
                        {actionType === 'search_google' ? (
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-semibold text-zinc-400 block flex items-center gap-1">
                                    <Globe className="w-3 h-3 text-purple-400" /> Từ Khóa Tìm Kiếm (Google):
                                </label>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="e.g. How to fix high CPU usage Windows process"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-zinc-200 font-mono text-[11px] focus:outline-none focus:border-purple-500"
                                />
                                <p className="text-[10px] text-zinc-500 italic">
                                    Tự động bật trình duyệt tìm giải pháp cho {targetName}.
                                </p>
                            </div>
                        ) : actionType === 'open_folder' ? (
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-semibold text-zinc-400 block flex items-center gap-1">
                                    <FolderOpen className="w-3 h-3 text-purple-400" /> Đường dẫn Thư mục (Path):
                                </label>
                                <input
                                    type="text"
                                    value={folderPath}
                                    onChange={(e) => setFolderPath(e.target.value)}
                                    placeholder="e.g. C:\Users\... or C:\Logs"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-zinc-200 font-mono text-[11px] focus:outline-none focus:border-purple-500"
                                />
                                <p className="text-[10px] text-zinc-500 italic">
                                    Tự động mở cửa sổ Explorer tại đường dẫn trên.
                                </p>
                            </div>
                        ) : actionType === 'open_taskmgr' ? (
                            <div className="bg-zinc-950 p-2 rounded border border-zinc-800/80 text-[11px] text-zinc-400 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-purple-400" />
                                <span>Tự động kích hoạt công cụ Task Manager của Windows.</span>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-semibold text-zinc-400 block flex items-center gap-1">
                                    <Sliders className="w-3 h-3 text-purple-400" /> Lệnh PowerShell:
                                </label>
                                <input
                                    type="text"
                                    value={data.command || 'echo "AutoGuard Triggered"'}
                                    onChange={(e) => (data.command = e.target.value)}
                                    placeholder="e.g. Stop-Process -Name chrome"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-zinc-200 font-mono text-[11px] focus:outline-none focus:border-purple-500"
                                />
                            </div>
                        )}
                    </div>

                    {/* Nút Test Action Ngay */}
                    <div className="pt-2 border-t border-zinc-800 flex items-center justify-between shrink-0">
                        <span className="text-[10px] text-zinc-500 font-mono">Status: Ready</span>
                        <button
                            onClick={handleTestRun}
                            disabled={isRunning}
                            className="px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
                        >
                            <Play className="w-3 h-3" /> {isRunning ? 'Executing...' : 'Test Action'}
                        </button>
                    </div>
                </div>

                <Handle
                    type="source"
                    position={Position.Right}
                    className="!w-3 !h-3 !bg-purple-400 !border-2 !border-zinc-900"
                />
            </div>
        </div>
    );
}
