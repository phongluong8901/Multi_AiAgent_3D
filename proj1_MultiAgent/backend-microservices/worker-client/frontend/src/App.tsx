import { useState, useEffect, useRef } from 'react';
import {
  WindowWithElectron,
  SystemData,
  TabType,
  WorkerConfig,
} from './types';
import { TitleBar } from './components/TitleBar';
import { OverviewTab } from './components/OverviewTab';
import { MapTab } from './components/MapTab';
import { SystemDetailTab } from './components/SystemDetailTab';
import { ConfigTab } from './components/ConfigTab';
import { TerminalLog } from './components/TerminalLog';

const customWindow = window as WindowWithElectron;
const ipcRenderer = customWindow.require ? customWindow.require('electron').ipcRenderer : null;

export default function App() {
  const [wsStatus, setWsStatus] = useState('Connecting...');
  const [logs, setLogs] = useState<string[]>([]);
  const [data, setData] = useState<SystemData | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Trạng thái tiến trình Worker
  const [isWorkerRunning, setIsWorkerRunning] = useState<boolean>(true);
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState<boolean>(false);

  // Config state
  const [config, setConfig] = useState<WorkerConfig>({
    serverWsUrl: 'ws://localhost:4000/api/v1/distributed/ws',
    authToken: '',
    nodeId: '',
    localEndpoint: 'http://localhost:11434',
    allocatedCores: 4,
    allocatedRAMGB: 8,
    enableGPU: true,
    gpuSharePercent: 80,
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  const addLog = (text: string) => {
    const timeStr = new Date().toTimeString().split(' ')[0];
    setLogs((prev) => [`[${timeStr}] ${text}`, ...prev].slice(0, 150));
  };

  // Nạp cấu hình & Trạng thái Worker ban đầu từ Electron Main Process
  useEffect(() => {
    if (ipcRenderer?.invoke) {
      ipcRenderer
        .invoke('get-worker-config')
        .then((savedCfg) => {
          if (savedCfg) {
            setConfig((prev) => ({ ...prev, ...savedCfg }));
          }
        })
        .catch(() => {});

      ipcRenderer
        .invoke('get-worker-status')
        .then((status) => {
          if (status && typeof status.running === 'boolean') {
            setIsWorkerRunning(status.running);
          }
        })
        .catch(() => {});

      // Lấy telemetry mới nhất lưu đệm trong Main process
      ipcRenderer
        .invoke('get-current-telemetry')
        .then((cachedTelem) => {
          if (cachedTelem) {
            setData(cachedTelem);
          }
        })
        .catch(() => {});
    }

    if (ipcRenderer?.on) {
      // 1. Nhận gói tin Telemetry cục bộ trực tiếp từ tiến trình Python Worker
      ipcRenderer.on('local-telemetry', (...args: any[]) => {
        const payload = args[1] !== undefined ? args[1] : args[0];
        if (payload && typeof payload === 'object') {
          setData(payload as SystemData);
        }
      });

      // 2. Nhận log kỹ thuật từ tiến trình Worker
      ipcRenderer.on('worker-log', (...args: any[]) => {
        const line = args[1] !== undefined ? args[1] : args[0];
        if (typeof line === 'string' && line.trim()) {
          addLog(line);
        }
      });

      // 3. Nhận sự kiện bật/tắt tiến trình
      ipcRenderer.on('worker-status-changed', (...args: any[]) => {
        const running = args[1] !== undefined ? args[1] : args[0];
        if (typeof running === 'boolean') {
          setIsWorkerRunning(running);
        }
      });
    }
  }, []);

  // Xử lý Bật / Tắt tiến trình Worker
  const handleToggleWorker = async () => {
    if (!ipcRenderer?.invoke) {
      setIsWorkerRunning(!isWorkerRunning);
      addLog(`[ACTION] Chuyển trạng thái Worker: ${!isWorkerRunning ? 'BẬT' : 'TẮT'} (Môi trường Dev)`);
      return;
    }

    try {
      if (isWorkerRunning) {
        addLog('[ACTION] Yêu cầu tạm dừng tiến trình Worker daemon...');
        const res = await ipcRenderer.invoke('stop-worker');
        setIsWorkerRunning(res.running);
      } else {
        addLog('[ACTION] Yêu cầu khởi chạy tiến trình Worker daemon...');
        const res = await ipcRenderer.invoke('start-worker');
        setIsWorkerRunning(res.running);
      }
    } catch (e: any) {
      addLog(`[ERROR] Không thể thay đổi trạng thái Worker: ${e.message}`);
    }
  };

  // Xử lý Test Ping mạng tới Distributed Service
  const handleTestPing = async () => {
    setIsPinging(true);
    addLog(`[PING] Đang kiểm tra độ trễ mạng tới ${config.serverWsUrl}...`);
    try {
      if (ipcRenderer?.invoke) {
        const res = await ipcRenderer.invoke('test-ping', config.serverWsUrl);
        if (res.ok) {
          setPingLatency(res.latency);
          addLog(`[PING SUCCESS] Độ trễ mạng: ${res.latency}ms (Mã phản hồi HTTP: ${res.status || 200})`);
        } else {
          setPingLatency(null);
          addLog(`[PING ERROR] Lỗi kiểm tra mạng: ${res.error}`);
        }
      } else {
        await new Promise((r) => setTimeout(r, 400));
        setPingLatency(12);
        addLog('[PING SUCCESS] Độ trễ mạng giả lập: 12ms');
      }
    } catch (e: any) {
      setPingLatency(null);
      addLog(`[PING ERROR] Thất bại: ${e.message}`);
    } finally {
      setIsPinging(false);
    }
  };

  // Lưu cấu hình
  const handleSaveConfig = async () => {
    if (ipcRenderer?.invoke) {
      const ok = await ipcRenderer.invoke('save-worker-config', config);
      if (ok) {
        setSaveSuccess(true);
        setIsWorkerRunning(true);
        addLog('[SUCCESS] Đã lưu cấu hình và khởi động lại Python Worker với thông số mới!');
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } else {
      addLog('[CONFIG] Đã lưu cấu hình (Dev mode)');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const wsRef = useRef<WebSocket | null>(null);

  // Kết nối WebSocket lắng nghe
  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: any = null;
    let isMounted = true;

    const urls = [
      config.serverWsUrl || 'ws://localhost:4000/api/v1/distributed/ws',
      'ws://localhost:5010/api/v1/distributed/ws',
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
          addLog(`[ONLINE] Kết nối thành công tới ${targetUrl}!`);
        };

        ws.onmessage = (event: MessageEvent) => {
          if (!isMounted) return;
          try {
            const message = JSON.parse(event.data) as SystemData;
            if (message.type === 'SYSTEM_INFO' || (message as any).cpu_percent !== undefined) {
              setData(message);
            }
          } catch (err) {
            // ignore non-json
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setWsStatus('Disconnected');
          wsRef.current = null;
          urlIndex = (urlIndex + 1) % urls.length;
          timer = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          if (ws) ws.close();
        };
      } catch (e) {
        if (!isMounted) return;
        setWsStatus('Disconnected');
        timer = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      if (ws) ws.close();
    };
  }, [config.serverWsUrl]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#121212] text-gray-200 overflow-hidden font-sans select-none">
      {/* 1. Postman-style Two-tier Title & Navigation Bar */}
      <TitleBar
        wsStatus={wsStatus}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        ipcRenderer={ipcRenderer}
        isWorkerRunning={isWorkerRunning}
        onToggleWorker={handleToggleWorker}
        onTestPing={handleTestPing}
        pingLatency={pingLatency}
        isPinging={isPinging}
      />

      {/* 2. Main Workspace Content View */}
      <div className="flex-1 p-3 overflow-hidden flex flex-col space-y-2.5 min-h-0 bg-[#141414]">
        <div className="flex-1 overflow-y-auto pr-0.5">
          {activeTab === 'overview' && (
            <OverviewTab
              data={data}
              isWorkerRunning={isWorkerRunning}
              onToggleWorker={handleToggleWorker}
              onTestPing={handleTestPing}
              pingLatency={pingLatency}
              isPinging={isPinging}
            />
          )}
          {activeTab === 'map' && <MapTab location={data?.location ?? null} />}
          {activeTab === 'detail' && <SystemDetailTab data={data} />}
          {activeTab === 'config' && (
            <ConfigTab
              config={config}
              setConfig={setConfig}
              data={data}
              saveSuccess={saveSuccess}
              handleSaveConfig={handleSaveConfig}
            />
          )}
        </div>

        {/* 3. Postman Console Drawer */}
        <TerminalLog logs={logs} onClearLogs={() => setLogs([])} />
      </div>
    </div>
  );
}
