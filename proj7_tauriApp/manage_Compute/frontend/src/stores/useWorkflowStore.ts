/**
 * Kho lưu trữ Zustand quản lý trạng thái đồ thị tự động hóa Auto-Guard Canvas (React Flow / @xyflow/react).
 * Lưu trữ danh sách Node, Edge, các mẫu quy trình dựng sẵn (Presets), trạng thái vũ trang (guardArmed),
 * trạng thái triển khai nền (isDeployed) và hiệu ứng đánh dấu node đang chạy (Execution Trace Highlights).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    applyNodeChanges,
    applyEdgeChanges,
    type Node,
    type Edge,
    type NodeChange,
    type EdgeChange,
    type Connection,
    addEdge,
} from '@xyflow/react';

/**
 * Các mẫu đồ thị quy trình dựng sẵn (Presets) phục vụ kiểm thử và ứng dụng thực tế:
 * 1. gpu_thermal: Giám sát nhiệt độ và VRAM card đồ họa NVIDIA.
 * 2. pc_automation_guard: Giám sát tiến trình Chrome, tìm kiếm giải pháp và dump thư mục.
 * 3. oom_guard: Chống tràn bộ nhớ Out-Of-Memory và tự hủy tiến trình rò rỉ.
 * 4. live_stream_watchdog: Theo dõi CPU và mở Dashboard trực tiếp.
 * 5. production_scheduled_guard: Quy trình chạy định kỳ thực tế với Timer Schedule.
 * 6. conditional_branch_guard: Rẽ nhánh điều kiện If/Else với 2 đầu ra True / False.
 * 7. memory_leak_auto_trim: Tự động phát hiện rò rỉ bộ nhớ qua độ dốc và gọi Win32 EmptyWorkingSet.
 * 8. port_collision_watchdog: Tự động phát hiện và giải phóng cổng mạng bị chiếm dụng.
 * 9. remote_webhook_watchdog: Gửi cảnh báo Webhook Discord/Telegram kèm chụp màn hình.
 * 10. resource_quota_partitioning: Phân vùng giới hạn tài nguyên CPU Cores và RAM Quota.
 */
export const DEFAULT_PRESETS = {
    gpu_thermal: {
        name: 'GPU Thermal & VRAM Guard',
        nodes: [
            {
                id: 'proc-1',
                type: 'process_node',
                position: { x: 50, y: 120 },
                data: { pid: 0, name: 'HeavyMLWorker.exe', cpu_percent: 45.0, memory_mb: 3200 },
            },
            {
                id: 'alert-1',
                type: 'metric_trigger',
                position: { x: 420, y: 120 },
                data: { targetScope: 'system', metric: 'gpu_temp', operator: '>=', threshold: 80, displayMode: 'realtime' },
            },
            {
                id: 'act-1',
                type: 'service_action',
                position: { x: 800, y: 120 },
                data: { action_type: 'suspend_pid', pid: null },
            },
            {
                id: 'auto-1',
                type: 'automation_node',
                position: { x: 1180, y: 120 },
                data: {
                    action_type: 'search_google',
                    search_query: 'How to fix high GPU temperature ML training',
                    folder_path: 'C:\\',
                },
            },
        ],
        edges: [
            { id: 'e-p-a', source: 'proc-1', target: 'alert-1', animated: true },
            { id: 'e-a-s', source: 'alert-1', target: 'act-1', animated: true },
            { id: 'e-s-auto', source: 'act-1', target: 'auto-1', animated: true },
        ],
    },
    pc_automation_guard: {
        name: 'PC Automation: Chrome Search & Folder Dump',
        nodes: [
            {
                id: 'proc-1',
                type: 'process_node',
                position: { x: 50, y: 120 },
                data: { pid: 0, name: 'chrome.exe', cpu_percent: 18.0, memory_mb: 2450 },
            },
            {
                id: 'alert-1',
                type: 'metric_trigger',
                position: { x: 420, y: 120 },
                data: { targetScope: 'process', metric: 'process_memory_mb', operator: '>=', threshold: 2000, displayMode: 'realtime' },
            },
            {
                id: 'act-1',
                type: 'service_action',
                position: { x: 800, y: 120 },
                data: { action_type: 'live_log_stream', pid: null },
            },
            {
                id: 'auto-1',
                type: 'automation_node',
                position: { x: 1180, y: 120 },
                data: {
                    action_type: 'search_google',
                    search_query: 'chrome.exe high memory usage memory leak fix',
                    folder_path: 'C:\\',
                },
            },
        ],
        edges: [
            { id: 'e-p-a', source: 'proc-1', target: 'alert-1', animated: true },
            { id: 'e-a-s', source: 'alert-1', target: 'act-1', animated: true },
            { id: 'e-s-auto', source: 'act-1', target: 'auto-1', animated: true },
        ],
    },
    oom_guard: {
        name: 'OOM Memory Leak Protector',
        nodes: [
            {
                id: 'proc-1',
                type: 'process_node',
                position: { x: 50, y: 120 },
                data: { pid: 0, name: 'MemoryLeakService.exe', cpu_percent: 12.0, memory_mb: 4800 },
            },
            {
                id: 'alert-1',
                type: 'metric_trigger',
                position: { x: 420, y: 120 },
                data: { targetScope: 'process', metric: 'process_memory_mb', operator: '>=', threshold: 4000, displayMode: 'alert_only' },
            },
            {
                id: 'act-1',
                type: 'service_action',
                position: { x: 800, y: 120 },
                data: { action_type: 'terminate_pid', pid: null },
            },
        ],
        edges: [
            { id: 'e-p-a', source: 'proc-1', target: 'alert-1', animated: true },
            { id: 'e-a-s', source: 'alert-1', target: 'act-1', animated: true },
        ],
    },
    live_stream_watchdog: {
        name: 'Live Process Socket & Stream Watchdog',
        nodes: [
            {
                id: 'proc-1',
                type: 'process_node',
                position: { x: 50, y: 120 },
                data: { pid: 0, name: 'pyrefly.exe', cpu_percent: 14.5, memory_mb: 1640 },
            },
            {
                id: 'alert-1',
                type: 'metric_trigger',
                position: { x: 420, y: 120 },
                data: { targetScope: 'process', metric: 'process_cpu_percent', operator: '>', threshold: 10, displayMode: 'realtime' },
            },
            {
                id: 'act-1',
                type: 'service_action',
                position: { x: 800, y: 120 },
                data: { action_type: 'open_dashboard', pid: null },
            },
        ],
        edges: [
            { id: 'e-p-a', source: 'proc-1', target: 'alert-1', animated: true },
            { id: 'e-a-s', source: 'alert-1', target: 'act-1', animated: true },
        ],
    },
    production_scheduled_guard: {
        name: 'Production Scheduled Watchdog (Real Project Setup)',
        nodes: [
            {
                id: 'sched-1',
                type: 'schedule_trigger',
                position: { x: 30, y: 120 },
                data: { interval_sec: 2.0, mode: 'interval' },
            },
            {
                id: 'proc-1',
                type: 'process_node',
                position: { x: 360, y: 120 },
                data: { pid: 0, name: 'chrome.exe', cpu_percent: 16.5, memory_mb: 2150 },
            },
            {
                id: 'alert-1',
                type: 'metric_trigger',
                position: { x: 720, y: 120 },
                data: { targetScope: 'process', metric: 'process_memory_mb', operator: '>=', threshold: 2000, displayMode: 'realtime' },
            },
            {
                id: 'act-1',
                type: 'service_action',
                position: { x: 1080, y: 120 },
                data: { action_type: 'live_log_stream', pid: null },
            },
            {
                id: 'auto-1',
                type: 'automation_node',
                position: { x: 1440, y: 120 },
                data: {
                    action_type: 'search_google',
                    search_query: 'chrome.exe high memory usage memory leak fix',
                    folder_path: 'C:\\',
                },
            },
        ],
        edges: [
            { id: 'e-s-p', source: 'sched-1', target: 'proc-1', animated: true },
            { id: 'e-p-a', source: 'proc-1', target: 'alert-1', animated: true },
            { id: 'e-a-s', source: 'alert-1', target: 'act-1', animated: true },
            { id: 'e-s-auto', source: 'act-1', target: 'auto-1', animated: true },
        ],
    },
    conditional_branch_guard: {
        name: 'Conditional Router (If/Else True & False Branching)',
        nodes: [
            {
                id: 'proc-1',
                type: 'process_node',
                position: { x: 40, y: 150 },
                data: { pid: 0, name: 'chrome.exe', cpu_percent: 22.0, memory_mb: 2600 },
            },
            {
                id: 'cond-1',
                type: 'condition_node',
                position: { x: 400, y: 150 },
                data: { targetScope: 'process', metric: 'process_memory_mb', operator: '>=', threshold: 2000 },
            },
            {
                id: 'act-true',
                type: 'service_action',
                position: { x: 780, y: 60 },
                data: { action_type: 'terminate_pid', pid: null },
            },
            {
                id: 'auto-true',
                type: 'automation_node',
                position: { x: 1150, y: 60 },
                data: {
                    action_type: 'search_google',
                    search_query: 'chrome.exe memory leak fix',
                    folder_path: 'C:\\',
                },
            },
            {
                id: 'act-false',
                type: 'service_action',
                position: { x: 780, y: 290 },
                data: { action_type: 'live_log_stream', pid: null },
            },
        ],
        edges: [
            { id: 'e-p-c', source: 'proc-1', target: 'cond-1', animated: true },
            { id: 'e-c-true', source: 'cond-1', target: 'act-true', sourceHandle: 'true', animated: true },
            { id: 'e-t-auto', source: 'act-true', target: 'auto-true', animated: true },
            { id: 'e-c-false', source: 'cond-1', target: 'act-false', sourceHandle: 'false', animated: true },
        ],
    },
    memory_leak_auto_trim: {
        name: 'Smart Leak Detection & Auto RAM Trim (Win32)',
        nodes: [
            {
                id: 'proc-1',
                type: 'process_node',
                position: { x: 50, y: 120 },
                data: { pid: 0, name: 'chrome.exe', cpu_percent: 15.0, memory_mb: 2400 },
            },
            {
                id: 'alert-1',
                type: 'metric_trigger',
                position: { x: 420, y: 120 },
                data: { targetScope: 'process', metric: 'memory_leak_slope', operator: '>=', threshold: 20, displayMode: 'realtime' },
            },
            {
                id: 'act-1',
                type: 'service_action',
                position: { x: 800, y: 120 },
                data: { action_type: 'trim_memory', pid: null },
            },
            {
                id: 'auto-1',
                type: 'automation_node',
                position: { x: 1180, y: 120 },
                data: {
                    action_type: 'search_google',
                    search_query: 'How to fix chrome memory leak EmptyWorkingSet',
                    folder_path: 'C:\\',
                },
            },
        ],
        edges: [
            { id: 'e-p-a', source: 'proc-1', target: 'alert-1', animated: true },
            { id: 'e-a-s', source: 'alert-1', target: 'act-1', animated: true },
            { id: 'e-s-auto', source: 'act-1', target: 'auto-1', animated: true },
        ],
    },
    port_collision_watchdog: {
        name: 'Port Collision & Auto Release Watchdog',
        nodes: [
            {
                id: 'sched-1',
                type: 'schedule_trigger',
                position: { x: 50, y: 120 },
                data: { interval_sec: 2.0, mode: 'interval' },
            },
            {
                id: 'alert-1',
                type: 'metric_trigger',
                position: { x: 420, y: 120 },
                data: { targetScope: 'system', metric: 'port_collision', operator: '==', threshold: 8000, displayMode: 'realtime' },
            },
            {
                id: 'act-1',
                type: 'service_action',
                position: { x: 800, y: 120 },
                data: { action_type: 'release_port', port: 8000 },
            },
        ],
        edges: [
            { id: 'e-s-a', source: 'sched-1', target: 'alert-1', animated: true },
            { id: 'e-a-s', source: 'alert-1', target: 'act-1', animated: true },
        ],
    },
    remote_webhook_watchdog: {
        name: 'Remote Webhook Notifier & Incident Screen Capture',
        nodes: [
            {
                id: 'sched-1',
                type: 'schedule_trigger',
                position: { x: 40, y: 120 },
                data: { interval_sec: 2.0, mode: 'interval' },
            },
            {
                id: 'proc-1',
                type: 'process_node',
                position: { x: 380, y: 120 },
                data: { pid: 0, name: 'chrome.exe', cpu_percent: 19.5, memory_mb: 2350 },
            },
            {
                id: 'alert-1',
                type: 'metric_trigger',
                position: { x: 740, y: 120 },
                data: { targetScope: 'process', metric: 'process_memory_mb', operator: '>=', threshold: 2000, displayMode: 'realtime' },
            },
            {
                id: 'act-1',
                type: 'service_action',
                position: { x: 1100, y: 120 },
                data: { action_type: 'trim_memory', pid: null },
            },
            {
                id: 'webhook-1',
                type: 'webhook_node',
                position: { x: 1460, y: 120 },
                data: {
                    title: 'Telegram / Discord Notifier',
                    provider: 'discord',
                    webhook_url: '',
                    bot_token: '',
                    chat_id: '',
                    channel: '#alerts',
                    incident_type: 'CRITICAL_OOM',
                    custom_message: 'Alert: Chrome exceeded 2000MB RAM. Working set trimmed and screenshot captured.',
                    notify_on_incident: true,
                },
            },
        ],
        edges: [
            { id: 'e-s-p', source: 'sched-1', target: 'proc-1', animated: true },
            { id: 'e-p-a', source: 'proc-1', target: 'alert-1', animated: true },
            { id: 'e-a-s', source: 'alert-1', target: 'act-1', animated: true },
            { id: 'e-s-w', source: 'act-1', target: 'webhook-1', animated: true },
        ],
    },
    resource_quota_partitioning: {
        name: 'Resource Partitioning (CPU Cores & RAM Hard Quota)',
        nodes: [
            {
                id: 'sched-1',
                type: 'schedule_trigger',
                position: { x: 40, y: 120 },
                data: { interval_sec: 2.0, mode: 'interval' },
            },
            {
                id: 'proc-1',
                type: 'process_node',
                position: { x: 380, y: 120 },
                data: { pid: 0, name: 'HeavyMLWorker.exe', cpu_percent: 65.0, memory_mb: 3400 },
            },
            {
                id: 'quota-1',
                type: 'resource_quota',
                position: { x: 740, y: 120 },
                data: {
                    title: 'Resource Quota Sandbox',
                    cores: [0, 1, 2, 3],
                    max_ram_mb: 2500,
                    max_cpu_percent: 45,
                    gpu_index: 0,
                    policy: 'TRIM_AND_THROTTLE',
                },
            },
            {
                id: 'webhook-1',
                type: 'webhook_node',
                position: { x: 1140, y: 120 },
                data: {
                    title: 'Telegram / Discord Notifier',
                    provider: 'discord',
                    webhook_url: '',
                    bot_token: '',
                    chat_id: '',
                    channel: '#alerts',
                    incident_type: 'CRITICAL_OOM',
                    custom_message: 'Alert: Process exceeded Resource Quota. Automatic Win32 RAM Trim & CPU Throttling executed.',
                    notify_on_incident: true,
                },
            },
        ],
        edges: [
            { id: 'e-s-p', source: 'sched-1', target: 'proc-1', animated: true },
            { id: 'e-p-q', source: 'proc-1', target: 'quota-1', animated: true },
            { id: 'e-q-w', source: 'quota-1', target: 'webhook-1', animated: true },
        ],
    },
};

/**
 * Trạng thái Store của Workflow Canvas.
 */
interface WorkflowState {
    /** Danh sách node hiện tại trên canvas */
    nodes: Node[];
    /** Danh sách cạnh nối (edges) giữa các node */
    edges: Edge[];
    /** Trạng thái vũ trang của Auto-Guard (true = bật) */
    guardArmed: boolean;
    /** Số lần tự động can thiệp đã thực hiện */
    interventions: number;
    /** Trạng thái đã triển khai chạy nền hay chưa */
    isDeployed: boolean;
    /** Cập nhật toàn bộ danh sách node */
    setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
    /** Cập nhật toàn bộ danh sách edge */
    setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
    /** Hàm xử lý sự kiện kéo thả thay đổi vị trí/kích thước node */
    onNodesChange: (changes: NodeChange[]) => void;
    /** Hàm xử lý sự kiện thay đổi edge */
    onEdgesChange: (changes: EdgeChange[]) => void;
    /** Hàm kết nối 2 handle giữa 2 node */
    onConnect: (connection: Connection) => void;
    /** Xóa một node và các cạnh nối liên quan */
    deleteNode: (nodeId: string) => void;
    /** Xóa một cạnh nối theo ID */
    deleteEdge: (edgeId: string) => void;
    /** Xóa sạch toàn bộ canvas */
    clearAll: () => void;
    /** Nạp cấu trúc đồ thị từ mẫu Preset có sẵn */
    loadPreset: (key: keyof typeof DEFAULT_PRESETS) => void;
    /** Bật/tắt trạng thái Auto-Guard */
    setGuardArmed: (val: boolean) => void;
    /** Cập nhật bộ đếm can thiệp */
    setInterventions: (val: number) => void;
    /** Đánh dấu trạng thái triển khai liên tục */
    setIsDeployed: (val: boolean) => void;
    /** ID của node đang được thực thi để vẽ viền sáng */
    activeExecutingNodeId: string | null;
    /** Bảng trạng thái thực thi của từng node: pending, running, success, failed, skipped */
    executionStatusMap: Record<string, 'pending' | 'running' | 'success' | 'failed' | 'skipped'>;
    /** Thiết lập node đang chạy */
    setActiveExecutingNodeId: (id: string | null) => void;
    /** Cập nhật bảng trạng thái thực thi */
    setExecutionStatusMap: (
        updater:
            | Record<string, 'pending' | 'running' | 'success' | 'failed' | 'skipped'>
            | ((
                  prev: Record<string, 'pending' | 'running' | 'success' | 'failed' | 'skipped'>
              ) => Record<string, 'pending' | 'running' | 'success' | 'failed' | 'skipped'>)
    ) => void;
    /** Đặt lại toàn bộ trạng thái chạy về ban đầu */
    resetExecutionStatus: () => void;
}

export const useWorkflowStore = create<WorkflowState>()(
    persist(
        (set) => ({
            nodes: DEFAULT_PRESETS.gpu_thermal.nodes,
            edges: DEFAULT_PRESETS.gpu_thermal.edges,
            guardArmed: true,
            interventions: 0,
            isDeployed: false,
            activeExecutingNodeId: null,
            executionStatusMap: {},

            setNodes: (updater) =>
                set((state) => ({
                    nodes: typeof updater === 'function' ? updater(state.nodes) : updater,
                })),

            setEdges: (updater) =>
                set((state) => ({
                    edges: typeof updater === 'function' ? updater(state.edges) : updater,
                })),

            onNodesChange: (changes) =>
                set((state) => ({
                    nodes: applyNodeChanges(changes, state.nodes),
                })),

            onEdgesChange: (changes) =>
                set((state) => ({
                    edges: applyEdgeChanges(changes, state.edges),
                })),

            onConnect: (connection) =>
                set((state) => ({
                    edges: addEdge({ ...connection, animated: true }, state.edges),
                })),

            deleteNode: (nodeId) =>
                set((state) => ({
                    nodes: state.nodes.filter((n) => n.id !== nodeId),
                    edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
                })),

            deleteEdge: (edgeId) =>
                set((state) => ({
                    edges: state.edges.filter((e) => e.id !== edgeId),
                })),

            clearAll: () =>
                set({
                    nodes: [],
                    edges: [],
                }),

            loadPreset: (key) => {
                const p = DEFAULT_PRESETS[key];
                if (p) {
                    set({
                        nodes: p.nodes,
                        edges: p.edges,
                    });
                }
            },

            setGuardArmed: (guardArmed) => set({ guardArmed }),
            setInterventions: (interventions) => set({ interventions }),
            setIsDeployed: (isDeployed) => set({ isDeployed }),
            setActiveExecutingNodeId: (activeExecutingNodeId) => set({ activeExecutingNodeId }),
            setExecutionStatusMap: (updater) =>
                set((state) => ({
                    executionStatusMap:
                        typeof updater === 'function' ? updater(state.executionStatusMap) : updater,
                })),
            resetExecutionStatus: () => set({ activeExecutingNodeId: null, executionStatusMap: {} }),
        }),
        {
            name: 'compute-studio-workflow-canvas',
            partialize: (state) => ({
                nodes: state.nodes,
                edges: state.edges,
                guardArmed: state.guardArmed,
                isDeployed: state.isDeployed,
            }),
        }
    )
);
