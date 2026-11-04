import type { FC } from 'react';
import { SystemData } from '../types';
import {
  CpuIcon,
  MemoryIcon,
  DiskIcon,
  GpuIcon,
  ServerIcon,
  GlobeIcon,
  ShieldCheckIcon,
  SparklesIcon,
  ZapIcon,
  ActivityIcon,
} from './Icons';

interface OverviewTabProps {
  data: SystemData | null;
  isWorkerRunning: boolean;
  onToggleWorker: () => void;
  onTestPing: () => void;
  pingLatency: number | null;
  isPinging: boolean;
}

export const OverviewTab: FC<OverviewTabProps> = ({ data }) => {
  const cpuPercent = data?.cpu_percent ?? data?.hardware?.cpu?.percent ?? 0;
  const ramPercent = data?.ram_percent ?? data?.hardware?.memory?.percent ?? 0;
  const diskPercent = data?.disk_percent ?? data?.hardware?.disk?.[0]?.percent ?? 0;

  const hasGPU = Boolean(data?.has_gpu || data?.hardware?.gpu?.name);
  const gpuName = data?.gpu_name || data?.hardware?.gpu?.name || 'Không phát hiện GPU rời';
  const gpuVRAM = data?.vram_gb || data?.hardware?.gpu?.vram_gb || 0;
  const gpuPercent = data?.gpu_percent ?? data?.hardware?.gpu?.load_percent ?? 0;
  const gpuTemp = data?.gpu_temp ?? data?.hardware?.gpu?.temperature ?? 0;

  const isLLMRunning = Boolean(
    data?.is_llm_running || (data?.ollama_models && data.ollama_models.length > 0)
  );
  const modelsCount = data?.installed_models?.length ?? data?.ollama_models?.length ?? 0;
  const activeModel = data?.active_model ?? (data?.ollama_models?.[0] || 'Chưa nạp model');

  // Real-time LLM Inference & Activity Stats
  const llmStats = data?.llm_stats;
  const totalTokens = llmStats?.total_tokens ?? data?.llm_total_tokens ?? 0;
  const totalCalls = llmStats?.total_requests ?? data?.llm_total_requests ?? 0;
  const isBusy = Boolean(llmStats?.is_busy ?? data?.llm_is_busy);
  const activeRequests = llmStats?.active_requests ?? data?.llm_active_requests ?? 0;
  const tokensPerSec = llmStats?.tokens_per_sec ?? data?.llm_tokens_per_sec ?? 0;
  const lastLatencyMs = llmStats?.last_latency_ms ?? 0;

  const totalRAMGB = data?.hardware?.memory?.total
    ? (data.hardware.memory.total / 1024 ** 3).toFixed(1)
    : '--';
  const usedRAMGB = data?.hardware?.memory?.used
    ? (data.hardware.memory.used / 1024 ** 3).toFixed(1)
    : '--';

  return (
    <div className="space-y-3">
      {/* 1. Postman Workspace Environment & Host Summary Banner */}
      <div className="bg-[#212121] border border-[#303030] rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-7 h-7 rounded bg-[#ff6c37]/15 border border-[#ff6c37]/30 flex items-center justify-center text-[#ff6c37]">
            <ServerIcon className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-white font-bold text-xs tracking-wide">
                {data?.os?.hostname || 'LOCAL COMPUTING NODE'}
              </span>
              <span className="px-2 py-0.2 rounded text-[10px] font-mono bg-[#282828] text-gray-300 border border-[#383838]">
                {data?.nodeId ? `ID: ${data.nodeId}` : 'ID: node_default'}
              </span>
            </div>
            <div className="flex items-center space-x-3 text-xs text-gray-400 mt-0.5 font-mono">
              <span className="flex items-center space-x-1">
                <GlobeIcon className="w-3 h-3 text-gray-500" />
                <span>
                  {data?.location?.city
                    ? `${data.location.city}, ${data.location.country}`
                    : 'Cục bộ / Mạng nội bộ (Hà Nội, VN)'}
                </span>
              </span>
              <span>•</span>
              <span>OS: {data?.os?.platform || 'Windows'} ({data?.os?.architecture || 'x64'})</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-[11px] font-mono text-gray-400">
          <div>
            <span className="text-gray-500 block text-[9px]">TIẾN TRÌNH</span>
            <span className="text-white font-semibold">Daemon Active</span>
          </div>
          <div className="h-4 w-[1px] bg-[#333]" />
          <div>
            <span className="text-gray-500 block text-[9px]">LẦN ĐỒNG BỘ</span>
            <span className="text-white font-semibold">
              {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. REAL-TIME LOCAL LLM WORK TRACKER & INFERENCE STATUS (Yêu cầu hiển thị số lượng token, lượt gọi, trạng thái làm việc) */}
      <div className="bg-[#212121] border border-[#303030] rounded-lg p-3.5 space-y-3 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2d2d2d] pb-2.5">
          <div className="flex items-center space-x-2.5">
            <div
              className={`w-7 h-7 rounded flex items-center justify-center shrink-0 border ${
                isBusy
                  ? 'bg-[#ff6c37]/20 border-[#ff6c37] text-[#ff6c37] animate-pulse'
                  : isLLMRunning
                  ? 'bg-emerald-950/60 border-emerald-700/50 text-[#10b981]'
                  : 'bg-amber-950/60 border-amber-700/50 text-amber-400'
              }`}
            >
              <SparklesIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-white font-bold text-xs uppercase tracking-wide">
                  Ollama Local LLM Activity & Work Status
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                    isBusy
                      ? 'bg-[#ff6c37]/20 text-[#ff7a45] border-[#ff6c37] animate-pulse'
                      : isLLMRunning
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                      : 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                  }`}
                >
                  {isBusy ? 'ĐANG SINH TOKEN (BUSY)' : isLLMRunning ? 'SẴN SÀNG NHẬN LỆNH (IDLE)' : 'CHƯA KHỞI CHẠY'}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Mô hình đang phục vụ: <strong className="text-gray-200 font-mono font-medium">{activeModel}</strong> ({modelsCount} models sẵn có)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-[11px] font-mono">
            <span className="text-gray-400">Card đồ họa:</span>
            <span className="text-white font-semibold bg-[#181818] px-2 py-0.5 rounded border border-[#303030]">
              {hasGPU ? gpuName : 'CPU Emulation'}
            </span>
          </div>
        </div>

        {/* 4 Cards: Tokens, Calls, Tokens/s, Latency */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Total Tokens Card */}
          <div className="bg-[#181818] border border-[#2d2d2d] rounded-lg p-2.5 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
              <span className="uppercase">Tổng Token Đã Xử Lý</span>
              <SparklesIcon className="w-3 h-3 text-[#ff6c37]" />
            </div>
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-black text-white font-mono tracking-tight">
                {totalTokens.toLocaleString()}
              </span>
              <span className="text-[10px] text-[#ff6c37] font-mono">tokens</span>
            </div>
            <div className="text-[9px] text-gray-500 font-mono truncate">
              Out: {llmStats?.completion_tokens?.toLocaleString() || 0} | In: {llmStats?.prompt_tokens?.toLocaleString() || 0}
            </div>
          </div>

          {/* Total Requests Card */}
          <div className="bg-[#181818] border border-[#2d2d2d] rounded-lg p-2.5 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
              <span className="uppercase">Số Lần Gọi LLM</span>
              <ActivityIcon className="w-3 h-3 text-[#38bdf8]" />
            </div>
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-black text-[#38bdf8] font-mono tracking-tight">
                {totalCalls}
              </span>
              <span className="text-[10px] text-gray-400 font-mono">lượt</span>
            </div>
            <div className="text-[9px] text-gray-500 font-mono">
              {activeRequests > 0 ? (
                <span className="text-[#ff7a45] font-bold animate-pulse">{activeRequests} task đang chạy</span>
              ) : (
                '0 task đang chờ'
              )}
            </div>
          </div>

          {/* Tokens Per Second Card */}
          <div className="bg-[#181818] border border-[#2d2d2d] rounded-lg p-2.5 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
              <span className="uppercase">Tốc Độ Sinh Token</span>
              <ZapIcon className="w-3 h-3 text-[#10b981]" />
            </div>
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-black text-[#10b981] font-mono tracking-tight">
                {tokensPerSec > 0 ? tokensPerSec.toFixed(1) : '--'}
              </span>
              <span className="text-[10px] text-gray-400 font-mono">tokens/s</span>
            </div>
            <div className="text-[9px] text-gray-500 font-mono">
              {isBusy ? 'Đang stream token...' : 'Tốc độ lượt gần nhất'}
            </div>
          </div>

          {/* Latency Card */}
          <div className="bg-[#181818] border border-[#2d2d2d] rounded-lg p-2.5 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
              <span className="uppercase">Độ Trễ Phản Hồi</span>
              <ShieldCheckIcon className="w-3 h-3 text-[#a855f7]" />
            </div>
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-black text-[#a855f7] font-mono tracking-tight">
                {lastLatencyMs > 0 ? lastLatencyMs : '--'}
              </span>
              <span className="text-[10px] text-gray-400 font-mono">ms</span>
            </div>
            <div className="text-[9px] text-gray-500 font-mono">
              Thời gian xử lý vòng đời
            </div>
          </div>
        </div>
      </div>

      {/* 3. 4 Primary Hardware Metric Cards (Postman Clean Dark Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* CPU Usage Card */}
        <div className="bg-[#212121] border border-[#303030] rounded-lg p-3 flex flex-col justify-between space-y-2 hover:border-[#404040] transition shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1.5 text-gray-300 font-semibold uppercase tracking-wider text-[11px]">
              <CpuIcon className="w-3.5 h-3.5 text-[#ff6c37]" />
              <span>CPU</span>
            </div>
            <span className="text-[10px] font-mono text-gray-400 bg-[#1a1a1a] px-1.5 py-0.5 rounded border border-[#333]">
              {data?.hardware?.cpu?.count_logical || 4} Cores
            </span>
          </div>

          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-white font-mono tracking-tight">
              {cpuPercent.toFixed(1)}
            </span>
            <span className="text-xs text-[#ff6c37] font-mono font-bold">% Tải</span>
            {data?.hardware?.cpu?.freq_current && (
              <span className="text-[10px] text-gray-500 font-mono ml-auto">
                {data.hardware.cpu.freq_current} MHz
              </span>
            )}
          </div>

          <div className="w-full bg-[#181818] rounded-full h-1.5 overflow-hidden border border-[#2d2d2d]">
            <div
              className="bg-[#ff6c37] h-full transition-all duration-300 rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, cpuPercent))}%` }}
            />
          </div>
        </div>

        {/* RAM Memory Card */}
        <div className="bg-[#212121] border border-[#303030] rounded-lg p-3 flex flex-col justify-between space-y-2 hover:border-[#404040] transition shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1.5 text-gray-300 font-semibold uppercase tracking-wider text-[11px]">
              <MemoryIcon className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>RAM</span>
            </div>
            <span className="text-[10px] font-mono text-gray-400 bg-[#1a1a1a] px-1.5 py-0.5 rounded border border-[#333]">
              {usedRAMGB} / {totalRAMGB} GB
            </span>
          </div>

          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-[#38bdf8] font-mono tracking-tight">
              {ramPercent.toFixed(1)}
            </span>
            <span className="text-xs text-[#38bdf8] font-mono font-bold">% Dùng</span>
          </div>

          <div className="w-full bg-[#181818] rounded-full h-1.5 overflow-hidden border border-[#2d2d2d]">
            <div
              className="bg-[#38bdf8] h-full transition-all duration-300 rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, ramPercent))}%` }}
            />
          </div>
        </div>

        {/* Disk Storage Card */}
        <div className="bg-[#212121] border border-[#303030] rounded-lg p-3 flex flex-col justify-between space-y-2 hover:border-[#404040] transition shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1.5 text-gray-300 font-semibold uppercase tracking-wider text-[11px]">
              <DiskIcon className="w-3.5 h-3.5 text-[#a855f7]" />
              <span>Ổ ĐĨA</span>
            </div>
            <span className="text-[10px] font-mono text-gray-400 bg-[#1a1a1a] px-1.5 py-0.5 rounded border border-[#333]">
              {data?.hardware?.disk?.[0]?.mountpoint || 'C:'}
            </span>
          </div>

          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-[#a855f7] font-mono tracking-tight">
              {diskPercent.toFixed(1)}
            </span>
            <span className="text-xs text-[#a855f7] font-mono font-bold">% Chiếm</span>
          </div>

          <div className="w-full bg-[#181818] rounded-full h-1.5 overflow-hidden border border-[#2d2d2d]">
            <div
              className="bg-[#a855f7] h-full transition-all duration-300 rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, diskPercent))}%` }}
            />
          </div>
        </div>

        {/* GPU Acceleration Card */}
        <div className="bg-[#212121] border border-[#303030] rounded-lg p-3 flex flex-col justify-between space-y-2 hover:border-[#404040] transition shadow-sm">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1.5 text-gray-300 font-semibold uppercase tracking-wider text-[11px]">
              <GpuIcon className={`w-3.5 h-3.5 ${hasGPU ? 'text-[#10b981]' : 'text-gray-500'}`} />
              <span>GPU</span>
            </div>
            <span
              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                hasGPU
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                  : 'bg-[#1a1a1a] text-gray-500 border-[#333]'
              }`}
            >
              {hasGPU ? `${gpuVRAM} GB VRAM` : 'CPU Only'}
            </span>
          </div>

          <div className="flex items-baseline space-x-1.5">
            {hasGPU ? (
              <>
                <span className="text-2xl font-black text-[#10b981] font-mono tracking-tight">
                  {gpuPercent.toFixed(1)}
                </span>
                <span className="text-xs text-[#10b981] font-mono font-bold">% Tải</span>
                {gpuTemp > 0 && (
                  <span className="text-[10px] text-gray-500 font-mono ml-auto">
                    {gpuTemp}°C
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs text-gray-500 italic py-0.5">Không có GPU rời</span>
            )}
          </div>

          <div className="w-full bg-[#181818] rounded-full h-1.5 overflow-hidden border border-[#2d2d2d]">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                hasGPU ? 'bg-[#10b981]' : 'bg-[#2a2a2a]'
              }`}
              style={{ width: `${hasGPU ? Math.min(100, Math.max(0, gpuPercent)) : 0}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
