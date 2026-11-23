import {
  AnimBinding,
  AnimFxId,
  AnimSoundId,
  AnimTriggerPhase,
  AnimTriggerType,
  CLIP_CATALOG,
  ClipGroup,
  EVENT_TRIGGER_CATALOG,
  EXPRESSION_CATALOG,
  FX_CATALOG,
  SOUND_CATALOG,
  STATE_TRIGGER_CATALOG,
  TOOL_TRIGGER_CATALOG,
  exportBindingsJson,
  getBindings,
  getClipById,
  importBindingsJson,
  isAnimBinderEnabled,
  onAnimationFired,
  onBindingsChanged,
  previewClip,
  removeBinding,
  resetBindingsToDefault,
  runBinding,
  setAnimBinderEnabled,
  stopAllClips,
  toggleBinding,
  upsertBinding,
} from '../../core/animationBinder';
import type { FaceExpression } from '../../core/types';
import { getCachedCustomSkills, refreshCustomSkills } from '../../backend/toolForge';
import { syncHitboxToRust } from '../ui';

const ICON_CLOSE = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
const ICON_PLAY = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>`;
const ICON_STOP = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="5" y="5" width="14" height="14" rx="2"></rect></svg>`;
const ICON_EDIT = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>`;
const ICON_TRASH = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>`;
const ICON_LINK = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"></path><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"></path></svg>`;
const DUCK_GLYPH = `<svg class="anim-duck-glyph" width="34" height="34" viewBox="0 0 40 40" fill="none"><ellipse cx="20" cy="26" rx="11" ry="8" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.2"/><circle cx="21" cy="14" r="7" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.2"/><path d="M27 14 L33 15.5 L27 17 Z" fill="#f59e0b"/><circle cx="23" cy="12.5" r="1.4" fill="#0f172a"/><rect x="15" y="33" width="3" height="4" rx="1" fill="#f59e0b"/><rect x="22" y="33" width="3" height="4" rx="1" fill="#f59e0b"/></svg>`;

const GROUP_LABEL: Record<ClipGroup, string> = {
  emotion: 'Cảm xúc & Xã hội',
  lifelike: 'Chờ & Sinh học',
  motion: 'Vật lý & Vui nhộn',
  work: 'Làm việc & AI',
  special: 'Đặc biệt',
};

const TRIGGER_TYPE_LABEL: Record<AnimTriggerType, string> = {
  tool: 'Tool AI',
  skill: 'Custom Skill',
  state: 'Trạng thái',
  event: 'Sự kiện / Trang',
};

const PHASE_LABEL: Record<AnimTriggerPhase, string> = {
  start: 'Khi bắt đầu',
  success: 'Khi thành công',
  error: 'Khi lỗi',
  enter: 'Khi kích hoạt',
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  );
}

function opts<T extends string>(list: Array<{ id: T; label: string }>, selected: T): string {
  return list
    .map((o) => `<option value="${esc(o.id)}"${o.id === selected ? ' selected' : ''}>${esc(o.label)}</option>`)
    .join('');
}

const FEATURED_COUNT = CLIP_CATALOG.filter((c) => c.featured).length;

export const animationManagerModalHtml = `
  <div id="anim-manager-modal" class="glass-panel" style="display: none;">
    <div class="panel-header">
      <div class="panel-title" style="flex-wrap: wrap;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f0abfc" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3l1.9 5.8L20 10l-5 3.6L16.8 20 12 16.6 7.2 20 9 13.6 4 10l6.1-1.2z"></path>
        </svg>
        <span>Quản Lý Hoạt Ảnh</span>
        <span id="anim-mgr-count" class="badge anim-badge-pink">0 GẮN KẾT</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button id="anim-btn-stop" class="action-btn anim-btn-stop" type="button" title="Dừng ngay mọi hoạt ảnh / vòng lặp đang phát">${ICON_STOP}<span>Dừng</span></button>
        <label class="anim-switch" title="Bật / tắt toàn bộ hệ thống hoạt ảnh gắn kết">
          <input id="anim-mgr-master" type="checkbox" />
          <span class="anim-switch-track"><span class="anim-switch-thumb"></span></span>
          <span class="anim-switch-lbl">Kích hoạt</span>
        </label>
        <button id="btn-close-anim-mgr" class="icon-btn-tiny" type="button" title="Đóng (Esc)">${ICON_CLOSE}</button>
      </div>
    </div>

    <div class="studio-tabs-bar anim-tabs" style="grid-template-columns: 1fr 1fr 1fr; margin-bottom: 10px;">
      <button class="studio-tab-btn active" data-anim-tab="bind" type="button">Gắn Kết</button>
      <button class="studio-tab-btn" data-anim-tab="library" type="button">Thư Viện (${CLIP_CATALOG.length})</button>
      <button class="studio-tab-btn" data-anim-tab="log" type="button">Nhật Ký</button>
    </div>

    <div id="anim-pane-bind" class="anim-pane">
      <div class="anim-form-card">
        <div class="anim-form-title">
          <span id="anim-form-mode">Tạo gắn kết mới</span>
          <label class="anim-loop-check" title="Tự động lặp lại cho tới khi thoát trạng thái hoặc bấm Dừng">
            <input id="anim-f-loop" type="checkbox" />
            <span>Lặp lại (Loop)</span>
          </label>
        </div>
        <div class="anim-seg" id="anim-trigger-seg">
          <button type="button" data-tt="tool" class="active">Tool AI</button>
          <button type="button" data-tt="skill">Custom Skill</button>
          <button type="button" data-tt="state">Trạng thái</button>
          <button type="button" data-tt="event">Sự kiện / Trang</button>
        </div>
        <div class="anim-form-grid">
          <label class="anim-field anim-span-2">
            <span>Khi xảy ra</span>
            <select id="anim-f-key"></select>
          </label>
          <label class="anim-field" id="anim-f-phase-wrap">
            <span>Thời điểm</span>
            <select id="anim-f-phase">
              <option value="start">Khi bắt đầu</option>
              <option value="success">Khi thành công</option>
              <option value="error">Khi lỗi</option>
            </select>
          </label>
          <label class="anim-field">
            <span>Hoạt ảnh</span>
            <select id="anim-f-clip"></select>
          </label>
          <label class="anim-field">
            <span>Thời lượng <b id="anim-f-dur-val">1.5s</b></span>
            <input id="anim-f-dur" type="range" min="0.4" max="10" step="0.1" value="1.5" />
          </label>
          <label class="anim-field">
            <span>Hồi chiêu (giây)</span>
            <input id="anim-f-cd" type="number" min="0" max="60" step="0.5" value="1.5" />
          </label>
          <label class="anim-field">
            <span>Hiệu ứng 3D</span>
            <select id="anim-f-fx">${opts(FX_CATALOG, 'none')}</select>
          </label>
          <label class="anim-field">
            <span>Biểu cảm</span>
            <select id="anim-f-expr">${opts(EXPRESSION_CATALOG, 'none')}</select>
          </label>
          <label class="anim-field">
            <span>Âm thanh</span>
            <select id="anim-f-sound">${opts(SOUND_CATALOG, 'clip')}</select>
          </label>
        </div>
        <div class="anim-form-actions">
          <button id="anim-btn-preview" class="action-btn" type="button">${ICON_PLAY}<span>Xem thử</span></button>
          <button id="anim-btn-cancel" class="action-btn" type="button" style="display: none;">Huỷ sửa</button>
          <button id="anim-btn-save" class="studio-btn-primary anim-btn-save" type="button">${ICON_LINK}<span>Lưu gắn kết</span></button>
        </div>
      </div>

      <div class="anim-list-toolbar">
        <input id="anim-filter" class="anim-filter" type="text" placeholder="Lọc theo tool, trạng thái, hoạt ảnh..." />
        <select id="anim-filter-type" class="anim-filter-type">
          <option value="all">Tất cả</option>
          <option value="tool">Tool AI</option>
          <option value="skill">Skill</option>
          <option value="state">Trạng thái</option>
          <option value="event">Sự kiện</option>
        </select>
      </div>
      <div id="anim-binding-list" class="anim-binding-list"></div>

      <div class="anim-footer-row">
        <button id="anim-btn-export" class="action-btn" type="button">Sao chép JSON</button>
        <button id="anim-btn-import" class="action-btn" type="button">Nhập JSON</button>
        <button id="anim-btn-reset" class="action-btn anim-btn-danger" type="button">Khôi phục mặc định</button>
      </div>
      <div id="anim-import-box" class="anim-import-box" style="display: none;">
        <textarea id="anim-import-text" placeholder="Dán JSON danh sách gắn kết vào đây..."></textarea>
        <div style="display: flex; gap: 6px; justify-content: flex-end;">
          <button id="anim-btn-import-cancel" class="action-btn" type="button">Đóng</button>
          <button id="anim-btn-import-apply" class="studio-btn-primary" type="button">Áp dụng</button>
        </div>
      </div>
    </div>

    <div id="anim-pane-library" class="anim-pane" style="display: none;">
      <div class="dash-sub" style="margin-bottom: 6px;">Rê chuột để xem mô phỏng, bấm Chạy để Vịt diễn thật (kèm âm thanh &amp; đèn LED), hoặc Gắn nhanh để đưa vào biểu mẫu.</div>
      <div id="anim-lib-filters" class="anim-lib-filters">
        <button type="button" data-lib-grp="all" class="active">Tất cả (${CLIP_CATALOG.length})</button>
        <button type="button" data-lib-grp="featured">Nổi bật (${FEATURED_COUNT})</button>
        <button type="button" data-lib-grp="emotion">${GROUP_LABEL.emotion}</button>
        <button type="button" data-lib-grp="lifelike">${GROUP_LABEL.lifelike}</button>
        <button type="button" data-lib-grp="motion">${GROUP_LABEL.motion}</button>
        <button type="button" data-lib-grp="work">${GROUP_LABEL.work}</button>
        <button type="button" data-lib-grp="special">${GROUP_LABEL.special}</button>
      </div>
      <div id="anim-library-grid" class="anim-library-grid"></div>
    </div>

    <div id="anim-pane-log" class="anim-pane" style="display: none;">
      <div id="anim-log-list" class="anim-log-list">
        <div class="dash-sub">Chưa có hoạt ảnh nào được kích hoạt.</div>
      </div>
    </div>

    <div id="anim-toast" class="anim-toast"></div>
  </div>
`;

/* ------------------------------------------------------------------ */

let isOpen = false;
let currentTab: 'bind' | 'library' | 'log' = 'bind';
let libFilter: 'all' | 'featured' | ClipGroup = 'all';
let formType: AnimTriggerType = 'tool';
let editingId: string | null = null;
const fireLog: Array<{ at: number; text: string; kind: AnimTriggerType | 'preview' }> = [];

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function describeKey(b: Pick<AnimBinding, 'triggerType' | 'triggerKey'>): string {
  if (b.triggerKey === '*') {
    return b.triggerType === 'skill' ? 'Bất kỳ Skill nào (*)' : 'Bất kỳ Tool nào (*)';
  }
  if (b.triggerType === 'tool') {
    return TOOL_TRIGGER_CATALOG.find((t) => t.key === b.triggerKey)?.label || b.triggerKey;
  }
  if (b.triggerType === 'skill') {
    return getCachedCustomSkills().find((s) => s.id === b.triggerKey)?.name || b.triggerKey;
  }
  if (b.triggerType === 'event') {
    return EVENT_TRIGGER_CATALOG.find((e) => e.key === b.triggerKey)?.label || b.triggerKey;
  }
  return b.triggerKey;
}

function showToast(text: string) {
  const el = $('anim-toast');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

function fillKeySelect(selected?: string) {
  const sel = $('anim-f-key') as HTMLSelectElement | null;
  if (!sel) return;
  let html = '';
  if (formType === 'tool') {
    html = TOOL_TRIGGER_CATALOG.map((t) => `<option value="${esc(t.key)}">${esc(t.label)} [${esc(t.key)}]</option>`).join('');
  } else if (formType === 'skill') {
    const skills = getCachedCustomSkills();
    html = `<option value="*">Bất kỳ Skill nào (*)</option>`;
    html += skills
      .map((s) => `<option value="${esc(s.id)}">${esc(s.name)}${s.enabled ? '' : ' (đang tắt)'}</option>`)
      .join('');
    if (skills.length === 0) {
      html += `<option value="" disabled>Chưa có skill nào - hãy rèn trong Xưởng Skill</option>`;
    }
  } else if (formType === 'state') {
    html = STATE_TRIGGER_CATALOG.map((s) => `<option value="${s}">[${s}]</option>`).join('');
  } else {
    html = EVENT_TRIGGER_CATALOG.map((e) => `<option value="${esc(e.key)}">${esc(e.label)}</option>`).join('');
  }
  sel.innerHTML = html;
  if (selected) sel.value = selected;
  const phaseWrap = $('anim-f-phase-wrap');
  if (phaseWrap) phaseWrap.style.display = formType === 'tool' || formType === 'skill' ? '' : 'none';
}

function fillClipSelect(selected = 'curious_inspect') {
  const sel = $('anim-f-clip') as HTMLSelectElement | null;
  if (!sel) return;
  const groups: ClipGroup[] = ['emotion', 'lifelike', 'motion', 'work', 'special'];
  sel.innerHTML = groups
    .map(
      (g) =>
        `<optgroup label="${GROUP_LABEL[g]}">${CLIP_CATALOG.filter((c) => c.group === g)
          .map((c) => `<option value="${c.id}">${esc(c.label)}${c.featured ? ' [MỚI]' : ''}</option>`)
          .join('')}</optgroup>`
    )
    .join('');
  sel.value = selected;
}

function setFormType(tt: AnimTriggerType, selectedKey?: string) {
  formType = tt;
  document.querySelectorAll<HTMLButtonElement>('#anim-trigger-seg button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tt === tt);
  });
  fillKeySelect(selectedKey);
}

function readForm(): AnimBinding | null {
  const key = ($('anim-f-key') as HTMLSelectElement | null)?.value || '';
  if (!key) return null;
  const clipId = ($('anim-f-clip') as HTMLSelectElement).value;
  const phase: AnimTriggerPhase =
    formType === 'tool' || formType === 'skill'
      ? (($('anim-f-phase') as HTMLSelectElement).value as AnimTriggerPhase)
      : 'enter';
  const existing = editingId ? getBindings().find((b) => b.id === editingId) : undefined;
  return {
    id: editingId || `ab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    enabled: existing?.enabled ?? true,
    triggerType: formType,
    triggerKey: key,
    phase,
    clipId,
    durationSec: Number(($('anim-f-dur') as HTMLInputElement).value) || 1.5,
    fx: ($('anim-f-fx') as HTMLSelectElement).value as AnimFxId,
    expression: ($('anim-f-expr') as HTMLSelectElement).value as FaceExpression | 'none',
    sound: ($('anim-f-sound') as HTMLSelectElement).value as AnimSoundId,
    cooldownSec: Number(($('anim-f-cd') as HTMLInputElement).value) || 0,
    fireCount: existing?.fireCount ?? 0,
    loop: Boolean(($('anim-f-loop') as HTMLInputElement | null)?.checked),
  };
}

function setDuration(v: number) {
  const inp = $('anim-f-dur') as HTMLInputElement | null;
  const lbl = $('anim-f-dur-val');
  if (inp) inp.value = String(v);
  if (lbl) lbl.textContent = `${v.toFixed(1)}s`;
}

function resetForm() {
  editingId = null;
  const mode = $('anim-form-mode');
  if (mode) mode.textContent = 'Tạo gắn kết mới';
  const cancel = $('anim-btn-cancel');
  if (cancel) cancel.style.display = 'none';
  ($('anim-f-fx') as HTMLSelectElement).value = 'none';
  ($('anim-f-expr') as HTMLSelectElement).value = 'none';
  ($('anim-f-sound') as HTMLSelectElement).value = 'clip';
  ($('anim-f-cd') as HTMLInputElement).value = '1.5';
  ($('anim-f-phase') as HTMLSelectElement).value = 'start';
  const loopEl = $('anim-f-loop') as HTMLInputElement | null;
  if (loopEl) loopEl.checked = false;
  $('anim-pane-bind')?.querySelector('.anim-form-card')?.classList.remove('editing');
}

function loadIntoForm(b: AnimBinding) {
  editingId = b.id;
  setFormType(b.triggerType, b.triggerKey);
  fillClipSelect(b.clipId);
  ($('anim-f-phase') as HTMLSelectElement).value = b.phase === 'enter' ? 'start' : b.phase;
  setDuration(b.durationSec);
  ($('anim-f-cd') as HTMLInputElement).value = String(b.cooldownSec);
  ($('anim-f-fx') as HTMLSelectElement).value = b.fx;
  ($('anim-f-expr') as HTMLSelectElement).value = b.expression;
  ($('anim-f-sound') as HTMLSelectElement).value = b.sound;
  const loopEl = $('anim-f-loop') as HTMLInputElement | null;
  if (loopEl) loopEl.checked = b.loop === true;
  const mode = $('anim-form-mode');
  if (mode) mode.textContent = 'Đang chỉnh sửa gắn kết';
  const cancel = $('anim-btn-cancel');
  if (cancel) cancel.style.display = '';
  const card = $('anim-pane-bind')?.querySelector('.anim-form-card');
  card?.classList.remove('editing');
  void (card as HTMLElement | undefined)?.offsetWidth;
  card?.classList.add('editing');
  card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderBindingList() {
  const list = $('anim-binding-list');
  if (!list) return;
  const filter = (($('anim-filter') as HTMLInputElement | null)?.value || '').trim().toLowerCase();
  const typeFilter = ($('anim-filter-type') as HTMLSelectElement | null)?.value || 'all';
  const all = getBindings();
  const count = $('anim-mgr-count');
  if (count) count.textContent = `${all.filter((b) => b.enabled).length}/${all.length} GẮN KẾT`;

  const rows = all.filter((b) => {
    if (typeFilter !== 'all' && b.triggerType !== typeFilter) return false;
    if (!filter) return true;
    const clip = getClipById(b.clipId);
    const hay = `${b.triggerKey} ${describeKey(b)} ${clip?.label || ''} ${b.triggerType}`.toLowerCase();
    return hay.includes(filter);
  });

  if (rows.length === 0) {
    list.innerHTML = `<div class="dash-sub" style="padding: 10px; text-align: center;">Không có gắn kết nào khớp bộ lọc.</div>`;
    return;
  }

  list.innerHTML = rows
    .map((b, i) => {
      const clip = getClipById(b.clipId);
      const extras: string[] = [];
      if (b.loop) extras.push('Loop');
      if (b.fx !== 'none') extras.push(FX_CATALOG.find((f) => f.id === b.fx)?.label || b.fx);
      if (b.expression !== 'none') extras.push(EXPRESSION_CATALOG.find((e) => e.id === b.expression)?.label || '');
      if (b.sound !== 'none') extras.push(SOUND_CATALOG.find((s) => s.id === b.sound)?.label || '');
      return `
        <div class="anim-bind-row tt-${b.triggerType}${b.enabled ? '' : ' disabled'}" data-id="${esc(b.id)}" style="animation-delay: ${Math.min(i, 14) * 28}ms">
          <label class="anim-switch anim-switch-sm" title="Bật / tắt gắn kết">
            <input type="checkbox" data-act="toggle" ${b.enabled ? 'checked' : ''} />
            <span class="anim-switch-track"><span class="anim-switch-thumb"></span></span>
          </label>
          <div class="anim-bind-main">
            <div class="anim-bind-line">
              <span class="anim-tt-chip">${TRIGGER_TYPE_LABEL[b.triggerType]}</span>
              <span class="anim-bind-key" title="${esc(b.triggerKey)}">${esc(describeKey(b))}</span>
              ${b.triggerType === 'tool' || b.triggerType === 'skill' ? `<span class="anim-phase-chip ph-${b.phase}">${PHASE_LABEL[b.phase]}</span>` : ''}
            </div>
            <div class="anim-bind-sub">
              <span class="anim-arrow">-&gt;</span>
              <b>${esc(clip?.label || b.clipId)}</b>
              <span class="anim-dim">${b.durationSec.toFixed(1)}s</span>
              ${extras.length ? `<span class="anim-dim">+ ${esc(extras.filter(Boolean).join(', '))}</span>` : ''}
              ${b.fireCount > 0 ? `<span class="anim-fire-count" title="Số lần đã kích hoạt">${b.fireCount}x</span>` : ''}
            </div>
          </div>
          <div class="anim-bind-actions">
            <button class="icon-btn-tiny" data-act="play" type="button" title="Chạy thử">${ICON_PLAY}</button>
            <button class="icon-btn-tiny" data-act="edit" type="button" title="Chỉnh sửa">${ICON_EDIT}</button>
            <button class="icon-btn-tiny anim-del" data-act="del" type="button" title="Xoá">${ICON_TRASH}</button>
          </div>
        </div>`;
    })
    .join('');
}

const GLYPH_ANIM: Record<string, string> = {
  curious_inspect: 'g-curious',
  happy_wiggle: 'g-wiggle',
  startled_hop: 'g-startled',
  shy_sit: 'g-shy',
  polite_bow: 'g-bow',
  idle_alive: 'g-alive',
  sleepy_doze: 'g-doze',
  wake_stretch: 'g-wake',
  stalking_crouch: 'g-stalk',
  proud_carry: 'g-proud',
  dramatic_flop: 'g-flop',
  nod: 'g-nod',
  head_shake: 'g-shake',
  hop: 'g-hop',
  victory: 'g-victory',
  bow: 'g-bow',
  think: 'g-think',
  shiver: 'g-shiver',
  typing: 'g-nod',
  peek: 'g-peek',
  surprise: 'g-hop',
  sad: 'g-sad',
  twirl: 'g-twirl',
  heartbeat: 'g-pulse',
  sneeze: 'g-sneeze',
  groove: 'g-groove',
  chomp: 'g-pulse',
  stretch: 'g-stretch',
  front_flip: 'g-flip',
  jelly: 'g-jelly',
  levitate: 'g-float',
  scan_look: 'g-peek',
  facepalm: 'g-sad',
  cheer: 'g-hop',
  reading_study: 'g-read',
  pipe_ponder: 'g-pipe',
  eureka_idea: 'g-idea',
  coffee_sip: 'g-coffee',
  detective_scan: 'g-magnify',
  weather_shiver: 'g-shiver',
  weather_breeze: 'g-breeze',
  weather_sunbathe: 'g-sun',
};

function renderLibrary() {
  const grid = $('anim-library-grid');
  if (!grid) return;
  const usage = new Map<string, number>();
  getBindings().forEach((b) => usage.set(b.clipId, (usage.get(b.clipId) || 0) + 1));

  const clips = CLIP_CATALOG.filter((c) => {
    if (libFilter === 'all') return true;
    if (libFilter === 'featured') return Boolean(c.featured);
    return c.group === libFilter;
  });

  grid.innerHTML = clips
    .map((c, i) => {
      const tags: string[] = [];
      if (c.featured) tags.push('<span class="anim-tag-new">MỚI</span>');
      if (c.defaultFx && c.defaultFx.startsWith('prop_')) tags.push('<span class="anim-tag-feat">3D PROP</span>');
      if (c.ledColor) tags.push('<span class="anim-tag-feat">LED</span>');
      if (c.soundCues && c.soundCues.length > 0) tags.push('<span class="anim-tag-feat">ÂM THANH</span>');
      if (c.recommendedLoop) tags.push('<span class="anim-tag-feat">LOOP</span>');
      return `
      <div class="anim-clip-card grp-${c.group}${c.featured ? ' is-featured' : ''}" data-clip="${c.id}" style="animation-delay: ${Math.min(i, 20) * 20}ms">
        <div class="anim-clip-stage ${GLYPH_ANIM[c.id] || 'g-hop'}">${DUCK_GLYPH}</div>
        <div class="anim-clip-name">${esc(c.label)}</div>
        <div class="anim-clip-desc" title="${esc(c.phaseNote || c.description)}">${esc(c.description)}</div>
        ${tags.length ? `<div class="anim-clip-tags">${tags.join('')}</div>` : ''}
        <div class="anim-clip-meta">
          <span class="anim-grp-chip">${GROUP_LABEL[c.group]}</span>
          <span class="anim-dim">${c.defaultDuration.toFixed(1)}s</span>
          ${usage.get(c.id) ? `<span class="anim-fire-count">${usage.get(c.id)} gắn</span>` : ''}
        </div>
        <div class="anim-clip-actions">
          <button class="action-btn" data-act="run" type="button">${ICON_PLAY}<span>Chạy</span></button>
          <button class="action-btn" data-act="bind" type="button">${ICON_LINK}<span>Gắn nhanh</span></button>
        </div>
      </div>`;
    })
    .join('');
}

function renderLog() {
  const list = $('anim-log-list');
  if (!list) return;
  if (fireLog.length === 0) {
    list.innerHTML = `<div class="dash-sub">Chưa có hoạt ảnh nào được kích hoạt.</div>`;
    return;
  }
  list.innerHTML = fireLog
    .map((e) => {
      const d = new Date(e.at);
      const ts = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      return `<div class="anim-log-row lk-${e.kind}"><span class="anim-log-ts">${ts}</span><span>${esc(e.text)}</span></div>`;
    })
    .join('');
}

function setTab(tab: typeof currentTab) {
  currentTab = tab;
  document.querySelectorAll<HTMLButtonElement>('#anim-manager-modal [data-anim-tab]').forEach((b) => {
    b.classList.toggle('active', b.dataset.animTab === tab);
  });
  const panes: Record<typeof currentTab, string> = {
    bind: 'anim-pane-bind',
    library: 'anim-pane-library',
    log: 'anim-pane-log',
  };
  (Object.keys(panes) as Array<typeof currentTab>).forEach((k) => {
    const el = $(panes[k]);
    if (el) el.style.display = k === tab ? '' : 'none';
  });
  if (tab === 'library') renderLibrary();
  if (tab === 'log') renderLog();
  window.setTimeout(() => syncHitboxToRust(true), 30);
}

export function toggleAnimationManager(force?: boolean) {
  const modal = $('anim-manager-modal');
  if (!modal) return;
  isOpen = force !== undefined ? force : !isOpen;
  if (isOpen) {
    window.dispatchEvent(new CustomEvent('duck-close-other-modals'));
  }
  modal.style.display = isOpen ? 'block' : 'none';
  $('dock-btn-anim')?.classList.toggle('active', isOpen);
  if (isOpen) {
    const master = $('anim-mgr-master') as HTMLInputElement | null;
    if (master) master.checked = isAnimBinderEnabled();
    renderBindingList();
    if (currentTab === 'library') renderLibrary();
    void refreshCustomSkills()
      .then(() => {
        if (formType === 'skill') fillKeySelect(($('anim-f-key') as HTMLSelectElement | null)?.value);
        renderBindingList();
      })
      .catch(() => {});
  }
  window.setTimeout(() => syncHitboxToRust(true), 30);
}

export function initAnimationManagerUi() {
  const modal = $('anim-manager-modal');
  if (!modal) return;

  setFormType('tool', 'web_search');
  fillClipSelect('curious_inspect');
  setDuration(getClipById('curious_inspect')?.defaultDuration ?? 2.5);

  $('btn-open-anim-manager')?.addEventListener('click', () => toggleAnimationManager(true));
  $('dock-btn-anim')?.addEventListener('click', () => toggleAnimationManager());
  $('btn-close-anim-mgr')?.addEventListener('click', () => toggleAnimationManager(false));

  window.addEventListener('duck-close-anim-manager', () => {
    if (isOpen) toggleAnimationManager(false);
  });
  window.addEventListener('duck-open-anim-manager', () => {
    toggleAnimationManager(true);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      e.stopImmediatePropagation();
      toggleAnimationManager(false);
    }
  }, true);

  $('anim-btn-stop')?.addEventListener('click', () => {
    stopAllClips();
    window.dispatchEvent(new CustomEvent('duck-anim-stopped'));
    showToast('[STOP] Đã dừng mọi hoạt ảnh đang phát');
  });

  ($('anim-mgr-master') as HTMLInputElement | null)?.addEventListener('change', (e) => {
    const on = (e.target as HTMLInputElement).checked;
    setAnimBinderEnabled(on);
    if (!on) window.dispatchEvent(new CustomEvent('duck-anim-stopped'));
    showToast(on ? '[ON] Hệ thống hoạt ảnh gắn kết đã bật' : '[OFF] Đã tạm dừng toàn bộ hoạt ảnh gắn kết');
  });

  modal.querySelectorAll<HTMLButtonElement>('[data-anim-tab]').forEach((b) => {
    b.addEventListener('click', () => setTab(b.dataset.animTab as typeof currentTab));
  });

  $('anim-lib-filters')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!btn?.dataset.libGrp) return;
    libFilter = btn.dataset.libGrp as typeof libFilter;
    document.querySelectorAll<HTMLButtonElement>('#anim-lib-filters button').forEach((b) => {
      b.classList.toggle('active', b === btn);
    });
    renderLibrary();
  });

  $('anim-trigger-seg')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (btn?.dataset.tt) setFormType(btn.dataset.tt as AnimTriggerType);
  });

  $('anim-f-clip')?.addEventListener('change', (e) => {
    const clip = getClipById((e.target as HTMLSelectElement).value);
    if (clip && !editingId) {
      setDuration(clip.defaultDuration);
      const loopEl = $('anim-f-loop') as HTMLInputElement | null;
      if (loopEl) loopEl.checked = Boolean(clip.recommendedLoop);
      const fxEl = $('anim-f-fx') as HTMLSelectElement | null;
      if (fxEl) fxEl.value = clip.defaultFx || 'none';
    }
  });
  $('anim-f-dur')?.addEventListener('input', (e) => {
    setDuration(Number((e.target as HTMLInputElement).value));
  });

  $('anim-btn-preview')?.addEventListener('click', () => {
    const b = readForm();
    if (b) runBinding(b, true);
    else previewClip(($('anim-f-clip') as HTMLSelectElement).value);
  });

  $('anim-btn-save')?.addEventListener('click', () => {
    const b = readForm();
    if (!b) {
      showToast('[WARN] Hãy chọn điều kiện kích hoạt hợp lệ');
      return;
    }
    const dup = getBindings().find(
      (x) =>
        x.id !== b.id &&
        x.triggerType === b.triggerType &&
        x.triggerKey === b.triggerKey &&
        x.phase === b.phase
    );
    if (dup) {
      // Một trigger chỉ giữ 1 gắn kết: thay thế bản cũ để tránh xung đột
      removeBinding(dup.id);
    }
    const wasEditing = Boolean(editingId);
    upsertBinding(b);
    resetForm();
    showToast(wasEditing ? '[SAVED] Đã cập nhật gắn kết' : dup ? '[SAVED] Đã thay thế gắn kết cũ cùng điều kiện' : '[SAVED] Đã tạo gắn kết mới');
    const first = $('anim-binding-list')?.querySelector(`[data-id="${CSS.escape(b.id)}"]`);
    first?.classList.add('flash');
  });

  $('anim-btn-cancel')?.addEventListener('click', () => resetForm());

  $('anim-filter')?.addEventListener('input', () => renderBindingList());
  $('anim-filter-type')?.addEventListener('change', () => renderBindingList());

  $('anim-binding-list')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const row = target.closest('.anim-bind-row') as HTMLElement | null;
    const actEl = target.closest('[data-act]') as HTMLElement | null;
    if (!row || !actEl) return;
    const id = row.dataset.id || '';
    const b = getBindings().find((x) => x.id === id);
    if (!b) return;
    const act = actEl.dataset.act;
    if (act === 'play') {
      runBinding(b, true);
    } else if (act === 'edit') {
      setTab('bind');
      loadIntoForm(b);
    } else if (act === 'del') {
      row.classList.add('removing');
      window.setTimeout(() => {
        removeBinding(id);
        if (editingId === id) resetForm();
      }, 220);
    }
  });
  $('anim-binding-list')?.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    if (input.dataset.act !== 'toggle') return;
    const row = input.closest('.anim-bind-row') as HTMLElement | null;
    if (row?.dataset.id) toggleBinding(row.dataset.id, input.checked);
  });

  $('anim-library-grid')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const card = target.closest('.anim-clip-card') as HTMLElement | null;
    const actEl = target.closest('[data-act]') as HTMLElement | null;
    if (!card || !actEl) return;
    const clipId = card.dataset.clip || '';
    if (actEl.dataset.act === 'run') {
      previewClip(clipId);
      card.classList.remove('played');
      void card.offsetWidth;
      card.classList.add('played');
    } else if (actEl.dataset.act === 'bind') {
      const clip = getClipById(clipId);
      setTab('bind');
      resetForm();
      fillClipSelect(clipId);
      setDuration(clip?.defaultDuration ?? 1.5);
      const loopEl = $('anim-f-loop') as HTMLInputElement | null;
      if (loopEl) loopEl.checked = Boolean(clip?.recommendedLoop);
      const fxEl = $('anim-f-fx') as HTMLSelectElement | null;
      if (fxEl) fxEl.value = clip?.defaultFx || 'none';
      showToast('[INFO] Đã chọn hoạt ảnh - hãy chọn điều kiện kích hoạt rồi Lưu');
    }
  });

  $('anim-btn-export')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(exportBindingsJson());
      showToast('[COPIED] Đã sao chép JSON gắn kết vào clipboard');
    } catch {
      showToast('[ERROR] Không truy cập được clipboard');
    }
  });
  $('anim-btn-import')?.addEventListener('click', () => {
    const box = $('anim-import-box');
    if (box) box.style.display = box.style.display === 'none' ? '' : 'none';
    window.setTimeout(() => syncHitboxToRust(true), 30);
  });
  $('anim-btn-import-cancel')?.addEventListener('click', () => {
    const box = $('anim-import-box');
    if (box) box.style.display = 'none';
    window.setTimeout(() => syncHitboxToRust(true), 30);
  });
  $('anim-btn-import-apply')?.addEventListener('click', () => {
    const txt = ($('anim-import-text') as HTMLTextAreaElement).value;
    try {
      const n = importBindingsJson(txt);
      showToast(`[IMPORTED] Đã nạp ${n} gắn kết hợp lệ`);
      const box = $('anim-import-box');
      if (box) box.style.display = 'none';
    } catch (err) {
      showToast(`[ERROR] JSON không hợp lệ: ${String(err).slice(0, 80)}`);
    }
  });
  $('anim-btn-reset')?.addEventListener('click', () => {
    resetBindingsToDefault();
    resetForm();
    showToast('[RESET] Đã khôi phục bộ gắn kết mặc định');
  });

  onBindingsChanged(() => {
    if (!isOpen) return;
    renderBindingList();
    if (currentTab === 'library') renderLibrary();
    window.setTimeout(() => syncHitboxToRust(true), 30);
  });

  onAnimationFired((b, clip) => {
    const text = b
      ? `${TRIGGER_TYPE_LABEL[b.triggerType]} "${describeKey(b)}"${b.triggerType === 'tool' || b.triggerType === 'skill' ? ` (${PHASE_LABEL[b.phase]})` : ''} -> ${clip.label}`
      : `Xem thử -> ${clip.label}`;
    fireLog.unshift({ at: Date.now(), text, kind: b ? b.triggerType : 'preview' });
    if (fireLog.length > 40) fireLog.length = 40;
    if (isOpen && currentTab === 'log') renderLog();
    if (isOpen && currentTab === 'bind' && b) {
      const row = $('anim-binding-list')?.querySelector(`[data-id="${CSS.escape(b.id)}"]`);
      if (row) {
        row.classList.remove('flash');
        void (row as HTMLElement).offsetWidth;
        row.classList.add('flash');
      }
    }
  });
}
