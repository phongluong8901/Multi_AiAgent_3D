/**
 * Thanh công cụ bên trái ngoài cùng (Activity Bar Component):
 * Cho phép chuyển đổi nhanh giữa các phân mục chính của bàn làm việc:
 * 1. Dashboard: Giám sát chỉ số và đồ thị phần cứng thời gian thực.
 * 2. Workflows: Trình biên soạn đồ thị DAG Auto-Guard và tự động hóa.
 * 3. Processes: Bảng điều khiển tiến trình hệ điều hành, dịch vụ và mạng.
 * 4. Nút bấm tạo nhanh một Tab Canvas mới.
 */

import { Workflow, Cpu, PlusCircle, LineChart } from 'lucide-react';
import { useWorkbenchStore } from '../../stores/useWorkbenchStore';

export function ActivityBar() {
    const { activeSection, setActiveSection, openTab } = useWorkbenchStore();

    return (
        <aside className="w-12 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-3 justify-between select-none shrink-0">
            {/* Nhóm các nút chuyển phân mục chính */}
            <div className="flex flex-col gap-3">
                {/* Nút phân mục Dashboard */}
                <button
                    onClick={() => {
                        setActiveSection('dashboard');
                        openTab({ id: 'tab-dash-1', title: 'Compute Dashboard', type: 'dashboard-metrics' });
                    }}
                    title="Compute & Telemetry Dashboard"
                    className={`p-2.5 rounded-lg transition-colors cursor-pointer ${
                        activeSection === 'dashboard'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                >
                    <LineChart className="w-5 h-5" />
                </button>

                {/* Nút phân mục Workflows */}
                <button
                    onClick={() => {
                        setActiveSection('workflows');
                        openTab({ id: 'tab-canvas-1', title: 'Auto-Guard GPU Pipeline', type: 'workflow-canvas' });
                    }}
                    title="Auto-Guard Workflows"
                    className={`p-2.5 rounded-lg transition-colors cursor-pointer ${
                        activeSection === 'workflows'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                >
                    <Workflow className="w-5 h-5" />
                </button>

                {/* Nút phân mục Quản lý tiến trình & Dịch vụ */}
                <button
                    onClick={() => {
                        setActiveSection('processes');
                        openTab({ id: 'tab-proc-1', title: 'OS Process & Port Inspector', type: 'service-inspector' });
                    }}
                    title="OS Process & Service Inspector"
                    className={`p-2.5 rounded-lg transition-colors cursor-pointer ${
                        activeSection === 'processes'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                >
                    <Cpu className="w-5 h-5" />
                </button>
            </div>

            {/* Nút tạo thêm Tab pipeline mới ở chân thanh công cụ */}
            <button
                onClick={() =>
                    openTab({
                        id: `canvas-${Date.now()}`,
                        title: `Pipeline #${Math.floor(Math.random() * 90 + 10)}`,
                        type: 'workflow-canvas',
                    })
                }
                title="New Pipeline Tab"
                className="p-2 text-zinc-500 hover:text-emerald-400 transition-colors cursor-pointer"
            >
                <PlusCircle className="w-5 h-5" />
            </button>
        </aside>
    );
}
