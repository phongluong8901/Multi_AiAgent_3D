/**
 * Dịch vụ HTTP Client gọi các REST API tới Backend FastAPI của Compute Studio.
 * Quản lý các cuộc gọi về tiến trình, hạn ngạch tài nguyên, mạng, phân vùng bộ nhớ và workflow DAG.
 */

import type { ProcessInfo, ProcessActionType, ProcessNetworkProfile, SystemNetworkSummary, SystemPartitionsOverview, PartitionPurgeResult } from '../types/compute';

// Đường dẫn gốc của Backend (mặc định trỏ về cổng 14200 cục bộ)
const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:14200';

/**
 * Trạng thái hoạt động của cơ chế bảo vệ tự động Auto-Guard.
 */
export interface GuardStatus {
    /** Trạng thái vũ trang (true: sẵn sàng can thiệp, false: chỉ quan sát) */
    guard_armed: boolean;
    /** Tổng số lượt can thiệp tự động đã thực hiện */
    interventions_count: number;
    /** Chi tiết sự kiện can thiệp gần nhất */
    last_intervention: any | null;
    /** Số lượng workflow đang duy trì chạy nền */
    active_workflows_count: number;
    /** Tổng số chu kỳ tick đã xử lý */
    total_ticks?: number;
    /** Dấu thời gian Unix của chu kỳ tick gần nhất */
    last_tick_time?: number | null;
    /** Bảng tra cứu các lịch trình chạy nền đang kích hoạt */
    active_schedules?: Record<string, any>;
}

export const httpClient = {
    /**
     * Lấy danh sách các tiến trình hệ điều hành đang chạy, hỗ trợ sắp xếp theo RAM hoặc CPU.
     */
    getProcesses: async (limit = 40, sortBy: 'memory' | 'cpu' = 'memory'): Promise<ProcessInfo[]> => {
        const res = await fetch(`${BASE_URL}/api/rest/processes?limit=${limit}&sort_by=${sortBy}`);
        if (!res.ok) throw new Error('Failed to fetch processes');
        return res.json();
    },

    /**
     * Điều khiển tiến trình: Hủy (kill/terminate), tạm dừng (suspend) hoặc kích hoạt lại (resume).
     */
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

    /**
     * Thu hồi giải phóng bộ nhớ RAM dư thừa của tiến trình (Windows EmptyWorkingSet API).
     */
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

    /**
     * Cài đặt mức độ ưu tiên điều phối CPU (idle, below_normal, normal, above_normal, high, realtime).
     */
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

    /**
     * Ghim tiến trình chạy độc quyền trên danh sách các lõi CPU chỉ định (CPU Affinity Pinning).
     */
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

    /**
     * Giải phóng cổng mạng đang bị chiếm dụng bằng cách đóng tiến trình sở hữu cổng.
     */
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

    /**
     * Áp dụng định mức giới hạn tài nguyên cứng (Resource Quota) cho một tiến trình.
     */
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

    /**
     * Lấy thông tin định mức tài nguyên hiện tại của tiến trình.
     */
    getResourceQuota: async (pid: number) => {
        const res = await fetch(`${BASE_URL}/api/rest/processes/${pid}/quota`);
        if (!res.ok) throw new Error('Failed to get resource quota');
        return res.json();
    },

    /**
     * Xóa bỏ hạn mức tài nguyên đã áp đặt cho tiến trình.
     */
    removeResourceQuota: async (pid: number) => {
        const res = await fetch(`${BASE_URL}/api/rest/processes/${pid}/quota`, {
            method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to remove resource quota');
        return res.json();
    },

    /**
     * Liệt kê tất cả các định mức tài nguyên đang được bảo vệ tự động.
     */
    listResourceQuotas: async () => {
        const res = await fetch(`${BASE_URL}/api/rest/processes/quotas/list`);
        if (!res.ok) throw new Error('Failed to list resource quotas');
        return res.json();
    },

    /**
     * Khảo sát chi tiết mạng của một tiến trình: cổng mở, socket ngoài, tên miền kết nối.
     */
    getProcessNetwork: async (pid: number): Promise<ProcessNetworkProfile> => {
        const res = await fetch(`${BASE_URL}/api/rest/processes/${pid}/network`);
        if (!res.ok) throw new Error(`Failed to inspect network for PID ${pid}`);
        return res.json();
    },

    /**
     * Lấy bản tóm tắt lưu lượng và điểm cuối API của toàn bộ hệ thống máy tính.
     */
    getNetworkSummary: async (): Promise<SystemNetworkSummary> => {
        const res = await fetch(`${BASE_URL}/api/rest/processes/network/summary`);
        if (!res.ok) throw new Error('Failed to fetch system network summary');
        return res.json();
    },

    /**
     * Lấy danh sách các phân vùng bộ nhớ và ổ đĩa (RAM Active, Standby, SSD, HDD, Temp).
     */
    getPartitions: async (): Promise<SystemPartitionsOverview> => {
        const res = await fetch(`${BASE_URL}/api/rest/system/partitions`);
        if (!res.ok) throw new Error('Failed to fetch memory partitions');
        return res.json();
    },

    /**
     * Thực hiện dọn dẹp phân vùng chỉ định (Standby Cache, Temp, Dumps).
     */
    purgePartition: async (partitionId: string, mode: 'safe' | 'force' = 'safe'): Promise<PartitionPurgeResult> => {
        const res = await fetch(`${BASE_URL}/api/rest/system/partitions/purge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ partition_id: partitionId, mode }),
        });
        if (!res.ok) throw new Error('Failed to purge partition');
        return res.json();
    },

    /**
     * Khởi tạo một tiến trình mới và gắn pipe giám sát log theo thời gian thực.
     */
    spawnService: async (name: string, command: string, cwd?: string) => {
        const res = await fetch(`${BASE_URL}/api/rest/processes/spawn`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, command, cwd }),
        });
        if (!res.ok) throw new Error('Failed to spawn service');
        return res.json();
    },

    /**
     * Triển khai workflow chạy nền liên tục theo chu kỳ lặp.
     */
    deployWorkflow: async (payload: any) => {
        const res = await fetch(`${BASE_URL}/api/rest/workflows/deploy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return res.json();
    },

    /**
     * Chạy thử nghiệm toàn bộ đồ thị quy trình một lần duy nhất.
     */
    runWorkflowOnce: async (payload: any) => {
        const res = await fetch(`${BASE_URL}/api/rest/workflows/run-once`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return res.json();
    },

    /**
     * Thử nghiệm đơn lẻ một node hành động can thiệp (Action node).
     */
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

    /**
     * Dừng một workflow đang chạy nền.
     */
    stopWorkflow: async (workflowId: string) => {
        const res = await fetch(`${BASE_URL}/api/rest/workflows/${workflowId}/stop`, {
            method: 'POST',
        });
        return res.json();
    },

    /**
     * Lấy tình trạng hoạt động và số lần can thiệp của Auto-Guard.
     */
    getGuardStatus: async (): Promise<GuardStatus> => {
        const res = await fetch(`${BASE_URL}/api/rest/workflows/guard/status`);
        if (!res.ok) throw new Error('Failed to fetch guard status');
        return res.json();
    },

    /**
     * Đảo hoặc thiết lập trạng thái vũ trang (Armed) của Auto-Guard.
     */
    toggleGuard: async (armed?: boolean): Promise<{ guard_armed: boolean; status: string }> => {
        const res = await fetch(`${BASE_URL}/api/rest/workflows/guard/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ armed }),
        });
        if (!res.ok) throw new Error('Failed to toggle guard status');
        return res.json();
    },

    /**
     * Truy vấn nhật ký các sự cố vi phạm tài nguyên đã được ghi nhận.
     */
    getIncidents: async (limit = 50, severity?: string) => {
        const query = severity ? `?limit=${limit}&severity=${severity}` : `?limit=${limit}`;
        const res = await fetch(`${BASE_URL}/api/rest/workflows/incidents${query}`);
        if (!res.ok) throw new Error('Failed to fetch incidents');
        return res.json();
    },

    /**
     * Trả về URL tải tệp xuất khẩu báo cáo sự cố định dạng CSV hoặc JSON.
     */
    exportIncidentsUrl: (format = 'csv') => `${BASE_URL}/api/rest/workflows/incidents/export?format=${format}`,

    /**
     * Yêu cầu backend chụp ảnh màn hình desktop làm chứng cứ phân tích lỗi.
     */
    captureScreen: async () => {
        const res = await fetch(`${BASE_URL}/api/rest/workflows/incidents/capture-screen`, {
            method: 'POST',
        });
        if (!res.ok) throw new Error('Failed to capture screenshot');
        return res.json();
    },

    /**
     * Gửi tin nhắn kiểm thử cấu hình Webhook (Discord / Telegram / Slack).
     */
    testNotification: async (payload: any) => {
        const res = await fetch(`${BASE_URL}/api/rest/workflows/notifications/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to send test notification');
        return res.json();
    },

    /**
     * Lấy điểm số sức khỏe hệ thống và các gợi ý bảo dưỡng từ chuyên gia AI.
     */
    getSystemHealth: async () => {
        const res = await fetch(`${BASE_URL}/api/rest/system/health`);
        if (!res.ok) throw new Error('Failed to fetch system health');
        return res.json();
    },
};
