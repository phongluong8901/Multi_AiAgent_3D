import { create } from 'zustand';

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

export interface WorkbenchTab {
    id: string;
    title: string;
    type: TabType;
}

interface WorkbenchState {
    activeSection: 'dashboard' | 'workflows' | 'processes';
    tabs: WorkbenchTab[];
    activeTabId: string;
    setActiveSection: (sec: 'dashboard' | 'workflows' | 'processes') => void;
    openTab: (tab: WorkbenchTab) => void;
    closeTab: (id: string) => void;
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
