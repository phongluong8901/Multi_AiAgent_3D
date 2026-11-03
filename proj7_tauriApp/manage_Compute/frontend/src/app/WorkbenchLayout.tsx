import { useEffect } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { ActivityBar } from '../components/workbench/ActivityBar';
import { TitleBar } from '../components/workbench/TitleBar';
import { SidebarExplorer } from '../components/workbench/SidebarExplorer';
import { TabBar } from '../components/workbench/TabBar';
import { BottomConsole } from '../components/workbench/BottomConsole';
import { CanvasEditor } from '../features/n8n-canvas/CanvasEditor';
import { ServiceInspectorView } from '../features/service-inspector/ServiceInspectorView';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { useWorkbenchStore } from '../stores/useWorkbenchStore';
import { useTelemetryStore } from '../stores/useTelemetryStore';
import { socketClient } from '../services/socketClient';

export function WorkbenchLayout() {
    const { tabs, activeTabId } = useWorkbenchStore();
    const connected = useTelemetryStore((s) => s.connected);

    useEffect(() => {
        socketClient.connect();
        return () => socketClient.disconnect();
    }, []);

    const currentTab = tabs.find((t) => t.id === activeTabId);

    return (
        <div className="h-screen w-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden select-none">
            {/* Header full viền liền mạch kiểu Postman */}
            <TitleBar />

            <div className="flex-1 flex overflow-hidden">
                {/* Cột Icon bên trái */}
                <ActivityBar />

                {/* Hệ thống khung kéo giãn kiểu Postman */}
                <Group orientation="horizontal" className="flex-1 h-full">
                    <Panel defaultSize="260px" minSize="200px" maxSize="420px">
                        <SidebarExplorer />
                    </Panel>

                    <Separator className="w-1 bg-zinc-800 hover:bg-emerald-500 transition-colors cursor-col-resize shrink-0" />

                    <Panel defaultSize="100%">
                        <Group orientation="vertical" className="h-full">
                            {/* Vùng làm việc chính theo từng Tab */}
                            <Panel defaultSize="72%" minSize="40%" className="flex flex-col">
                                <TabBar />
                                <div className="flex-1 overflow-hidden">
                                    <ErrorBoundary fallbackTitle="Workspace Tab Render Error">
                                        {currentTab?.type === 'n8n-canvas' ? (
                                            <CanvasEditor />
                                        ) : (
                                            <ServiceInspectorView />
                                        )}
                                    </ErrorBoundary>
                                </div>
                            </Panel>

                            <Separator className="h-1 bg-zinc-800 hover:bg-emerald-500 transition-colors cursor-row-resize shrink-0" />

                            {/* Ngăn kéo Console dưới đáy */}
                            <Panel defaultSize="28%" minSize="120px">
                                <BottomConsole />
                            </Panel>
                        </Group>
                    </Panel>
                </Group>
            </div>

            {/* Thanh trạng thái dưới cùng */}
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
