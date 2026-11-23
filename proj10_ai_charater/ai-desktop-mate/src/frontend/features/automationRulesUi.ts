import { invoke } from '@tauri-apps/api/core';
import { AutomationRuleRecord, CdpTabInfo, HardwareInfo, WinRect } from '../../core/types';
import { executeSavedSkillWithSelfHeal, getCachedCustomSkills } from '../../backend/toolForge';

export interface AutomationUiDeps {
  speakMessage: (text: string) => void;
  runQuickBuiltinAction: (actionId: string, argsJson: string) => Promise<string>;
}

const BUILTIN_AUTO_TARGETS = [
  { id: 'builtin:clean_ram', label: '[BUILTIN] Dọn RAM hệ thống' },
  { id: 'builtin:check_git', label: '[BUILTIN] Check Git Status' },
  { id: 'builtin:check_ports', label: '[BUILTIN] Quét Port Dev' },
  { id: 'builtin:top_proc', label: '[BUILTIN] Top tiến trình ngốn RAM' },
  { id: 'builtin:weather_3d', label: '[BUILTIN] Cập nhật Thời Tiết 3D' },
];

export const QUICK_AUTOMATION_PRESETS: Array<{
  id: string;
  label: string;
  name: string;
  trigger_type: string;
  trigger_value: string;
  skill_id: string;
  args_json: string;
}> = [
  {
    id: 'preset_ram_clean_85',
    label: 'RAM > 12GB -> Dọn RAM',
    name: 'Tự dọn RAM khi quá tải',
    trigger_type: 'ram_high',
    trigger_value: '12',
    skill_id: 'builtin:clean_ram',
    args_json: '{}',
  },
  {
    id: 'preset_cpu_85',
    label: 'CPU > 85% -> Soi Top Process',
    name: 'Báo tiến trình khi CPU cao',
    trigger_type: 'cpu_high',
    trigger_value: '85',
    skill_id: 'builtin:top_proc',
    args_json: '{}',
  },
  {
    id: 'preset_interval_60_ports',
    label: 'Mỗi 60p -> Quét Port Dev',
    name: 'Kiểm tra Port định kỳ 60 phút',
    trigger_type: 'interval_min',
    trigger_value: '60',
    skill_id: 'builtin:check_ports',
    args_json: '{}',
  },
  {
    id: 'preset_daily_0830_git',
    label: '08:30 sáng -> Check Git',
    name: 'Check Git buổi sáng 08:30',
    trigger_type: 'daily_time',
    trigger_value: '08:30',
    skill_id: 'builtin:check_git',
    args_json: '{}',
  },
];

let cachedRules: AutomationRuleRecord[] = [];
let lastDailyTriggerMap = new Map<string, string>();

export function refreshAutomationSkillSelect() {
  const sel = document.getElementById('tf-auto-skill-select') as HTMLSelectElement | null;
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '';

  BUILTIN_AUTO_TARGETS.forEach((b) => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.label;
    sel.appendChild(opt);
  });

  getCachedCustomSkills().forEach((sk) => {
    const opt = document.createElement('option');
    opt.value = sk.id;
    opt.textContent = `[SKILL] ${sk.name} (${sk.id})`;
    sel.appendChild(opt);
  });

  if (prev) sel.value = prev;
}

export async function runRuleTarget(
  rule: AutomationRuleRecord,
  deps: AutomationUiDeps
): Promise<string> {
  await invoke('auto_rule_mark_ran', { id: rule.id }).catch(() => {});
  if (rule.skill_id.startsWith('builtin:')) {
    return deps.runQuickBuiltinAction(rule.skill_id, rule.args_json || '{}');
  }
  let parsedArgs: Record<string, unknown> = {};
  try {
    parsedArgs = JSON.parse(rule.args_json || '{}') as Record<string, unknown>;
  } catch {
    parsedArgs = {};
  }
  return executeSavedSkillWithSelfHeal(rule.skill_id, parsedArgs);
}

export async function refreshAutomationRulesUi(deps: AutomationUiDeps) {
  refreshAutomationSkillSelect();
  try {
    cachedRules = await invoke<AutomationRuleRecord[]>('auto_rule_list');
  } catch {
    cachedRules = [];
  }

  const listEl = document.getElementById('tf-auto-rules-list');
  if (!listEl) return;

  if (cachedRules.length === 0) {
    listEl.innerHTML =
      '<div class="dash-sub">Chưa có Rule tự động nào. Hãy bấm 1 gợi ý nhanh ở trên hoặc tạo rule mới.</div>';
    return;
  }

  listEl.innerHTML = '';
  cachedRules.forEach((rule) => {
    const card = document.createElement('div');
    card.className = 'tf-skill-card';

    const head = document.createElement('div');
    head.className = 'tf-skill-card-head';

    const titleWrap = document.createElement('div');
    titleWrap.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;';

    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'font-size:11.5px;font-weight:700;color:#f8fafc;';
    nameEl.textContent = rule.name;

    const trigBadge = document.createElement('span');
    trigBadge.className = 'badge tf-badge-pass';
    trigBadge.style.fontSize = '9px';
    trigBadge.textContent = `[${rule.trigger_type}: ${rule.trigger_value}]`;

    const countBadge = document.createElement('span');
    countBadge.className = 'badge';
    countBadge.style.cssText = 'font-size:9px;text-transform:none;';
    countBadge.textContent = `Đã chạy: ${rule.run_count}`;

    titleWrap.append(nameEl, trigBadge, countBadge);

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = rule.enabled;
    chk.addEventListener('change', () => {
      void invoke('auto_rule_toggle', { id: rule.id, enabled: chk.checked }).then(() =>
        refreshAutomationRulesUi(deps)
      );
    });

    head.append(titleWrap, chk);

    const targetEl = document.createElement('div');
    targetEl.style.cssText = 'font-size:10.5px;color:#cbd5e1;';
    targetEl.textContent = `Thực thi: ${rule.skill_id} | Args: ${rule.args_json}`;

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:6px;margin-top:2px;';

    const btnRunNow = document.createElement('button');
    btnRunNow.type = 'button';
    btnRunNow.className = 'action-btn';
    btnRunNow.style.cssText = 'padding:3px 9px;font-size:10.5px;';
    btnRunNow.textContent = 'Chạy Thử';
    btnRunNow.addEventListener('click', async () => {
      btnRunNow.disabled = true;
      btnRunNow.textContent = 'Đang chạy...';
      try {
        const out = await runRuleTarget(rule, deps);
        deps.speakMessage(`[AUTO RULE: ${rule.name}] ${out.slice(0, 180)}`);
        await refreshAutomationRulesUi(deps);
      } catch (err) {
        deps.speakMessage(`[AUTO ERR] ${String(err)}`);
      } finally {
        btnRunNow.disabled = false;
        btnRunNow.textContent = 'Chạy Thử';
      }
    });

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'action-btn';
    btnDel.style.cssText =
      'padding:3px 9px;font-size:10.5px;border-color:rgba(248,113,113,0.45);color:#fca5a5;';
    btnDel.textContent = 'Xóa';
    btnDel.addEventListener('click', () => {
      void invoke('auto_rule_delete', { id: rule.id }).then(() =>
        refreshAutomationRulesUi(deps)
      );
    });

    btnRow.append(btnRunNow, btnDel);
    card.append(head, targetEl, btnRow);
    listEl.appendChild(card);
  });
}

export function initAutomationRulesUi(deps: AutomationUiDeps) {
  const presetsBox = document.getElementById('tf-auto-presets');
  if (presetsBox) {
    presetsBox.innerHTML = '';
    QUICK_AUTOMATION_PRESETS.forEach((p) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chat-chip';
      chip.textContent = p.label;
      chip.addEventListener('click', async () => {
        await invoke('auto_rule_upsert', {
          id: p.id,
          name: p.name,
          triggerType: p.trigger_type,
          triggerValue: p.trigger_value,
          skillId: p.skill_id,
          argsJson: p.args_json,
          enabled: true,
        });
        await refreshAutomationRulesUi(deps);
        deps.speakMessage(`[AUTOMATION] Đã thêm nhanh rule "${p.name}".`);
      });
      presetsBox.appendChild(chip);
    });
  }

  document.getElementById('btn-tf-add-auto-rule')?.addEventListener('click', async () => {
    const name =
      (document.getElementById('tf-auto-name') as HTMLInputElement | null)?.value.trim() ||
      'Rule Tự Động';
    const triggerType =
      (document.getElementById('tf-auto-trig-type') as HTMLSelectElement | null)?.value ||
      'interval_min';
    const triggerValue =
      (document.getElementById('tf-auto-trig-val') as HTMLInputElement | null)?.value.trim() ||
      '30';
    const skillId =
      (document.getElementById('tf-auto-skill-select') as HTMLSelectElement | null)?.value ||
      'builtin:clean_ram';
    const argsJson =
      (document.getElementById('tf-auto-args') as HTMLInputElement | null)?.value.trim() || '{}';

    await invoke('auto_rule_upsert', {
      id: `rule_${Date.now()}`,
      name,
      triggerType,
      triggerValue,
      skillId,
      argsJson,
      enabled: true,
    });
    await refreshAutomationRulesUi(deps);
  });

  document.getElementById('btn-tf-cdp-launch')?.addEventListener('click', async () => {
    const logEl = document.getElementById('tf-cdp-status-log');
    try {
      const msg = await invoke<string>('cdp_launch_debug_chrome', {
        url: 'https://www.google.com',
        port: 9222,
      });
      if (logEl) logEl.textContent = `[CDP] ${msg}`;
    } catch (err) {
      if (logEl) logEl.textContent = `[CDP ERR] ${String(err)}`;
    }
  });

  document.getElementById('btn-tf-cdp-tabs')?.addEventListener('click', async () => {
    const logEl = document.getElementById('tf-cdp-status-log');
    try {
      const tabs = await invoke<CdpTabInfo[]>('cdp_list_tabs', { port: 9222 });
      if (logEl) {
        logEl.textContent =
          tabs.length > 0
            ? `[CDP OK] ${tabs.length} tab: ${tabs.map((t) => t.title || t.url).join(' | ')}`
            : '[CDP] Chưa có tab Chrome nào mở.';
      }
    } catch (err) {
      if (logEl) logEl.textContent = `[CDP ERR] ${String(err)}`;
    }
  });

  void refreshAutomationRulesUi(deps);

  // Background Trigger Evaluator (30s tick, respects cooldowns)
  window.setInterval(async () => {
    if (cachedRules.length === 0) return;
    const enabled = cachedRules.filter((r) => r.enabled);
    if (enabled.length === 0) return;

    const nowSec = Math.floor(Date.now() / 1000);
    const nowDate = new Date();
    const hhmm = `${String(nowDate.getHours()).padStart(2, '0')}:${String(
      nowDate.getMinutes()
    ).padStart(2, '0')}`;
    const todayKey = nowDate.toISOString().slice(0, 10);

    let hw: HardwareInfo | null = null;
    let wins: WinRect[] | null = null;

    for (const rule of enabled) {
      let shouldFire = false;
      if (rule.trigger_type === 'interval_min') {
        const mins = Math.max(1, Number(rule.trigger_value) || 30);
        if (nowSec - rule.last_run_at >= mins * 60) {
          shouldFire = true;
        }
      } else if (rule.trigger_type === 'daily_time') {
        if (rule.trigger_value === hhmm && lastDailyTriggerMap.get(rule.id) !== todayKey) {
          lastDailyTriggerMap.set(rule.id, todayKey);
          shouldFire = true;
        }
      } else if (rule.trigger_type === 'cpu_high' || rule.trigger_type === 'ram_high') {
        if (nowSec - rule.last_run_at < 300) continue;
        if (!hw) {
          hw = await invoke<HardwareInfo>('check_hardware').catch(() => null);
        }
        if (hw) {
          const thresh = Number(rule.trigger_value) || 85;
          if (rule.trigger_type === 'cpu_high' && hw.cpu_load_pct >= thresh) shouldFire = true;
          if (rule.trigger_type === 'ram_high' && hw.ram_used_pct >= thresh) shouldFire = true;
        }
      } else if (rule.trigger_type === 'app_focus') {
        if (nowSec - rule.last_run_at < 300) continue;
        if (!wins) {
          wins = await invoke<WinRect[]>('get_open_windows').catch(() => []);
        }
        const needle = rule.trigger_value.toLowerCase();
        if (needle && wins.some((w) => w.title.toLowerCase().includes(needle))) {
          shouldFire = true;
        }
      }

      if (shouldFire) {
        try {
          const out = await runRuleTarget(rule, deps);
          deps.speakMessage(`[AUTO: ${rule.name}] ${out.slice(0, 160)}`);
          await refreshAutomationRulesUi(deps);
        } catch {
          // ignore silent background errors
        }
      }
    }
  }, 30_000);
}
