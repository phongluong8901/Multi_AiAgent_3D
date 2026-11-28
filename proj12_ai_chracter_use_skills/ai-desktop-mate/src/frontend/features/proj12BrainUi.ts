import { invoke } from '@tauri-apps/api/core';
import { syncCognitiveMemoryWithCloud } from '../../backend/cloudHubClient';
import {
  PackCatalogSummary,
  PackExecResult,
  PackRouteResult,
  RouterStatusPayload,
  SleepConsolidationResult,
} from '../../core/types';

let cachedPackCatalog: PackCatalogSummary | null = null;

export async function refresh9RouterStudioUi(): Promise<RouterStatusPayload | null> {
  const badge = document.getElementById('studio-9router-badge');
  const box = document.getElementById('studio-9router-endpoints');
  const chips = document.getElementById('studio-9router-vault-keys');
  const stratSelect = document.getElementById('select-9router-strategy') as HTMLSelectElement | null;

  try {
    const status = await invoke<RouterStatusPayload>('router_get_status');
    if (stratSelect && (status.strategy === 'priority' || status.strategy === 'round_robin')) {
      stratSelect.value = status.strategy;
    }
    if (badge) {
      badge.textContent = `[9ROUTER: ${status.healthy_endpoints}/${status.total_endpoints} ONLINE | ${status.strategy.toUpperCase()}]`;
      badge.style.color = status.healthy_endpoints > 0 ? '#6ee7b7' : '#fca5a5';
    }
    if (box) {
      if (status.endpoints.length === 0) {
        box.textContent =
          '[9ROUTER] Chưa có API Key nào trong .env hoặc DPAPI Vault. Hãy nhập Gemini / Groq / Cloudflare Key ở ô trên.';
      } else {
        box.textContent = status.endpoints
          .map((ep) => {
            const st =
              ep.status === 'healthy'
                ? 'OK'
                : ep.status === 'cooldown'
                  ? `COOLDOWN ${ep.cooldown_remaining_sec}s`
                  : 'DISABLED';
            const lat = ep.ewma_latency_ms > 0 ? ` | EWMA ${ep.ewma_latency_ms}ms` : '';
            const stat = ep.requests > 0 ? ` | ok=${ep.successes}/${ep.requests}` : '';
            return `[${st}] ${ep.endpoint_id} (prio=${ep.priority}${lat}${stat})${ep.last_error ? ` -> ${ep.last_error}` : ''}`;
          })
          .join('\n');
      }
    }
    if (chips) {
      chips.innerHTML = '';
      for (const vk of status.vault_keys) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chat-chip';
        btn.title = `Bấm để xóa key ${vk.label} khỏi Windows DPAPI Vault`;
        btn.textContent = `[DPAPI] ${vk.provider.toUpperCase()}: ${vk.masked_key} (Xóa)`;
        btn.addEventListener('click', async () => {
          await invoke('router_delete_api_key', { keyId: vk.id }).catch(() => {});
          await refresh9RouterStudioUi();
        });
        chips.appendChild(btn);
      }
    }
    window.dispatchEvent(
      new CustomEvent('duck-9router-updated', { detail: { healthy: status.healthy_endpoints } })
    );
    return status;
  } catch (err) {
    if (box) box.textContent = `[9ROUTER ERR] ${String(err)}`;
    return null;
  }
}

export async function refreshProj11PacksUi(forceReload = false): Promise<void> {
  const countBadge = document.getElementById('tf-packs-count');
  const wmBadge = document.getElementById('tf-pack-wm-badge');
  const metaLog = document.getElementById('tf-pack-meta-log');
  const listEl = document.getElementById('tf-pack-skills-list');

  try {
    const cat = await invoke<PackCatalogSummary>(
      forceReload ? 'pack_reload_catalog' : 'pack_get_catalog'
    );
    cachedPackCatalog = cat;
    if (countBadge) countBadge.textContent = String(cat.total_tools);
    if (wmBadge) wmBadge.textContent = `[$mem: ${cat.working_memory_keys.length}]`;

    const packSummary = Object.entries(cat.packs)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ');
    if (metaLog) {
      metaLog.textContent = `[READY] Tổng ${cat.total_tools} tools (${packSummary})\nPython: ${cat.python_exe || 'Chưa tìm thấy python.exe (chế độ đọc tĩnh)'}`;
    }
    renderPackEntriesList(cat.entries.slice(0, 60));
  } catch (err) {
    if (metaLog) metaLog.textContent = `[PACK ERR] ${String(err)}`;
    if (listEl) listEl.innerHTML = `<div class="dash-sub">Lỗi nạp kho Skill Pack: ${String(err)}</div>`;
  }
}

function renderPackEntriesList(
  items: Array<{
    tool_name: string;
    pack: string;
    module_name: string;
    description: string;
    score?: number;
  }>
) {
  const listEl = document.getElementById('tf-pack-skills-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  if (items.length === 0) {
    listEl.innerHTML = '<div class="dash-sub">Không tìm thấy tool phù hợp trong kho 6 pack.</div>';
    return;
  }

  for (const it of items) {
    const card = document.createElement('div');
    card.className = 'studio-subcard';
    card.style.marginBottom = '6px';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.gap = '6px';

    const title = document.createElement('span');
    title.style.fontSize = '11px';
    title.style.fontWeight = '600';
    title.style.color = '#7dd3fc';
    title.textContent = it.tool_name;

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.style.fontSize = '9px';
    badge.textContent =
      typeof it.score === 'number' ? `[${it.pack} | BM25=${it.score}]` : `[${it.pack}]`;

    header.appendChild(title);
    header.appendChild(badge);

    const desc = document.createElement('div');
    desc.style.fontSize = '10.5px';
    desc.style.color = '#cbd5e1';
    desc.style.margin = '4px 0 6px';
    desc.textContent = it.description;

    const actRow = document.createElement('div');
    actRow.style.display = 'flex';
    actRow.style.gap = '6px';

    const argsInput = document.createElement('input');
    argsInput.type = 'text';
    argsInput.className = 'studio-input';
    argsInput.style.fontSize = '10px';
    argsInput.style.padding = '3px 7px';
    argsInput.placeholder = 'JSON args, vd: {} hoặc {"rows":"$mem_1"}';
    argsInput.value = '{}';

    const runBtn = document.createElement('button');
    runBtn.type = 'button';
    runBtn.className = 'action-btn';
    runBtn.style.padding = '3px 9px';
    runBtn.style.fontSize = '10px';
    runBtn.style.flexShrink = '0';
    runBtn.textContent = 'Chạy Thử';
    runBtn.addEventListener('click', async () => {
      runBtn.disabled = true;
      runBtn.textContent = 'Đang chạy...';
      const metaLog = document.getElementById('tf-pack-meta-log');
      try {
        const res = await invoke<PackExecResult>('pack_execute_skill', {
          toolName: it.tool_name,
          argsJson: argsInput.value.trim() || '{}',
          userQuery: null,
        });
        if (metaLog) {
          metaLog.textContent = res.ok
            ? `${res.summary_text}`
            : `[ERR] ${res.tool_name}: ${res.error}`;
        }
        const wmBadge = document.getElementById('tf-pack-wm-badge');
        if (wmBadge && res.mem_ref) {
          wmBadge.textContent = `[Latest: ${res.mem_ref}]`;
        }
      } catch (e) {
        if (metaLog) metaLog.textContent = `[EXEC ERR] ${String(e)}`;
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = 'Chạy Thử';
      }
    });

    actRow.appendChild(argsInput);
    actRow.appendChild(runBtn);
    card.appendChild(header);
    card.appendChild(desc);
    card.appendChild(actRow);
    listEl.appendChild(card);
  }
}

export function initProj12BrainUi(onSpeak?: (msg: string) => void) {
  document.getElementById('btn-9router-add-key')?.addEventListener('click', async () => {
    const prov =
      (document.getElementById('select-9router-provider') as HTMLSelectElement | null)?.value ||
      'gemini';
    const input = document.getElementById('input-9router-keys') as HTMLInputElement | null;
    const raw = input?.value.trim() || '';
    if (!raw) return;
    try {
      await invoke('router_add_api_keys', {
        provider: prov,
        rawKeys: raw,
        label: null,
        accountId: null,
      });
      if (input) input.value = '';
      await refresh9RouterStudioUi();
      onSpeak?.(`[9ROUTER DPAPI] Đã mã hóa và nạp thêm API Key (${prov.toUpperCase()}) vào Pool xoay vòng.`);
    } catch (err) {
      const box = document.getElementById('studio-9router-endpoints');
      if (box) box.textContent = `[VAULT ERR] ${String(err)}`;
    }
  });

  document.getElementById('select-9router-strategy')?.addEventListener('change', async (ev) => {
    const val = (ev.target as HTMLSelectElement).value;
    await invoke('router_set_strategy', { strategy: val }).catch(() => {});
    await refresh9RouterStudioUi();
  });

  document.getElementById('btn-9router-reload')?.addEventListener('click', async () => {
    await invoke('router_reload_pool').catch(() => {});
    await refresh9RouterStudioUi();
  });

  document.getElementById('btn-cog-sleep-now')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    try {
      const res = await invoke<SleepConsolidationResult>('cog_consolidate_sleep');
      const msg = `[COGNITIVE MEMORY] Đã tổng hợp ${res.consolidated_events} sự kiện -> ${res.playbooks_count} Playbooks, ${res.active_facts} Facts, ${res.active_rules} Habit Rules (dọn ${res.pruned_old_logs} log cũ).`;
      const box = document.getElementById('studio-9router-endpoints');
      if (box) box.textContent = msg;
      onSpeak?.(msg);
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('btn-tf-pack-reload')?.addEventListener('click', () => {
    void refreshProj11PacksUi(true);
  });

  const runPackRouteSearch = async () => {
    const q =
      (document.getElementById('tf-pack-route-input') as HTMLInputElement | null)?.value.trim() ||
      '';
    const metaLog = document.getElementById('tf-pack-meta-log');
    if (!q) {
      if (cachedPackCatalog) renderPackEntriesList(cachedPackCatalog.entries.slice(0, 60));
      return;
    }
    try {
      const routed = await invoke<PackRouteResult>('pack_route_skills', { query: q, topK: 10 });
      if (metaLog) {
        metaLog.textContent = `[BM25 SUB-GOALS: ${routed.sub_goals.join(' -> ')}] Chọn Top-${routed.routed.length}/${routed.total_indexed} tools:`;
      }
      if (routed.routed.length > 0) {
        renderPackEntriesList(routed.routed);
      } else if (cachedPackCatalog) {
        const kw = q.toLowerCase();
        const filtered = cachedPackCatalog.entries.filter(
          (e) =>
            e.tool_name.toLowerCase().includes(kw) ||
            e.pack.toLowerCase().includes(kw) ||
            e.description.toLowerCase().includes(kw)
        );
        renderPackEntriesList(filtered.slice(0, 50));
      }
    } catch (err) {
      if (metaLog) metaLog.textContent = `[BM25 ERR] ${String(err)}`;
    }
  };

  document.getElementById('btn-tf-pack-route-test')?.addEventListener('click', () => {
    void runPackRouteSearch();
  });
  document.getElementById('tf-pack-route-input')?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') void runPackRouteSearch();
  });

  document.getElementById('btn-tf-sync-cog-memory')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement;
    const logEl = document.getElementById('tf-cloud-status-log');
    btn.disabled = true;
    if (logEl) logEl.textContent = '[MEMORY SYNC] Đang đồng bộ 2 chiều Cognitive Memory với MongoDB...';
    try {
      const res = await syncCognitiveMemoryWithCloud();
      const msg = `[MEMORY SYNC OK] Đã hợp nhất ${res.merged_local} mục (Facts=${res.total_facts}, Rules=${res.total_rules}, Playbooks=${res.total_playbooks}).`;
      if (logEl) logEl.textContent = msg;
      onSpeak?.(msg);
    } catch (err) {
      if (logEl) logEl.textContent = `[MEMORY SYNC ERR] ${String(err)}`;
    } finally {
      btn.disabled = false;
    }
  });

  void refresh9RouterStudioUi();
}
