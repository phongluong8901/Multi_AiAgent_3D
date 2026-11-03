export interface CpuMetrics {
    percent: number;
    per_core: number[];
    freq_current_mhz: number;
    freq_max_mhz: number;
    logical_cores: number;
    physical_cores?: number;
}

export interface RamMetrics {
    total_gb: number;
    available_gb: number;
    used_gb: number;
    percent: number;
    swap_percent: number;
}

export interface GpuMetrics {
    id: number;
    name: string;
    load_percent: number;
    memory_used_mb: number;
    memory_total_mb: number;
    memory_percent: number;
    temp_c: number;
    power_watts?: number;
}

export interface DiskNetMetrics {
    disk_usage_percent: number;
    disk_free_gb: number;
    net_bytes_sent_mb: number;
    net_bytes_recv_mb: number;
}

export interface SystemSnapshot {
    timestamp: number;
    cpu: CpuMetrics;
    ram: RamMetrics;
    gpus: GpuMetrics[];
    io: DiskNetMetrics;
}

export interface ProcessInfo {
    pid: number;
    name: string;
    username?: string;
    status: string;
    cpu_percent: number;
    memory_percent: number;
    memory_mb: number;
    num_threads: number;
    cmdline: string[];
    open_ports: number[];
}

export type ProcessActionType = 'kill' | 'terminate' | 'suspend' | 'resume';