/**
 * Bố cục giao diện bàn làm việc trung tâm (Workbench Layout):
 * Cấu trúc phân chia ô linh hoạt (Resizable Split Panes phong cách VS Code):
 * - Thanh tiêu đề trên cùng (TitleBar)
 * - Cột biểu tượng bên trái (ActivityBar)
 * - Khung cây thư mục / danh sách (SidebarExplorer)
 * - Vùng nội dung Tab (TabBar & CanvasEditor / Dashboard / Inspector / Network / Health)
 * - Bảng điều khiển Console phía dưới (BottomConsole)
 * - Thanh trạng thái chân trang (Footer Status Bar)
 */

import { useEffect } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { ReactFlowProvider } from '@xyflow/react';
import { ActivityBar } from '../components/workbench/ActivityBar';
import { TitleBar } from '../components/workbench/TitleBar';
import { SidebarExplorer } from '../components/workbench/SidebarExplorer';
import { TabBar } from '../components/workbench/TabBar';
import { BottomConsole } from '../components/workbench/BottomConsole';
import { CanvasEditor } from '../features/n8n-canvas/CanvasEditor';
import { ServiceInspectorView } from '../features/service-inspector/ServiceInspectorView';
import { DashboardMetricsView } from '../features/dashboard-metrics/DashboardMetricsView';
import { ProcessDetailChartTab } from '../features/dashboard-metrics/ProcessDetailChartTab';
import { IncidentAuditLogView } from '../features/incident-audit/IncidentAuditLogView';
import { SystemHealthAdvisorView } from '../features/health-advisor/SystemHealthAdvisorView';
import { NetworkTrafficView } from '../features/network-traffic/NetworkTrafficView';
import { MemoryPartitionView } from '../features/partition-manager/MemoryPartitionView';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { useWorkbenchStore } from '../stores/useWorkbenchStore';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import { socketClient } from '../services/socketClient';

export function WorkbenchLayout() {
    const { tabs, activeTabId } = useWorkbenchStore();
    const connected = useTelemetryStore((s) => s.connected);

    // Tự động kết nối WebSocket khi khởi động và dọn dẹp khi thoát
    useEffect(() => {
        socketClient.connect();
        return () => socketClient.disconnect();
    }, []);

    // Tìm tab đang được chọn
    const currentTab = tabs.find((t) => t.id === activeTabId);

    return (
        <div className="h-screen w-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden select-none">
            {/* Header full viền liền mạch */}
            <TitleBar />

            <div className="flex-1 flex overflow-hidden">
                {/* Cột Icon phân mục bên trái */}
                <ActivityBar />

                {/* Hệ thống khung kéo giãn Split-Pane có chia sẻ context ReactFlow */}
                <ReactFlowProvider>
                    <Group orientation="horizontal" className="flex-1 h-full">
                        {/* Khung Sidebar duyệt cây tài nguyên bên trái */}
                        <Panel defaultSize="260px" minSize="200px" maxSize="420px">
                            <SidebarExplorer />
                        </Panel>

                        {/* Thanh ngăn cách có thể kéo dãn ngang */}
                        <Separator className="w-1 bg-zinc-800 hover:bg-emerald-500 transition-colors cursor-col-resize shrink-0" />

                        {/* Vùng làm việc chính gồm Tab trên và Console dưới */}
                        <Panel defaultSize="100%">
                            <Group orientation="vertical" className="h-full">
                                {/* Vùng hiển thị nội dung theo từng Tab */}
                                <Panel defaultSize="72%" minSize="40%" className="flex flex-col">
                                    <TabBar />
                                    <div className="flex-1 overflow-hidden">
                                        <ErrorBoundary fallbackTitle="Workspace Tab Render Error">
                                            {currentTab?.type === 'workflow-canvas' || currentTab?.type === 'n8n-canvas' ? (
                                                <CanvasEditor />
                                            ) : currentTab?.type === 'dashboard-metrics' ? (
                                                <DashboardMetricsView />
                                            ) : currentTab?.type === 'process-chart' ? (
                                                <ProcessDetailChartTab tabId={currentTab.id} />
                                            ) : currentTab?.type === 'incident-log' ? (
                                                <IncidentAuditLogView />
                                            ) : currentTab?.type === 'health-advisor' ? (
                                                <SystemHealthAdvisorView />
                                            ) : currentTab?.type === 'network-traffic' ? (
                                                <NetworkTrafficView />
                                            ) : currentTab?.type === 'memory-partitions' ? (
                                                <MemoryPartitionView />
                                            ) : (
                                                <ServiceInspectorView />
                                            )}
                                        </ErrorBoundary>
                                    </div>
                                </Panel>

                                {/* Thanh ngăn cách có thể kéo dãn dọc */}
                                <Separator className="h-1 bg-zinc-800 hover:bg-emerald-500 transition-colors cursor-row-resize shrink-0" />

                                {/* Ngăn kéo Console thời gian thực dưới đáy */}
                                <Panel defaultSize="28%" minSize="120px">
                                    <BottomConsole />
                                </Panel>
                            </Group>
                        </Panel>
                    </Group>
                </ReactFlowProvider>
            </div>

            {/* Thanh trạng thái dưới cùng (Status Bar) */}
            <footer className="h-6 bg-zinc-900 border-t border-zinc-800 px-3 flex items-center justify-between text-[11px] text-zinc-400 select-none shrink-0">
                <div className="flex items-center gap-2">
                    <span
                        className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                            }`}
                    />
                    <span>
                        {connected
                            ? 'Connected to Python Engine (127.0.0.1:14200)'
                            : 'Disconnected - Reconnecting...'}
                    </span>
                </div>
                <div className="font-mono text-zinc-500">ComputeStudio v0.1.0</div>
            </footer>
        </div>
    );
}
