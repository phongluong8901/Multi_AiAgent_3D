/**
 * Kho lưu trữ Zustand quản lý trạng thái giao diện bàn làm việc (Workbench Workspace).
 * Quản lý thanh phân vùng bên trái (ActivityBar), danh sách các Tab đang mở,
 * và điều hướng giữa các công cụ: Dashboard, Flow Canvas, Process Inspector, Partitions, Network, Health Advisor.
 */

import { create } from 'zustand';

/**
 * Các loại màn hình Tab có thể mở trên bàn làm việc Workbench.
 */
export type TabType =
    | 'workflow-canvas'
    | 'service-inspector'
    | 'dashboard-metrics'
    | 'process-chart'
    | 'n8n-canvas'
    | 'incident-log'
    | 'health-advisor'
    | 'network-traffic'
    | 'memory-partitions';

/**
 * Cấu trúc một Tab đang mở trên TabBar.
 */
export interface WorkbenchTab {
    /** Mã định danh duy nhất của Tab */
    id: string;
    /** Tiêu đề hiển thị trên thanh tab */
    title: string;
    /** Loại nội dung tab */
    type: TabType;
}

/**
 * Trạng thái và các hành động điều hướng Tab.
 */
interface WorkbenchState {
    /** Phân mục hiện tại trên thanh Activity Bar (dashboard, workflows, processes) */
    activeSection: 'dashboard' | 'workflows' | 'processes';
    /** Danh sách các tab đang được mở */
    tabs: WorkbenchTab[];
    /** ID của tab đang kích hoạt và hiển thị nội dung */
    activeTabId: string;
    /** Thay đổi phân mục chính trên Activity Bar */
    setActiveSection: (sec: 'dashboard' | 'workflows' | 'processes') => void;
    /** Mở một tab mới hoặc chuyển tới tab đó nếu đã tồn tại */
    openTab: (tab: WorkbenchTab) => void;
    /** Đóng một tab theo ID và chuyển active sang tab kề cận */
    closeTab: (id: string) => void;
    /** Chọn tab hiển thị đang hoạt động */
    setActiveTab: (id: string) => void;
}

export const useWorkbenchStore = create<WorkbenchState>((set) => ({
    activeSection: 'workflows',
    tabs: [
        { id: 'tab-dash-1', title: 'Compute Dashboard', type: 'dashboard-metrics' },
        { id: 'tab-canvas-1', title: 'Auto-Guard GPU Pipeline', type: 'workflow-canvas' },
        { id: 'tab-proc-1', title: 'OS Process & Port Inspector', type: 'service-inspector' },
    ],
    activeTabId: 'tab-canvas-1',

    setActiveSection: (activeSection) => set({ activeSection }),

    openTab: (newTab) =>
        set((state) => {
            const exists = state.tabs.find((t) => t.id === newTab.id);
            if (exists) return { activeTabId: exists.id };
            return { tabs: [...state.tabs, newTab], activeTabId: newTab.id };
        }),

    closeTab: (id) =>
        set((state) => {
            const filtered = state.tabs.filter((t) => t.id !== id);
            if (filtered.length === 0) return state;
            const nextActive = state.activeTabId === id ? filtered[filtered.length - 1].id : state.activeTabId;
            return { tabs: filtered, activeTabId: nextActive };
        }),

    setActiveTab: (activeTabId) => set({ activeTabId }),
}));
