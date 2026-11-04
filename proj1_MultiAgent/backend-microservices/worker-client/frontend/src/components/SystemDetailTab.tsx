import type { FC } from 'react';
import { SystemData } from '../types';
import {
  CpuIcon,
  MemoryIcon,
  DiskIcon,
  GpuIcon,
  ServerIcon,
} from './Icons';

interface SystemDetailTabProps {
  data: SystemData | null;
}

export const SystemDetailTab: FC<SystemDetailTabProps> = ({ data }) => {
  const hw = data?.hardware;
  const os = data?.os;
  const hasGPU = Boolean(data?.has_gpu || hw?.gpu?.name);

  return (
    <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
      {/* CPU & Memory Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* CPU Specs */}
        <div className="bg-[#212121] border border-[#303030] rounded-lg p-3.5 space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#2d2d2d] pb-2">
            <span className="text-white font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5">
              <CpuIcon className="w-3.5 h-3.5 text-[#ff6c37]" />
              <span>Bộ Xử Lý (CPU)</span>
            </span>
            <span className="text-xs font-mono text-[#ff6c37] font-bold">
              {hw?.cpu?.percent?.toFixed(1) || 0}% Tải
            </span>
          </div>

          <div className="space-y-1.5 text-xs text-gray-300">
            <div className="flex justify-between">
              <span className="text-gray-400">Mô hình:</span>
              <span className="font-semibold text-white truncate max-w-[220px]" title={os?.processor}>
                {os?.processor || 'AMD / Intel Processor'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Luồng Logic (Logical Cores):</span>
              <strong className="text-white font-mono">{hw?.cpu?.count_logical || '--'} Cores</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Nhân Vật Lý (Physical Cores):</span>
              <strong className="text-white font-mono">{hw?.cpu?.count_physical || '--'} Cores</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Xung Nhịp Hiện Tại:</span>
              <strong className="text-white font-mono">
                {hw?.cpu?.freq_current ? `${hw.cpu.freq_current} MHz` : '--'}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Xung Nhịp Tối Đa:</span>
              <strong className="text-white font-mono">
                {hw?.cpu?.freq_max ? `${hw.cpu.freq_max} MHz` : '--'}
              </strong>
            </div>
          </div>
        </div>

        {/* Memory Specs */}
        <div className="bg-[#212121] border border-[#303030] rounded-lg p-3.5 space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#2d2d2d] pb-2">
            <span className="text-white font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5">
              <MemoryIcon className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>Bộ Nhớ RAM</span>
            </span>
            <span className="text-xs font-mono text-[#38bdf8] font-bold">
              {hw?.memory?.percent?.toFixed(1) || 0}% Sử dụng
            </span>
          </div>

          <div className="space-y-1.5 text-xs text-gray-300">
            <div className="flex justify-between">
              <span className="text-gray-400">Tổng RAM:</span>
              <strong className="text-white font-mono">
                {hw?.memory?.total ? `${(hw.memory.total / 1024 ** 3).toFixed(2)} GB` : '--'}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Đã Dùng:</span>
              <strong className="text-[#38bdf8] font-mono">
                {hw?.memory?.used ? `${(hw.memory.used / 1024 ** 3).toFixed(2)} GB` : '--'}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Khả Dụng:</span>
              <strong className="text-[#10b981] font-mono">
                {hw?.memory?.available ? `${(hw.memory.available / 1024 ** 3).toFixed(2)} GB` : '--'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* GPU & Storage Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* GPU Details */}
        <div className="bg-[#212121] border border-[#303030] rounded-lg p-3.5 space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#2d2d2d] pb-2">
            <span className="text-white font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5">
              <GpuIcon className="w-3.5 h-3.5 text-[#10b981]" />
              <span>Card Đồ Họa (GPU)</span>
            </span>
            <span
              className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                hasGPU
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                  : 'bg-[#181818] text-gray-500 border-[#333]'
              }`}
            >
              {hasGPU ? 'GPU Acceleration' : 'CPU Mode'}
            </span>
          </div>

          <div className="space-y-1.5 text-xs text-gray-300">
            <div className="flex justify-between">
              <span className="text-gray-400">Model:</span>
              <span className="font-semibold text-white truncate max-w-[220px]">
                {hasGPU ? hw?.gpu?.name : 'Không phát hiện card rời'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Bộ nhớ VRAM:</span>
              <strong className="text-white font-mono">{hasGPU ? `${hw?.gpu?.vram_gb} GB` : '0 GB'}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Tỷ lệ tải GPU:</span>
              <strong className="text-[#10b981] font-mono">{hasGPU ? `${hw?.gpu?.load_percent}%` : '--'}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Nhiệt độ nhân:</span>
              <strong className="text-white font-mono">{hasGPU && hw?.gpu?.temperature ? `${hw.gpu.temperature}°C` : '--'}</strong>
            </div>
          </div>
        </div>

        {/* Disk Partitions */}
        <div className="bg-[#212121] border border-[#303030] rounded-lg p-3.5 space-y-2.5">
          <div className="flex items-center justify-between border-b border-[#2d2d2d] pb-2">
            <span className="text-white font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5">
              <DiskIcon className="w-3.5 h-3.5 text-[#a855f7]" />
              <span>Phân Vùng Ổ Đĩa</span>
            </span>
            <span className="text-xs font-mono text-[#a855f7] font-bold">
              {hw?.disk?.length || 0} Phân Vùng
            </span>
          </div>

          <div className="space-y-2 max-h-36 overflow-y-auto">
            {hw?.disk?.map((d, i) => (
              <div key={i} className="bg-[#181818] p-2 rounded border border-[#2d2d2d] text-xs space-y-1">
                <div className="flex justify-between font-mono">
                  <span className="font-bold text-white">{d.mountpoint} ({d.fstype})</span>
                  <span className="text-[#a855f7]">{d.percent}%</span>
                </div>
                <div className="w-full bg-[#121212] rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-[#a855f7] h-full rounded-full"
                    style={{ width: `${d.percent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                  <span>Dùng: {(d.used / 1024 ** 3).toFixed(1)} GB</span>
                  <span>Tổng: {(d.total / 1024 ** 3).toFixed(1)} GB</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* OS & Network Information */}
      <div className="bg-[#212121] border border-[#303030] rounded-lg p-3.5 space-y-2.5">
        <div className="flex items-center space-x-2 border-b border-[#2d2d2d] pb-2">
          <ServerIcon className="w-3.5 h-3.5 text-[#ff6c37]" />
          <span className="text-white font-bold text-xs uppercase tracking-wider">
            Thông Tin Hệ Điều Hành & Mạng
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-gray-400 block text-[10px]">TÊN MÁY:</span>
            <strong className="text-white">{os?.hostname || '--'}</strong>
          </div>
          <div>
            <span className="text-gray-400 block text-[10px]">HỆ ĐIỀU HÀNH:</span>
            <strong className="text-white">{os?.platform} {os?.release}</strong>
          </div>
          <div>
            <span className="text-gray-400 block text-[10px]">KIẾN TRÚC:</span>
            <strong className="text-white">{os?.architecture || '--'}</strong>
          </div>
          <div>
            <span className="text-gray-400 block text-[10px]">THỜI GIAN BOOT:</span>
            <strong className="text-white font-mono text-[11px]">{os?.boot_time || '--'}</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
