/**
 * Định nghĩa các kiểu dữ liệu hệ thống (TypeScript Interfaces) cho Compute Studio Workbench.
 * Bao gồm các thông số đo lường Telemetry, tiến trình, mạng, bộ nhớ và phân vùng lưu trữ.
 */

/**
 * Thông số đo lường hiệu năng của CPU.
 */
export interface CpuMetrics {
    /** Tỷ lệ tải CPU tổng thể hiện tại (0 - 100%) */
    percent: number;
    /** Tỷ lệ sử dụng riêng biệt cho từng lõi logic */
    per_core: number[];
    /** Xung nhịp hiện thời của CPU tính bằng MHz */
    freq_current_mhz: number;
    /** Xung nhịp tối đa của CPU tính bằng MHz */
    freq_max_mhz: number;
    /** Tổng số lượng lõi logic (Hyper-Threading) */
    logical_cores: number;
    /** Tổng số lượng lõi vật lý thực tế */
    physical_cores?: number;
}

/**
 * Thông số đo lường bộ nhớ RAM vật lý và Swap/Pagefile.
 */
export interface RamMetrics {
    /** Tổng dung lượng RAM vật lý tính theo Gigabytes (GB) */
    total_gb: number;
    /** Dung lượng RAM còn khả dụng tính theo Gigabytes (GB) */
    available_gb: number;
    /** Dung lượng RAM đang được sử dụng tính theo Gigabytes (GB) */
    used_gb: number;
    /** Tỷ lệ phần trăm RAM đang bị chiếm dụng */
    percent: number;
    /** Tỷ lệ phần trăm bộ nhớ ảo Swap/Pagefile đang dùng */
    swap_percent: number;
}

/**
 * Thông số đo lường card đồ họa GPU NVIDIA.
 */
export interface GpuMetrics {
    /** Chỉ số định danh thiết bị GPU trong hệ thống */
    id: number;
    /** Tên thương mại của card đồ họa (ví dụ: NVIDIA GeForce RTX 3080) */
    name: string;
    /** Tỷ lệ tải tính toán GPU Core (0 - 100%) */
    load_percent: number;
    /** Bộ nhớ đồ họa VRAM đã dùng (MB) */
    memory_used_mb: number;
    /** Tổng dung lượng VRAM có sẵn (MB) */
    memory_total_mb: number;
    /** Tỷ lệ phần trăm VRAM bị chiếm dụng */
    memory_percent: number;
    /** Nhiệt độ vận hành hiện tại tính bằng độ C */
    temp_c: number;
    /** Mức tiêu thụ điện năng tức thời (Watts) */
    power_watts?: number;
}

/**
 * Thông số đo lường lưu lượng đọc/ghi đĩa và băng thông mạng I/O.
 */
export interface DiskNetMetrics {
    /** Tỷ lệ phần trăm dung lượng ổ đĩa chính đã sử dụng */
    disk_usage_percent: number;
    /** Dung lượng trống còn lại trên ổ đĩa tính bằng GB */
    disk_free_gb: number;
    /** Tổng dung lượng dữ liệu mạng đã gửi đi từ lúc khởi động (MB) */
    net_bytes_sent_mb: number;
    /** Tổng dung lượng dữ liệu mạng đã nhận về từ lúc khởi động (MB) */
    net_bytes_recv_mb: number;
}

/**
 * Thông tin chi tiết của một tiến trình hệ điều hành (Process).
 */
export interface ProcessInfo {
    /** Mã định danh tiến trình duy nhất (Process ID) */
    pid: number;
    /** Tên tệp thực thi của tiến trình (ví dụ: node.exe, chrome.exe) */
    name: string;
    /** Tên tài khoản người dùng sở hữu tiến trình */
    username?: string;
    /** Trạng thái tiến trình (running, sleeping, suspended, etc.) */
    status: string;
    /** Tỷ lệ chiếm dụng CPU tức thời của tiến trình (%) */
    cpu_percent: number;
    /** Tỷ lệ chiếm dụng RAM vật lý so với tổng dung lượng máy (%) */
    memory_percent: number;
    /** Dung lượng RAM thực tế đang chiếm (Working Set RSS tính bằng MB) */
    memory_mb: number;
    /** Số lượng luồng (threads) đang xử lý song song */
    num_threads: number;
    /** Toàn bộ câu lệnh dòng lệnh kèm tham số khi khởi chạy */
    cmdline: string[];
    /** Danh sách các cổng mạng (TCP/UDP) mà tiến trình đang mở hoặc kết nối */
    open_ports: number[];
}

/**
 * Bản chụp nhanh trạng thái tài nguyên toàn hệ thống tại một thời điểm (Snapshot).
 */
export interface SystemSnapshot {
    /** Dấu thời gian Unix timestamp khi tạo bản chụp (giây) */
    timestamp: number;
    /** Chỉ số CPU */
    cpu: CpuMetrics;
    /** Chỉ số RAM */
    ram: RamMetrics;
    /** Danh sách các GPU NVIDIA trong hệ thống */
    gpus: GpuMetrics[];
    /** Chỉ số I/O Đĩa và Mạng */
    io: DiskNetMetrics;
    /** Danh sách các tiến trình hàng đầu tiêu thụ nhiều tài nguyên nhất */
    processes?: ProcessInfo[];
}

/**
 * Các thao tác điều khiển tiến trình hệ điều hành hỗ trợ.
 */
export type ProcessActionType = 'kill' | 'terminate' | 'suspend' | 'resume';

/**
 * Chi tiết kết nối socket mạng của tiến trình.
 */
export interface SocketConnectionItem {
    /** Giao thức mạng (TCP hoặc UDP) */
    protocol: string;
    /** Địa chỉ IP nội bộ */
    local_ip: string;
    /** Cổng lắng nghe / gửi cục bộ */
    local_port: number;
    /** Địa chỉ IP của máy chủ từ xa */
    remote_ip?: string | null;
    /** Cổng dịch vụ của máy chủ từ xa */
    remote_port?: number | null;
    /** Tên miền đã phân giải (Domain hostname) */
    remote_host?: string | null;
    /** URL đích hoặc endpoint dự đoán */
    url?: string | null;
    /** Trạng thái kết nối (ESTABLISHED, LISTEN, TIME_WAIT, etc.) */
    status: string;
    /** Phân loại kết nối: API / Database / External Web / Internal Service */
    category: string;
    /** Mô tả chức năng hoặc dịch vụ tương ứng */
    description?: string | null;
}

/**
 * Hồ sơ lưu lượng mạng của một tiến trình cụ thể.
 */
export interface ProcessNetworkProfile {
    /** Mã định danh tiến trình (PID) */
    pid: number;
    /** Tên tiến trình */
    name: string;
    /** Tổng số lượng kết nối socket đang mở */
    total_connections: number;
    /** Danh sách cổng đang mở ở chế độ lắng nghe (Listen) */
    listening_ports: number[];
    /** Danh sách các kết nối hướng ra ngoài (Outbound Sockets) */
    outbound_connections: SocketConnectionItem[];
    /** Danh sách các tên miền mà tiến trình đã liên lạc */
    domains_contacted: string[];
    /** Các nhóm phân loại mạng liên quan */
    categories: string[];
}

/**
 * Bản tóm tắt bức tranh toàn cảnh mạng và các kết nối API toàn hệ thống.
 */
export interface SystemNetworkSummary {
    /** Tổng số kết nối mạng đang hoạt động */
    total_active_connections: number;
    /** Số lượng tiến trình có kết nối mạng đang được giám sát */
    monitored_processes_count: number;
    /** Danh sách các tên miền được gọi nhiều nhất */
    top_domains: { domain: string; connections: number }[];
    /** Các tiến trình mở nhiều socket mạng nhất */
    top_processes: {
        pid: number;
        name: string;
        total_sockets: number;
        outbound_apis: number;
        listening: number;
    }[];
}

/**
 * Thông tin của một phân vùng bộ nhớ (Memory Partition) hoặc nhóm lưu trữ.
 */
export interface MemoryPartitionItem {
    /** Mã định danh phân vùng (ví dụ: standby-cache, app-ram, temp-cache) */
    id: string;
    /** Tên hiển thị của phân vùng */
    name: string;
    /** Phân loại bộ nhớ: RAM chủ động, RAM Cache, Bộ nhớ nhân, SSD, HDD, Tạm */
    category: 'RAM_ACTIVE' | 'RAM_CACHE' | 'RAM_KERNEL' | 'DISK_SSD' | 'DISK_HDD' | 'CACHE_TEMP';
    /** Loại lưu trữ vật lý: RAM, SWAP, SSD, HDD, VIRTUAL */
    storage_type: 'RAM' | 'SWAP' | 'SSD' | 'HDD' | 'VIRTUAL';
    /** Mức độ ưu tiên bảo vệ tài nguyên */
    priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
    /** Tổng kích thước phân vùng (MB) */
    total_mb: number;
    /** Dung lượng đã dùng (MB) */
    used_mb: number;
    /** Dung lượng trống (MB) */
    free_mb: number;
    /** Tỷ lệ phần trăm chiếm dụng (%) */
    usage_percent: number;
    /** Cho phép người dùng hoặc hệ thống kích hoạt dọn dẹp / giải phóng không */
    is_purgeable: boolean;
    /** Mã hành động giải phóng tương ứng khi bấm Purge */
    purge_action_id?: string | null;
    /** Mô tả vai trò và ý nghĩa của phân vùng */
    description: string;
    /** Vị trí đường dẫn thư mục vật lý (đối với Temp Cache/Dumps) */
    location?: string | null;
}

/**
 * Tổng quan toàn bộ các phân vùng bộ nhớ của hệ thống máy chủ / máy trạm.
 */
export interface SystemPartitionsOverview {
    /** Tổng dung lượng RAM (MB) */
    ram_total_mb: number;
    /** Dung lượng RAM đang dùng (MB) */
    ram_used_mb: number;
    /** Dung lượng RAM còn trống (MB) */
    ram_free_mb: number;
    /** Dung lượng bộ đệm Standby List có thể thu hồi ngay lập tức (MB) */
    standby_reclaimable_mb: number;
    /** Tổng dung lượng tất cả các ổ đĩa (GB) */
    disks_total_gb: number;
    /** Tổng dung lượng đĩa còn trống (GB) */
    disks_free_gb: number;
    /** Dung lượng bộ nhớ tạm (Temp Cache / Dumps) có thể xóa được (MB) */
    temp_cache_purgeable_mb: number;
    /** Danh sách từng phân vùng chi tiết */
    partitions: MemoryPartitionItem[];
}

/**
 * Kết quả sau khi thực hiện dọn dẹp một phân vùng bộ nhớ.
 */
export interface PartitionPurgeResult {
    /** Mã phân vùng vừa được dọn dẹp */
    partition_id: string;
    /** Trạng thái thao tác (success, error, etc.) */
    status: string;
    /** Dung lượng bộ nhớ thực tế đã giải phóng thành công (MB) */
    freed_mb: number;
    /** Thông điệp thông báo kết quả trả về cho người dùng */
    message: string;
}
