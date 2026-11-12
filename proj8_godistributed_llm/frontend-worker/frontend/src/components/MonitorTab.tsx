import { worker } from '../../wailsjs/go/models';
import { ActivityIcon, ShieldIcon, ZapIcon } from '../Icons';

/** Props đầu vào cho tab Telemetry / Overview & GPU. */
interface MonitorTabProps {
  snapshot: worker.WorkerSnapshot;
  running: boolean;
}

/** Quy đổi uptime (giây) sang chuỗi dễ đọc (Xh Ym Zs). */
function formatUptime(sec: number): string {
  if (!sec || sec < 0) return '0s';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Hiển thị các thẻ giám sát phần cứng (GPU slots, CPU/RAM, VRAM, Circuit Breaker), bộ đếm throughput và danh sách model. */
export function MonitorTab({ snapshot, running }: MonitorTabProps) {
  const maxSlots = snapshot.max_slots || 1;
  const slotsPct = Math.min(100, ((snapshot.active_jobs || 0) / maxSlots) * 100);
  const cpu = (snapshot.cpu_percent || 0).toFixed(1);
  const ram = (snapshot.ram_percent || 0).toFixed(1);
  const vram = (snapshot.gpu_vram_percent || 0).toFixed(1);

  return (
    <>
      <div className="cards-grid">
        <div className="card">
          <div className="card-label">
            <span>Active GPU Slots</span>
            <ActivityIcon />
          </div>
          <div className="card-val">
            {snapshot.active_jobs || 0} / {snapshot.max_slots || 0}
          </div>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${slotsPct}%` }} />
          </div>
        </div>

        <div className="card">
          <div className="card-label">
            <span>Host CPU / RAM</span>
            <ActivityIcon />
          </div>
          <div className="card-pair">
            <div>CPU: <strong>{cpu}%</strong></div>
            <div>RAM: <strong>{ram}%</strong></div>
          </div>
          <div className="bar">
            <div className="bar-fill bar-cyan" style={{ width: `${Math.min(100, Number(ram))}%` }} />
          </div>
        </div>

        <div className="card">
          <div className="card-label">
            <span>GPU VRAM</span>
            <ZapIcon />
          </div>
          <div className="card-val">{vram}%</div>
          <div className="bar">
            <div className="bar-fill bar-amber" style={{ width: `${Math.min(100, Number(vram))}%` }} />
          </div>
        </div>

        <div className="card">
          <div className="card-label">
            <span>Circuit Breaker</span>
            <ShieldIcon />
          </div>
          <div className="card-val">{snapshot.breaker_state || 'CLOSED'}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Errors: <strong>{snapshot.breaker_failures || 0} / {snapshot.breaker_threshold || 3}</strong>
          </div>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <h2>Throughput &amp; Uptime</h2>
          <div className="counters-grid">
            <div className="counter-item"><span>Completed</span><strong>{snapshot.jobs_completed || 0}</strong></div>
            <div className="counter-item"><span>Failed</span><strong>{snapshot.jobs_failed || 0}</strong></div>
            <div className="counter-item"><span>Canceled</span><strong>{snapshot.jobs_canceled || 0}</strong></div>
            <div className="counter-item"><span>Timed Out</span><strong>{snapshot.jobs_timed_out || 0}</strong></div>
            <div className="counter-item"><span>Tokens Sent</span><strong>{snapshot.total_tokens_sent || 0}</strong></div>
            <div className="counter-item"><span>Uptime</span><strong>{running ? formatUptime(snapshot.uptime_sec) : '0s'}</strong></div>
          </div>
        </div>

        <div className="panel">
          <h2>Supported Models &amp; Runtime</h2>
          <div className="chips">
            {(snapshot.supported_models || []).map((m: string) => (
              <span key={m} className="chip">{m}</span>
            ))}
          </div>
          <div className="kv-list">
            <div><span>LLM Engine:</span> <strong>{snapshot.llm_provider} ({snapshot.llm_base_url})</strong></div>
            <div><span>Redis Queue:</span> <strong>{snapshot.redis_addr} [{snapshot.consumer_group}]</strong></div>
            <div><span>Hard Job Timeout:</span> <strong>{snapshot.max_job_duration_sec || 0}s</strong></div>
            <div><span>gRPC Batch / Sync:</span> <strong>{snapshot.batch_flush_ms || 0}ms / {snapshot.dynamic_model_sync ? 'ON' : 'OFF'}</strong></div>
          </div>
        </div>
      </div>
    </>
  );
}

