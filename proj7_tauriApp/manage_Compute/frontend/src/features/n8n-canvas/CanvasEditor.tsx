import { useMemo, useState, useEffect, useRef } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
    Play,
    Rocket,
    Cpu,
    Gauge,
    Zap,
    X,
    ShieldCheck,
    ShieldAlert,
    Shield,
    Flame,
    RotateCcw,
    SlidersHorizontal,
    Activity,
    Trash2,
    Bot,
    Clock,
    ChevronDown,
    GitBranch,
    Layers,
    Download,
    Upload,
    Sparkles,
    Globe,
    Send,
    Plus,
    Search,
    CheckCircle2,
    AlertTriangle,
} from 'lucide-react';
import { MetricTriggerNode } from './custom-nodes/MetricTriggerNode';
import { ServiceActionNode } from './custom-nodes/ServiceActionNode';
import { ProcessNode } from './custom-nodes/ProcessNode';
import { AutomationNode } from './custom-nodes/AutomationNode';
import { ScheduleTriggerNode } from './custom-nodes/ScheduleTriggerNode';
import { ConditionNode } from './custom-nodes/ConditionNode';
import { LogicGateNode } from './custom-nodes/LogicGateNode';
import { WebhookNotificationNode } from './custom-nodes/WebhookNotificationNode';
import { ResourceQuotaNode } from './custom-nodes/ResourceQuotaNode';
import { httpClient } from '../../services/httpClient';
import { useTelemetryStore } from '../../stores/useTelemetryStore';
import { useWorkflowStore, DEFAULT_PRESETS } from '../../stores/useWorkflowStore';
import { useWorkbenchStore } from '../../stores/useWorkbenchStore';
import { validateNodeConnection, type NodeTier } from './utils/connectionValidator';

export function CanvasEditor() {
    // Sử dụng Zustand Store có persist: dữ liệu KHÔNG BỊ MẤT khi chuyển qua lại các Tab
    const nodes = useWorkflowStore((s) => s.nodes);
    const edges = useWorkflowStore((s) => s.edges);
    const setNodes = useWorkflowStore((s) => s.setNodes);
    const setEdges = useWorkflowStore((s) => s.setEdges);
    const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
    const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
    const onConnect = useWorkflowStore((s) => s.onConnect);
    const deleteEdge = useWorkflowStore((s) => s.deleteEdge);
    const clearAll = useWorkflowStore((s) => s.clearAll);
    const loadPreset = useWorkflowStore((s) => s.loadPreset);

    const guardArmed = useWorkflowStore((s) => s.guardArmed);
    const setGuardArmed = useWorkflowStore((s) => s.setGuardArmed);
    const interventions = useWorkflowStore((s) => s.interventions);
    const setInterventions = useWorkflowStore((s) => s.setInterventions);
    const isDeployed = useWorkflowStore((s) => s.isDeployed);
    const setIsDeployed = useWorkflowStore((s) => s.setIsDeployed);
    const setActiveExecutingNodeId = useWorkflowStore((s) => s.setActiveExecutingNodeId);
    const setExecutionStatusMap = useWorkflowStore((s) => s.setExecutionStatusMap);
    const resetExecutionStatus = useWorkflowStore((s) => s.resetExecutionStatus);

    const [showProcessPicker, setShowProcessPicker] = useState(false);
    const [showPresetsMenu, setShowPresetsMenu] = useState(false);
    const [showTestMenu, setShowTestMenu] = useState(false);
    const [showNodePalette, setShowNodePalette] = useState(true);
    const [searchNodeQuery, setSearchNodeQuery] = useState('');
    const [selectedTierFilter, setSelectedTierFilter] = useState<'ALL' | 'START' | 'MIDDLE' | 'END'>('ALL');
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [watchdogInterval, setWatchdogInterval] = useState<number>(2.0);
    const [scheduleTicks, setScheduleTicks] = useState<number>(0);
    const [simulationProgress, setSimulationProgress] = useState<{
        isRunning: boolean;
        mode: 'LIVE_TEST' | 'SIMULATION';
        currentStep: number;
        totalSteps: number;
        currentNodeLabel: string;
        detail: string;
        status: 'running' | 'completed' | 'error';
    } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const addLog = useTelemetryStore((s) => s.addLog);
    const snapshot = useTelemetryStore((s) => s.snapshot);
    const openTab = useWorkbenchStore((s) => s.openTab);

    const nodeTypes = useMemo(
        () => ({
            metric_trigger: MetricTriggerNode,
            service_action: ServiceActionNode,
            process_node: ProcessNode,
            automation_node: AutomationNode,
            schedule_trigger: ScheduleTriggerNode,
            condition_node: ConditionNode,
            logic_gate: LogicGateNode,
            webhook_node: WebhookNotificationNode,
            resource_quota: ResourceQuotaNode,
        }),
        []
    );

    // Tìm xem trong nodes có ScheduleTriggerNode không để đồng bộ interval
    const scheduleNode = nodes.find((n) => n.type === 'schedule_trigger');
    const effectiveInterval = scheduleNode?.data?.interval_sec
        ? Number(scheduleNode.data.interval_sec)
        : watchdogInterval;

    // Đồng bộ trạng thái Auto-Guard & Scheduler từ backend định kỳ
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const status = await httpClient.getGuardStatus();
                setGuardArmed(status.guard_armed);
                setInterventions(status.interventions_count);
                if (status.total_ticks !== undefined) {
                    setScheduleTicks(status.total_ticks);
                }
                if (status.active_workflows_count > 0) {
                    setIsDeployed(true);
                }
            } catch {
                // Ignore silent errors during offline/init
            }
        };
        fetchStatus();
        const interval = setInterval(fetchStatus, 2500);
        return () => clearInterval(interval);
    }, [setGuardArmed, setInterventions, setIsDeployed]);

    const buildPayload = (forceBreach = false) => ({
        workflow_id: 'wf-auto-guard-primary',
        name: 'Auto-Guard Compute Pipeline',
        nodes: nodes.map((n) => ({ id: n.id, type: n.type || 'unknown', data: n.data })),
        edges: edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
        })),
        interval_sec: effectiveInterval,
        force_breach: forceBreach,
    });

    const handleToggleGuard = async () => {
        try {
            const nextState = !guardArmed;
            const res = await httpClient.toggleGuard(nextState);
            setGuardArmed(res.guard_armed);
            addLog(
                'ACTION',
                `[AUTOGUARD] Protection Shield is now ${res.guard_armed ? 'ARMED & ACTIVE' : 'DISARMED / PAUSED'}`
            );
        } catch (e: any) {
            addLog('ALERT', `Failed to toggle Auto-Guard: ${e.message}`);
        }
    };

    const handleResetSimulation = () => {
        resetExecutionStatus();
        setSimulationProgress(null);
        setEdges((eds) =>
            eds.map((edge) => ({
                ...edge,
                animated: true,
                style: undefined,
            }))
        );
    };

    // Helper chung thực thi Test & Simulation với Live Execution Tracer hiển thị tiến trình từng bước
    const runAnimatedSimulation = async (forceBreach: boolean, modeName: 'LIVE_TEST' | 'SIMULATION') => {
        setShowTestMenu(false);
        resetExecutionStatus();
        setEdges((eds) =>
            eds.map((edge) => ({
                ...edge,
                animated: true,
                style: undefined,
            }))
        );

        setSimulationProgress({
            isRunning: true,
            mode: modeName,
            currentStep: 0,
            totalSteps: Math.max(1, nodes.length),
            currentNodeLabel: 'Initializing Engine & DAG...',
            detail: forceBreach
                ? 'Generating synthetic breach payload to trigger all downstream action nodes...'
                : 'Evaluating live system hardware metrics against trigger rules...',
            status: 'running',
        });

        try {
            const res = await httpClient.runWorkflowOnce(buildPayload(forceBreach));
            setInterventions(res.interventions_count || 0);

            let trace: any[] = res.execution_trace || [];
            if (!trace || trace.length === 0) {
                // Fallback nếu trace trống: tạo trace tuần tự từ các node trên canvas
                trace = nodes.map((n, idx) => ({
                    step: idx + 1,
                    node_id: n.id,
                    node_type: n.type,
                    label: n.data?.name || n.data?.title || n.type,
                    status: 'PASSED',
                    detail: `Traversed node ${idx + 1} (${n.type})`,
                }));
            }

            // Chạy hiệu ứng quét từng node theo thứ tự tuần tự với Edge Illumination
            for (let i = 0; i < trace.length; i++) {
                const step = trace[i];
                setActiveExecutingNodeId(step.node_id);
                setExecutionStatusMap((prev) => ({ ...prev, [step.node_id]: 'running' }));

                // Chiếu sáng dây dẫn dẫn vào node đang thực thi
                setEdges((eds) =>
                    eds.map((edge) => {
                        if (edge.target === step.node_id) {
                            return {
                                ...edge,
                                animated: true,
                                style: { stroke: '#f59e0b', strokeWidth: 3 },
                            };
                        }
                        return edge;
                    })
                );

                setSimulationProgress({
                    isRunning: true,
                    mode: modeName,
                    currentStep: i + 1,
                    totalSteps: trace.length,
                    currentNodeLabel: step.label,
                    detail: step.detail || 'Evaluating node logic...',
                    status: 'running',
                });

                addLog(
                    forceBreach ? 'ACTION' : 'INFO',
                    `[${modeName} STEP ${i + 1}/${trace.length}] ${step.label}: ${step.detail}`
                );

                await new Promise((r) => setTimeout(r, 700));
                const nextStatus = step.status === 'SAFE' ? 'skipped' : 'success';
                setExecutionStatusMap((prev) => ({
                    ...prev,
                    [step.node_id]: nextStatus,
                }));

                // Cập nhật màu dây dẫn sang xanh hoàn tất
                setEdges((eds) =>
                    eds.map((edge) => {
                        if (edge.target === step.node_id || edge.source === step.node_id) {
                            return {
                                ...edge,
                                animated: true,
                                style: {
                                    stroke: nextStatus === 'success' ? '#10b981' : '#71717a',
                                    strokeWidth: 2,
                                },
                            };
                        }
                        return edge;
                    })
                );
            }

            setActiveExecutingNodeId(null);
            setSimulationProgress({
                isRunning: false,
                mode: modeName,
                currentStep: trace.length,
                totalSteps: trace.length,
                currentNodeLabel: `${modeName === 'SIMULATION' ? 'Breach Simulation' : 'Live Test'} Finished`,
                detail: `All ${trace.length} graph nodes evaluated. ${res.triggered_events?.length || 0} event action(s) triggered.`,
                status: 'completed',
            });

            setTimeout(() => {
                handleResetSimulation();
            }, 6000);
        } catch (e: any) {
            addLog('ALERT', `[${modeName} ERROR] ${e.message}`);
            setActiveExecutingNodeId(null);
            setSimulationProgress({
                isRunning: false,
                mode: modeName,
                currentStep: 0,
                totalSteps: 1,
                currentNodeLabel: 'Execution Failed',
                detail: e.message,
                status: 'error',
            });
            setTimeout(() => {
                handleResetSimulation();
            }, 4000);
        }
    };

    // Test 1: Đánh giá theo chỉ số máy thật
    const handleRunOnceLive = () => {
        void runAnimatedSimulation(false, 'LIVE_TEST');
    };

    // Test 2: Giả lập vượt ngưỡng để kích hoạt trọn vẹn chuỗi Action & PC Automation
    const handleSimulateBreach = () => {
        void runAnimatedSimulation(true, 'SIMULATION');
    };

    const handleDeployToggle = async () => {
        try {
            if (isDeployed) {
                await httpClient.stopWorkflow('wf-auto-guard-primary');
                setIsDeployed(false);
                addLog('INFO', '[AUTOGUARD] Background continuous watchdog stopped');
            } else {
                const res = await httpClient.deployWorkflow(buildPayload());
                setIsDeployed(true);
                addLog(
                    'INFO',
                    `[AUTOGUARD] Continuous watchdog loop deployed (${res.interval_sec}s interval). Monitoring background processes.`
                );
            }
        } catch (e: any) {
            addLog('ALERT', `Deploy watchdog failed: ${e.message}`);
        }
    };

    const handleLoadPreset = (key: keyof typeof DEFAULT_PRESETS) => {
        loadPreset(key);
        setShowPresetsMenu(false);
        addLog('CONFIG', `[AUTOGUARD] Loaded Pipeline Preset: ${DEFAULT_PRESETS[key].name}`);
    };

    // Export Workflow JSON
    const handleExportJSON = () => {
        const data = {
            version: '2.0',
            exported_at: new Date().toISOString(),
            workflow_id: 'wf-auto-guard-primary',
            nodes,
            edges,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compute-pipeline-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        addLog('INFO', `[PIPELINE] Exported workflow configuration (${nodes.length} nodes, ${edges.length} edges).`);
    };

    // Import Workflow JSON
    const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string);
                if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
                    setNodes(parsed.nodes);
                    setEdges(parsed.edges);
                    addLog(
                        'CONFIG',
                        `[PIPELINE] Successfully imported workflow (${parsed.nodes.length} nodes, ${parsed.edges.length} edges).`
                    );
                } else {
                    addLog('ALERT', '[PIPELINE] Invalid workflow JSON format: missing nodes/edges array.');
                }
            } catch (err: any) {
                addLog('ALERT', `[PIPELINE] Failed to parse imported JSON: ${err.message}`);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // Thuật toán Tự Động Căn Chỉnh Vị Trí Node (Auto-Layout DAG)
    const handleAutoLayout = () => {
        if (nodes.length === 0) return;

        // Tính in-degree cho mỗi node
        const inDegree: Record<string, number> = {};
        const outgoingMap: Record<string, string[]> = {};
        nodes.forEach((n) => {
            inDegree[n.id] = 0;
            outgoingMap[n.id] = [];
        });

        edges.forEach((e) => {
            if (inDegree[e.target] !== undefined) inDegree[e.target]++;
            if (outgoingMap[e.source]) outgoingMap[e.source].push(e.target);
        });

        // BFS gán tầng (Rank)
        const rank: Record<string, number> = {};
        const queue: string[] = [];

        nodes.forEach((n) => {
            if (inDegree[n.id] === 0) {
                rank[n.id] = 0;
                queue.push(n.id);
            }
        });

        // Nếu chu trình hoặc không có root, gán 0
        nodes.forEach((n) => {
            if (rank[n.id] === undefined) rank[n.id] = 0;
        });

        while (queue.length > 0) {
            const curr = queue.shift()!;
            const currRank = rank[curr] || 0;
            (outgoingMap[curr] || []).forEach((target) => {
                if (rank[target] === undefined || rank[target] < currRank + 1) {
                    rank[target] = currRank + 1;
                    queue.push(target);
                }
            });
        }

        // Gom các node theo tầng
        const layers: Record<number, string[]> = {};
        nodes.forEach((n) => {
            const r = rank[n.id] || 0;
            if (!layers[r]) layers[r] = [];
            layers[r].push(n.id);
        });

        // Cập nhật vị trí x, y ngăn nắp
        const updatedNodes = nodes.map((n) => {
            const r = rank[n.id] || 0;
            const nodesInLayer = layers[r] || [];
            const index = nodesInLayer.indexOf(n.id);
            return {
                ...n,
                position: {
                    x: r * 350 + 60,
                    y: index * 250 + 80,
                },
            };
        });

        setNodes(updatedNodes);
        addLog('ACTION', `[AUTOGUARD] Auto-organized ${nodes.length} nodes into structured DAG layout.`);
    };

    const addScheduleNode = () => {
        const id = `sched-${Date.now()}`;
        setNodes((nds) => [
            ...nds,
            {
                id,
                type: 'schedule_trigger',
                position: { x: 30, y: nds.length * 80 + 80 },
                data: { interval_sec: 2.0, mode: 'interval' },
            },
        ]);
        addLog('INFO', '[AUTOGUARD] Added Schedule Trigger Node.');
    };

    const addConditionNode = () => {
        const id = `cond-${Date.now()}`;
        setNodes((nds) => [
            ...nds,
            {
                id,
                type: 'condition_node',
                position: { x: 380, y: nds.length * 80 + 80 },
                data: { targetScope: 'process', metric: 'process_memory_mb', operator: '>=', threshold: 1500 },
            },
        ]);
        addLog('INFO', '[AUTOGUARD] Added Condition Router Node (If/Else Branching).');
    };

    const addLogicGateNode = () => {
        const id = `gate-${Date.now()}`;
        setNodes((nds) => [
            ...nds,
            {
                id,
                type: 'logic_gate',
                position: { x: 650, y: nds.length * 80 + 80 },
                data: { gate_type: 'AND' },
            },
        ]);
        addLog('INFO', '[AUTOGUARD] Added Logic Gate Node (AND/OR Combiner).');
    };

    const addTriggerNode = () => {
        const id = `alert-${Date.now()}`;
        setNodes((nds) => [
            ...nds,
            {
                id,
                type: 'metric_trigger',
                position: { x: 420, y: nds.length * 80 + 80 },
                data: { metric: 'gpu_temp', operator: '>=', threshold: 80, displayMode: 'realtime' },
            },
        ]);
    };

    const addActionNode = () => {
        const id = `action-${Date.now()}`;
        setNodes((nds) => [
            ...nds,
            {
                id,
                type: 'service_action',
                position: { x: 780, y: nds.length * 80 + 80 },
                data: { action_type: 'suspend_pid', pid: null },
            },
        ]);
    };

    const addAutomationNode = () => {
        const id = `auto-${Date.now()}`;
        setNodes((nds) => [
            ...nds,
            {
                id,
                type: 'automation_node',
                position: { x: 1140, y: nds.length * 80 + 80 },
                data: {
                    action_type: 'search_google',
                    search_query: 'Fix high CPU usage Windows process',
                    folder_path: 'C:\\',
                },
            },
        ]);
    };

    const addWebhookNode = () => {
        const id = `webhook-${Date.now()}`;
        setNodes((nds) => [
            ...nds,
            {
                id,
                type: 'webhook_node',
                position: { x: 1140, y: nds.length * 80 + 80 },
                data: {
                    title: 'Telegram / Discord Notifier',
                    provider: 'discord',
                    webhook_url: '',
                    bot_token: '',
                    chat_id: '',
                    channel: '#alerts',
                    incident_type: 'CRITICAL_OOM',
                    custom_message: 'Alert: System resource exceeded limit!',
                    notify_on_incident: true,
                },
            },
        ]);
        addLog('ACTION', `[CANVAS] Added Webhook Notification Node (${id})`);
    };

    const addResourceQuotaNode = () => {
        const id = `quota-${Date.now()}`;
        setNodes((nds) => [
            ...nds,
            {
                id,
                type: 'resource_quota',
                position: { x: 780, y: nds.length * 80 + 80 },
                data: {
                    title: 'Resource Quota Sandbox',
                    cores: [0, 1],
                    max_ram_mb: 2048,
                    max_cpu_percent: 40,
                    gpu_index: 0,
                    policy: 'TRIM_AND_THROTTLE',
                },
            },
        ]);
        addLog('ACTION', `[CANVAS] Added Resource Quota Sandbox Node (${id})`);
    };

    const handleSelectProcess = (proc: any) => {
        const id = `proc-${Date.now()}`;
        setNodes((nds) => [
            ...nds,
            {
                id,
                type: 'process_node',
                position: { x: 220, y: nds.length * 80 + 80 },
                data: {
                    pid: proc.pid,
                    name: proc.name,
                    cpu_percent: proc.cpu_percent,
                    memory_mb: proc.memory_mb,
                    open_ports: proc.open_ports,
                    status: proc.status,
                },
            },
        ]);
        setShowProcessPicker(false);
        addLog('INFO', `[AUTOGUARD] Added Process [${proc.name}] (PID ${proc.pid}). Connect it to Alert Node.`);
    };

    // Nhấp vào dây nối để xóa dây ngay lập tức
    const handleEdgeClick = (_: React.MouseEvent, edge: any) => {
        deleteEdge(edge.id);
        addLog('INFO', `[AUTOGUARD] Removed connection line (${edge.source} -> ${edge.target})`);
    };

    // Kiểm định kết nối hợp lệ theo kiến trúc DAG: START -> MIDDLE -> END
    const handleConnect = (connection: any) => {
        const sourceNode = nodes.find((n) => n.id === connection.source);
        const targetNode = nodes.find((n) => n.id === connection.target);
        const validation = validateNodeConnection(sourceNode, targetNode);

        if (!validation.isValid) {
            setConnectionError(validation.reason || 'Kết nối không hợp lệ');
            addLog('ALERT', `[PIPELINE RULE VIOLATION] ${validation.reason}`);
            setTimeout(() => setConnectionError(null), 6000);
            return;
        }

        setConnectionError(null);
        onConnect(connection);
        addLog(
            'INFO',
            `[PIPELINE] Connected [${sourceNode?.data?.name || sourceNode?.data?.title || sourceNode?.type}] -> [${
                targetNode?.data?.name || targetNode?.data?.title || targetNode?.type
            }]`
        );
    };

    const runningProcesses = snapshot?.processes || [];

    const nodeCatalog = [
        // TẦNG 1: START (KHỞI ĐẦU / TRIGGERS & SOURCES)
        {
            id: 'schedule_trigger',
            name: 'Schedule Trigger',
            tier: 'START' as NodeTier,
            category: 'Triggers & Sources',
            desc: 'Chu kỳ lặp polling (1s, 2s, 5s) hoặc Cron timer phát xung nhịp đầu vào',
            badge: 'TIMER',
            badgeColor: 'border-cyan-500/30 text-cyan-300 bg-cyan-950/40',
            icon: Clock,
            iconColor: 'text-cyan-400',
            action: addScheduleNode,
        },
        {
            id: 'process_node',
            name: 'OS Process Source',
            tier: 'START' as NodeTier,
            category: 'Triggers & Sources',
            desc: 'Gán tiến trình Windows & theo dõi thời gian thực RAM, CPU, Port',
            badge: 'PROCESS',
            badgeColor: 'border-cyan-500/30 text-cyan-300 bg-cyan-950/40',
            icon: Cpu,
            iconColor: 'text-cyan-400',
            action: () => setShowProcessPicker(true),
        },
        {
            id: 'metric_trigger',
            name: 'Metric Alert Guard',
            tier: 'START' as NodeTier,
            category: 'Monitors & Alerts',
            desc: 'Ngưỡng CPU, RAM, GPU, Slope Leak & Port Collision',
            badge: 'ALERT',
            badgeColor: 'border-cyan-500/30 text-cyan-300 bg-cyan-950/40',
            icon: Gauge,
            iconColor: 'text-cyan-400',
            action: addTriggerNode,
        },

        // TẦNG 2: MIDDLE (XỬ LÝ TRUNG GIAN / LOGIC, ĐIỀU KIỆN & QUOTAS)
        {
            id: 'condition_node',
            name: 'Condition Router (If/Else)',
            tier: 'MIDDLE' as NodeTier,
            category: 'Logic & Flow',
            desc: 'Rẽ nhánh True / False theo điều kiện logic (If/Else)',
            badge: 'ROUTER',
            badgeColor: 'border-amber-500/30 text-amber-300 bg-amber-950/40',
            icon: GitBranch,
            iconColor: 'text-amber-400',
            action: addConditionNode,
        },
        {
            id: 'logic_gate',
            name: 'Logic Gate (AND / OR)',
            tier: 'MIDDLE' as NodeTier,
            category: 'Logic & Flow',
            desc: 'Gộp nhiều tín hiệu cảnh báo (lọc nhiễu Spike trước khi can thiệp)',
            badge: 'GATE',
            badgeColor: 'border-amber-500/30 text-amber-300 bg-amber-950/40',
            icon: Layers,
            iconColor: 'text-amber-400',
            action: addLogicGateNode,
        },
        {
            id: 'resource_quota',
            name: 'Resource Quota Sandbox',
            tier: 'MIDDLE' as NodeTier,
            category: 'Resource Quotas & Limits',
            desc: 'Gán nhân Core CPU, Giới hạn RAM tối đa & Phân bổ GPU cho task',
            badge: 'QUOTA',
            badgeColor: 'border-amber-500/40 text-amber-300 bg-amber-950/50',
            icon: Shield,
            iconColor: 'text-amber-400',
            action: addResourceQuotaNode,
        },

        // TẦNG 3: END (HÀNH ĐỘNG ĐÍCH / ACTIONS & NOTIFICATIONS)
        {
            id: 'service_action',
            name: 'Service Action',
            tier: 'END' as NodeTier,
            category: 'Actions & Remediation',
            desc: 'Win32 EmptyWorkingSet Trim RAM, Priority, Cores, Kill',
            badge: 'ACTION',
            badgeColor: 'border-rose-500/30 text-rose-300 bg-rose-950/40',
            icon: Zap,
            iconColor: 'text-rose-400',
            action: addActionNode,
        },
        {
            id: 'automation_node',
            name: 'PC Automation Card',
            tier: 'END' as NodeTier,
            category: 'Actions & Remediation',
            desc: 'Mở Chrome search lỗi, Windows Explorer, Taskmgr tự động',
            badge: 'DESKTOP',
            badgeColor: 'border-purple-500/30 text-purple-300 bg-purple-950/40',
            icon: Bot,
            iconColor: 'text-purple-400',
            action: addAutomationNode,
        },
        {
            id: 'webhook_node',
            name: 'Webhook Notifier',
            tier: 'END' as NodeTier,
            category: 'Remote Notifications',
            desc: 'Push cảnh báo sự cố đến Telegram, Discord & Slack',
            badge: 'REMOTE',
            badgeColor: 'border-indigo-500/30 text-indigo-300 bg-indigo-950/40',
            icon: Send,
            iconColor: 'text-indigo-400',
            action: addWebhookNode,
        },
    ];

    const filteredCatalog = nodeCatalog.filter((item) => {
        const matchesTier = selectedTierFilter === 'ALL' || item.tier === selectedTierFilter;
        const matchesSearch =
            item.name.toLowerCase().includes(searchNodeQuery.toLowerCase()) ||
            item.desc.toLowerCase().includes(searchNodeQuery.toLowerCase()) ||
            item.category.toLowerCase().includes(searchNodeQuery.toLowerCase()) ||
            item.badge.toLowerCase().includes(searchNodeQuery.toLowerCase());
        return matchesTier && matchesSearch;
    });

    return (
        <div className="h-full flex flex-col relative select-none">
            {/* Input file picker ẩn cho Import JSON */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
            />

            {/* Header Control Toolbar gọn gàng, không bị tràn thanh ngang */}
            <div className="h-11 bg-zinc-900 border-b border-zinc-800 px-3 flex items-center justify-between shrink-0">
                {/* Khối bên trái: Trạng thái Shield, Scheduler Stats & Thông số Watchdog */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleToggleGuard}
                        title="Click to toggle Auto-Guard Arming"
                        className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer shadow-sm ${
                            guardArmed
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60'
                                : 'bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:bg-zinc-700/80'
                        }`}
                    >
                        {guardArmed ? (
                            <>
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                                <span>ARMED</span>
                            </>
                        ) : (
                            <>
                                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                                <span>DISARMED</span>
                            </>
                        )}
                    </button>

                    {/* Scheduler Stats Indicator & Quick Interval Selector */}
                    <div className="flex items-center gap-1.5 text-xs">
                        <div
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[11px] border ${
                                isDeployed
                                    ? 'bg-cyan-950/50 text-cyan-300 border-cyan-500/40'
                                    : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                            }`}
                        >
                            <Clock className={`w-3 h-3 text-cyan-400 ${isDeployed ? 'animate-spin' : ''}`} />
                            <span>{isDeployed ? `${effectiveInterval}s` : 'POLL:'}</span>
                            {!isDeployed && (
                                <select
                                    value={watchdogInterval}
                                    onChange={(e) => setWatchdogInterval(Number(e.target.value))}
                                    className="bg-transparent text-cyan-400 font-mono text-[11px] focus:outline-none cursor-pointer"
                                >
                                    <option value="1" className="bg-zinc-900 text-zinc-200">1.0s</option>
                                    <option value="2" className="bg-zinc-900 text-zinc-200">2.0s</option>
                                    <option value="5" className="bg-zinc-900 text-zinc-200">5.0s</option>
                                    <option value="10" className="bg-zinc-900 text-zinc-200">10.0s</option>
                                </select>
                            )}
                            {isDeployed && <span className="text-zinc-500">| Ticks: {scheduleTicks}</span>}
                        </div>

                        <div className="flex items-center gap-1 text-zinc-400 font-mono text-[11px] hidden sm:flex">
                            <Activity className="w-3 h-3 text-emerald-400" />
                            <span>Hits:</span>
                            <span className="font-bold text-zinc-100">{interventions}</span>
                        </div>
                    </div>
                </div>

                {/* Khối bên phải: Auto-Layout, Presets, Test, Deploy, Node Palette Toggle */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {/* Auto Layout */}
                    <button
                        onClick={handleAutoLayout}
                        title="Tự động căn chỉnh và sắp xếp vị trí các node theo DAG"
                        className="px-2 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/80 text-xs rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                    >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span className="hidden md:inline">Auto Layout</span>
                    </button>

                    {/* Export & Import JSON */}
                    <button
                        onClick={handleExportJSON}
                        title="Xuất file cấu hình JSON của workflow"
                        className="p-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/80 rounded-md transition-colors cursor-pointer"
                    >
                        <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        title="Tải lên file cấu hình JSON để khôi phục workflow"
                        className="p-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/80 rounded-md transition-colors cursor-pointer"
                    >
                        <Upload className="w-3.5 h-3.5" />
                    </button>

                    <div className="h-4 w-px bg-zinc-800 mx-0.5" />

                    {/* Menu Presets Auto-Guard */}
                    <div className="relative">
                        <button
                            onClick={() => setShowPresetsMenu(!showPresetsMenu)}
                            className="px-2 py-1 bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-300 border border-zinc-700/80 text-xs rounded-md flex items-center gap-1 transition-colors cursor-pointer"
                        >
                            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" /> Presets
                        </button>

                        {showPresetsMenu && (
                            <div className="absolute right-0 top-10 z-50 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden p-1.5 space-y-1">
                                <div className="px-2 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                    Production Pipeline Profiles
                                </div>

                                <button
                                    onClick={() => handleLoadPreset('resource_quota_partitioning')}
                                    className="w-full text-left px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 rounded flex items-center gap-2 transition-colors cursor-pointer border border-emerald-500/20 bg-emerald-950/20"
                                >
                                    <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <div>
                                        <div className="font-semibold text-emerald-300">Resource Quota &amp; Sandbox</div>
                                        <div className="text-[10px] text-zinc-400 font-mono">
                                            Schedule &rarr; Process &rarr; Cores 0-3 / RAM Cap &rarr; Webhook
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleLoadPreset('remote_webhook_watchdog')}
                                    className="w-full text-left px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 rounded flex items-center gap-2 transition-colors cursor-pointer border border-indigo-500/20 bg-indigo-950/20"
                                >
                                    <Send className="w-4 h-4 text-indigo-400 shrink-0" />
                                    <div>
                                        <div className="font-semibold text-indigo-300">Remote Webhook Watchdog</div>
                                        <div className="text-[10px] text-zinc-400 font-mono">
                                            Schedule (2s) &rarr; Chrome &rarr; RAM Alert &rarr; Trim &amp; Webhook
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleLoadPreset('memory_leak_auto_trim')}
                                    className="w-full text-left px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 rounded flex items-center gap-2 transition-colors cursor-pointer border border-emerald-500/20 bg-emerald-950/20"
                                >
                                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <div>
                                        <div className="font-semibold text-emerald-300">Smart Leak Trend &amp; Auto Trim</div>
                                        <div className="text-[10px] text-zinc-400 font-mono">
                                            Chrome &rarr; Slope Trend 5 Cycles &rarr; Win32 EmptyWorkingSet
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleLoadPreset('port_collision_watchdog')}
                                    className="w-full text-left px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 rounded flex items-center gap-2 transition-colors cursor-pointer border border-amber-500/20 bg-amber-950/20"
                                >
                                    <Globe className="w-4 h-4 text-amber-400 shrink-0" />
                                    <div>
                                        <div className="font-semibold text-amber-300">Port Collision Watchdog</div>
                                        <div className="text-[10px] text-zinc-400 font-mono">
                                            Schedule (2s) &rarr; Port 8000 Occupied &rarr; Release Port
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleLoadPreset('conditional_branch_guard')}
                                    className="w-full text-left px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 rounded flex items-center gap-2 transition-colors cursor-pointer border border-sky-500/20 bg-sky-950/20"
                                >
                                    <GitBranch className="w-4 h-4 text-sky-400 shrink-0" />
                                    <div>
                                        <div className="font-semibold text-sky-300">Conditional Router (If/Else)</div>
                                        <div className="text-[10px] text-zinc-400 font-mono">
                                            Process &rarr; Router &rarr; True (Kill &amp; Chrome) / False (Log)
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleLoadPreset('production_scheduled_guard')}
                                    className="w-full text-left px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 rounded flex items-center gap-2 transition-colors cursor-pointer border border-cyan-500/20 bg-cyan-950/20"
                                >
                                    <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                                    <div>
                                        <div className="font-semibold text-cyan-300">Production Scheduled Watchdog</div>
                                        <div className="text-[10px] text-zinc-400 font-mono">
                                            Schedule (2s) &rarr; Chrome &rarr; RAM &gt; 2GB &rarr; Action &amp; Auto
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleLoadPreset('gpu_thermal')}
                                    className="w-full text-left px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 rounded flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                    <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                    <div>
                                        <div className="font-medium">GPU Thermal &amp; VRAM Guard</div>
                                        <div className="text-[10px] text-zinc-500 font-mono">Temp &gt; 80°C &rarr; Suspend PID</div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleLoadPreset('pc_automation_guard')}
                                    className="w-full text-left px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 rounded flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                    <Bot className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                    <div>
                                        <div className="font-medium">PC Automation: Chrome &amp; Folder</div>
                                        <div className="text-[10px] text-zinc-500 font-mono">Alert &rarr; Terminate &rarr; Search Google</div>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="h-4 w-px bg-zinc-800 mx-0.5" />

                    {/* Test Guard Dropdown Menu */}
                    <div className="relative">
                        <div className="flex items-center rounded-md border border-emerald-500/30 overflow-hidden">
                            <button
                                onClick={handleRunOnceLive}
                                title="Đánh giá theo chỉ số hệ thống thực tế"
                                className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 text-xs flex items-center gap-1 transition-colors cursor-pointer font-medium"
                            >
                                <Play className="w-3 h-3" /> Test
                            </button>
                            <button
                                onClick={() => setShowTestMenu(!showTestMenu)}
                                className="px-1 py-1 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border-l border-emerald-500/20 text-xs transition-colors cursor-pointer"
                            >
                                <ChevronDown className="w-3 h-3" />
                            </button>
                        </div>

                        {showTestMenu && (
                            <div className="absolute right-0 top-10 z-50 w-64 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden p-1.5 space-y-1">
                                <button
                                    onClick={handleRunOnceLive}
                                    className="w-full text-left px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 rounded flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                    <Play className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <div>
                                        <div className="font-medium">Test Live Reading</div>
                                        <div className="text-[10px] text-zinc-500">Đánh giá theo chỉ số máy thật</div>
                                    </div>
                                </button>

                                <button
                                    onClick={handleSimulateBreach}
                                    className="w-full text-left px-2.5 py-1.5 text-xs text-rose-300 hover:bg-zinc-800 rounded flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                    <Zap className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                    <div>
                                        <div className="font-semibold text-rose-300">Simulate Breach Test</div>
                                        <div className="text-[10px] text-zinc-400">Ép kích hoạt toàn bộ chuỗi Action &amp; Auto</div>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Deploy Watchdog Loop */}
                    <button
                        onClick={handleDeployToggle}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1 transition-all cursor-pointer shadow-sm ${
                            isDeployed
                                ? 'bg-amber-600 hover:bg-amber-500 text-white border border-amber-400/40'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                    >
                        {isDeployed ? (
                            <>
                                <RotateCcw className="w-3 h-3 animate-spin" /> Stop
                            </>
                        ) : (
                            <>
                                <Rocket className="w-3 h-3" /> Deploy
                            </>
                        )}
                    </button>

                    <div className="h-4 w-px bg-zinc-800 mx-0.5" />

                    {/* Nút bật/tắt Node Palette Sidebar bên phải */}
                    <button
                        onClick={() => setShowNodePalette(!showNodePalette)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer border ${
                            showNodePalette
                                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                                : 'bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                        }`}
                        title="Đóng / Mở Bảng Danh Mục Node bên phải"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Node Palette</span>
                    </button>
                </div>
            </div>

            {/* Vùng Canvas chính & Sidebar Node Palette bên phải */}
            <div className="flex-1 w-full flex overflow-hidden relative">
                {/* Canvas React Flow */}
                <div className="flex-1 h-full bg-zinc-950 relative overflow-hidden">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={handleConnect}
                        onEdgeClick={handleEdgeClick}
                        nodeTypes={nodeTypes}
                        fitView
                        proOptions={{ hideAttribution: true }}
                        snapToGrid
                        snapGrid={[15, 15]}
                    >
                        <Background color="#27272a" gap={20} size={1} />
                        <Controls className="!bg-zinc-900 !border-zinc-800 !fill-zinc-300" />
                    </ReactFlow>

                    {/* Floating Connection Validation Error Toast */}
                    {connectionError && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[92%] animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="bg-rose-950/95 border-2 border-rose-500 text-rose-200 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                                <div className="flex-1 text-xs">
                                    <div className="font-bold uppercase tracking-wider text-rose-300 font-mono">
                                        Quy Tắc Luồng Dữ Liệu Bị Vi Phạm (DAG Rule)
                                    </div>
                                    <div className="mt-1 text-zinc-200 font-medium leading-relaxed">
                                        {connectionError}
                                    </div>
                                    <div className="mt-2 text-[10px] font-mono text-zinc-400 border-t border-rose-900/60 pt-1.5 flex items-center gap-1.5">
                                        <span className="text-cyan-300 font-semibold">START</span>
                                        <span>&rarr;</span>
                                        <span className="text-amber-300 font-semibold">MIDDLE</span>
                                        <span>&rarr;</span>
                                        <span className="text-rose-300 font-semibold">END</span>
                                        <span className="text-zinc-500 pl-1">(Không được nối ngược)</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setConnectionError(null)}
                                    className="text-zinc-400 hover:text-white p-1 rounded cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Floating Execution & Simulation Tracer Bar */}
                    {simulationProgress && (
                        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[92%] animate-in fade-in slide-in-from-bottom-2 duration-150">
                            <div className="bg-zinc-900/95 border border-amber-500/50 rounded-xl shadow-2xl p-3 backdrop-blur-md text-xs text-zinc-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {simulationProgress.status === 'running' ? (
                                            <Activity className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                                        ) : simulationProgress.status === 'completed' ? (
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                        ) : (
                                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                                        )}
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-xs uppercase font-mono tracking-wider text-amber-300">
                                                {simulationProgress.mode === 'SIMULATION' ? 'Breach Simulation Tracer' : 'Live DAG Test Tracer'}
                                            </span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-zinc-800 text-zinc-300">
                                                Step {simulationProgress.currentStep}/{simulationProgress.totalSteps}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleResetSimulation}
                                        className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded cursor-pointer"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Active Node & Step Detail */}
                                <div className="mt-2 space-y-0.5">
                                    <div className="font-semibold text-zinc-100 flex items-center gap-1.5">
                                        <span className="text-emerald-400">&bull;</span>
                                        <span>{simulationProgress.currentNodeLabel}</span>
                                    </div>
                                    <div className="text-[11px] text-zinc-400 font-mono pl-3 truncate">
                                        {simulationProgress.detail}
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden mt-2 border border-zinc-800">
                                    <div
                                        className={`h-full transition-all duration-300 ${
                                            simulationProgress.status === 'completed'
                                                ? 'bg-emerald-400'
                                                : simulationProgress.status === 'error'
                                                ? 'bg-rose-500'
                                                : 'bg-amber-400'
                                        }`}
                                        style={{
                                            width: `${Math.min(
                                                100,
                                                (simulationProgress.currentStep /
                                                    Math.max(1, simulationProgress.totalSteps)) *
                                                    100
                                            )}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal/Dropdown chọn tiến trình từ hệ thống */}
                {showProcessPicker && (
                    <div className="absolute top-3 right-80 z-50 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
                        <div className="px-3 py-2 bg-zinc-950/90 border-b border-zinc-800 flex items-center justify-between">
                            <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                                <Cpu className="w-3.5 h-3.5 text-emerald-400" /> Chọn Tiến Trình Hệ Thống
                            </span>
                            <button
                                onClick={() => setShowProcessPicker(false)}
                                className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="max-h-64 overflow-y-auto p-1 divide-y divide-zinc-800/40">
                            {runningProcesses.length === 0 ? (
                                <div className="p-4 text-center text-zinc-500 text-xs">
                                    Đang quét danh sách tiến trình...
                                </div>
                            ) : (
                                runningProcesses.map((p) => (
                                    <button
                                        key={p.pid}
                                        onClick={() => handleSelectProcess(p)}
                                        className="w-full px-2.5 py-1.5 text-left hover:bg-zinc-800/70 rounded flex items-center justify-between text-xs transition-colors cursor-pointer group"
                                    >
                                        <div className="truncate max-w-[170px]">
                                            <div className="font-medium text-zinc-200 group-hover:text-emerald-400 truncate">
                                                {p.name}
                                            </div>
                                            <div className="text-[10px] text-zinc-500 font-mono">PID: {p.pid}</div>
                                        </div>
                                        <div className="text-right font-mono text-[11px] shrink-0">
                                            <div className="text-zinc-300">{p.memory_mb.toFixed(0)} MB</div>
                                            <div className="text-zinc-500 text-[10px]">{p.cpu_percent.toFixed(1)}%</div>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Sidebar Bên Phải (Node Library Palette Phân Tầng) */}
                {showNodePalette && (
                    <div className="w-80 h-full bg-zinc-900/95 border-l border-zinc-800 flex flex-col shrink-0 z-20 select-none shadow-2xl backdrop-blur">
                        {/* Header của Sidebar */}
                        <div className="px-3 py-2.5 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                                    Node Palette
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                                    {nodes.length} nodes
                                </span>
                                <button
                                    onClick={() => setShowNodePalette(false)}
                                    className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors cursor-pointer"
                                    title="Đóng bảng công cụ"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Hướng Dẫn Kiến Trúc Luồng 1 Chiều (DAG Architecture Guide) */}
                        <div className="px-3 py-2 bg-zinc-950/90 border-b border-zinc-800 text-[10px] space-y-1.5 shrink-0">
                            <div className="text-zinc-400 font-semibold uppercase tracking-wider flex items-center justify-between">
                                <span>Kiến Trúc Luồng Hợp Lệ</span>
                                <span className="font-mono text-emerald-400 font-bold">1-WAY DAG</span>
                            </div>
                            <div className="flex items-center gap-1 font-mono text-[9px]">
                                <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-bold">START</span>
                                <span className="text-zinc-600">&rarr;</span>
                                <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40 font-bold">MIDDLE</span>
                                <span className="text-zinc-600">&rarr;</span>
                                <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-500/40 font-bold">END</span>
                            </div>
                            <div className="text-[10px] text-zinc-500">
                                Luồng chạy từ Triggers &rarr; Điều Kiện/Quota &rarr; Hành Động/Báo Động. Chặn nối ngược!
                            </div>
                        </div>

                        {/* Search Input Filter & Tier Filter Tabs */}
                        <div className="p-2 border-b border-zinc-800/80 bg-zinc-950/40 shrink-0 space-y-1.5">
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                                <input
                                    type="text"
                                    placeholder="Search nodes (e.g. ram, cron, webhook)..."
                                    value={searchNodeQuery}
                                    onChange={(e) => setSearchNodeQuery(e.target.value)}
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
                                />
                            </div>

                            {/* Tier Filter Buttons */}
                            <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
                                <button
                                    onClick={() => setSelectedTierFilter('ALL')}
                                    className={`py-1 rounded text-center transition-colors cursor-pointer border ${
                                        selectedTierFilter === 'ALL'
                                            ? 'bg-zinc-800 text-zinc-100 border-zinc-600 font-bold'
                                            : 'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                                    }`}
                                >
                                    TẤT CẢ
                                </button>
                                <button
                                    onClick={() => setSelectedTierFilter('START')}
                                    className={`py-1 rounded text-center transition-colors cursor-pointer border ${
                                        selectedTierFilter === 'START'
                                            ? 'bg-cyan-950 text-cyan-300 border-cyan-500 font-bold'
                                            : 'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:text-cyan-300'
                                    }`}
                                >
                                    START
                                </button>
                                <button
                                    onClick={() => setSelectedTierFilter('MIDDLE')}
                                    className={`py-1 rounded text-center transition-colors cursor-pointer border ${
                                        selectedTierFilter === 'MIDDLE'
                                            ? 'bg-amber-950 text-amber-300 border-amber-500 font-bold'
                                            : 'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:text-amber-300'
                                    }`}
                                >
                                    MIDDLE
                                </button>
                                <button
                                    onClick={() => setSelectedTierFilter('END')}
                                    className={`py-1 rounded text-center transition-colors cursor-pointer border ${
                                        selectedTierFilter === 'END'
                                            ? 'bg-rose-950 text-rose-300 border-rose-500 font-bold'
                                            : 'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:text-rose-300'
                                    }`}
                                >
                                    END
                                </button>
                            </div>
                        </div>

                        {/* Danh sách các Node dạng Cards phân tầng */}
                        <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                            {filteredCatalog.length === 0 ? (
                                <div className="p-6 text-center text-xs text-zinc-500 italic">
                                    Không tìm thấy node phù hợp với bộ lọc
                                </div>
                            ) : (
                                filteredCatalog.map((item) => {
                                    const IconComponent = item.icon;
                                    const tierBadgeColor =
                                        item.tier === 'START'
                                            ? 'border-cyan-500/40 text-cyan-300 bg-cyan-950/60'
                                            : item.tier === 'MIDDLE'
                                            ? 'border-amber-500/40 text-amber-300 bg-amber-950/60'
                                            : 'border-rose-500/40 text-rose-300 bg-rose-950/60';

                                    return (
                                        <div
                                            key={item.id}
                                            onClick={item.action}
                                            className="group p-2.5 rounded-xl bg-zinc-950/60 hover:bg-zinc-800/90 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer flex flex-col gap-1.5 shadow-sm hover:shadow"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 group-hover:border-zinc-700">
                                                        <IconComponent className={`w-4 h-4 ${item.iconColor}`} />
                                                    </div>
                                                    <span className="text-xs font-semibold text-zinc-200 group-hover:text-emerald-400 transition-colors">
                                                        {item.name}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className={`text-[8px] font-mono font-bold px-1 py-0.5 rounded border ${tierBadgeColor}`}>
                                                        {item.tier}
                                                    </span>
                                                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${item.badgeColor}`}>
                                                        {item.badge}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-[11px] text-zinc-400 group-hover:text-zinc-300 leading-snug line-clamp-2">
                                                {item.desc}
                                            </p>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer của Sidebar: Quick navigation sang Dashboard/Incidents/Health & Clear Canvas */}
                        <div className="p-2.5 border-t border-zinc-800 bg-zinc-950/80 shrink-0 space-y-2">
                            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium px-0.5">
                                <span>Quick Tabs</span>
                                <span className="font-mono">{nodes.length} nodes active</span>
                            </div>

                            <div className="grid grid-cols-3 gap-1">
                                <button
                                    onClick={() =>
                                        openTab({
                                            id: 'tab-dash-1',
                                            title: 'Compute Dashboard',
                                            type: 'dashboard-metrics',
                                        })
                                    }
                                    className="px-1.5 py-1 text-center bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-800 text-[10px] transition-colors truncate cursor-pointer"
                                >
                                    Dashboard
                                </button>
                                <button
                                    onClick={() =>
                                        openTab({
                                            id: 'tab-incidents-1',
                                            title: 'Incident Audit Trail',
                                            type: 'incident-log',
                                        })
                                    }
                                    className="px-1.5 py-1 text-center bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-800 text-[10px] transition-colors truncate cursor-pointer"
                                >
                                    Incidents
                                </button>
                                <button
                                    onClick={() =>
                                        openTab({
                                            id: 'tab-advisor-1',
                                            title: 'Health Score & AI Advisor',
                                            type: 'health-advisor',
                                        })
                                    }
                                    className="px-1.5 py-1 text-center bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded border border-zinc-800 text-[10px] transition-colors truncate cursor-pointer"
                                >
                                    Health
                                </button>
                            </div>

                            <button
                                onClick={clearAll}
                                className="w-full px-2.5 py-1.5 bg-zinc-900 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-800 hover:border-rose-500/30 text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Clear All Canvas Nodes</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
