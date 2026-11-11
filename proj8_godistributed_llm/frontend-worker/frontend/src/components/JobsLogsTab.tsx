import { agent, worker } from '../../wailsjs/go/models';

interface JobsLogsTabProps {
  jobs: worker.JobRecord[];
  logs: agent.LogEntry[];
  onClearLogs: () => void;
}

export function JobsLogsTab({ jobs, logs, onClearLogs }: JobsLogsTabProps) {
  return (
    <>
      <div className="panel">
        <div className="panel-header-row">
          <h2>Recent Inference Jobs</h2>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{jobs.length} records</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Model</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Queue Wait</th>
                <th>Duration</th>
                <th>Tokens</th>
                <th>Trace ID</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-cell">Chua co job nao chay tren worker nay.</td>
                </tr>
              ) : (
                jobs.map((j) => (
                  <tr key={j.job_id}>
                    <td className="mono" title={j.job_id}>{j.job_id.slice(0, 12)}</td>
                    <td className="mono">{j.model}</td>
                    <td>{j.priority || 'normal'}</td>
                    <td><span className={`status-badge st-${String(j.status).toLowerCase()}`}>{j.status}</span></td>
                    <td>{j.queue_wait_ms || 0} ms</td>
                    <td>{j.duration_ms || 0} ms</td>
                    <td>{j.tokens_sent || 0}</td>
                    <td className="mono" title={j.trace_id}>{j.trace_id ? j.trace_id.slice(0, 12) : '--'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header-row">
          <h2>Live Worker Console Logs</h2>
          <button className="btn" type="button" onClick={onClearLogs}>Clear Logs</button>
        </div>
        <div className="log-box">
          {logs.length === 0 ? (
            <div style={{ color: 'var(--muted)' }}>Chua co log nao duoc ghi nhan.</div>
          ) : (
            logs.map((entry, idx) => (
              <div key={idx} className="log-line">
                <span className="log-time">{entry.time}</span>
                <span className={`log-lvl-${entry.level}`}>{entry.level}</span>
                <span className="log-msg">{entry.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

