import { useEffect, useState } from 'react';
import { main } from '../../wailsjs/go/models';

interface SettingsTabProps {
  config: main.WorkerConfigDTO;
  running: boolean;
  onSave: (dto: main.WorkerConfigDTO, restart: boolean) => Promise<void>;
  onTestEngine: (provider: string, baseURL: string) => Promise<main.EngineCheckResult>;
}

export function SettingsTab({ config, running, onSave, onTestEngine }: SettingsTabProps) {
  const [form, setForm] = useState<main.WorkerConfigDTO>(config);
  const [modelsText, setModelsText] = useState((config.supported_models || []).join(', '));
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(config);
    setModelsText((config.supported_models || []).join(', '));
  }, [config]);

  const handleSave = async (restart: boolean) => {
    setSaving(true);
    try {
      const parsedModels = modelsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await onSave({ ...form, supported_models: parsedModels }, restart);
    } finally {
      setSaving(false);
    }
  };

  const handleProbe = async () => {
    setTestMsg(null);
    const res = await onTestEngine(form.llm_provider, form.llm_base_url);
    if (res.ok) {
      const list = res.models && res.models.length > 0 ? ` (${res.models.join(', ')})` : '';
      setTestMsg({ ok: true, text: `Ket noi engine thanh cong${list}` });
    } else {
      setTestMsg({ ok: false, text: res.error || 'Khong the ket noi engine' });
    }
  };

  return (
    <div className="panel">
      <h2>Worker Node Configuration (worker.yaml)</h2>
      <div className="form-grid">
        <div className="field">
          <label>Worker ID</label>
          <input value={form.worker_id} onChange={(e) => setForm({ ...form, worker_id: e.target.value })} />
        </div>

        <div className="field">
          <label>Local Embedded Web UI Addr</label>
          <input value={form.ui_addr} placeholder=":9091 or disabled" onChange={(e) => setForm({ ...form, ui_addr: e.target.value })} />
        </div>

        <div className="field">
          <label>Token Transport</label>
          <select value={form.transport} onChange={(e) => setForm({ ...form, transport: e.target.value })}>
            <option value="grpc">gRPC Streaming (High Throughput)</option>
            <option value="http">HTTP NDJSON Fallback</option>
          </select>
        </div>

        <div className="field">
          <label>Max Parallel GPU Jobs (Semaphore)</label>
          <input type="number" min={1} max={64} value={form.max_parallel_jobs} onChange={(e) => setForm({ ...form, max_parallel_jobs: Number(e.target.value) || 1 })} />
        </div>

        <div className="field">
          <label>LLM Provider</label>
          <select value={form.llm_provider} onChange={(e) => setForm({ ...form, llm_provider: e.target.value })}>
            <option value="ollama">ollama (/api/chat)</option>
            <option value="vllm">vllm / sglang / lmstudio (/v1)</option>
            <option value="llamacpp">llamacpp (/completion)</option>
          </select>
        </div>

        <div className="field">
          <label>LLM Base URL</label>
          <div className="field-row">
            <input value={form.llm_base_url} onChange={(e) => setForm({ ...form, llm_base_url: e.target.value })} />
            <button className="btn" type="button" onClick={handleProbe}>Test</button>
          </div>
          {testMsg && <span className={testMsg.ok ? 'hint-ok' : 'hint-err'}>{testMsg.text}</span>}
        </div>

        <div className="field">
          <label>Redis Address(es)</label>
          <input value={form.redis_addr} onChange={(e) => setForm({ ...form, redis_addr: e.target.value })} />
        </div>

        <div className="field">
          <label>Redis Consumer Group</label>
          <input value={form.consumer_group} onChange={(e) => setForm({ ...form, consumer_group: e.target.value })} />
        </div>

        <div className="field">
          <label>Hard Job Timeout (sec)</label>
          <input type="number" min={0} value={form.max_job_duration_sec} onChange={(e) => setForm({ ...form, max_job_duration_sec: Number(e.target.value) || 0 })} />
        </div>

        <div className="field">
          <label>gRPC Micro-Batch Flush (ms)</label>
          <input type="number" min={0} value={form.batch_flush_ms} onChange={(e) => setForm({ ...form, batch_flush_ms: Number(e.target.value) || 0 })} />
        </div>

        <div className="field">
          <label>Fallback Supported Models (comma-separated)</label>
          <input value={modelsText} onChange={(e) => setModelsText(e.target.value)} />
        </div>

        <div className="field checkbox-field">
          <input id="dyn-sync" type="checkbox" checked={form.dynamic_model_sync} onChange={(e) => setForm({ ...form, dynamic_model_sync: e.target.checked })} />
          <label htmlFor="dyn-sync">Auto-sync models from LLM engine</label>
        </div>
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" type="button" disabled={saving} onClick={() => handleSave(false)}>
          Save Config
        </button>
        {running && (
          <button className="btn btn-ok" type="button" disabled={saving} onClick={() => handleSave(true)}>
            Save &amp; Restart Worker
          </button>
        )}
      </div>
    </div>
  );
}

