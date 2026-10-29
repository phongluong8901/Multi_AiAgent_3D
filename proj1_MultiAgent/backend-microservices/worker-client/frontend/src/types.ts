export interface WindowWithElectron extends Window {
  require?: (module: string) => {
    ipcRenderer: {
      send: (channel: string, ...args: unknown[]) => void;
      on: (channel: string, listener: (...args: unknown[]) => void) => void;
      invoke: (channel: string, ...args: unknown[]) => Promise<any>;
    };
  };
}

export interface CpuInfo {
  percent: number;
  count_logical: number;
  count_physical: number | null;
  freq_current: number | null;
  freq_max: number | null;
}

export interface MemoryInfo {
  total: number;
  available: number;
  used: number;
  percent: number;
}

export interface DiskInfo {
  device: string;
  mountpoint: string;
  fstype: string;
  total: number;
  used: number;
  free: number;
  percent: number;
}

export interface NetworkInfo {
  bytes_sent: number;
  bytes_recv: number;
  packets_sent: number;
  packets_recv: number;
}

export interface BatteryInfo {
  percent: number;
  plugged: boolean;
  secsleft: number | null;
}

export interface GpuInfo {
  name: string;
  vram_gb: number;
  load_percent: number;
  temperature: number;
}

export interface HardwareInfo {
  cpu: CpuInfo;
  memory: MemoryInfo;
  disk: DiskInfo[];
  network: NetworkInfo;
  battery: BatteryInfo | null;
  gpu?: GpuInfo | null;
}

export interface OsInfo {
  hostname: string;
  platform: string;
  release: string;
  version: string;
  architecture: string;
  processor: string;
  boot_time: string;
}

export interface LocationInfo {
  lat: number;
  lon: number;
  city?: string;
  region?: string;
  country?: string;
  ip?: string;
  isp?: string;
  source?: string;
}

export interface LLMActivityStats {
  total_requests: number;
  active_requests: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  tokens_per_sec: number;
  last_latency_ms: number;
  current_model: string;
  is_busy: boolean;
  status: string;
}

export interface SystemData {
  type: string;
  nodeId?: string;
  timestamp: string;
  hardware: HardwareInfo;
  has_gpu?: boolean;
  gpu_name?: string;
  vram_gb?: number;
  is_llm_running?: boolean;
  ollama_running?: boolean;
  llm_provider?: string;
  ollama_models?: string[];
  installed_models?: string[];
  active_model?: string;
  os: OsInfo;
  location: LocationInfo | null;
  cpu_percent?: number;
  ram_percent?: number;
  disk_percent?: number;
  gpu_percent?: number;
  gpu_temp?: number;
  llm_stats?: LLMActivityStats;
  llm_total_tokens?: number;
  llm_total_requests?: number;
  llm_active_requests?: number;
  llm_is_busy?: boolean;
  llm_tokens_per_sec?: number;
}

export type TabType = 'overview' | 'map' | 'detail' | 'config';

export interface WorkerConfig {
  serverWsUrl: string;
  authToken: string;
  nodeId: string;
  localEndpoint: string;
  allocatedCores: number;
  allocatedRAMGB: number;
  enableGPU: boolean;
  gpuSharePercent: number;
  minPricePerHourCoin?: number;
  maxTokens?: number;
  contextLength?: number;
  temperature?: number;
  defaultModel?: string;
  maxConcurrentTasks?: number;
}

