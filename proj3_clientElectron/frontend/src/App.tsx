import React, { useState, useEffect, useRef } from 'react';

// Định nghĩa kiểu dữ liệu an toàn cho Electron IPC tránh lỗi TypeScript
interface WindowWithElectron extends Window {
  require?: (module: string) => {
    ipcRenderer: {
      send: (channel: string, ...args: unknown[]) => void;
      on: (channel: string, listener: (...args: unknown[]) => void) => void;
      [key: string]: unknown;
    };
  };
}

const customWindow = window as WindowWithElectron;
const ipcRenderer = customWindow.require ? customWindow.require('electron').ipcRenderer : null;

interface HardwareStats {
  cpu_percent: number;
  ram_percent: number;
  disk_percent: number;
  cpu_count?: number;
}

export default function App() {
  const [wsStatus, setWsStatus] = useState<string>('Connecting...');
  const [logs, setLogs] = useState<string[]>([]);
  const [stats, setStats] = useState<HardwareStats>({
    cpu_percent: 0,
    ram_percent: 0,
    disk_percent: 0,
    cpu_count: 0
  });

  const wsRef = useRef<WebSocket | null>(null);

  const addLog = (text: string) => {
    const timeStr = new Date().toTimeString().split(' ')[0];
    setLogs((prev) => [`[${timeStr}] ${text}`, ...prev]);
  };

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('Connected');
      addLog('Đã kết nối thành công tới Go WebSocket Server!');
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        // Kiểm tra nếu là dữ liệu phần cứng từ Python Worker
        if (message.type === 'HARDWARE_STATS' || message.cpu_percent !== undefined) {
          const data = message.data || message;
          setStats({
            cpu_percent: data.cpu_percent || 0,
            ram_percent: data.ram_percent || 0,
            disk_percent: data.disk_percent || 0,
            cpu_count: data.cpu_count || 4
          });
        }
        // Kiểm tra nếu là thông điệp phản hồi hoặc echo từ Go/Client khác
        else if (message.type === 'PING_CHECK') {
          addLog(`[RECEIVED] Nhận tín hiệu PING từ hệ thống.`);
        }
      } catch (err) {
        console.error('Lỗi parse JSON:', err);
      }
    };

    ws.onclose = () => {
      setWsStatus('Disconnected');
      addLog('Mất kết nối với Go Server.');
    };

    ws.onerror = () => {
      addLog('Lỗi đường truyền WebSocket.');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // Hàm gửi lệnh Ping tới Go Server (mô phỏng gửi gói tin như Python Worker)
  const handleSendPing = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload = {
        type: 'PING_CHECK',
        sender: 'React-Frontend-Client',
        timestamp: new Date().toISOString()
      };
      wsRef.current.send(JSON.stringify(payload));
      addLog(`[SENT] Đã gửi gói tin PING lên Go Server thành công.`);
    } else {
      addLog(`[ERROR] Không thể gửi: WebSocket chưa kết nối.`);
    }
  };

  // Các hàm điều khiển cửa sổ Electron
  const handleMinimize = () => ipcRenderer?.send('window-minimize');
  const handleMaximize = () => ipcRenderer?.send('window-maximize');
  const handleClose = () => ipcRenderer?.send('window-close');

  return (
    <div className="bg-[#181818] text-[#cccccc] h-screen flex flex-col overflow-hidden select-none font-sans text-xs border border-[#333]">

      {/* ========================================================= */}
      {/* POSTMAN CUSTOM WINDOW TITLE BAR & HEADER                  */}
      {/* ========================================================= */}
      <div
        className="h-[42px] bg-[#212121] flex items-center justify-between px-3 border-b border-[#2d2d2d] flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Left: Logo Postman + Menu */}
        <div className="flex items-center space-x-4" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="w-6 h-6 bg-[#ff6c37] rounded flex items-center justify-center font-black text-white text-xs tracking-tighter shadow-sm cursor-pointer">
            PM
          </div>
          <div className="hidden sm:flex items-center space-x-3 text-[11px] text-gray-400 font-medium">
            <span className="hover:text-white cursor-pointer transition">File</span>
            <span className="hover:text-white cursor-pointer transition">Edit</span>
            <span className="hover:text-white cursor-pointer transition">View</span>
            <span className="hover:text-white cursor-pointer transition">Help</span>
          </div>
        </div>

        {/* Center: Search / Workspace Real Input */}
        <div
          className="hidden md:flex items-center bg-[#181818] border border-[#333333] px-3 py-1 rounded-[4px] w-64 justify-between text-gray-400 focus-within:border-[#ff6c37]"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <input
            type="text"
            placeholder="Search workspaces..."
            className="bg-transparent outline-none w-full text-gray-200 text-[11px] placeholder-gray-500 cursor-text"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          />
          <span className="bg-[#2a2a2a] text-[9px] px-1.5 py-0.5 rounded text-gray-400 border border-[#3a3a3a] ml-2 flex-shrink-0 font-mono">Ctrl+K</span>
        </div>

        {/* Right: Status Pill & Electron Window Controls */}
        <div className="flex items-center space-x-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className={`px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wide flex items-center space-x-1.5 ${wsStatus.includes('Connected') ? 'bg-[#1c3321] text-[#4ade80] border border-[#23482b]' : 'bg-[#3b1d1d] text-[#f87171] border border-[#522525]'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${wsStatus.includes('Connected') ? 'bg-[#4ade80] animate-pulse' : 'bg-[#f87171]'}`}></span>
            <span>{wsStatus.toUpperCase()}</span>
          </div>

          {/* Windows Control Buttons */}
          <div className="flex items-center -mr-3 ml-2 border-l border-[#333] pl-2 space-x-1">
            <button
              onClick={handleMinimize}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-[#333] hover:text-white transition cursor-pointer"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              title="Minimize"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path></svg>
            </button>
            <button
              onClick={handleMaximize}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-[#333] hover:text-white transition cursor-pointer"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              title="Maximize"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" strokeWidth="2" rx="2"></rect></svg>
            </button>
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-red-600 hover:text-white transition rounded-tr cursor-pointer"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              title="Close"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TABS & ACTION TOOLBAR (POSTMAN STYLE)                     */}
      {/* ========================================================= */}
      <div className="h-[42px] bg-[#1e1e1e] border-b border-[#2d2d2d] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <div className="bg-[#181818] border-t-2 border-t-[#ff6c37] border-x border-[#2d2d2d] border-b-0 px-4 py-2 rounded-t flex items-center space-x-2 text-[11px] text-white font-medium shadow-inner cursor-pointer">
            <span className="bg-[#2a2a2a] text-[#ff6c37] px-1.5 py-0.5 rounded text-[9px] font-bold font-mono">WS</span>
            <span>hardware-monitor.workspace</span>
          </div>
        </div>

        {/* Nút Ping & Kiểm tra kết nối */}
        <div className="flex items-center space-x-3">
          <span className="text-gray-400 font-mono text-[10px]">ws://localhost:8080/ws</span>
          <button
            onClick={handleSendPing}
            className="bg-[#ff6c37] hover:bg-[#e05b29] text-white px-3 py-1.5 rounded-[4px] font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            <span>Send Ping</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MAIN DASHBOARD CONTENT                                    */}
      {/* ========================================================= */}
      <div className="flex-1 bg-[#181818] p-4 flex flex-col overflow-y-auto space-y-4">

        {/* METRICS GRID */}
        <div className="grid grid-cols-3 gap-4">

          {/* CPU Card */}
          <div className="bg-[#212121] p-3.5 rounded border border-[#2d2d2d] flex flex-col justify-between shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center space-x-2 text-gray-400 font-medium">
                <svg className="w-4 h-4 text-[#ff6c37]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                <span>CPU Usage</span>
              </div>
              <span className="text-[#ff6c37] font-bold text-sm font-mono">{stats.cpu_percent}%</span>
            </div>
            <div className="w-full bg-[#181818] h-2 rounded-full overflow-hidden border border-[#333]">
              <div
                className="bg-[#ff6c37] h-full transition-all duration-300"
                style={{ width: `${stats.cpu_percent}%` }}
              ></div>
            </div>
          </div>

          {/* RAM Card */}
          <div className="bg-[#212121] p-3.5 rounded border border-[#2d2d2d] flex flex-col justify-between shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center space-x-2 text-gray-400 font-medium">
                <svg className="w-4 h-4 text-[#38bdf8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                <span>RAM Usage</span>
              </div>
              <span className="text-[#38bdf8] font-bold text-sm font-mono">{stats.ram_percent}%</span>
            </div>
            <div className="w-full bg-[#181818] h-2 rounded-full overflow-hidden border border-[#333]">
              <div
                className="bg-[#38bdf8] h-full transition-all duration-300"
                style={{ width: `${stats.ram_percent}%` }}
              ></div>
            </div>
          </div>

          {/* Disk Card */}
          <div className="bg-[#212121] p-3.5 rounded border border-[#2d2d2d] flex flex-col justify-between shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center space-x-2 text-gray-400 font-medium">
                <svg className="w-4 h-4 text-[#a855f7]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg>
                <span>Disk Usage</span>
              </div>
              <span className="text-[#a855f7] font-bold text-sm font-mono">{stats.disk_percent}%</span>
            </div>
            <div className="w-full bg-[#181818] h-2 rounded-full overflow-hidden border border-[#333]">
              <div
                className="bg-[#a855f7] h-full transition-all duration-300"
                style={{ width: `${stats.disk_percent}%` }}
              ></div>
            </div>
          </div>

        </div>

        {/* CONSOLE / LOGS PANEL */}
        <div className="flex-1 bg-[#1e1e1e] rounded border border-[#2d2d2d] p-3 flex flex-col min-h-[220px] shadow-inner">
          <div className="flex justify-between items-center text-gray-400 mb-2 border-b border-[#2d2d2d] pb-2">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[#ff6c37]"></span>
              <span className="font-bold text-white tracking-wide">Console Stream Logs</span>
            </div>
            <button
              onClick={() => setLogs([])}
              className="bg-[#2a2a2a] hover:bg-[#333] text-gray-300 px-2.5 py-1 rounded text-[10px] transition cursor-pointer"
            >
              Clear Console
            </button>
          </div>
          <div className="flex-1 font-mono text-[11px] text-[#4ade80] overflow-auto space-y-1.5 p-1 bg-[#181818] rounded border border-[#282828]">
            {logs.length === 0 ? (
              <span className="text-gray-600 italic">Waiting for telemetry stream from Python Worker via Go Server...</span>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <svg className="w-3 h-3 text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                  <span>{log}</span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}