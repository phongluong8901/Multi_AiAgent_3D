import { useState } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { Gauge, Sliders, ShieldAlert, Eye, BellRing, Cpu, Server, HardDrive, Zap } from 'lucide-react';
import { useTelemetryStore } from '../../../stores/useTelemetryStore';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { httpClient } from '../../../services/httpClient';
import { findConnectedProcess } from '../utils/flowGraphUtils';
import { NodeExecutionHeader, getNodeCardBorderClass } from '../components/NodeExecutionHeader';

export function MetricTriggerNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
    const snapshot = useTelemetryStore((s) => s.snapshot);
    const processLookup = useTelemetryStore((s) => s.processLookup);
    const addLog = useTelemetryStore((s) => s.addLog);
    const deleteNode = useWorkflowStore((s) => s.deleteNode);
    const nodes = useWorkflowStore((s) => s.nodes);
    const edges = useWorkflowStore((s) => s.edges);
    const activeExecutingNodeId = useWorkflowStore((s) => s.activeExecutingNodeId);
    const executionStatus = useWorkflowStore((s) => s.executionStatusMap[id]);
    const isExecutingThis = activeExecutingNodeId === id;

    // Tìm kiếm thông tin tiến trình đang nối vào node này
    const connectedProc = findConnectedProcess(id, nodes, edges);
    const liveProc = connectedProc?.pid ? processLookup[connectedProc.pid] : null;

    // Chế độ đo lường: 'system' (% Hệ thống) hoặc 'process' (Giá trị riêng của tiến trình)
    const [targetScope, setTargetScope] = useState<'system' | 'process'>(
        data.targetScope || (data.metric?.startsWith('process_') ? 'process' : 'system')
    );

    const [metric, setMetric] = useState<string>(
        data.metric || (targetScope === 'process' ? 'process_memory_mb' : 'cpu_percent')
    );
    const [threshold, setThreshold] = useState<number>(
        Number(data.threshold || (metric === 'process_memory_mb' ? 500 : 80))
    );
    const [operator, setOperator] = useState<string>(data.operator || '>');
    const [displayMode, setDisplayMode] = useState<'realtime' | 'alert_only'>(data.displayMode || 'realtime');
    const [isSimulating, setIsSimulating] = useState(false);

    // Đồng bộ lại data prop để dag_runner nhận đúng
    data.targetScope = targetScope;
    data.metric = metric;
    data.threshold = threshold;
    data.operator = operator;
    data.displayMode = displayMode;
    if (connectedProc) {
        data.target_pid = connectedProc.pid;
        data.target_name = connectedProc.name;
    }

    // Xử lý chuyển đổi giữa Scope Hệ thống và Tiến trình
    const handleScopeChange = (scope: 'system' | 'process') => {
        setTargetScope(scope);
        if (scope === 'process') {
            const nextMetric = 'process_memory_mb';
            setMetric(nextMetric);
            setThreshold(500); // 500 MB mặc định
        } else {
            const nextMetric = 'cpu_percent';
            setMetric(nextMetric);
            setThreshold(80); // 80% mặc định
        }
    };

    // Test Giả lập vượt ngưỡng để kích hoạt trọn vẹn chuỗi Action & PC Automation
    const handleSimulateBreach = async () => {
        setIsSimulating(true);
        try {
            const graphPayload = {
                workflow_id: `sim-breach-${Date.now()}`,
                name: 'Simulated Breach Test',
                nodes: nodes.map((n) => ({ id: n.id, type: n.type || 'unknown', data: n.data })),
                edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
                interval_sec: 1.0,
                force_breach: true,
            };
            const res = await httpClient.runWorkflowOnce(graphPayload);
            const count = res.triggered_events?.length || 0;
            addLog(
                'ACTION',
                `[AUTOGUARD] [SIMULATE BREACH] Fired test breach on ${metric}: ${count} downstream action(s) executed!`
            );
        } catch (err: any) {
            addLog('ALERT', `[AUTOGUARD] Simulate breach failed: ${err.message}`);
        } finally {
            setTimeout(() => setIsSimulating(false), 500);
        }
    };

    let currentVal = 0;
    let unit = '%';
    let maxScale = 100;

    if (targetScope === 'process') {
        if (metric === 'process_memory_mb') {
            currentVal = Math.round(liveProc?.memory_mb ?? connectedProc?.memory_mb ?? 0);
            unit = 'MB';
            maxScale = Math.max(threshold * 1.5, 2048);
        } else if (metric === 'memory_leak_slope') {
            currentVal = Math.round(liveProc?.memory_mb ?? connectedProc?.memory_mb ?? 0);
            unit = 'MB/slope';
            maxScale = 100;
        } else {
            // process_cpu_percent
            currentVal = Number((liveProc?.cpu_percent ?? connectedProc?.cpu_percent ?? 0).toFixed(1));
            unit = '%';
            maxScale = 100;
        }
    } else {
        // System metrics
        if (metric === 'ram_percent') {
            currentVal = snapshot?.ram?.percent ?? 0;
            unit = '%';
        } else if (metric === 'gpu_temp') {
            currentVal = snapshot?.gpus?.[0]?.temp_c ?? 0;
            unit = '°C';
            maxScale = 110;
        } else if (metric === 'gpu_vram_percent') {
            currentVal = snapshot?.gpus?.[0]?.memory_percent ?? 0;
            unit = '%';
        } else if (metric === 'port_collision') {
            currentVal = threshold;
            unit = 'Port';
            maxScale = 65535;
        } else {
            currentVal = snapshot?.cpu?.percent ?? 0;
            unit = '%';
        }
    }

    let isTriggered = false;
    if (operator === '>') isTriggered = currentVal > threshold;
    else if (operator === '>=') isTriggered = currentVal >= threshold;
    else if (operator === '<') isTriggered = currentVal < threshold;
    else if (operator === '<=') isTriggered = currentVal <= threshold;
    else if (operator === '==') isTriggered = Math.abs(currentVal - threshold) < 0.1;

    const progressPercent = Math.min(100, Math.max(0, (currentVal / maxScale) * 100));
    const isCollapsed = displayMode === 'alert_only' && !isTriggered;

    return (
        <div className="relative h-full w-full min-w-[285px] min-h-[235px]">
            {/* Thanh co giãn kích thước Node Resizer */}
            <NodeResizer
                minWidth={275}
                minHeight={225}
                isVisible={selected}
                lineClassName="!border-emerald-500 !border-dashed"
                handleClassName="!w-2.5 !h-2.5 !bg-zinc-950 !border-2 !border-emerald-500 !rounded"
            />

            <div
                className={`h-full w-full rounded-xl bg-zinc-900 border-2 shadow-xl transition-all duration-200 select-none flex flex-col justify-between overflow-hidden ${
                    getNodeCardBorderClass('START', isExecutingThis, executionStatus, !!connectedProc, isTriggered ? 'border-rose-500 ring-1 ring-rose-500/40 shadow-rose-500/20' : 'border-zinc-700 hover:border-zinc-600')
                }`}
            >
                {/* Input Handle (Left) */}
                <Handle
                    type="target"
                    position={Position.Left}
                    className="!w-3 !h-3 !bg-cyan-400 !border-2 !border-zinc-900"
                />

                {/* Header tích hợp Live Tracer Progress & Tier START Badge */}
                <NodeExecutionHeader
                    id={id}
                    tier="START"
                    tierBadge="TRIGGER"
                    title="Metric Alert Guard"
                    subtitle={connectedProc ? `Proc: ${connectedProc.name}` : 'System Scope'}
                    icon={
                        isTriggered ? (
                            <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
                        ) : (
                            <Gauge className="w-4 h-4 text-cyan-400" />
                        )
                    }
                    extraRight={
                        <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                                isTriggered
                                    ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40 animate-pulse'
                                    : 'bg-zinc-800 text-zinc-400'
                            }`}
                        >
                            {isTriggered ? 'BREACHED' : 'ARMED'}
                        </span>
                    }
                    onDelete={() => deleteNode(id)}
                />

                {/* Scope Selector: % Hệ Thống vs Giá Trị Tiến Trình */}
                <div className="px-3 pt-2 pb-1 border-b border-zinc-800/80 bg-zinc-950/40 shrink-0">
                    <div className="grid grid-cols-2 gap-1 bg-zinc-950 p-0.5 rounded border border-zinc-800 text-[10px]">
                        <button
                            onClick={() => handleScopeChange('system')}
                            className={`py-1 px-1.5 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                                targetScope === 'system'
                                    ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                                    : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            <Server className="w-3 h-3" /> % Hệ Thống
                        </button>
                        <button
                            onClick={() => handleScopeChange('process')}
                            className={`py-1 px-1.5 rounded flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                                targetScope === 'process'
                                    ? 'bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30'
                                    : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            <Cpu className="w-3 h-3" /> Process Tự Đặt
                        </button>
                    </div>

                    {/* Hiển thị Target Process Context nếu có nối dây */}
                    <div className="mt-1 flex items-center justify-between text-[10px]">
                        <span className="text-zinc-500">Đầu vào:</span>
                        {connectedProc ? (
                            <span className="font-mono text-emerald-400 font-medium truncate max-w-[170px]">
                                {connectedProc.name} [PID {connectedProc.pid || 'Auto'}]
                            </span>
                        ) : (
                            <span className="text-zinc-600 italic">Chưa nối ProcessNode</span>
                        )}
                    </div>
                </div>

                {/* Body & Threshold Controls */}
                {isCollapsed ? (
                    <div className="p-3 text-center space-y-1 flex-1 flex flex-col justify-center">
                        <div className="text-xs text-zinc-400 font-mono">
                            Safe ({currentVal} {unit} / Threshold {threshold} {unit})
                        </div>
                        <div className="text-[10px] text-zinc-600">
                            Chế độ Alert Only: Tự động bung ra khi vượt ngưỡng cảnh báo
                        </div>
                    </div>
                ) : (
                    <div className="p-3 space-y-2 text-xs flex-1 flex flex-col justify-between">
                        {/* Metric Selector & Operator */}
                        <div className="grid grid-cols-5 gap-1.5 shrink-0">
                            <select
                                value={metric}
                                onChange={(e) => {
                                    const nextM = e.target.value;
                                    setMetric(nextM);
                                    if (nextM === 'process_memory_mb') setThreshold(500);
                                    else if (nextM === 'process_cpu_percent') setThreshold(50);
                                    else if (nextM === 'memory_leak_slope') setThreshold(25);
                                    else if (nextM === 'port_collision') setThreshold(8000);
                                    else setThreshold(80);
                                }}
                                className="col-span-3 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                            >
                                {targetScope === 'system' ? (
                                    <>
                                        <option value="cpu_percent">% CPU Hệ Thống</option>
                                        <option value="ram_percent">% RAM Hệ Thống</option>
                                        <option value="gpu_vram_percent">% VRAM GPU</option>
                                        <option value="gpu_temp">Nhiệt độ GPU (°C)</option>
                                        <option value="port_collision">Xung Đột Cổng Mạng (Port)</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="process_memory_mb">RAM Tiến trình (MB)</option>
                                        <option value="process_cpu_percent">% CPU Tiến trình</option>
                                        <option value="memory_leak_slope">Rò rỉ RAM (Slope Trend)</option>
                                    </>
                                )}
                            </select>

                            <select
                                value={operator}
                                onChange={(e) => setOperator(e.target.value)}
                                className="col-span-2 bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-[11px] text-zinc-200 text-center focus:outline-none focus:border-emerald-500 cursor-pointer font-mono"
                            >
                                <option value=">">&gt; (Vượt)</option>
                                <option value=">=">&gt;= (Từ)</option>
                                <option value="<">&lt; (Dưới)</option>
                                <option value="<=">&lt;= (Bằng/Dưới)</option>
                            </select>
                        </div>

                        {/* Threshold Slider + Nhập trực tiếp con số Value */}
                        <div>
                            <div className="flex justify-between items-center mb-1 text-[11px]">
                                <span className="text-zinc-400 flex items-center gap-1">
                                    <Sliders className="w-3 h-3 text-zinc-500" /> Ngưỡng Alert:
                                </span>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        min="1"
                                        max={metric === 'process_memory_mb' ? 65536 : 100}
                                        step={metric === 'process_memory_mb' ? 50 : 1}
                                        value={threshold}
                                        onChange={(e) => setThreshold(Number(e.target.value))}
                                        className="w-16 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 font-mono text-emerald-400 text-right text-xs focus:outline-none focus:border-emerald-500"
                                    />
                                    <span className="font-mono font-semibold text-zinc-400 text-xs">
                                        {unit}
                                    </span>
                                </div>
                            </div>
                            <input
                                type="range"
                                min={metric === 'process_memory_mb' ? 50 : 5}
                                max={metric === 'process_memory_mb' ? 8192 : 100}
                                step={metric === 'process_memory_mb' ? 50 : 1}
                                value={threshold}
                                onChange={(e) => setThreshold(Number(e.target.value))}
                                className="w-full accent-emerald-500 bg-zinc-800 h-1.5 rounded-lg cursor-pointer"
                            />
                        </div>

                        {/* Live Reading Bar */}
                        <div className="pt-1 border-t border-zinc-800 space-y-1 shrink-0">
                            <div className="flex justify-between text-[11px]">
                                <span className="text-zinc-400 flex items-center gap-1">
                                    {targetScope === 'process' && <HardDrive className="w-3 h-3 text-purple-400" />}
                                    Live Reading:
                                </span>
                                <span
                                    className={`font-mono font-bold ${
                                        isTriggered ? 'text-rose-400' : 'text-zinc-200'
                                    }`}
                                >
                                    {currentVal} {unit}
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/80">
                                <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                        isTriggered
                                            ? 'bg-rose-500'
                                            : progressPercent > 70
                                            ? 'bg-amber-400'
                                            : 'bg-emerald-400'
                                    }`}
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        </div>

                        {/* Test Simulate Breach + Display Mode */}
                        <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1.5 border-t border-zinc-800/60 shrink-0">
                            <button
                                onClick={handleSimulateBreach}
                                disabled={isSimulating}
                                title="Giả lập vượt ngưỡng để test chuỗi Action & PC Automation tức thì"
                                className="px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded flex items-center gap-1 font-semibold cursor-pointer transition-colors"
                            >
                                <Zap className="w-3 h-3 text-rose-400" />
                                {isSimulating ? 'Testing...' : 'Test Breach'}
                            </button>

                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setDisplayMode('realtime')}
                                    className={`px-1.5 py-0.5 rounded cursor-pointer flex items-center gap-1 ${
                                        displayMode === 'realtime'
                                            ? 'bg-zinc-800 text-emerald-400 font-semibold'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                                >
                                    <Eye className="w-3 h-3" /> Realtime
                                </button>
                                <button
                                    onClick={() => setDisplayMode('alert_only')}
                                    className={`px-1.5 py-0.5 rounded cursor-pointer flex items-center gap-1 ${
                                        displayMode === 'alert_only'
                                            ? 'bg-zinc-800 text-amber-400 font-semibold'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                                >
                                    <BellRing className="w-3 h-3" /> Alert Only
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Output Handle (Right) - Nối tới ServiceActionNode */}
                <Handle
                    type="source"
                    position={Position.Right}
                    className="!w-3 !h-3 !bg-emerald-400 !border-2 !border-zinc-900"
                />
            </div>
        </div>
    );
}
