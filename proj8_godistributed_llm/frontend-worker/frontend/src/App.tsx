import { useCallback, useEffect, useState } from 'react';
import './App.css';
import {
  ClearLogs,
  DrainNode,
  GetState,
  ResetBreaker,
  RestartWorker,
  ResumeNode,
  SaveConfig,
  StartWorker,
  StopWorker,
  SyncModels,
  TestEngine,
} from '../wailsjs/go/main/App';
import { main } from '../wailsjs/go/models';
import {
  Quit,
  WindowIsMaximised,
  WindowMinimise,
  WindowToggleMaximise,
} from '../wailsjs/runtime/runtime';
import {
  ActivityIcon,
  CloseIcon,
  MaximizeIcon,
  MinimizeIcon,
  NodeFlowIcon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
  RestoreIcon,
  SettingsIcon,
  ShieldIcon,
  StopIcon,
  TerminalIcon,
} from './Icons';
import { MonitorTab } from './components/MonitorTab';
import { JobsLogsTab } from './components/JobsLogsTab';
import { SettingsTab } from './components/SettingsTab';

/** Định danh các tab chính trong giao diện Worker Desktop Console. */
type TabKey = 'monitor' | 'jobs' | 'settings';

/**
 * Component gốc của Worker Desktop App (giao diện Frameless dark style n8n/Postman):
 * - Thanh Titlebar điều khiển Start/Stop/Restart/Drain + nút cửa sổ Windows.
 * - Polling GetState() định kỳ mỗi 2s từ Wails Go backend.
 * - Chuyển đổi giữa 3 workspace tabs: Telemetry, Executions & Logs, Configuration.
 */
export function App() {
  const [tab, setTab] = useState<TabKey>('monitor');
  const [state, setState] = useState<main.DesktopState | null>(null);
  const [busy, setBusy] = useState(false);
  const [maximized, setMaximized] = useState(false);

  // Đồng bộ trạng thái phóng to/thu nhỏ của cửa sổ Frameless để đổi icon Maximize/Restore.
  const syncWindowState = useCallback(async () => {
    try {
      const isMax = await WindowIsMaximised();
      setMaximized(isMax);
    } catch {
      // Bỏ qua khi chạy ngoài môi trường Wails runtime (ví dụ trình duyệt dev)
    }
  }, []);

  // Kéo toàn bộ DesktopState mới nhất từ Go App backend qua Wails IPC.
  const refresh = useCallback(async () => {
    try {
      const next = await GetState();
      setState(next);
    } catch (err) {
      console.error('Failed to poll worker desktop state:', err);
    }
  }, []);

  useEffect(() => {
    refresh();
    syncWindowState();
    const id = setInterval(refresh, 2000);
    window.addEventListener('resize', syncWindowState);
    return () => {
      clearInterval(id);
      window.removeEventListener('resize', syncWindowState);
    };
  }, [refresh, syncWindowState]);

  // Wrapper khóa nút trong lúc gọi các RPC điều khiển Worker (Start, Stop, Drain, SaveConfig...).
  const runAction = async (fn: () => Promise<main.DesktopState>) => {
    setBusy(true);
    try {
      const next = await fn();
      setState(next);
    } finally {
      setBusy(false);
    }
  };

  // Phóng to/khôi phục kích thước cửa sổ khi click nút hoặc double-click vào thanh Titlebar.
  const handleToggleMaximize = async () => {
    WindowToggleMaximise();
    setTimeout(syncWindowState, 60);
  };

  if (!state) {
    return (
      <div className="app-frame" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>Initializing GoLLM Worker Console...</span>
      </div>
    );
  }

  const snap = state.snapshot;
  const stLower = String(snap.status || 'stopped').toLowerCase();
  const workerName = snap.worker_id || state.config.worker_id;

  return (
    <div className="app-frame">
      {/* Custom Frameless Titlebar (n8n / Postman dark workspace style) */}
      <header className="titlebar" onDoubleClick={handleToggleMaximize}>
        <div className="titlebar-left">
          <div className="app-emblem" aria-hidden="true">
            <NodeFlowIcon />
          </div>
          <div className="breadcrumb">
            <span className="crumb-root">GoLLM Cluster</span>
            <span className="crumb-sep">/</span>
            <span className="crumb-node">{workerName}</span>
          </div>
          <span className={`status-badge st-${stLower}`}>
            <span className="status-dot" />
            {snap.status}
          </span>
        </div>

        <div className="titlebar-center" onDoubleClick={(e) => e.stopPropagation()}>
          <div className="endpoint-preview">
            <span className="transport-tag">{(snap.transport || 'grpc').toUpperCase()}</span>
            <span>{state.config.llm_provider} @ {state.config.llm_base_url}</span>
          </div>
          {!state.running ? (
            <button className="btn btn-sm btn-primary" type="button" disabled={busy} onClick={() => runAction(StartWorker)}>
              <PlayIcon />
              <span>Start</span>
            </button>
          ) : (
            <button className="btn btn-sm btn-danger" type="button" disabled={busy} onClick={() => runAction(StopWorker)}>
              <StopIcon />
              <span>Stop</span>
            </button>
          )}
        </div>

        <div className="titlebar-right" onDoubleClick={(e) => e.stopPropagation()}>
          {state.running && (
            <div className="quick-actions">
              <button className="btn btn-sm" type="button" disabled={busy} title="Restart Worker" onClick={() => runAction(RestartWorker)}>
                <RefreshIcon />
                <span>Restart</span>
              </button>
              {snap.draining ? (
                <button className="btn btn-sm btn-ok" type="button" disabled={busy} title="Resume Accepting Jobs" onClick={() => runAction(ResumeNode)}>
                  <PlayIcon />
                  <span>Resume</span>
                </button>
              ) : (
                <button className="btn btn-sm btn-warn" type="button" disabled={busy} title="Drain Node" onClick={() => runAction(DrainNode)}>
                  <PauseIcon />
                  <span>Drain</span>
                </button>
              )}
            </div>
          )}

          <div className="win-controls">
            <button className="win-btn" type="button" title="Minimize" onClick={() => WindowMinimise()}>
              <MinimizeIcon />
            </button>
            <button className="win-btn" type="button" title={maximized ? 'Restore' : 'Maximize'} onClick={handleToggleMaximize}>
              {maximized ? <RestoreIcon /> : <MaximizeIcon />}
            </button>
            <button className="win-btn win-btn-close" type="button" title="Close" onClick={() => Quit()}>
              <CloseIcon />
            </button>
          </div>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div>
            <div className="nav-section-title">Workspace</div>
            <nav className="nav-list">
              <button className={`nav-item ${tab === 'monitor' ? 'active' : ''}`} type="button" onClick={() => setTab('monitor')}>
                <ActivityIcon />
                <span>Overview &amp; GPU</span>
              </button>
              <button className={`nav-item ${tab === 'jobs' ? 'active' : ''}`} type="button" onClick={() => setTab('jobs')}>
                <TerminalIcon />
                <span>Executions &amp; Logs</span>
              </button>
              <button className={`nav-item ${tab === 'settings' ? 'active' : ''}`} type="button" onClick={() => setTab('settings')}>
                <SettingsIcon />
                <span>Configuration</span>
              </button>
            </nav>
          </div>

          <div className="sidebar-footer">
            <div className="config-path" title={state.config_path}>
              Config: {state.config_path}
            </div>
            <button
              className="btn btn-sm"
              type="button"
              disabled={!state.running || busy}
              onClick={() => runAction(SyncModels)}
            >
              <RefreshIcon />
              <span>Sync Engine Models</span>
            </button>
            <button
              className="btn btn-sm"
              type="button"
              disabled={!state.running || busy}
              onClick={() => runAction(ResetBreaker)}
            >
              <ShieldIcon />
              <span>Reset Circuit Breaker</span>
            </button>
          </div>
        </aside>

        <main className="main-area">
          <div className="tabbar">
            <div className="tabs-group">
              <button className={`tab-btn ${tab === 'monitor' ? 'active' : ''}`} type="button" onClick={() => setTab('monitor')}>
                <ActivityIcon />
                <span>Telemetry</span>
              </button>
              <button className={`tab-btn ${tab === 'jobs' ? 'active' : ''}`} type="button" onClick={() => setTab('jobs')}>
                <TerminalIcon />
                <span>Executions ({(snap.recent_jobs || []).length})</span>
              </button>
              <button className={`tab-btn ${tab === 'settings' ? 'active' : ''}`} type="button" onClick={() => setTab('settings')}>
                <SettingsIcon />
                <span>worker.yaml</span>
              </button>
            </div>

            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
              Redis: <strong style={{ color: 'var(--text)', fontWeight: 500 }}>{state.config.redis_addr}</strong>
            </span>
          </div>

          <section className="content-scroll">
            {state.last_error && <div className="error-banner">{state.last_error}</div>}

            {tab === 'monitor' && <MonitorTab snapshot={snap} running={state.running} />}
            {tab === 'jobs' && (
              <JobsLogsTab
                jobs={snap.recent_jobs || []}
                logs={state.logs || []}
                onClearLogs={() => runAction(ClearLogs)}
              />
            )}
            {tab === 'settings' && (
              <SettingsTab
                config={state.config}
                running={state.running}
                onSave={async (dto, restart) => runAction(() => SaveConfig(dto, restart))}
                onTestEngine={TestEngine}
              />
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
