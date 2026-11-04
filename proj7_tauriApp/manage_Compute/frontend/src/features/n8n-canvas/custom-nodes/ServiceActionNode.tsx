import { useState } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { Zap, ShieldCheck, TerminalSquare, LineChart, Radio, Cpu, Sparkles, Sliders, Globe } from 'lucide-react';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { useWorkbenchStore } from '../../../stores/useWorkbenchStore';
import { useTelemetryStore } from '../../../stores/useTelemetryStore';
import { httpClient } from '../../../services/httpClient';
import { findConnectedProcess } from '../utils/flowGraphUtils';
import { NodeExecutionHeader, getNodeCardBorderClass } from '../components/NodeExecutionHeader';

export function ServiceActionNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
    const deleteNode = useWorkflowStore((s) => s.deleteNode);
    const nodes = useWorkflowStore((s) => s.nodes);
    const edges = useWorkflowStore((s) => s.edges);
    const openTab = useWorkbenchStore((s) => s.openTab);
    const logs = useTelemetryStore((s) => s.logs);
    const processLookup = useTelemetryStore((s) => s.processLookup);
    const addLog = useTelemetryStore((s) => s.addLog);
    const activeExecutingNodeId = useWorkflowStore((s) => s.activeExecutingNodeId);
    const executionStatus = useWorkflowStore((s) => s.executionStatusMap[id]);

    const isExecuting = activeExecutingNodeId === id;

    // Tự động nhận diện tiến trình đầu vào từ đồ thị
    const connectedProc = findConnectedProcess(id, nodes, edges);
    const targetPid = connectedProc?.pid ?? (data.pid ? Number(data.pid) : null);
    const targetName = connectedProc?.name ?? data.name ?? 'Target Process';
    const liveProc = targetPid ? processLookup[targetPid] : null;

    const [actionType, setActionType] = useState<string>(data.action_type || 'trim_memory');
    const [command, setCommand] = useState<string>(data.command || 'python worker.py');
    const [priority, setPriority] = useState<string>(data.priority || 'idle');
    const [targetPort, setTargetPort] = useState<number>(Number(data.port || 8000));
    const [affinityCores, setAffinityCores] = useState<string>(data.cores_str || '0,1');
    const [isRunning, setIsRunning] = useState(false);

    data.action_type = actionType;
    if (targetPid) {
        data.pid = targetPid;
        data.name = targetName;
    }
    if (actionType === 'spawn_command') data.command = command;
    if (actionType === 'set_priority') data.priority = priority;
    if (actionType === 'release_port') data.port = targetPort;
    if (actionType === 'set_affinity') {
        data.cores = affinityCores.split(',').map((c) => Number(c.trim())).filter((c) => !isNaN(c));
    }

    const isCommand = actionType === 'spawn_command';
    const isLogStream = actionType === 'live_log_stream';
    const isDashboard = actionType === 'open_dashboard';
    const isTrim = actionType === 'trim_memory';
    const isPriority = actionType === 'set_priority';
    const isAffinity = actionType === 'set_affinity';
    const isReleasePort = actionType === 'release_port';

    // Lọc các log liên quan đến tiến trình đích nếu có PID
    const filteredLogs = logs
        .filter((l) => {
            if (!targetPid) return true;
            return l.message.includes(String(targetPid)) || l.message.toLowerCase().includes(targetName.toLowerCase());
        })
        .slice(-4);

    const handleOpenProcessChart = () => {
        const finalPid = targetPid || 0;
        const tabTitle = targetPid ? `${targetName} [PID ${targetPid}] Chart` : 'Process Live Chart';
        openTab({
            id: `tab-proc-chart-${finalPid || Date.now()}`,
            title: tabTitle,
            type: 'process-chart',
        });
    };

    // Test nhanh action trực tiếp từ thẻ
    const handleQuickExecute = async () => {
        setIsRunning(true);
        try {
            const payload = {
                action_type: actionType,
                pid: targetPid,
                priority,
                port: targetPort,
                cores: affinityCores.split(',').map((c) => Number(c.trim())).filter((c) => !isNaN(c)),
                command,
                proc_name: targetName,
            };
            const res = await httpClient.testAction(payload);
            if (res.result?.status === 'trimmed') {
                addLog('ACTION', `[SYSTEM OPTIMIZER] Successfully trimmed working set RAM for ${targetName} (PID ${targetPid})`);
            } else if (res.result?.status === 'priority_set') {
                addLog('ACTION', `[CPU OPTIMIZER] Changed CPU priority of ${targetName} to '${priority.toUpperCase()}'`);
            } else if (res.result?.status === 'released') {
                addLog('ACTION', `[PORT WATCHDOG] Released port ${targetPort} (Terminated PID ${res.result.terminated_pid})`);
            } else {
                addLog('ACTION', `[SERVICE ACTION] Executed: ${JSON.stringify(res.result || res)}`);
            }
        } catch (err: any) {
            addLog('ALERT', `[SERVICE ACTION] Action failed: ${err.message}`);
        } finally {
            setTimeout(() => setIsRunning(false), 500);
        }
    };

    return (
        <div className="relative h-full w-full min-w-[285px] min-h-[200px]">
            {/* Thanh co giãn kích thước Node Resizer */}
            <NodeResizer
                minWidth={275}
                minHeight={190}
                isVisible={selected}
                lineClassName="!border-amber-500 !border-dashed"
                handleClassName="!w-2.5 !h-2.5 !bg-zinc-950 !border-2 !border-amber-500 !rounded"
            />

            <div
                className={`h-full w-full rounded-xl bg-zinc-900 border-2 shadow-xl transition-all select-none flex flex-col justify-between overflow-hidden ${
                    getNodeCardBorderClass('END', isExecuting, executionStatus, !!connectedProc, 'border-zinc-700 hover:border-zinc-600')
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
                    tierBadge="ACTION"
                    title="Service Action"
                    subtitle={targetPid ? `PID ${targetPid}` : 'Process Remediation'}
                    icon={<Zap className="w-4 h-4 text-rose-400" />}
                    extraRight={
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> READY
                        </span>
                    }
                    onDelete={() => deleteNode(id)}
                />

                {/* Target Process Indicator */}
                <div className="px-3 py-1 bg-zinc-950/60 border-b border-zinc-800/60 flex items-center justify-between text-[10px] shrink-0">
                    <span className="text-zinc-500 flex items-center gap-1">
                        <Cpu className="w-3 h-3 text-amber-400" /> Đầu vào Target:
                    </span>
                    {connectedProc ? (
                        <span className="font-mono text-amber-300 font-semibold truncate max-w-[170px]">
                            {connectedProc.name} (PID: {connectedProc.pid || 'Auto'})
                        </span>
                    ) : (
                        <span className="text-zinc-500 italic">Kế thừa từ node kết nối</span>
                    )}
                </div>

                <div className="p-3 space-y-2 text-xs flex-1 flex flex-col justify-between">
                    {/* Action Type Dropdown */}
                    <div className="shrink-0">
                        <label className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
                            Hành động Can thiệp:
                        </label>
                        <select
                            value={actionType}
                            onChange={(e) => setActionType(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-zinc-200 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                        >
                            <optgroup label="Tối Ưu Hóa OS & Bộ Nhớ (System Optimizer)">
                                <option value="trim_memory">Thu Hồi RAM (Win32 EmptyWorkingSet)</option>
                                <option value="set_priority">Hạ/Đổi Độ Ưu Tiên CPU (Priority)</option>
                                <option value="set_affinity">Gán Core CPU (CPU Affinity)</option>
                                <option value="release_port">Giải Phóng Cổng Mạng (Release Port)</option>
                            </optgroup>
                            <optgroup label="Điều Khiển Tiến Trình (Process Controls)">
                                <option value="suspend_pid">Suspend Process (Tạm dừng an toàn)</option>
                                <option value="terminate_pid">Terminate Process (Dừng SIGTERM)</option>
                                <option value="kill_pid">Force Kill (Cưỡng chế SIGKILL)</option>
                                <option value="resume_pid">Resume Process (Kích hoạt lại)</option>
                            </optgroup>
                            <optgroup label="Giám Sát & Dashboard">
                                <option value="live_log_stream">Giám sát Socket Dạng Text</option>
                                <option value="open_dashboard">Mở Process Chart Dashboard</option>
                                <option value="spawn_command">Spawn Shell Command / Fallback</option>
                            </optgroup>
                        </select>
                    </div>

                    {/* Sub-view dựa trên actionType */}
                    <div className="flex-1 flex flex-col justify-center">
                        {isTrim ? (
                            <div className="bg-zinc-950/80 p-2 rounded border border-emerald-500/30 space-y-1">
                                <div className="text-[11px] font-medium text-emerald-300 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                                    EmptyWorkingSet Memory Trim
                                </div>
                                <div className="text-[10px] text-zinc-400">
                                    Giải phóng bộ nhớ Working Set của {targetName} lại cho Windows mà không tắt ứng dụng.
                                </div>
                            </div>
                        ) : isPriority ? (
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-semibold text-zinc-400 block flex items-center gap-1">
                                    <Sliders className="w-3 h-3 text-amber-400" /> Mức Độ Ưu Tiên CPU Mới:
                                </label>
                                <select
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                                >
                                    <option value="idle">IDLE (Mức thấp nhất - Không giật máy)</option>
                                    <option value="below_normal">BELOW NORMAL (Dưới bình thường)</option>
                                    <option value="normal">NORMAL (Bình thường)</option>
                                    <option value="above_normal">ABOVE NORMAL (Trên bình thường)</option>
                                    <option value="high">HIGH (Ưu tiên cao)</option>
                                </select>
                            </div>
                        ) : isAffinity ? (
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-semibold text-zinc-400 block flex items-center gap-1">
                                    <Cpu className="w-3 h-3 text-amber-400" /> Cores Được Phép Chạy (ví dụ: 0,1):
                                </label>
                                <input
                                    type="text"
                                    value={affinityCores}
                                    onChange={(e) => setAffinityCores(e.target.value)}
                                    placeholder="0,1"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 font-mono text-[11px] focus:outline-none focus:border-amber-500"
                                />
                            </div>
                        ) : isReleasePort ? (
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-semibold text-zinc-400 block flex items-center gap-1">
                                    <Globe className="w-3 h-3 text-amber-400" /> Cổng Mạng Cần Giải Phóng (Port):
                                </label>
                                <input
                                    type="number"
                                    value={targetPort}
                                    onChange={(e) => setTargetPort(Number(e.target.value))}
                                    placeholder="8000"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 font-mono text-[11px] focus:outline-none focus:border-amber-500"
                                />
                            </div>
                        ) : isCommand ? (
                            <div>
                                <label className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1 flex items-center gap-1">
                                    <TerminalSquare className="w-3 h-3 text-amber-400" /> Exec Command:
                                </label>
                                <input
                                    type="text"
                                    value={command}
                                    onChange={(e) => setCommand(e.target.value)}
                                    placeholder="e.g. python -m http.server 8092"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 font-mono text-[11px] focus:outline-none focus:border-amber-500"
                                />
                            </div>
                        ) : isLogStream ? (
                            <div className="bg-zinc-950 p-2 rounded border border-zinc-800/80 space-y-1">
                                <div className="flex items-center justify-between text-[10px] text-zinc-400 border-b border-zinc-800 pb-1">
                                    <span className="flex items-center gap-1 text-amber-400 font-mono">
                                        <Radio className="w-3 h-3 animate-pulse" /> Live Socket: {targetName}
                                    </span>
                                    <span className="text-[9px] text-zinc-500">
                                        {liveProc ? `${liveProc.memory_mb.toFixed(0)}MB | ${liveProc.cpu_percent}%` : 'WS :14200'}
                                    </span>
                                </div>
                                <div className="font-mono text-[10px] text-zinc-300 space-y-0.5 max-h-16 overflow-y-auto">
                                    {filteredLogs.length === 0 ? (
                                        <div className="text-zinc-600 italic">Đang lắng nghe gói telemetry cho {targetName}...</div>
                                    ) : (
                                        filteredLogs.map((l, i) => (
                                            <div key={i} className="truncate text-zinc-400">
                                                <span className="text-amber-500">[{l.type || l.level || 'INFO'}]</span> {l.message}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : isDashboard ? (
                            <div className="bg-zinc-950 p-2 rounded border border-zinc-800/80 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <div className="text-[11px] font-medium text-zinc-200">
                                        {targetName} Chart
                                    </div>
                                    <div className="text-[10px] text-zinc-500">
                                        Đầu vào: PID {targetPid || 'Chưa định danh'}
                                    </div>
                                </div>
                                <button
                                    onClick={handleOpenProcessChart}
                                    className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                    <LineChart className="w-3 h-3" /> Mở Chart Tab
                                </button>
                            </div>
                        ) : (
                            <div className="bg-zinc-950/80 p-2 rounded border border-zinc-800/80 text-[11px] text-zinc-400 flex items-center justify-between">
                                <span>Thực thi trên:</span>
                                <span className="font-mono text-amber-300 font-medium">
                                    {targetName} {targetPid ? `[PID ${targetPid}]` : ''}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Nút Test Thực Thi Trực Tiếp Action */}
                    <div className="pt-1.5 border-t border-zinc-800 flex items-center justify-between shrink-0">
                        <span className="text-[10px] text-zinc-500 font-mono">Action: Armed</span>
                        <button
                            onClick={handleQuickExecute}
                            disabled={isRunning}
                            className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                        >
                            <Zap className="w-3 h-3" /> {isRunning ? 'Running...' : 'Run Action'}
                        </button>
                    </div>
                </div>

                <Handle
                    type="source"
                    position={Position.Right}
                    className="!w-3 !h-3 !bg-amber-400 !border-2 !border-zinc-900"
                />
            </div>
        </div>
    );
}
