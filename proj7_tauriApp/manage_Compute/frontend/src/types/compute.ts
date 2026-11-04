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

export interface SystemSnapshot {
    timestamp: number;
    cpu: CpuMetrics;
    ram: RamMetrics;
    gpus: GpuMetrics[];
    io: DiskNetMetrics;
    processes?: ProcessInfo[];
}

export type ProcessActionType = 'kill' | 'terminate' | 'suspend' | 'resume';

export interface SocketConnectionItem {
    protocol: string;
    local_ip: string;
    local_port: number;
    remote_ip?: string | null;
    remote_port?: number | null;
    remote_host?: string | null;
    url?: string | null;
    status: string;
    category: string;
    description?: string | null;
}

export interface ProcessNetworkProfile {
    pid: number;
    name: string;
    total_connections: number;
    listening_ports: number[];
    outbound_connections: SocketConnectionItem[];
    domains_contacted: string[];
    categories: string[];
}

export interface SystemNetworkSummary {
    total_active_connections: number;
    monitored_processes_count: number;
    top_domains: { domain: string; connections: number }[];
    top_processes: {
        pid: number;
        name: string;
        total_sockets: number;
        outbound_apis: number;
        listening: number;
    }[];
}

export interface MemoryPartitionItem {
    id: string;
    name: string;
    category: 'RAM_ACTIVE' | 'RAM_CACHE' | 'RAM_KERNEL' | 'DISK_SSD' | 'DISK_HDD' | 'CACHE_TEMP';
    storage_type: 'RAM' | 'SWAP' | 'SSD' | 'HDD' | 'VIRTUAL';
    priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
    total_mb: number;
    used_mb: number;
    free_mb: number;
    usage_percent: number;
    is_purgeable: boolean;
    purge_action_id?: string | null;
    description: string;
    location?: string | null;
}

export interface SystemPartitionsOverview {
    ram_total_mb: number;
    ram_used_mb: number;
    ram_free_mb: number;
    standby_reclaimable_mb: number;
    disks_total_gb: number;
    disks_free_gb: number;
    temp_cache_purgeable_mb: number;
    partitions: MemoryPartitionItem[];
}

export interface PartitionPurgeResult {
    partition_id: string;
    status: string;
    freed_mb: number;
    message: string;
}
