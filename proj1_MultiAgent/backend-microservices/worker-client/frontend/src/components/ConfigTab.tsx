import type { FC, Dispatch, SetStateAction } from 'react';
import { WorkerConfig, SystemData } from '../types';
import { SlidersIcon, ShieldCheckIcon, CheckCircleIcon, GpuIcon, CpuIcon, MemoryIcon, SparklesIcon, ZapIcon } from './Icons';

interface ConfigTabProps {
  config: WorkerConfig;
  setConfig: Dispatch<SetStateAction<WorkerConfig>>;
  data: SystemData | null;
  saveSuccess: boolean;
  handleSaveConfig: () => void;
}

export const ConfigTab: FC<ConfigTabProps> = ({
  config,
  setConfig,
  data,
  saveSuccess,
  handleSaveConfig,
}) => {
  const hasGPU = Boolean(data?.has_gpu || data?.hardware?.gpu?.name);
  const totalCores = data?.hardware?.cpu?.count_logical || 16;
  const totalRAMGB = Math.round((data?.hardware?.memory?.total || 16 * 1024 ** 3) / 1024 ** 3);
  const installedModels = data?.installed_models || [];

  // If machine has no physical GPU, ensure enableGPU remains disabled
  const isGPUEnabled = hasGPU && config.enableGPU;

  return (
    <div className="bg-[#212121] border border-[#303030] rounded-lg p-5 space-y-5 max-h-[520px] overflow-y-auto">
      <div className="flex items-center space-x-3 border-b border-[#303030] pb-3">
        <div className="w-8 h-8 rounded bg-[#ff6c37]/15 border border-[#ff6c37]/30 flex items-center justify-center text-[#ff6c37]">
          <SlidersIcon className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-white font-bold text-sm tracking-wide">
            Cấu Hình Kết Nối & Giới Hạn Tài Nguyên
          </h2>
          <p className="text-gray-400 text-xs">
            Điều chỉnh thông số mạng WebSocket, Auth Token xác thực, tỷ lệ phần cứng và tham số LLM Local cho phép mạng lưới khai thác.
          </p>
        </div>
      </div>

      {/* Network & Auth Inputs */}
      <div className="space-y-3 text-xs">
        <div>
          <label className="text-gray-300 font-semibold block mb-1">
            Mã Auth Token Đối Tác (Bắt buộc để liên kết với Web):
          </label>
          <input
            type="text"
            value={config.authToken}
            onChange={(e) => setConfig({ ...config, authToken: e.target.value.trim() })}
            placeholder="dist_xxxxxx (Lấy trên trang Kiểm Tra Node AI)"
            className="w-full bg-[#181818] border border-[#383838] rounded-md px-3 py-2 text-white font-mono text-xs focus:border-[#ff6c37] focus:outline-none transition"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-gray-300 font-semibold block mb-1">
              Node ID (Định danh máy trạm):
            </label>
            <input
              type="text"
              value={config.nodeId}
              onChange={(e) => setConfig({ ...config, nodeId: e.target.value.trim() })}
              placeholder="node_usr_seller_01"
              className="w-full bg-[#181818] border border-[#383838] rounded-md px-3 py-2 text-white font-mono text-xs focus:border-[#ff6c37] focus:outline-none transition"
            />
          </div>

          <div>
            <label className="text-gray-300 font-semibold block mb-1">
              WebSocket Server Endpoint:
            </label>
            <input
              type="text"
              value={config.serverWsUrl}
              onChange={(e) => setConfig({ ...config, serverWsUrl: e.target.value.trim() })}
              placeholder="ws://localhost:4000/api/v1/distributed/ws"
              className="w-full bg-[#181818] border border-[#383838] rounded-md px-3 py-2 text-white font-mono text-xs focus:border-[#ff6c37] focus:outline-none transition"
            />
          </div>
        </div>

        <div>
          <label className="text-gray-300 font-semibold block mb-1">
            Ollama Endpoint (Địa chỉ API mô hình AI cục bộ):
          </label>
          <input
            type="text"
            value={config.localEndpoint}
            onChange={(e) => setConfig({ ...config, localEndpoint: e.target.value.trim() })}
            placeholder="http://localhost:11434"
            className="w-full bg-[#181818] border border-[#383838] rounded-md px-3 py-2 text-white font-mono text-xs focus:border-[#ff6c37] focus:outline-none transition"
          />
        </div>
      </div>

      <hr className="border-[#303030]" />

      {/* LLM LOCAL SERVING CONFIGURATION */}
      <div className="space-y-3.5 text-xs">
        <h3 className="text-white font-bold text-xs uppercase tracking-wider flex items-center space-x-2">
          <SparklesIcon className="w-4 h-4 text-[#ff6c37]" />
          <span>Cấu Hình Tham Số Mô Hình AI (Ollama Local LLM)</span>
        </h3>

        <div className="bg-[#181818] p-3 rounded-md border border-[#303030] space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-gray-300 font-medium block mb-1">
                Model mặc định phục vụ tính toán P2P:
              </label>
              {installedModels.length > 0 ? (
                <select
                  value={config.defaultModel || installedModels[0]}
                  onChange={(e) => setConfig({ ...config, defaultModel: e.target.value })}
                  className="w-full bg-[#262626] border border-[#383838] rounded-md px-2.5 py-1.5 text-white font-mono text-xs focus:border-[#ff6c37] focus:outline-none"
                >
                  {installedModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={config.defaultModel || 'qwen2.5-coder:1.5b'}
                  onChange={(e) => setConfig({ ...config, defaultModel: e.target.value.trim() })}
                  placeholder="qwen2.5-coder:1.5b"
                  className="w-full bg-[#262626] border border-[#383838] rounded-md px-2.5 py-1.5 text-white font-mono text-xs focus:border-[#ff6c37] focus:outline-none"
                />
              )}
            </div>

            <div>
              <label className="text-gray-300 font-medium block mb-1">
                Số tác vụ xử lý đồng thời (Concurrent Tasks):
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={config.maxConcurrentTasks ?? 2}
                  onChange={(e) => setConfig({ ...config, maxConcurrentTasks: Math.max(1, Math.min(4, Number(e.target.value))) })}
                  className="w-24 bg-[#262626] border border-[#383838] rounded-md px-2.5 py-1.5 text-white font-mono text-xs focus:border-[#ff6c37] focus:outline-none"
                />
                <span className="text-gray-400 text-[11px]">(Tối đa 4 task cùng lúc)</span>
              </div>
            </div>
          </div>

          {/* Max Tokens Slider */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-gray-300">
              <span className="flex items-center space-x-1.5">
                <ZapIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>Max Tokens tối đa mỗi câu hỏi:</span>
              </span>
              <span className="font-mono text-amber-400 font-bold bg-[#262626] border border-[#383838] px-2 py-0.5 rounded text-[11px]">
                {config.maxTokens ?? 2048} tokens
              </span>
            </div>
            <input
              type="range"
              min={256}
              max={8192}
              step={256}
              value={config.maxTokens ?? 2048}
              onChange={(e) => setConfig({ ...config, maxTokens: Number(e.target.value) })}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          {/* Context Length Slider */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-gray-300">
              <span className="flex items-center space-x-1.5">
                <SlidersIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>Độ dài ngữ cảnh (Context Window):</span>
              </span>
              <span className="font-mono text-emerald-400 font-bold bg-[#262626] border border-[#383838] px-2 py-0.5 rounded text-[11px]">
                {config.contextLength ?? 4096} tokens
              </span>
            </div>
            <input
              type="range"
              min={1024}
              max={16384}
              step={1024}
              value={config.contextLength ?? 4096}
              onChange={(e) => setConfig({ ...config, contextLength: Number(e.target.value) })}
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>

          {/* Temperature Slider */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-gray-300">
              <span className="flex items-center space-x-1.5">
                <SlidersIcon className="w-3.5 h-3.5 text-purple-400" />
                <span>Độ sáng tạo / Ngẫu nhiên (Temperature):</span>
              </span>
              <span className="font-mono text-purple-400 font-bold bg-[#262626] border border-[#383838] px-2 py-0.5 rounded text-[11px]">
                {(config.temperature ?? 0.7).toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.0}
              max={1.0}
              step={0.05}
              value={config.temperature ?? 0.7}
              onChange={(e) => setConfig({ ...config, temperature: Number(e.target.value) })}
              className="w-full accent-purple-400 cursor-pointer"
            />
          </div>
        </div>
      </div>

      <hr className="border-[#303030]" />

      {/* Resource Allocation Sliders */}
      <div className="space-y-3.5 text-xs">
        <h3 className="text-white font-bold text-xs uppercase tracking-wider flex items-center space-x-2">
          <ShieldCheckIcon className="w-4 h-4 text-[#10b981]" />
          <span>Hạn Mức Phần Cứng Chia Sẻ Cho P2P</span>
        </h3>

        {/* CPU Cores Slider */}
        <div className="bg-[#181818] p-3 rounded-md border border-[#303030] space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-300 flex items-center space-x-1.5 font-medium">
              <CpuIcon className="w-3.5 h-3.5 text-[#ff6c37]" />
              <span>Số lượng CPU Cores cấp phát:</span>
            </span>
            <span className="font-mono text-[#ff6c37] font-bold bg-[#262626] border border-[#383838] px-2 py-0.5 rounded text-[11px]">
              {config.allocatedCores} / {totalCores} Cores
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={totalCores}
            value={config.allocatedCores}
            onChange={(e) => setConfig({ ...config, allocatedCores: Number(e.target.value) })}
            className="w-full accent-[#ff6c37] cursor-pointer"
          />
        </div>

        {/* RAM Limit Slider */}
        <div className="bg-[#181818] p-3 rounded-md border border-[#303030] space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-300 flex items-center space-x-1.5 font-medium">
              <MemoryIcon className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>Dung lượng RAM tối đa cấp phát:</span>
            </span>
            <span className="font-mono text-[#38bdf8] font-bold bg-[#262626] border border-[#383838] px-2 py-0.5 rounded text-[11px]">
              {config.allocatedRAMGB} / {totalRAMGB} GB
            </span>
          </div>
          <input
            type="range"
            min={2}
            max={totalRAMGB}
            value={config.allocatedRAMGB}
            onChange={(e) => setConfig({ ...config, allocatedRAMGB: Number(e.target.value) })}
            className="w-full accent-[#38bdf8] cursor-pointer"
          />
        </div>

        {/* GPU Sharing Toggle */}
        <div className="bg-[#181818] p-3 rounded-md border border-[#303030] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <GpuIcon className={`w-4 h-4 ${hasGPU ? 'text-[#10b981]' : 'text-gray-500'}`} />
              <span className="font-semibold text-gray-200">
                Cho phép chia sẻ Card Đồ Họa (GPU Acceleration):
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                disabled={!hasGPU}
                checked={isGPUEnabled}
                onChange={(e) => setConfig({ ...config, enableGPU: e.target.checked })}
                className="sr-only peer"
              />
              <div
                className={`w-10 h-5 bg-[#303030] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all ${hasGPU ? 'peer-checked:bg-[#10b981]' : 'opacity-40 cursor-not-allowed'
                  }`}
              />
            </label>
          </div>

          {!hasGPU && (
            <p className="text-[11px] text-amber-400/90 italic">
              [LƯU Ý] Không phát hiện GPU rời. Chế độ tính toán tự động hoạt động trên CPU.
            </p>
          )}

          {hasGPU && isGPUEnabled && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-gray-300 text-xs">
                <span>Tỷ lệ tải GPU cho phép:</span>
                <span className="font-mono text-[#10b981] font-bold">{config.gpuSharePercent}%</span>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                value={config.gpuSharePercent}
                onChange={(e) => setConfig({ ...config, gpuSharePercent: Number(e.target.value) })}
                className="w-full accent-[#10b981] cursor-pointer"
              />
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end space-x-3 pt-2">
        {saveSuccess && (
          <span className="text-[#10b981] text-xs font-mono flex items-center space-x-1">
            <CheckCircleIcon className="w-3.5 h-3.5" />
            <span>Đã lưu thành công và cập nhật daemon!</span>
          </span>
        )}
        <button
          onClick={handleSaveConfig}
          className="px-5 py-2 rounded-md bg-[#ff6c37] hover:bg-[#ff5722] text-white font-bold text-xs shadow-sm transition active:scale-95"
        >
          Lưu Cấu Hình
        </button>
      </div>
    </div>
  );
};
