import React, { useState, useEffect, useRef } from 'react';
import Map, { Marker, NavigationControl, Popup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

interface WindowWithElectron extends Window {
  require?: (module: string) => {
    ipcRenderer: {
      send: (channel: string, ...args: unknown[]) => void;
      on: (channel: string, listener: (...args: unknown[]) => void) => void;
    };
  };
}

const customWindow = window as WindowWithElectron;
const ipcRenderer = customWindow.require ? customWindow.require('electron').ipcRenderer : null;

// ====================== TYPES ======================
interface CpuInfo {
  percent: number;
  count_logical: number;
  count_physical: number | null;
  freq_current: number | null;
  freq_max: number | null;
}

interface MemoryInfo {
  total: number;
  available: number;
  used: number;
  percent: number;
}

interface DiskInfo {
  device: string;
  mountpoint: string;
  fstype: string;
  total: number;
  used: number;
  free: number;
  percent: number;
}

interface NetworkInfo {
  bytes_sent: number;
  bytes_recv: number;
  packets_sent: number;
  packets_recv: number;
}

interface BatteryInfo {
  percent: number;
  plugged: boolean;
  secsleft: number | null;
}

interface HardwareInfo {
  cpu: CpuInfo;
  memory: MemoryInfo;
  disk: DiskInfo[];
  network: NetworkInfo;
  battery: BatteryInfo | null;
}

interface OsInfo {
  hostname: string;
  platform: string;
  release: string;
  version: string;
  architecture: string;
  processor: string;
  boot_time: string;
}

interface LocationInfo {
  lat: number;
  lon: number;
  city?: string;
  region?: string;
  country?: string;
  ip?: string;
  isp?: string;
  source?: string;
}

interface SystemData {
  type: string;
  timestamp: string;
  hardware: HardwareInfo;
  os: OsInfo;
  location: LocationInfo | null;
}

type TabType = 'overview' | 'map' | 'detail';

// ===================================================

export default function App() {
  const [wsStatus, setWsStatus] = useState('Connecting...');
  const [logs, setLogs] = useState<string[]>([]);
  const [data, setData] = useState<SystemData | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showPopup, setShowPopup] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);

  const addLog = (text: string) => {
    const timeStr = new Date().toTimeString().split(' ')[0];
    setLogs((prev) => [`[${timeStr}] ${text}`, ...prev].slice(0, 80));
  };

  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: any = null;
    let isMounted = true;

    const urls = [
      'ws://localhost:4000/api/v1/distributed/ws',
      'ws://localhost:5010/api/v1/distributed/ws',
      'ws://localhost:8082/ws',
    ];
    let urlIndex = 0;

    const connect = () => {
      if (!isMounted) return;
      const targetUrl = urls[urlIndex];
      setWsStatus(`Connecting...`);

      try {
        ws = new WebSocket(targetUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setWsStatus('Connected');
          addLog(`✅ Kết nối thành công tới ${targetUrl}!`);
        };

        ws.onmessage = (event: MessageEvent) => {
          if (!isMounted) return;
          try {
            const message = JSON.parse(event.data) as SystemData;
            if (message.type === 'SYSTEM_INFO' || (message as any).cpu_percent !== undefined) {
              setData(message);
              if (message.location) {
                addLog(`Vị trí: ${message.location.city || ''}, ${message.location.country || ''}`);
              }
            } else if ((message as { type: string }).type === 'PING_CHECK') {
              addLog(`[RECEIVED] Nhận tín hiệu PING từ hệ thống.`);
            }
          } catch (err) {
            console.error('Lỗi parse JSON:', err);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setWsStatus('Disconnected');
          urlIndex = (urlIndex + 1) % urls.length;
          timer = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          // Sự kiện onclose sẽ tự động kích hoạt sau đó
        };
      } catch (e) {
        urlIndex = (urlIndex + 1) % urls.length;
        timer = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, []);

  const handleSendPing = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
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

  const handleMinimize = () => ipcRenderer?.send('window-minimize');
  const handleMaximize = () => ipcRenderer?.send('window-maximize');
  const handleClose = () => ipcRenderer?.send('window-close');

  const cpu = data?.hardware?.cpu?.percent ?? 0;
  const ram = data?.hardware?.memory?.percent ?? 0;
  const disk = data?.hardware?.disk?.[0]?.percent ?? 0;
  const battery = data?.hardware?.battery;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Dark style từ MapLibre (không cần token)
  const darkStyle = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

  return (
    <div className="bg-[#181818] text-[#cccccc] h-screen flex flex-col overflow-hidden select-none font-sans text-xs border border-[#333]">
      {/* ===================== TITLE BAR ===================== */}
      <div
        className="h-[42px] bg-[#212121] flex items-center justify-between px-3 border-b border-[#2d2d2d] flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center space-x-4" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="w-6 h-6 bg-[#ff6c37] rounded flex items-center justify-center font-black text-white text-xs">
            PM
          </div>
          <div className="hidden sm:flex items-center space-x-3 text-[11px] text-gray-400 font-medium">
            <span className="hover:text-white cursor-pointer">File</span>
            <span className="hover:text-white cursor-pointer">Edit</span>
            <span className="hover:text-white cursor-pointer">View</span>
            <span className="hover:text-white cursor-pointer">Help</span>
          </div>
        </div>

        <div className="flex items-center space-x-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div
            className={`px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wide flex items-center space-x-1.5 ${wsStatus.includes('Connected')
                ? 'bg-[#1c3321] text-[#4ade80] border border-[#23482b]'
                : 'bg-[#3b1d1d] text-[#f87171] border border-[#522525]'
              }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${wsStatus.includes('Connected') ? 'bg-[#4ade80] animate-pulse' : 'bg-[#f87171]'
                }`}
            ></span>
            <span>{wsStatus.toUpperCase()}</span>
          </div>

          <div className="flex items-center -mr-3 ml-2 border-l border-[#333] pl-2 space-x-1">
            <button onClick={handleMinimize} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-[#333] hover:text-white">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path></svg>
            </button>
            <button onClick={handleMaximize} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-[#333] hover:text-white">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" strokeWidth="2" rx="2"></rect></svg>
            </button>
            <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-red-600 hover:text-white">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        </div>
      </div>

      {/* ===================== TOOLBAR + TABS ===================== */}
      <div className="h-[42px] bg-[#1e1e1e] border-b border-[#2d2d2d] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-t text-[11px] font-medium flex items-center space-x-2 transition ${activeTab === 'overview'
                ? 'bg-[#181818] border-t-2 border-t-[#ff6c37] border-x border-[#2d2d2d] text-white'
                : 'text-gray-400 hover:text-white'
              }`}
          >
            <span className="bg-[#2a2a2a] text-[#ff6c37] px-1.5 py-0.5 rounded text-[9px] font-bold font-mono">1</span>
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`px-4 py-2 rounded-t text-[11px] font-medium flex items-center space-x-2 transition ${activeTab === 'map'
                ? 'bg-[#181818] border-t-2 border-t-[#38bdf8] border-x border-[#2d2d2d] text-white'
                : 'text-gray-400 hover:text-white'
              }`}
          >
            <span className="bg-[#2a2a2a] text-[#38bdf8] px-1.5 py-0.5 rounded text-[9px] font-bold font-mono">2</span>
            <span>3D Map</span>
          </button>

          <button
            onClick={() => setActiveTab('detail')}
            className={`px-4 py-2 rounded-t text-[11px] font-medium flex items-center space-x-2 transition ${activeTab === 'detail'
                ? 'bg-[#181818] border-t-2 border-t-[#a855f7] border-x border-[#2d2d2d] text-white'
                : 'text-gray-400 hover:text-white'
              }`}
          >
            <span className="bg-[#2a2a2a] text-[#a855f7] px-1.5 py-0.5 rounded text-[9px] font-bold font-mono">3</span>
            <span>System Detail</span>
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-gray-400 font-mono text-[10px]">ws://localhost:4000/api/v1/distributed/ws</span>
          <button
            onClick={handleSendPing}
            className="bg-[#ff6c37] hover:bg-[#e05b29] text-white px-3 py-1.5 rounded-[4px] font-bold transition flex items-center space-x-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
            <span>Send Ping</span>
          </button>
        </div>
      </div>

      {/* ===================== MAIN CONTENT ===================== */}
      <div className="flex-1 bg-[#181818] overflow-hidden">

        {/* ========== TAB 1: OVERVIEW ========== */}
        {activeTab === 'overview' && (
          <div className="h-full p-4 flex gap-4 overflow-hidden">
            {/* Left */}
            <div className="w-[380px] flex flex-col space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 gap-3">
                <div className="bg-[#212121] p-3.5 rounded border border-[#2d2d2d]">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400">CPU Usage</span>
                    <span className="text-[#ff6c37] font-bold font-mono">{cpu}%</span>
                  </div>
                  <div className="w-full bg-[#181818] h-2 rounded-full overflow-hidden border border-[#333]">
                    <div className="bg-[#ff6c37] h-full transition-all duration-300" style={{ width: `${cpu}%` }}></div>
                  </div>
                </div>

                <div className="bg-[#212121] p-3.5 rounded border border-[#2d2d2d]">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400">RAM Usage</span>
                    <span className="text-[#38bdf8] font-bold font-mono">{ram}%</span>
                  </div>
                  <div className="w-full bg-[#181818] h-2 rounded-full overflow-hidden border border-[#333]">
                    <div className="bg-[#38bdf8] h-full transition-all duration-300" style={{ width: `${ram}%` }}></div>
                  </div>
                </div>

                <div className="bg-[#212121] p-3.5 rounded border border-[#2d2d2d]">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400">Disk Usage</span>
                    <span className="text-[#a855f7] font-bold font-mono">{disk}%</span>
                  </div>
                  <div className="w-full bg-[#181818] h-2 rounded-full overflow-hidden border border-[#333]">
                    <div className="bg-[#a855f7] h-full transition-all duration-300" style={{ width: `${disk}%` }}></div>
                  </div>
                </div>

                {battery && (
                  <div className="bg-[#212121] p-3.5 rounded border border-[#2d2d2d]">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-400">Battery</span>
                      <span className="text-[#4ade80] font-bold font-mono">
                        {battery.percent}% {battery.plugged ? '(Charging)' : ''}
                      </span>
                    </div>
                    <div className="w-full bg-[#181818] h-2 rounded-full overflow-hidden border border-[#333]">
                      <div className="bg-[#4ade80] h-full transition-all duration-300" style={{ width: `${battery.percent}%` }}></div>
                    </div>
                  </div>
                )}
              </div>

              {data?.os && (
                <div className="bg-[#212121] p-3 rounded border border-[#2d2d2d] text-[11px] space-y-1.5">
                  <div className="text-[#ff6c37] font-bold mb-1">Quick Info</div>
                  <div>Hostname: <span className="text-white">{data.os.hostname}</span></div>
                  <div>OS: <span className="text-white">{data.os.platform} {data.os.release}</span></div>
                  <div>Arch: <span className="text-white">{data.os.architecture}</span></div>
                  {data.location && (
                    <div className="pt-2 border-t border-[#333] mt-2">
                      <div>Location: <span className="text-white">{data.location.city}, {data.location.country}</span></div>
                      <div>IP: <span className="text-white">{data.location.ip}</span></div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex-1 bg-[#1e1e1e] rounded border border-[#2d2d2d] p-3 flex flex-col min-h-[200px]">
                <div className="flex justify-between items-center text-gray-400 mb-2 border-b border-[#2d2d2d] pb-2">
                  <span className="font-bold text-white">Console Logs</span>
                  <button onClick={() => setLogs([])} className="bg-[#2a2a2a] hover:bg-[#333] text-gray-300 px-2 py-1 rounded text-[10px]">
                    Clear
                  </button>
                </div>
                <div className="flex-1 font-mono text-[11px] text-[#4ade80] overflow-auto space-y-1">
                  {logs.length === 0 ? (
                    <span className="text-gray-600 italic">Waiting for data...</span>
                  ) : (
                    logs.map((log, i) => <div key={i}>{log}</div>)
                  )}
                </div>
              </div>
            </div>

            {/* Right - Mini 3D Map */}
            <div className="flex-1 bg-[#0a0a0a] rounded border border-[#2d2d2d] overflow-hidden relative">
              <div className="absolute top-3 left-3 z-10 bg-black/70 px-3 py-1.5 rounded text-[11px] text-gray-300 pointer-events-none">
                Live 3D Location
              </div>

              {data?.location ? (
                <Map
                  initialViewState={{
                    longitude: data.location.lon,
                    latitude: data.location.lat,
                    zoom: 5,
                    pitch: 45,        // Nghiêng 3D
                    bearing: -20
                  }}
                  style={{ width: '100%', height: '100%' }}
                  mapStyle={darkStyle}
                  attributionControl={false}
                >
                  <Marker
                    longitude={data.location.lon}
                    latitude={data.location.lat}
                    color="#ff6c37"
                    scale={0.9}
                  />
                </Map>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-600">
                  Waiting for location...
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== TAB 2: 3D MAP ========== */}
        {activeTab === 'map' && (
          <div className="h-full p-4">
            <div className="w-full h-full bg-[#0a0a0a] rounded border border-[#2d2d2d] overflow-hidden relative">
              <div className="absolute top-4 left-4 z-10 bg-black/80 px-4 py-2 rounded text-[12px] text-gray-200 max-w-xs pointer-events-none">
                <div className="font-bold text-[#38bdf8] mb-1">3D Location Map</div>
                {data?.location ? (
                  <div className="space-y-0.5 text-[11px]">
                    <div>{data.location.city}, {data.location.region}, {data.location.country}</div>
                    <div>Lat: {data.location.lat} | Lon: {data.location.lon}</div>
                    <div>IP: {data.location.ip}</div>
                    <div className="text-gray-400">{data.location.isp}</div>
                  </div>
                ) : (
                  <div className="text-gray-500">Waiting for location data...</div>
                )}
              </div>

              {data?.location ? (
                <Map
                  initialViewState={{
                    longitude: data.location.lon,
                    latitude: data.location.lat,
                    zoom: 6,
                    pitch: 60,        // Nghiêng mạnh hơn
                    bearing: -30
                  }}
                  style={{ width: '100%', height: '100%' }}
                  mapStyle={darkStyle}
                  attributionControl={false}
                >
                  <NavigationControl position="top-right" />

                  <Marker
                    longitude={data.location.lon}
                    latitude={data.location.lat}
                    color="#ff6c37"
                    scale={1.1}
                    onClick={() => setShowPopup(true)}
                  />

                  {showPopup && (
                    <Popup
                      longitude={data.location.lon}
                      latitude={data.location.lat}
                      anchor="bottom"
                      onClose={() => setShowPopup(false)}
                      closeOnClick={false}
                    >
                      <div className="text-black text-xs p-1">
                        <b>{data.location.city}</b><br />
                        {data.location.region}, {data.location.country}<br />
                        IP: {data.location.ip}
                      </div>
                    </Popup>
                  )}
                </Map>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-600">
                  Waiting for location data...
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== TAB 3: SYSTEM DETAIL ========== */}
        {activeTab === 'detail' && (
          <div className="h-full p-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4 max-w-6xl">
              {/* CPU */}
              <div className="bg-[#212121] rounded border border-[#2d2d2d] p-4">
                <h3 className="text-[#ff6c37] font-bold mb-3 text-[13px]">CPU Information</h3>
                {data?.hardware?.cpu ? (
                  <div className="space-y-2 text-[12px]">
                    <div className="flex justify-between"><span className="text-gray-400">Usage</span><span className="text-white font-mono">{data.hardware.cpu.percent}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Logical Cores</span><span className="text-white">{data.hardware.cpu.count_logical}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Physical Cores</span><span className="text-white">{data.hardware.cpu.count_physical ?? 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Current Freq</span><span className="text-white">{data.hardware.cpu.freq_current ? data.hardware.cpu.freq_current + ' MHz' : 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Max Freq</span><span className="text-white">{data.hardware.cpu.freq_max ? data.hardware.cpu.freq_max + ' MHz' : 'N/A'}</span></div>
                  </div>
                ) : <div className="text-gray-500">No data</div>}
              </div>

              {/* Memory */}
              <div className="bg-[#212121] rounded border border-[#2d2d2d] p-4">
                <h3 className="text-[#38bdf8] font-bold mb-3 text-[13px]">Memory Information</h3>
                {data?.hardware?.memory ? (
                  <div className="space-y-2 text-[12px]">
                    <div className="flex justify-between"><span className="text-gray-400">Usage</span><span className="text-white font-mono">{data.hardware.memory.percent}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Total</span><span className="text-white">{formatBytes(data.hardware.memory.total)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Used</span><span className="text-white">{formatBytes(data.hardware.memory.used)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Available</span><span className="text-white">{formatBytes(data.hardware.memory.available)}</span></div>
                  </div>
                ) : <div className="text-gray-500">No data</div>}
              </div>

              {/* Disk */}
              <div className="bg-[#212121] rounded border border-[#2d2d2d] p-4">
                <h3 className="text-[#a855f7] font-bold mb-3 text-[13px]">Disk Information</h3>
                {data?.hardware?.disk?.length ? (
                  <div className="space-y-3">
                    {data.hardware.disk.map((d, i) => (
                      <div key={i} className="text-[12px] border-b border-[#333] pb-2 last:border-0">
                        <div className="font-medium text-white mb-1">{d.device} ({d.mountpoint})</div>
                        <div className="flex justify-between text-gray-400">
                          <span>{d.percent}% used</span>
                          <span>{formatBytes(d.used)} / {formatBytes(d.total)}</span>
                        </div>
                        <div className="w-full bg-[#181818] h-1.5 rounded-full mt-1 overflow-hidden">
                          <div className="bg-[#a855f7] h-full" style={{ width: `${d.percent}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-gray-500">No data</div>}
              </div>

              {/* Network + Battery + OS */}
              <div className="bg-[#212121] rounded border border-[#2d2d2d] p-4 space-y-4">
                <div>
                  <h3 className="text-[#4ade80] font-bold mb-2 text-[13px]">Network</h3>
                  {data?.hardware?.network ? (
                    <div className="space-y-1 text-[12px]">
                      <div className="flex justify-between"><span className="text-gray-400">Sent</span><span className="text-white">{formatBytes(data.hardware.network.bytes_sent)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Received</span><span className="text-white">{formatBytes(data.hardware.network.bytes_recv)}</span></div>
                    </div>
                  ) : <div className="text-gray-500 text-[12px]">No data</div>}
                </div>

                {data?.hardware?.battery && (
                  <div>
                    <h3 className="text-[#fbbf24] font-bold mb-2 text-[13px]">Battery</h3>
                    <div className="space-y-1 text-[12px]">
                      <div className="flex justify-between"><span className="text-gray-400">Level</span><span className="text-white">{data.hardware.battery.percent}%</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Status</span><span className="text-white">{data.hardware.battery.plugged ? 'Charging' : 'On Battery'}</span></div>
                    </div>
                  </div>
                )}

                {data?.os && (
                  <div>
                    <h3 className="text-[#f472b6] font-bold mb-2 text-[13px]">Operating System</h3>
                    <div className="space-y-1 text-[12px]">
                      <div className="flex justify-between"><span className="text-gray-400">Hostname</span><span className="text-white">{data.os.hostname}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Platform</span><span className="text-white">{data.os.platform}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Release</span><span className="text-white">{data.os.release}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Architecture</span><span className="text-white">{data.os.architecture}</span></div>
                      <div className="flex justify-between"><span className="text-gray-400">Boot Time</span><span className="text-white">{data.os.boot_time}</span></div>
                    </div>
                  </div>
                )}
              </div>

              {data?.location && (
                <div className="col-span-2 bg-[#212121] rounded border border-[#2d2d2d] p-4">
                  <h3 className="text-[#38bdf8] font-bold mb-3 text-[13px]">Location Information</h3>
                  <div className="grid grid-cols-3 gap-4 text-[12px]">
                    <div><span className="text-gray-400">City</span><div className="text-white mt-0.5">{data.location.city}</div></div>
                    <div><span className="text-gray-400">Region</span><div className="text-white mt-0.5">{data.location.region}</div></div>
                    <div><span className="text-gray-400">Country</span><div className="text-white mt-0.5">{data.location.country}</div></div>
                    <div><span className="text-gray-400">Latitude</span><div className="text-white mt-0.5">{data.location.lat}</div></div>
                    <div><span className="text-gray-400">Longitude</span><div className="text-white mt-0.5">{data.location.lon}</div></div>
                    <div><span className="text-gray-400">IP Address</span><div className="text-white mt-0.5">{data.location.ip}</div></div>
                    <div className="col-span-3"><span className="text-gray-400">ISP</span><div className="text-white mt-0.5">{data.location.isp}</div></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}