import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { appState } from '../../core/state';
import {
  CapturedWindowBatchItem,
  MiniWebStatus,
  MiniWindowEntry,
  WinRect,
} from '../../core/types';

export interface MiniScreenUiDeps {
  getMiniScreenPanel: () => HTMLDivElement | null;
  getDockBtnMiniScreen: () => HTMLButtonElement | null;
  syncHitboxToRust: (force?: boolean) => void;
  speakMessage: (msg: string) => void;
  runPcMedia: (action: 'prev' | 'play_pause' | 'next' | 'vol_down' | 'vol_up') => Promise<void>;
  findTargetWindow: () => WinRect | null;
}

const DEFAULT_MINI_W = 460;
const DEFAULT_MINI_H = 390;
const MIN_MINI_W = 310;
const MAX_MINI_W = 1440;
const MIN_MINI_H = 230;
const MAX_MINI_H = 960;

let savedDeps: MiniScreenUiDeps | null = null;
let miniScreenTab: 'web' | 'mirror' = 'web';
let miniLayout: 1 | 2 | 4 = 1;
let preZoomLayout: 1 | 2 | 4 | null = null;
let slotHwnds: [number, number, number, number] = [0, 0, 0, 0];
let activeSlot = 0;

let miniMirrorActive = false;
let miniMirrorBusy = false;
let miniMirrorTimer: number | null = null;
let miniDisplayStream: MediaStream | null = null;
let miniPanelCollapsed = false;
let miniWebIsOpen = false;
let miniMirrorWindows: MiniWindowEntry[] = [];
let lastMiniWinFetchAt = 0;
let customW = DEFAULT_MINI_W;
let customH = DEFAULT_MINI_H;

function clampSize(w: number, h: number): { width: number; height: number } {
  const maxW = Math.max(MIN_MINI_W, Math.min((appState.W || 1920) - 16, MAX_MINI_W));
  const maxH = Math.max(MIN_MINI_H, Math.min((appState.H || 1080) - 16, MAX_MINI_H));
  return {
    width: Math.round(Math.max(MIN_MINI_W, Math.min(maxW, w))),
    height: Math.round(Math.max(MIN_MINI_H, Math.min(maxH, h))),
  };
}

function updateSizeReadoutUi() {
  const el = document.getElementById('mini-size-readout');
  if (el) {
    el.textContent = `${customW}x${customH}`;
  }
}

function clampPanelWithinViewport(panel: HTMLDivElement) {
  if (!panel.style.left || panel.style.left === 'auto') return;
  const curLeft = parseFloat(panel.style.left) || 0;
  const curTop = parseFloat(panel.style.top) || 0;
  const maxL = Math.max(6, (appState.W || 1920) - customW - 6);
  const maxT = Math.max(6, (appState.H || 1080) - 80);
  panel.style.left = `${Math.round(Math.max(6, Math.min(maxL, curLeft)))}px`;
  panel.style.top = `${Math.round(Math.max(6, Math.min(maxT, curTop)))}px`;
}

function applyPanelSize(
  panel: HTMLDivElement | null,
  w: number,
  h: number,
  persist = false
) {
  const clamped = clampSize(w, h);
  customW = clamped.width;
  customH = clamped.height;
  updateSizeReadoutUi();

  if (panel) {
    panel.style.width = `${customW}px`;
    if (!miniPanelCollapsed) {
      panel.style.height = `${customH}px`;
      panel.style.minHeight = `${MIN_MINI_H}px`;
    }
    clampPanelWithinViewport(panel);
  }
  if (persist) {
    localStorage.setItem('mate_mini_size_v2', JSON.stringify({ width: customW, height: customH }));
    savedDeps?.syncHitboxToRust(true);
  }
}

function updateMiniResourceStatus() {
  const el = document.getElementById('mini-resource-status');
  if (!el) return;
  const webPart = miniWebIsOpen
    ? 'WebView Mini: ĐANG CHẠY'
    : 'WebView Mini: ĐÃ TẮT (0 MB RAM)';
  const visibleSlots = getVisibleSlotIndices();
  const activeCount = visibleSlots.filter((s) => slotHwnds[s] > 0).length;
  const mirrorPart = miniDisplayStream
    ? 'Chiếu App: WEBRTC 60FPS'
    : miniMirrorActive
    ? `Chiếu App: ĐANG CHẠY (${activeCount}/${miniLayout} ô)`
    : `Chiếu App: TẮT (${miniLayout} Ô)`;
  el.textContent = `${webPart} | ${mirrorPart}`;
}

function setMiniScreenModeBadge(label: string) {
  const b = document.getElementById('mini-screen-mode-badge');
  if (b) b.textContent = label;
}

function getVisibleSlotIndices(): number[] {
  if (miniLayout === 1) {
    return [Math.max(0, Math.min(3, activeSlot))];
  }
  if (miniLayout === 2) {
    return [0, 1];
  }
  return [0, 1, 2, 3];
}

function renderLayoutVisibilityAndActiveTile() {
  const grid = document.getElementById('mini-mirror-grid');
  if (grid) {
    grid.className = `mini-mirror-grid layout-${miniLayout}`;
  }
  document.querySelectorAll('.mini-layout-btn').forEach((btn) => {
    const val = Number(btn.getAttribute('data-layout') || '1');
    btn.classList.toggle('active', val === miniLayout);
  });

  const visible = new Set(getVisibleSlotIndices());
  if (!visible.has(activeSlot)) {
    activeSlot = getVisibleSlotIndices()[0] ?? 0;
  }

  document.querySelectorAll('.mini-mirror-tile').forEach((tile) => {
    const slot = Number(tile.getAttribute('data-slot') || '0');
    tile.classList.toggle('visible-tile', visible.has(slot));
    tile.classList.toggle('active-tile', slot === activeSlot);
  });
}

function syncStealthButtonsUi() {
  const hwnd = slotHwnds[activeSlot] || 0;
  const entry = miniMirrorWindows.find((w) => w.hwnd === hwnd);
  const stealthBtn = document.getElementById('btn-mini-stealth-toggle');
  if (stealthBtn) {
    stealthBtn.textContent = entry?.is_stealth
      ? 'Hiện Lại App Đang Ẩn'
      : 'Ẩn App (Vẫn Chiếu)';
  }
  const anyStealth = miniMirrorWindows.some((w) => w.is_stealth);
  const restoreBtn = document.getElementById('btn-mini-restore-all');
  if (restoreBtn) {
    restoreBtn.style.display = anyStealth ? 'block' : 'none';
  }

  for (let s = 0; s < 4; s++) {
    const sh = slotHwnds[s];
    const sEntry = miniMirrorWindows.find((w) => w.hwnd === sh);
    const tileStealthBtn = document.querySelector(`.mini-tile-stealth[data-slot="${s}"]`);
    if (tileStealthBtn) {
      tileStealthBtn.classList.toggle('stealth-on', Boolean(sEntry?.is_stealth));
    }
  }
}

function syncMainSelectWithActiveSlot() {
  const mainSel = document.getElementById('mini-mirror-win-select') as HTMLSelectElement | null;
  const val = String(slotHwnds[activeSlot] || 0);
  if (mainSel && mainSel.value !== val) {
    mainSel.value = val;
  }
  const tileSel = document.querySelector(`.mini-tile-select[data-slot="${activeSlot}"]`) as HTMLSelectElement | null;
  if (tileSel && tileSel.value !== val) {
    tileSel.value = val;
  }
  syncStealthButtonsUi();
  updateMiniResourceStatus();
}

function persistSlots() {
  try {
    localStorage.setItem('mate_mini_slots_v1', JSON.stringify(slotHwnds));
  } catch {
    // ignore storage errors
  }
}

function autoPopulateEmptyVisibleSlots() {
  if (miniMirrorWindows.length === 0) return;
  const visible = getVisibleSlotIndices();
  const used = new Set(visible.map((idx) => slotHwnds[idx]).filter((h) => h > 0));

  for (const idx of visible) {
    if (slotHwnds[idx] > 0 && miniMirrorWindows.some((w) => w.hwnd === slotHwnds[idx])) {
      continue;
    }
    const candidate =
      miniMirrorWindows.find((w) => !used.has(w.hwnd)) || miniMirrorWindows[0];
    if (candidate) {
      slotHwnds[idx] = candidate.hwnd;
      used.add(candidate.hwnd);
      const tileSel = document.querySelector(`.mini-tile-select[data-slot="${idx}"]`) as HTMLSelectElement | null;
      if (tileSel) tileSel.value = String(candidate.hwnd);
    }
  }
  persistSlots();
  syncMainSelectWithActiveSlot();
}

function setMiniLayout(nextLayout: 1 | 2 | 4, autoAssign = true, keepZoomMemory = false) {
  if (!keepZoomMemory) {
    preZoomLayout = null;
  }
  miniLayout = nextLayout;
  localStorage.setItem('mate_mini_layout', String(nextLayout));
  if (miniLayout === 2 && activeSlot > 1) activeSlot = 0;

  renderLayoutVisibilityAndActiveTile();
  if (autoAssign) {
    autoPopulateEmptyVisibleSlots();
  } else {
    syncMainSelectWithActiveSlot();
  }

  const panel = savedDeps?.getMiniScreenPanel() ?? null;
  if (panel && !miniPanelCollapsed) {
    let targetW = customW;
    let targetH = customH;
    if (miniLayout === 2 && targetW < 580) targetW = 580;
    if (miniLayout === 4) {
      if (targetW < 640) targetW = 640;
      if (targetH < 440) targetH = 440;
    }
    if (targetW !== customW || targetH !== customH) {
      applyPanelSize(panel, targetW, targetH, true);
    }
  }
  updateMiniResourceStatus();
  if (miniMirrorActive) {
    void stepMiniMirrorFrame();
  }
}

function setActiveSlot(slot: number) {
  activeSlot = Math.max(0, Math.min(3, slot));
  renderLayoutVisibilityAndActiveTile();
  syncMainSelectWithActiveSlot();
}

export async function refreshMiniMirrorWindowSelect(force = false) {
  const mainSel = document.getElementById('mini-mirror-win-select') as HTMLSelectElement | null;
  const tileSelects = Array.from(
    document.querySelectorAll('.mini-tile-select')
  ) as HTMLSelectElement[];
  if (!mainSel && tileSelects.length === 0) return;

  const now = performance.now();
  if (!force && now - lastMiniWinFetchAt < 3500) return;
  lastMiniWinFetchAt = now;

  try {
    const windows = await invoke<MiniWindowEntry[]>('mini_screen_list_windows');
    miniMirrorWindows = Array.isArray(windows) ? windows : [];
  } catch {
    return;
  }

  const key = miniMirrorWindows
    .map((w) => `${w.hwnd}:${w.is_minimized ? 1 : 0}:${w.is_stealth ? 1 : 0}:${w.title.slice(0, 16)}`)
    .join('|');

  if (!force && mainSel && mainSel.dataset.key === key) {
    syncStealthButtonsUi();
    return;
  }
  if (mainSel) mainSel.dataset.key = key;

  const validSet = new Set(miniMirrorWindows.map((w) => w.hwnd));
  for (let s = 0; s < 4; s++) {
    if (slotHwnds[s] && !validSet.has(slotHwnds[s])) {
      slotHwnds[s] = 0;
    }
  }
  if (!slotHwnds[activeSlot]) {
    const preferredHwnd =
      appState.activeWindowHwnd || savedDeps?.findTargetWindow()?.hwnd || 0;
    if (preferredHwnd && validSet.has(preferredHwnd)) {
      slotHwnds[activeSlot] = preferredHwnd;
    }
  }

  const buildOptions = (selectedHwnd: number, placeholderLabel: string) => {
    return [
      `<option value="0">${placeholderLabel}</option>`,
      ...miniMirrorWindows.map((w) => {
        const procTag = w.process_name ? `[${w.process_name}] ` : '';
        const stateTag = w.is_stealth ? '[Đang ẩn] ' : w.is_minimized ? '[Thu nhỏ] ' : '';
        const selAttr = w.hwnd === selectedHwnd ? 'selected' : '';
        return `<option value="${w.hwnd}" ${selAttr}>${stateTag}${procTag}${w.title.slice(0, 36)}</option>`;
      }),
    ].join('');
  };

  if (mainSel) {
    mainSel.innerHTML = buildOptions(slotHwnds[activeSlot] || 0, 'Chọn app cho ô đang chọn...');
  }
  tileSelects.forEach((sel) => {
    const slot = Number(sel.getAttribute('data-slot') || '0');
    sel.innerHTML = buildOptions(slotHwnds[slot] || 0, `Ô #${slot + 1}...`);
  });

  if (miniLayout > 1) {
    autoPopulateEmptyVisibleSlots();
  } else {
    syncMainSelectWithActiveSlot();
  }
}

function stopMiniDisplayMedia() {
  if (miniDisplayStream) {
    miniDisplayStream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {}
    });
    miniDisplayStream = null;
  }
  const vid = document.getElementById('mini-display-video') as HTMLVideoElement | null;
  if (vid) {
    vid.srcObject = null;
    vid.style.display = 'none';
  }
  const btn = document.getElementById('btn-mini-display-media');
  if (btn) btn.textContent = 'Bắt Tab / Màn 60 FPS';
  updateMiniResourceStatus();
}

function setTileViewState(slot: number, bmpSrc: string | null, placeholderMsg: string) {
  const img = document.querySelector(`.mini-tile-img[data-slot="${slot}"]`) as HTMLImageElement | null;
  const ph = document.querySelector(`.mini-tile-placeholder[data-slot="${slot}"]`) as HTMLDivElement | null;
  if (bmpSrc) {
    if (img) {
      img.src = bmpSrc;
      img.style.display = 'block';
    }
    if (ph) ph.style.display = 'none';
  } else {
    if (img) {
      img.src = '';
      img.style.display = 'none';
    }
    if (ph) {
      ph.style.display = 'block';
      ph.textContent = placeholderMsg;
    }
  }
}

function stopMiniWindowMirror() {
  miniMirrorActive = false;
  if (miniMirrorTimer !== null) {
    window.clearTimeout(miniMirrorTimer);
    miniMirrorTimer = null;
  }
  for (let s = 0; s < 4; s++) {
    setTileViewState(
      s,
      null,
      `Ô #${s + 1}: Chọn ứng dụng cần giám sát ở thanh trên rồi bấm "Bắt Đầu Chiếu App".`
    );
  }
  const toggleBtn = document.getElementById('btn-mini-mirror-toggle');
  if (toggleBtn) toggleBtn.textContent = 'Bắt Đầu Chiếu App';
  if (!miniDisplayStream) {
    setMiniScreenModeBadge(miniWebIsOpen ? '[WEB MINI ON]' : '[LIVE]');
  }
  updateMiniResourceStatus();
}

async function stepMiniMirrorFrame() {
  if (!miniMirrorActive) return;
  if (!appState.isMiniScreenOpen || miniPanelCollapsed || miniScreenTab !== 'mirror') {
    stopMiniWindowMirror();
    return;
  }
  if (miniMirrorBusy) {
    miniMirrorTimer = window.setTimeout(() => void stepMiniMirrorFrame(), 120);
    return;
  }

  const fpsSel = document.getElementById('select-mini-mirror-fps') as HTMLSelectElement | null;
  const chkStealth = document.getElementById('chk-mini-auto-stealth') as HTMLInputElement | null;
  const fps = Math.max(2, Math.min(10, Number(fpsSel?.value || '6') || 6));

  const visibleSlots = getVisibleSlotIndices();
  if (miniLayout === 1 && !slotHwnds[activeSlot]) {
    const fallbackHwnd = appState.activeWindowHwnd || savedDeps?.findTargetWindow()?.hwnd || 0;
    if (fallbackHwnd) {
      slotHwnds[activeSlot] = fallbackHwnd;
      syncMainSelectWithActiveSlot();
    }
  }

  const uniqueHwnds = Array.from(
    new Set(visibleSlots.map((s) => slotHwnds[s]).filter((h) => h > 0))
  );

  if (uniqueHwnds.length === 0) {
    for (const s of visibleSlots) {
      setTileViewState(s, null, `Ô #${s + 1}: Hãy chọn một ứng dụng / cửa sổ để chiếu.`);
    }
    setMiniScreenModeBadge('[WAIT]');
    miniMirrorTimer = window.setTimeout(() => void stepMiniMirrorFrame(), 650);
    return;
  }

  miniMirrorBusy = true;
  try {
    const viewportEl = document.querySelector('.mini-screen-viewport') as HTMLElement | null;
    const vw = viewportEl?.clientWidth || Math.max(300, customW - 24);
    const cols = miniLayout === 1 ? 1 : 2;
    const perTileMaxW = Math.round(Math.min(1180, Math.max(240, (vw / cols) * 1.15)));

    const results = await invoke<CapturedWindowBatchItem[]>(
      'mini_screen_capture_windows_batch',
      {
        hwnds: uniqueHwnds,
        maxWidth: perTileMaxW,
        autoStealthMinimized: chkStealth?.checked ?? true,
      }
    );
    if (!miniMirrorActive) return;

    const byHwnd = new Map<number, CapturedWindowBatchItem>();
    for (const item of results) {
      byHwnd.set(item.hwnd, item);
    }

    let anyStealthChanged = false;
    let firstFrameStealth = false;
    let anyLiveRendered = false;

    for (const s of visibleSlots) {
      const h = slotHwnds[s];
      if (!h) {
        setTileViewState(s, null, `Ô #${s + 1}: Chọn ứng dụng...`);
        continue;
      }
      const item = byHwnd.get(h);
      if (!item || !item.frame) {
        setTileViewState(s, null, item?.error || `Ô #${s + 1}: Không đọc được khung hình.`);
        continue;
      }
      const f = item.frame;
      if (f.is_minimized || !f.bmp_base64) {
        setTileViewState(
          s,
          null,
          `"${f.title}" đang thu nhỏ. Bật Xem Ẩn hoặc bấm Đưa App Lên.`
        );
      } else {
        setTileViewState(s, `data:image/bmp;base64,${f.bmp_base64}`, '');
        anyLiveRendered = true;
        if (f.is_stealth) firstFrameStealth = true;
        const cached = miniMirrorWindows.find((w) => w.hwnd === h);
        if (cached && Boolean(f.is_stealth) !== cached.is_stealth) {
          anyStealthChanged = true;
        }
      }
    }

    if (miniLayout > 1) {
      setMiniScreenModeBadge(`[${miniLayout} Ô ${fps}FPS]`);
    } else if (!anyLiveRendered) {
      setMiniScreenModeBadge('[MINIMIZED]');
    } else {
      setMiniScreenModeBadge(firstFrameStealth ? `[XEM ẨN ${fps}FPS]` : `[APP ${fps}FPS]`);
    }
    updateMiniResourceStatus();

    if (anyStealthChanged) {
      void refreshMiniMirrorWindowSelect(true);
    }
  } catch (err) {
    for (const s of visibleSlots) {
      setTileViewState(s, null, String(err));
    }
    setMiniScreenModeBadge('[WAIT]');
  } finally {
    miniMirrorBusy = false;
    if (miniMirrorActive) {
      miniMirrorTimer = window.setTimeout(
        () => void stepMiniMirrorFrame(),
        Math.round(1000 / fps)
      );
    }
  }
}

function startMiniWindowMirror() {
  stopMiniDisplayMedia();
  stopMiniWindowMirror();
  miniMirrorActive = true;
  const toggleBtn = document.getElementById('btn-mini-mirror-toggle');
  if (toggleBtn) toggleBtn.textContent = 'Dừng Chiếu App';
  updateMiniResourceStatus();
  void refreshMiniMirrorWindowSelect(true).then(() => {
    if (miniMirrorActive) void stepMiniMirrorFrame();
  });
}

async function startMiniDisplayMedia() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    savedDeps?.speakMessage(
      '[MINI SCREEN] WebView hiện tại không hỗ trợ getDisplayMedia. Hãy dùng nút "Bắt Đầu Chiếu App" hoặc tab "YouTube & Web Mini" nhé!'
    );
    return;
  }
  stopMiniWindowMirror();
  stopMiniDisplayMedia();
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: false,
    });
    miniDisplayStream = stream;
    const vid = document.getElementById('mini-display-video') as HTMLVideoElement | null;
    const btn = document.getElementById('btn-mini-display-media');
    if (vid) {
      vid.srcObject = stream;
      vid.style.display = 'block';
    }
    if (btn) btn.textContent = 'Đang Bắt 60 FPS (Click Để Tắt)';
    setMiniScreenModeBadge('[WEBRTC 60FPS]');
    updateMiniResourceStatus();
    stream.getVideoTracks().forEach((track) => {
      track.addEventListener('ended', () => {
        stopMiniDisplayMedia();
        setMiniScreenModeBadge('[LIVE]');
      });
    });
  } catch (err) {
    savedDeps?.speakMessage(
      `[MINI SCREEN] Bạn đã hủy hoặc WebView chặn chọn nguồn chia sẻ: ${String(err)}`
    );
  }
}

function setMiniScreenTab(tab: 'web' | 'mirror') {
  miniScreenTab = tab;
  const btnWeb = document.getElementById('tab-btn-mini-web');
  const btnMirror = document.getElementById('tab-btn-mini-mirror');
  const paneWeb = document.getElementById('mini-pane-web');
  const paneMirror = document.getElementById('mini-pane-mirror');
  if (btnWeb) btnWeb.classList.toggle('active', tab === 'web');
  if (btnMirror) btnMirror.classList.toggle('active', tab === 'mirror');
  if (paneWeb) paneWeb.style.display = tab === 'web' ? 'block' : 'none';
  if (paneMirror) paneMirror.style.display = tab === 'mirror' ? 'flex' : 'none';
  if (tab === 'mirror') {
    void refreshMiniMirrorWindowSelect(true);
  } else {
    stopMiniWindowMirror();
    stopMiniDisplayMedia();
  }
  savedDeps?.syncHitboxToRust(true);
}

function updateMiniWebStatusUi(st: MiniWebStatus) {
  miniWebIsOpen = Boolean(st.is_open);
  const statusEl = document.getElementById('mini-web-status-text');
  const pinChk = document.getElementById('chk-mini-web-pin') as HTMLInputElement | null;
  if (pinChk) pinChk.checked = st.always_on_top;
  if (statusEl) {
    statusEl.textContent = st.is_open
      ? `Đang mở: ${st.title} (${st.width}x${st.height} | ${st.url})`
      : 'WebView Mini chưa khởi chạy (không tốn RAM/CPU nền). Nhấn YouTube hoặc dán link khi cần dùng.';
  }
  const wInp = document.getElementById('mini-web-custom-w') as HTMLInputElement | null;
  const hInp = document.getElementById('mini-web-custom-h') as HTMLInputElement | null;
  if (wInp && document.activeElement !== wInp && st.width > 0) wInp.value = String(st.width);
  if (hInp && document.activeElement !== hInp && st.height > 0) hInp.value = String(st.height);
  if (!miniMirrorActive && !miniDisplayStream) {
    setMiniScreenModeBadge(st.is_open ? '[WEB MINI ON]' : '[LIVE]');
  }
  updateMiniResourceStatus();
}

async function openMiniWebTarget(rawTarget: string) {
  const pinChk = document.getElementById('chk-mini-web-pin') as HTMLInputElement | null;
  const target = rawTarget.trim() || 'youtube';
  const inp = document.getElementById('mini-web-url-input') as HTMLInputElement | null;
  if (inp && rawTarget.trim()) inp.value = target;
  try {
    const st = await invoke<MiniWebStatus>('mini_screen_open_web', {
      target,
      alwaysOnTop: pinChk?.checked ?? true,
    });
    updateMiniWebStatusUi(st);
    savedDeps?.speakMessage(`[MINI SCREEN] Đã mở "${st.title}" ở chế độ cửa sổ Mini ghim nổi!`);
  } catch (err) {
    savedDeps?.speakMessage(`[MINI SCREEN LỖI] ${String(err)}`);
  }
}

export function toggleMiniScreenPanel(
  forceState?: boolean,
  defaultTab?: 'web' | 'mirror'
) {
  appState.isMiniScreenOpen =
    forceState !== undefined ? forceState : !appState.isMiniScreenOpen;
  if (appState.isMiniScreenOpen) {
    if (defaultTab) {
      setMiniScreenTab(defaultTab);
    } else {
      void refreshMiniMirrorWindowSelect(true);
    }
    void invoke<MiniWebStatus>('mini_screen_control_web', { action: 'status' })
      .then((st) => updateMiniWebStatusUi(st))
      .catch(() => updateMiniResourceStatus());
  } else {
    stopMiniWindowMirror();
    stopMiniDisplayMedia();
    void invoke('mini_screen_restore_all_stealth').catch(() => {});
    const autoCloseWeb =
      (document.getElementById('chk-mini-web-autoclose') as HTMLInputElement | null)?.checked ??
      true;
    if (autoCloseWeb && miniWebIsOpen) {
      void invoke<MiniWebStatus>('mini_screen_control_web', { action: 'close' })
        .then((st) => updateMiniWebStatusUi(st))
        .catch(() => {});
    }
  }
  const panel = savedDeps?.getMiniScreenPanel() ?? (document.getElementById('mini-screen-panel') as HTMLDivElement | null);
  if (panel) {
    panel.style.display = appState.isMiniScreenOpen ? 'flex' : 'none';
  }
  const dockBtn = savedDeps?.getDockBtnMiniScreen();
  if (dockBtn) {
    dockBtn.classList.toggle('active', appState.isMiniScreenOpen);
  }
  savedDeps?.syncHitboxToRust(true);
}

export function refreshMiniMirrorWindowsIfOpen() {
  if (appState.isMiniScreenOpen && miniScreenTab === 'mirror') {
    void refreshMiniMirrorWindowSelect(false);
  }
}

async function toggleStealthForHwnd(hwnd: number) {
  if (!hwnd) {
    savedDeps?.speakMessage('[MINI SCREEN] Hãy chọn app/cửa sổ trước khi bật chế độ Xem Ẩn.');
    return;
  }
  const existing = miniMirrorWindows.find((w) => w.hwnd === hwnd);
  const nextStealth = !(existing?.is_stealth ?? false);
  try {
    const msg = await invoke<string>('mini_screen_set_stealth', {
      hwnd,
      enabled: nextStealth,
    });
    await refreshMiniMirrorWindowSelect(true);
    savedDeps?.speakMessage(`[MINI SCREEN] ${msg}`);
    if (nextStealth && !miniMirrorActive) {
      startMiniWindowMirror();
    }
  } catch (err) {
    savedDeps?.speakMessage(`[MINI SCREEN LỖI] ${String(err)}`);
  }
}

function focusHwndNow(hwnd: number) {
  if (!hwnd) {
    savedDeps?.speakMessage('[MINI SCREEN] Chưa chọn ứng dụng nào để đưa lên.');
    return;
  }
  void invoke<string>('mini_screen_focus_window', { hwnd })
    .then((m) => savedDeps?.speakMessage(`[MINI SCREEN] ${m}`))
    .catch((e) => savedDeps?.speakMessage(`[MINI SCREEN] ${String(e)}`));
}

export function initMiniScreenUi(deps: MiniScreenUiDeps) {
  savedDeps = deps;
  const miniScreenPanel = deps.getMiniScreenPanel();

  // Restore saved free-form size (or migrate legacy mate_mini_width)
  try {
    const rawSz = localStorage.getItem('mate_mini_size_v2');
    if (rawSz) {
      const parsed = JSON.parse(rawSz) as { width?: number; height?: number };
      if (parsed && Number.isFinite(parsed.width) && Number.isFinite(parsed.height)) {
        applyPanelSize(miniScreenPanel, Number(parsed.width), Number(parsed.height), false);
      } else {
        applyPanelSize(miniScreenPanel, DEFAULT_MINI_W, DEFAULT_MINI_H, false);
      }
    } else {
      const legacyW = Number(localStorage.getItem('mate_mini_width') || String(DEFAULT_MINI_W));
      applyPanelSize(
        miniScreenPanel,
        Number.isFinite(legacyW) ? legacyW : DEFAULT_MINI_W,
        DEFAULT_MINI_H,
        false
      );
    }
  } catch {
    applyPanelSize(miniScreenPanel, DEFAULT_MINI_W, DEFAULT_MINI_H, false);
  }

  // Restore saved layout & slots
  const savedLayoutRaw = Number(localStorage.getItem('mate_mini_layout') || '1');
  if (savedLayoutRaw === 1 || savedLayoutRaw === 2 || savedLayoutRaw === 4) {
    miniLayout = savedLayoutRaw;
  }
  try {
    const savedSlots = JSON.parse(localStorage.getItem('mate_mini_slots_v1') || 'null');
    if (Array.isArray(savedSlots) && savedSlots.length === 4) {
      slotHwnds = [
        Number(savedSlots[0]) || 0,
        Number(savedSlots[1]) || 0,
        Number(savedSlots[2]) || 0,
        Number(savedSlots[3]) || 0,
      ];
    }
  } catch {
    // ignore
  }
  renderLayoutVisibilityAndActiveTile();

  if (miniScreenPanel) {
    const savedOpacity = Number(localStorage.getItem('mate_mini_opacity') || '0.96');
    const opacityInp = document.getElementById('mini-screen-opacity') as HTMLInputElement | null;
    if (Number.isFinite(savedOpacity) && savedOpacity >= 0.45 && savedOpacity <= 1) {
      miniScreenPanel.style.opacity = String(savedOpacity);
      if (opacityInp) opacityInp.value = String(savedOpacity);
    }

    try {
      const savedPos = JSON.parse(localStorage.getItem('mate_mini_pos') || 'null') as {
        left: number;
        top: number;
      } | null;
      if (savedPos && Number.isFinite(savedPos.left) && Number.isFinite(savedPos.top)) {
        const clampedL = Math.max(8, Math.min((appState.W || 1920) - 220, savedPos.left));
        const clampedT = Math.max(8, Math.min((appState.H || 1080) - 120, savedPos.top));
        miniScreenPanel.style.left = `${clampedL}px`;
        miniScreenPanel.style.top = `${clampedT}px`;
        miniScreenPanel.style.right = 'auto';
      }
    } catch {
      // keep default top-right
    }

    // Header drag-to-move
    const dragHandle = document.getElementById('mini-screen-drag-handle');
    let miniDragging = false;
    let dragOffX = 0;
    let dragOffY = 0;
    dragHandle?.addEventListener('pointerdown', (e) => {
      if ((e.target as Element | null)?.closest('button, input')) return;
      miniDragging = true;
      const r = miniScreenPanel.getBoundingClientRect();
      dragOffX = e.clientX - r.left;
      dragOffY = e.clientY - r.top;
      dragHandle.setPointerCapture(e.pointerId);
    });
    dragHandle?.addEventListener('pointermove', (e) => {
      if (!miniDragging) return;
      const panelW = miniScreenPanel.offsetWidth || customW;
      const nx = Math.max(6, Math.min((appState.W || 1920) - panelW - 6, e.clientX - dragOffX));
      const ny = Math.max(6, Math.min((appState.H || 1080) - 60, e.clientY - dragOffY));
      miniScreenPanel.style.left = `${Math.round(nx)}px`;
      miniScreenPanel.style.top = `${Math.round(ny)}px`;
      miniScreenPanel.style.right = 'auto';
      deps.syncHitboxToRust(false);
    });
    const finishMiniDrag = () => {
      if (!miniDragging) return;
      miniDragging = false;
      const r = miniScreenPanel.getBoundingClientRect();
      localStorage.setItem(
        'mate_mini_pos',
        JSON.stringify({ left: Math.round(r.left), top: Math.round(r.top) })
      );
      deps.syncHitboxToRust(true);
    };
    dragHandle?.addEventListener('pointerup', finishMiniDrag);
    dragHandle?.addEventListener('pointercancel', finishMiniDrag);

    // Free-form edge / corner resize
    miniScreenPanel.querySelectorAll('.mini-resize-handle').forEach((el) => {
      const handle = el as HTMLElement;
      const edge = (handle.dataset.resize || 'se') as 'e' | 'w' | 's' | 'se' | 'sw';
      let resizing = false;
      let startX = 0;
      let startY = 0;
      let startRect = { left: 0, top: 0, width: DEFAULT_MINI_W, height: DEFAULT_MINI_H, right: 0 };

      handle.addEventListener('pointerdown', (e) => {
        if (miniPanelCollapsed) return;
        e.preventDefault();
        e.stopPropagation();
        resizing = true;
        const rect = miniScreenPanel.getBoundingClientRect();
        startRect = {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          right: rect.right,
        };
        startX = e.clientX;
        startY = e.clientY;
        miniScreenPanel.style.left = `${Math.round(rect.left)}px`;
        miniScreenPanel.style.top = `${Math.round(rect.top)}px`;
        miniScreenPanel.style.right = 'auto';
        handle.setPointerCapture(e.pointerId);
      });

      handle.addEventListener('pointermove', (e) => {
        if (!resizing) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let nextW = startRect.width;
        let nextH = startRect.height;

        if (edge === 'e' || edge === 'se') {
          nextW = startRect.width + dx;
        } else if (edge === 'w' || edge === 'sw') {
          nextW = startRect.width - dx;
        }
        if (edge === 's' || edge === 'se' || edge === 'sw') {
          nextH = startRect.height + dy;
        }

        const clamped = clampSize(nextW, nextH);
        if (edge === 'w' || edge === 'sw') {
          const newLeft = Math.max(6, startRect.right - clamped.width);
          const actualW = Math.max(MIN_MINI_W, startRect.right - newLeft);
          miniScreenPanel.style.left = `${Math.round(newLeft)}px`;
          applyPanelSize(miniScreenPanel, actualW, clamped.height, false);
        } else {
          const maxRightW = Math.max(MIN_MINI_W, (appState.W || 1920) - startRect.left - 6);
          applyPanelSize(miniScreenPanel, Math.min(clamped.width, maxRightW), clamped.height, false);
        }
        deps.syncHitboxToRust(false);
      });

      const finishResize = () => {
        if (!resizing) return;
        resizing = false;
        const r = miniScreenPanel.getBoundingClientRect();
        localStorage.setItem(
          'mate_mini_pos',
          JSON.stringify({ left: Math.round(r.left), top: Math.round(r.top) })
        );
        applyPanelSize(miniScreenPanel, r.width, r.height, true);
      };
      handle.addEventListener('pointerup', finishResize);
      handle.addEventListener('pointercancel', finishResize);
    });
  }

  document.getElementById('btn-close-mini-screen')?.addEventListener('click', () => {
    toggleMiniScreenPanel(false);
  });

  document.getElementById('btn-mini-reset-size')?.addEventListener('click', () => {
    const defaultByLayout =
      miniLayout === 4
        ? { w: 660, h: 460 }
        : miniLayout === 2
        ? { w: 600, h: 360 }
        : { w: DEFAULT_MINI_W, h: DEFAULT_MINI_H };
    applyPanelSize(miniScreenPanel, defaultByLayout.w, defaultByLayout.h, true);
  });

  document.getElementById('btn-mini-collapse')?.addEventListener('click', () => {
    miniPanelCollapsed = !miniPanelCollapsed;
    const bodyEl = document.getElementById('mini-screen-body');
    if (bodyEl) bodyEl.style.display = miniPanelCollapsed ? 'none' : 'flex';
    miniScreenPanel?.querySelectorAll('.mini-resize-handle').forEach((h) => {
      (h as HTMLElement).style.display = miniPanelCollapsed ? 'none' : '';
    });
    if (miniScreenPanel) {
      if (miniPanelCollapsed) {
        miniScreenPanel.style.height = 'auto';
        miniScreenPanel.style.minHeight = '0px';
      } else {
        miniScreenPanel.style.height = `${customH}px`;
        miniScreenPanel.style.minHeight = `${MIN_MINI_H}px`;
      }
    }
    if (miniPanelCollapsed) {
      stopMiniWindowMirror();
      stopMiniDisplayMedia();
    }
    deps.syncHitboxToRust(true);
  });

  document.getElementById('mini-screen-opacity')?.addEventListener('input', (e) => {
    const val = (e.target as HTMLInputElement).value;
    if (miniScreenPanel) {
      miniScreenPanel.style.opacity = val;
      localStorage.setItem('mate_mini_opacity', val);
    }
  });

  document.getElementById('tab-btn-mini-web')?.addEventListener('click', () => {
    setMiniScreenTab('web');
  });
  document.getElementById('tab-btn-mini-mirror')?.addEventListener('click', () => {
    setMiniScreenTab('mirror');
  });

  // Layout buttons (1 / 2 / 4)
  document.querySelectorAll('.mini-layout-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = Number(btn.getAttribute('data-layout') || '1');
      if (next === 1 || next === 2 || next === 4) {
        setMiniLayout(next, true, false);
      }
    });
  });

  // Per-tile listeners (select, focus, stealth, solo-zoom, click, double-click)
  document.querySelectorAll('.mini-mirror-tile').forEach((tileEl) => {
    const slot = Number(tileEl.getAttribute('data-slot') || '0');
    tileEl.addEventListener('pointerdown', (e) => {
      if ((e.target as Element | null)?.closest('select, button')) return;
      if (activeSlot !== slot) setActiveSlot(slot);
    });
  });

  document.querySelectorAll('.mini-tile-stage').forEach((stageEl) => {
    const slot = Number(stageEl.getAttribute('data-slot') || '0');
    stageEl.addEventListener('dblclick', () => {
      focusHwndNow(slotHwnds[slot] || 0);
    });
  });

  document.querySelectorAll('.mini-tile-select').forEach((selEl) => {
    const sel = selEl as HTMLSelectElement;
    const slot = Number(sel.getAttribute('data-slot') || '0');
    sel.addEventListener('change', () => {
      slotHwnds[slot] = Number(sel.value || '0') || 0;
      persistSlots();
      setActiveSlot(slot);
      if (miniMirrorActive) {
        void stepMiniMirrorFrame();
      }
    });
  });

  document.querySelectorAll('.mini-tile-focus').forEach((btnEl) => {
    const slot = Number(btnEl.getAttribute('data-slot') || '0');
    btnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      focusHwndNow(slotHwnds[slot] || 0);
    });
  });

  document.querySelectorAll('.mini-tile-stealth').forEach((btnEl) => {
    const slot = Number(btnEl.getAttribute('data-slot') || '0');
    btnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      void toggleStealthForHwnd(slotHwnds[slot] || 0);
    });
  });

  document.querySelectorAll('.mini-tile-zoom').forEach((btnEl) => {
    const slot = Number(btnEl.getAttribute('data-slot') || '0');
    btnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (miniLayout !== 1) {
        const prev = miniLayout;
        activeSlot = slot;
        setMiniLayout(1, false, true);
        preZoomLayout = prev;
      } else if (preZoomLayout && preZoomLayout !== 1) {
        const restore = preZoomLayout;
        preZoomLayout = null;
        setMiniLayout(restore, true, false);
      } else {
        setMiniLayout(2, true, false);
      }
    });
  });

  // Web Mini handlers
  document.getElementById('btn-mini-web-open')?.addEventListener('click', () => {
    const val =
      (document.getElementById('mini-web-url-input') as HTMLInputElement | null)?.value ||
      'youtube';
    void openMiniWebTarget(val);
  });
  document.getElementById('mini-web-url-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = (e.target as HTMLInputElement).value || 'youtube';
      void openMiniWebTarget(val);
    }
  });
  document.querySelectorAll('.mini-web-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target') || 'youtube';
      void openMiniWebTarget(target);
    });
  });
  document.getElementById('btn-mini-web-paste')?.addEventListener('click', async () => {
    try {
      const clip = await invoke<string>('get_clipboard_text');
      const inp = document.getElementById('mini-web-url-input') as HTMLInputElement | null;
      if (inp && clip.trim()) {
        inp.value = clip.trim();
        void openMiniWebTarget(clip.trim());
      } else {
        deps.speakMessage('[MINI SCREEN] Clipboard hiện đang trống.');
      }
    } catch (err) {
      deps.speakMessage(`[MINI SCREEN] Không đọc được clipboard: ${String(err)}`);
    }
  });
  document.querySelectorAll('.mini-web-size-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const w = Number(btn.getAttribute('data-w') || '480');
      const h = Number(btn.getAttribute('data-h') || '300');
      void invoke<MiniWebStatus>('mini_screen_control_web', {
        action: 'resize',
        width: w,
        height: h,
      })
        .then((st) => updateMiniWebStatusUi(st))
        .catch(() => {});
    });
  });
  document.getElementById('btn-mini-web-apply-size')?.addEventListener('click', () => {
    const wEl = document.getElementById('mini-web-custom-w') as HTMLInputElement | null;
    const hEl = document.getElementById('mini-web-custom-h') as HTMLInputElement | null;
    const w = Math.max(300, Math.min(1280, Number(wEl?.value || '480') || 480));
    const h = Math.max(190, Math.min(920, Number(hEl?.value || '300') || 300));
    void invoke<MiniWebStatus>('mini_screen_control_web', {
      action: 'resize',
      width: w,
      height: h,
    })
      .then((st) => updateMiniWebStatusUi(st))
      .catch(() => {});
  });
  document.getElementById('chk-mini-web-pin')?.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    void invoke<MiniWebStatus>('mini_screen_control_web', {
      action: 'pin',
      alwaysOnTop: checked,
    })
      .then((st) => updateMiniWebStatusUi(st))
      .catch(() => {});
  });
  document.getElementById('btn-mini-web-focus')?.addEventListener('click', () => {
    void invoke<MiniWebStatus>('mini_screen_control_web', { action: 'focus' })
      .then((st) => updateMiniWebStatusUi(st))
      .catch(() => {});
  });
  document.getElementById('btn-mini-web-close')?.addEventListener('click', () => {
    void invoke<MiniWebStatus>('mini_screen_control_web', { action: 'close' })
      .then((st) => updateMiniWebStatusUi(st))
      .catch(() => {});
  });

  // Live Mirror top bar & global actions
  document.getElementById('btn-mini-mirror-refresh')?.addEventListener('click', () => {
    void refreshMiniMirrorWindowSelect(true);
  });
  document.getElementById('mini-mirror-win-select')?.addEventListener('change', (e) => {
    const val = Number((e.target as HTMLSelectElement).value || '0') || 0;
    slotHwnds[activeSlot] = val;
    persistSlots();
    const tileSel = document.querySelector(`.mini-tile-select[data-slot="${activeSlot}"]`) as HTMLSelectElement | null;
    if (tileSel) tileSel.value = String(val);
    syncStealthButtonsUi();
    updateMiniResourceStatus();
    if (miniMirrorActive) {
      void stepMiniMirrorFrame();
    }
  });
  document.getElementById('btn-mini-mirror-toggle')?.addEventListener('click', () => {
    if (miniMirrorActive) {
      stopMiniWindowMirror();
    } else {
      startMiniWindowMirror();
    }
  });
  document.getElementById('btn-mini-stealth-toggle')?.addEventListener('click', () => {
    void toggleStealthForHwnd(slotHwnds[activeSlot] || 0);
  });
  document.getElementById('btn-mini-restore-all')?.addEventListener('click', async () => {
    try {
      const count = await invoke<number>('mini_screen_restore_all_stealth');
      await refreshMiniMirrorWindowSelect(true);
      deps.speakMessage(`[MINI SCREEN] Đã hiện lại ${count} cửa sổ đang ẩn.`);
    } catch {
      // ignore
    }
  });
  void listen('duck-mini-web-closed', () => {
    updateMiniWebStatusUi({
      is_open: false,
      url: '',
      title: '',
      always_on_top: true,
      width: 480,
      height: 300,
    });
  });
  document.getElementById('btn-mini-display-media')?.addEventListener('click', () => {
    if (miniDisplayStream) {
      stopMiniDisplayMedia();
      setMiniScreenModeBadge('[LIVE]');
    } else {
      void startMiniDisplayMedia();
    }
  });
  document.getElementById('btn-mini-focus-app')?.addEventListener('click', () => {
    const hwnd =
      slotHwnds[activeSlot] || appState.activeWindowHwnd || deps.findTargetWindow()?.hwnd || 0;
    focusHwndNow(hwnd);
  });
  document.getElementById('btn-mini-media-prev')?.addEventListener('click', () => void deps.runPcMedia('prev'));
  document.getElementById('btn-mini-media-play')?.addEventListener('click', () => void deps.runPcMedia('play_pause'));
  document.getElementById('btn-mini-media-next')?.addEventListener('click', () => void deps.runPcMedia('next'));
  document.getElementById('btn-mini-vol-down')?.addEventListener('click', () => void deps.runPcMedia('vol_down'));
  document.getElementById('btn-mini-vol-up')?.addEventListener('click', () => void deps.runPcMedia('vol_up'));
}
