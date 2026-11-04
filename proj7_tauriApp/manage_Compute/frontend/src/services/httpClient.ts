import type { ProcessInfo, ProcessActionType, ProcessNetworkProfile, SystemNetworkSummary, SystemPartitionsOverview, PartitionPurgeResult } from '../types/compute';

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:14200';

export interface GuardStatus {
    guard_armed: boolean;
    interventions_count: number;
    last_intervention: any | null;
    active_workflows_count: number;
    total_ticks?: number;
    last_tick_time?: number | null;
    active_schedules?: Record<string, any>;
}

export const httpClient = {
    getProcesses: async (limit = 40, sortBy: 'memory' | 'cpu' = 'memory'): Promise<ProcessInfo[]> => {
        const res = await fetch(`${BASE_URL}/api/rest/processes?limit=${limit}&sort_by=${sortBy}`);
        if (!res.ok) throw new Error('Failed to fetch processes');
        return res.json();
    },

    controlProcess: async (pid: number, action: ProcessActionType | string) => {
        const res = await fetch(`${BASE_URL}/api/rest/processes/${pid}/${action}`, {
            method: 'POST',
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Action failed');
        }
        return res.json();
    },

    trimMemory: async (pid: number) => {
        const res = await fetch(`${BASE_URL}/api/rest/processes/${pid}/trim-memory`, {
            method: 'POST',
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Failed to trim process memory');
        }
        return res.json();
    },

    setPriority: async (pid: number, priority: string) => {
        const res = await fetch(`${BASE_URL}/api/rest/processes/${pid}/priority`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ priority }),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Failed to set priority');
        }
        return res.json();
    },

    setAffinity: async (pid: number, cores: number[]) => {
        const res = await fetch(`${BASE_URL}/api/rest/processes/${pid}/affinity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cores }),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Failed to set affinity');
        }
        return res.json();
    },

    releasePort: async (port: number) => {
        const res = await fetch(`${BASE_URL}/api/rest/processes/ports/release`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ port }),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Failed to release port');
        }
        return res.json();
    },

    applyResourceQuota: async (pid: number, quota: {
        cores?: number[];
        max_ram_mb?: number;
        max_cpu_percent?: number;
        gpu_index?: number;
        policy?: string;
    }) => {
        const res = await fetch(`${BASE_URL}/api/rest/processes/${pid}/quota`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(quota),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Failed to apply resource quota');
        }
        return res.json();
    },

    getResourceQuota: async (pid: number) => {
        const res = await fetch(`${BASE_URL}/api/rest/processes/${pid}/quota`);
        if (!res.ok) throw new Error('Failed to get resource quota');
        return res.json();
    },

    removeResourceQuota: async (pid: number) => {
        const res = await fetch(`${BASE_URL}/api/rest/processes/${pid}/quota`, {
            method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to remove resource quota');
        return res.json();
    },

    listResourceQuotas: async () => {
        const res = await fetch(`${BASE_URL}/api/rest/processes/quotas/list`);
        if (!res.ok) throw new Error('Failed to list resource quotas');
        return res.json();
    },

    getProcessNetwork: async (pid: number): Promise<ProcessNetworkProfile> => {
        const res = await fetch(`${BASE_URL}/api/rest/processes/${pid}/network`);
        if (!res.ok) throw new Error(`Failed to inspect network for PID ${pid}`);
        return res.json();
    },

    getNetworkSummary: async (): Promise<SystemNetworkSummary> => {
        const res = await fetch(`${BASE_URL}/api/rest/processes/network/summary`);
        if (!res.ok) throw new Error('Failed to fetch system network summary');
        return res.json();
    },

    getPartitions: async (): Promise<SystemPartitionsOverview> => {
        const res = await fetch(`${BASE_URL}/api/rest/system/partitions`);
        if (!res.ok) throw new Error('Failed to fetch memory partitions');
        return res.json();
    },

    purgePartition: async (partitionId: string, mode: 'safe' | 'force' = 'safe'): Promise<PartitionPurgeResult> => {
        const res = await fetch(`${BASE_URL}/api/rest/system/partitions/purge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ partition_id: partitionId, mode }),
        });
        if (!res.ok) throw new Error('Failed to purge partition');
        return res.json();
    },

    spawnService: async (name: string, command: string, cwd?: string) => {
        const res = await fetch(`${BASE_URL}/api/rest/processes/spawn`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, command, cwd }),
        });
        if (!res.ok) throw new Error('Failed to spawn service');
        return res.json();
    },

    deployWorkflow: async (payload: any) => {
        const res = await fetch(`${BASE_URL}/api/rest/workflows/deploy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return res.json();
    },

    runWorkflowOnce: async (payload: any) => {
        const res = await fetch(`${BASE_URL}/api/rest/workflows/run-once`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return res.json();
    },

    testAction: async (actionData: any) => {
        const res = await fetch(`${BASE_URL}/api/rest/workflows/action/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(actionData),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Test action failed');
        }
        return res.json();
    },

    stopWorkflow: async (workflowId: string) => {
        const res = await fetch(`${BASE_URL}/api/rest/workflows/${workflowId}/stop`, {
            method: 'POST',
        });
        return res.json();
    },

    getGuardStatus: async (): Promise<GuardStatus> => {
        const res = await fetch(`${BASE_URL}/api/rest/workflows/guard/status`);
        if (!res.ok) throw new Error('Failed to fetch guard status');
        return res.json();
    },

    toggleGuard: async (armed?: boolean): Promise<{ guard_armed: boolean; status: string }> => {
        const res = await fetch(`${BASE_URL}/api/rest/workflows/guard/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ armed }),
        });
        if (!res.ok) throw new Error('Failed to toggle guard status');
        return res.json();
    },

    getIncidents: async (limit = 50, severity?: string) => {
        const query = severity ? `?limit=${limit}&severity=${severity}` : `?limit=${limit}`;
        const res = await fetch(`${BASE_URL}/api/rest/workflows/incidents${query}`);
        if (!res.ok) throw new Error('Failed to fetch incidents');
        return res.json();
    },

    exportIncidentsUrl: (format = 'csv') => `${BASE_URL}/api/rest/workflows/incidents/export?format=${format}`,

    captureScreen: async () => {
        const res = await fetch(`${BASE_URL}/api/rest/workflows/incidents/capture-screen`, {
            method: 'POST',
        });
        if (!res.ok) throw new Error('Failed to capture screenshot');
        return res.json();
    },

    testNotification: async (payload: any) => {
        const res = await fetch(`${BASE_URL}/api/rest/workflows/notifications/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to send test notification');
        return res.json();
    },

    getSystemHealth: async () => {
        const res = await fetch(`${BASE_URL}/api/rest/system/health`);
        if (!res.ok) throw new Error('Failed to fetch system health');
        return res.json();
    },
};
