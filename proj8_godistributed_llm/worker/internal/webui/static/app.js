// --- Cụm biến trạng thái & helper định dạng giao diện Console cục bộ (:9091) ---
let isDraining = false;

/** Quy đổi thời gian uptime từ giây sang chuỗi dễ đọc (Xh Ym Zs). */
function formatUptime(sec) {
  if (!sec || sec < 0) return "0s";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Escape ký tự HTML đặc biệt để tránh XSS khi render tên model hoặc ID job. */
function escapeHTML(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Cập nhật toàn bộ DOM Dashboard từ payload WorkerSnapshot của GET /api/status. */
function renderStatus(data) {
  document.getElementById("worker-id").textContent = data.worker_id || "--";
  document.getElementById("transport-mode").textContent = (data.transport || "grpc").toUpperCase();
  document.getElementById("uptime").textContent = formatUptime(data.uptime_sec);

  isDraining = Boolean(data.draining);
  const badge = document.getElementById("status-badge");
  badge.textContent = data.status || "ONLINE";
  badge.className = "badge badge-" + String(data.status || "online").toLowerCase();

  const drainBtn = document.getElementById("btn-drain");
  const drainLabel = document.getElementById("drain-label");
  if (isDraining) {
    drainLabel.textContent = "Resume Worker";
    drainBtn.className = "btn btn-ok";
  } else {
    drainLabel.textContent = "Drain Node";
    drainBtn.className = "btn btn-warn";
  }

  const maxSlots = data.max_slots || 1;
  const active = data.active_jobs || 0;
  document.getElementById("slots-value").textContent = `${active} / ${maxSlots}`;
  document.getElementById("slots-bar").style.width = `${Math.min(100, (active / maxSlots) * 100)}%`;

  const cpu = Number(data.cpu_percent || 0).toFixed(1);
  const ram = Number(data.ram_percent || 0).toFixed(1);
  const vram = Number(data.gpu_vram_percent || 0).toFixed(1);
  document.getElementById("cpu-pct").textContent = `${cpu}%`;
  document.getElementById("ram-pct").textContent = `${ram}%`;
  document.getElementById("ram-bar").style.width = `${Math.min(100, Number(ram))}%`;
  document.getElementById("vram-pct").textContent = `${vram}%`;
  document.getElementById("vram-bar").style.width = `${Math.min(100, Number(vram))}%`;

  document.getElementById("breaker-state").textContent = data.breaker_state || "CLOSED";
  document.getElementById("breaker-failures").textContent = `${data.breaker_failures || 0} / ${data.breaker_threshold || 3}`;

  document.getElementById("jobs-completed").textContent = data.jobs_completed || 0;
  document.getElementById("jobs-failed").textContent = data.jobs_failed || 0;
  document.getElementById("jobs-canceled").textContent = data.jobs_canceled || 0;
  document.getElementById("jobs-timeout").textContent = data.jobs_timed_out || 0;
  document.getElementById("tokens-sent").textContent = data.total_tokens_sent || 0;

  const modelsEl = document.getElementById("models-list");
  modelsEl.innerHTML = (data.supported_models || [])
    .map((m) => `<span class="chip">${escapeHTML(m)}</span>`)
    .join("");

  document.getElementById("llm-info").textContent = `${data.llm_provider || "--"} (${data.llm_base_url || "--"})`;
  document.getElementById("redis-info").textContent = `${data.redis_addr || "--"} [${data.consumer_group || "--"}]`;
  document.getElementById("timeout-info").textContent = `${data.max_job_duration_sec || 0}s`;
  document.getElementById("batch-info").textContent = `${data.batch_flush_ms || 0}ms (Sync: ${data.dynamic_model_sync ? "ON" : "OFF"})`;

  const tbody = document.getElementById("jobs-body");
  const jobs = data.recent_jobs || [];
  if (jobs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">Chua co job nao duoc xu ly tren node nay.</td></tr>`;
    return;
  }

  tbody.innerHTML = jobs
    .map((j) => {
      const shortID = escapeHTML((j.job_id || "").slice(0, 12));
      const shortTrace = escapeHTML((j.trace_id || "").slice(0, 12));
      const prio = escapeHTML(j.priority || "normal");
      const status = escapeHTML(j.status || "UNKNOWN");
      return `<tr>
        <td class="mono" title="${escapeHTML(j.job_id)}">${shortID}</td>
        <td class="mono">${escapeHTML(j.model)}</td>
        <td>${prio}</td>
        <td><span class="st-tag st-${status}">${status}</span></td>
        <td>${j.queue_wait_ms || 0} ms</td>
        <td>${j.duration_ms || 0} ms</td>
        <td>${j.tokens_sent || 0}</td>
        <td class="mono" title="${escapeHTML(j.trace_id)}">${shortTrace || "--"}</td>
      </tr>`;
    })
    .join("");
}

// --- Cụm Polling API & Sự kiện nút điều khiển Drain / Sync / Reset Breaker ---

/** Kéo snapshot trạng thái mới nhất từ Worker HTTP server và render lại UI. */
async function fetchStatus() {
  try {
    const res = await fetch("/api/status");
    if (res.ok) {
      renderStatus(await res.json());
    }
  } catch (err) {
    console.error("Failed to fetch worker status:", err);
  }
}

document.getElementById("btn-drain").addEventListener("click", async () => {
  const endpoint = isDraining ? "/api/resume" : "/api/drain";
  await fetch(endpoint, { method: "POST" });
  await fetchStatus();
});

document.getElementById("btn-sync").addEventListener("click", async () => {
  await fetch("/api/models/sync", { method: "POST" });
  await fetchStatus();
});

document.getElementById("btn-reset-breaker").addEventListener("click", async () => {
  await fetch("/api/breaker/reset", { method: "POST" });
  await fetchStatus();
});

fetchStatus();
setInterval(fetchStatus, 2000);

