import type { ProcessInfo, ProcessActionType } from '../types/compute';

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:14200';

export const httpClient = {
    getProcesses: async (limit = 40, sortBy: 'memory' | 'cpu' = 'memory'): Promise<ProcessInfo[]> => {
        const res = await fetch(`${BASE_URL}/api/rest/processes?limit=${limit}&sort_by=${sortBy}`);
        if (!res.ok) throw new Error('Failed to fetch processes');
        return res.json();
    },

    controlProcess: async (pid: number, action: ProcessActionType) => {
        const res = await fetch(`${BASE_URL}/api/rest/processes/${pid}/${action}`, {
            method: 'POST',
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Action failed');
        }
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
};