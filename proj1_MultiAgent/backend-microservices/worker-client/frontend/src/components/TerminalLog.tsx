import { useRef, useEffect, useState } from 'react';
import type { FC } from 'react';
import { TerminalIcon, CopyIcon, TrashIcon, CheckCircleIcon, ChevronDownIcon, ChevronUpIcon } from './Icons';

interface TerminalLogProps {
  logs: string[];
  onClearLogs?: () => void;
}

export const TerminalLog: FC<TerminalLogProps> = ({ logs, onClearLogs }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<'all' | 'telemetry' | 'online' | 'error'>('all');
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [logs]);

  const filteredLogs = logs.filter((line) => {
    if (filter === 'telemetry') return line.includes('[TELEMETRY]') || line.includes('[LOCAL_TELEMETRY]');
    if (filter === 'online') return line.includes('[ONLINE]') || line.includes('[CONNECTED]') || line.includes('[CONNECTING]');
    if (filter === 'error') return line.includes('[ERROR]') || line.includes('[WARN]') || line.includes('[FAIL]');
    return true;
  });

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`bg-[#181818] border border-[#2d2d2d] rounded-lg flex flex-col transition-all duration-200 shadow-sm ${
      isCollapsed ? 'h-9 overflow-hidden' : 'h-36'
    }`}>
      {/* Postman Console Header Bar */}
      <div className="h-9 px-3 bg-[#202020] border-b border-[#2d2d2d] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center space-x-1.5 text-xs font-semibold text-gray-200 hover:text-white transition"
          >
            <TerminalIcon className="w-3.5 h-3.5 text-[#ff6c37]" />
            <span className="tracking-wide">Console</span>
            {isCollapsed ? (
              <ChevronUpIcon className="w-3.5 h-3.5 text-gray-400" />
            ) : (
              <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400" />
            )}
          </button>
          <span className="text-[10px] font-mono text-gray-400 bg-[#2b2b2b] px-1.5 py-0.2 rounded border border-[#383838]">
            {logs.length} logs
          </span>
        </div>

        {/* Filter Chips & Action Controls */}
        <div className="flex items-center space-x-1.5 text-[10px] font-mono">
          {!isCollapsed && (
            <>
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'telemetry', label: 'Telemetry' },
                  { id: 'online', label: 'Network' },
                  { id: 'error', label: 'Errors' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`px-2 py-0.5 rounded transition ${
                    filter === tab.id
                      ? 'bg-[#ff6c37] text-white font-bold'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              <div className="h-3 w-[1px] bg-[#333] mx-1" />

              <button
                onClick={handleCopyLogs}
                className="flex items-center space-x-1 px-2 py-0.5 rounded text-gray-400 hover:text-white hover:bg-[#2d2d2d] transition"
                title="Sao chép toàn bộ nhật ký"
              >
                {copied ? (
                  <>
                    <CheckCircleIcon className="w-3 h-3 text-[#10b981]" />
                    <span className="text-[#10b981]">Đã chép</span>
                  </>
                ) : (
                  <>
                    <CopyIcon className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              {onClearLogs && (
                <button
                  onClick={onClearLogs}
                  className="flex items-center space-x-1 px-2 py-0.5 rounded text-gray-400 hover:text-rose-400 hover:bg-[#2d2d2d] transition"
                  title="Xóa console"
                >
                  <TrashIcon className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Terminal Output Body */}
      {!isCollapsed && (
        <div
          ref={logContainerRef}
          className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[11px] text-gray-300 select-text bg-[#141414]"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-gray-600 italic py-2 text-center text-[11px]">
              {logs.length === 0 ? 'Đang khởi tạo telemetry và lắng nghe sự kiện từ worker...' : 'Không có log phù hợp bộ lọc.'}
            </div>
          ) : (
            filteredLogs.map((line, idx) => {
              const isSuccess =
                line.includes('[SUCCESS]') || line.includes('[ONLINE]') || line.includes('[CONNECTED]');
              const isError = line.includes('[ERROR]') || line.includes('[FAIL]') || line.includes('[STDERR]');
              const isWarn = line.includes('[WARN]') || line.includes('[WAITING]') || line.includes('[DISCONNECT]') || line.includes('[PAUSED]');
              const isTelem = line.includes('[TELEMETRY]');
              const isConfig = line.includes('[CONFIG]') || line.includes('[INIT]');

              let colorClass = 'text-gray-300';
              if (isSuccess) colorClass = 'text-[#10b981]';
              else if (isError) colorClass = 'text-rose-400';
              else if (isWarn) colorClass = 'text-amber-400';
              else if (isTelem) colorClass = 'text-[#38bdf8]';
              else if (isConfig) colorClass = 'text-[#ff6c37]';

              return (
                <div key={idx} className={`leading-relaxed truncate hover:bg-[#1e1e1e] px-1 rounded ${colorClass}`}>
                  {line}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
