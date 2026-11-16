import { invoke } from '@tauri-apps/api/core';
import { appState, PRESET_ALICIA_URL, PRESET_VRM1_URL } from '../core/state';
import { spawnParticles } from '../core/particles';
import {
  triggerBackflip,
  triggerExploreInsideWindow,
  triggerInteractInsideWindow,
  triggerJumpToWindow,
  triggerSpawnRandomFood,
  triggerSpin,
} from '../physics/physics';
import {
  clearCachedVrm,
  loadVrmFromUrl,
  applyVrmScaleAndOffset,
  applyGlbScaleAndOffset,
} from '../characters/vrmManager';
import {
  createDetailedAnimeCharacter,
  createMicroDuckCharacter,
  switchBuiltinCharacterType,
  rigRoot,
} from '../characters/characterRig';
import {
  autoCheckEnabled,
  chatWithLocalLlm,
  clearLocalMemory,
  cpuAlertPct,
  geminiApiKey,
  geminiModel,
  llmRouteMode,
  ollamaModel,
  ramAlertGb,
  refreshLongMemoryUi,
  runBitcoinCheck,
  runFullDashboardScan,
  runHardwareAction,
  runHardwareCheck,
  runMemoryCheck,
  runNetworkCheck,
  runOcrAndSummarize,
  runOpenLatestScreenshot,
  runPcMedia,
  runPcOpen,
  runPcScreenshot,
  runShowSuggestion,
  saveLongMemoryEntry,
  setAutoCheckEnabled,
  setCpuAlertPct,
  setGeminiApiKey,
  setGeminiModel,
  setLlmRouteMode,
  setOllamaModel,
  setRamAlertGb,
  LlmRouteMode,
} from '../backend/assistant';
import {
  findTargetWindow,
  performWindowAction,
  startPhysicalPush,
  startPhysicalResize,
} from '../physics/windowInteract';
import { mountUi } from './components/mountUi';

export let leftTelemetryPanel!: HTMLElement;
export let rightActionPanel!: HTMLElement;
export let speechBubble!: HTMLDivElement;
export let companionDock!: HTMLDivElement;
export let studioPanel!: HTMLDivElement;
export let longMemoryPanel!: HTMLDivElement;
export let fileInput!: HTMLInputElement;

let btnCloseLeft!: HTMLButtonElement;
let btnCloseRight!: HTMLButtonElement;
let btnRefreshAll!: HTMLButtonElement;
let bubbleContent!: HTMLDivElement;
let timerBadge!: HTMLSpanElement;
let btnMinimizeBubble!: HTMLButtonElement;
let btnActHw!: HTMLButtonElement;
let btnActNet!: HTMLButtonElement;
let btnActBtc!: HTMLButtonElement;
let btnActMem!: HTMLButtonElement;
let btnActSuggest!: HTMLButtonElement;
let btnClearMemory!: HTMLButtonElement;
let suggestionActions!: HTMLDivElement;
let btnSugAccept!: HTMLButtonElement;
let btnSugDismiss!: HTMLButtonElement;
let btnActJump!: HTMLButtonElement;
let btnActDance!: HTMLButtonElement;
let btnActPat!: HTMLButtonElement;
let btnActFlip!: HTMLButtonElement;
let btnActSpin!: HTMLButtonElement;
let btnActDuck!: HTMLButtonElement;
let btnActTimer!: HTMLButtonElement;
let btnActCenter!: HTMLButtonElement;
let btnActFeed!: HTMLButtonElement;
let btnActEnterWin!: HTMLButtonElement;
let btnActFrameKey!: HTMLButtonElement;
let btnPcYt!: HTMLButtonElement;
let btnPcShot!: HTMLButtonElement;
let btnPcOpenShot!: HTMLButtonElement;
let btnPcNote!: HTMLButtonElement;
let btnPcCleanRam!: HTMLButtonElement;
let btnPcBrightDown!: HTMLButtonElement;
let btnPcBrightUp!: HTMLButtonElement;
let btnPcOcr!: HTMLButtonElement;
let btnPcVolDown!: HTMLButtonElement;
let btnPcPlay!: HTMLButtonElement;
let btnPcVolUp!: HTMLButtonElement;
let winTargetName!: HTMLDivElement;
let btnWinPushL!: HTMLButtonElement;
let btnWinPushR!: HTMLButtonElement;
let btnWinShrink!: HTMLButtonElement;
let btnWinExpand!: HTMLButtonElement;
let btnWinMin!: HTMLButtonElement;
let bubbleInput!: HTMLInputElement;
let btnSendMsg!: HTMLButtonElement;
let btnOpenStudio!: HTMLButtonElement;
let btnLoadVrm!: HTMLButtonElement;
let dockBtnLeft!: HTMLButtonElement;
let dockBtnChat!: HTMLButtonElement;
let dockBtnRight!: HTMLButtonElement;
let dockBtnStudio!: HTMLButtonElement;
let dockBtnMini!: HTMLButtonElement;
let btnCloseStudio!: HTMLButtonElement;
let presetAlicia!: HTMLButtonElement;
let presetVrm1!: HTMLButtonElement;
let presetBuiltin!: HTMLButtonElement;
let presetMicroduck!: HTMLButtonElement;
let vrmUrlInput!: HTMLInputElement;
let btnLoadUrl!: HTMLButtonElement;
let btnStudioFile!: HTMLButtonElement;
let sliderScale!: HTMLInputElement;
let valScale!: HTMLSpanElement;
let sliderGravity!: HTMLInputElement;
let valGravity!: HTMLSpanElement;
let sliderBounce!: HTMLInputElement;
let valBounce!: HTMLSpanElement;
let chkAutoroam!: HTMLInputElement;
let chkLookat!: HTMLInputElement;
let chkWinInteract!: HTMLInputElement;
let inputOllamaModel!: HTMLInputElement;
let inputGeminiKey!: HTMLInputElement;
let inputGeminiModel!: HTMLInputElement;
let selectLlmRoute!: HTMLSelectElement;
let chkAutocheck!: HTMLInputElement;
let inputAlertCpu!: HTMLInputElement;
let inputAlertRam!: HTMLInputElement;
let btnOpenLongMem!: HTMLButtonElement;
let btnCloseLongMem!: HTMLButtonElement;
let lmPresetCute!: HTMLButtonElement;
let lmPresetDev!: HTMLButtonElement;
let lmPresetTsun!: HTMLButtonElement;
let lmPersonaInput!: HTMLTextAreaElement;
let btnSavePersona!: HTMLButtonElement;
let lmCatSelect!: HTMLSelectElement;
let lmTitleInput!: HTMLInputElement;
let lmContentInput!: HTMLInputElement;
let btnAddLongMem!: HTMLButtonElement;

function bindDomRefs() {
  leftTelemetryPanel = document.getElementById('left-telemetry-panel') as HTMLElement;
  rightActionPanel = document.getElementById('right-action-panel') as HTMLElement;
  btnCloseLeft = document.getElementById('btn-close-left') as HTMLButtonElement;
  btnCloseRight = document.getElementById('btn-close-right') as HTMLButtonElement;
  btnRefreshAll = document.getElementById('btn-refresh-all') as HTMLButtonElement;

  speechBubble = document.getElementById('speech-bubble') as HTMLDivElement;
  bubbleContent = document.getElementById('bubble-content') as HTMLDivElement;
  timerBadge = document.getElementById('timer-badge') as HTMLSpanElement;
  btnMinimizeBubble = document.getElementById('btn-minimize-bubble') as HTMLButtonElement;
  btnActHw = document.getElementById('btn-act-hw') as HTMLButtonElement;
  btnActNet = document.getElementById('btn-act-net') as HTMLButtonElement;
  btnActBtc = document.getElementById('btn-act-btc') as HTMLButtonElement;
  btnActMem = document.getElementById('btn-act-mem') as HTMLButtonElement;
  btnActSuggest = document.getElementById('btn-act-suggest') as HTMLButtonElement;
  btnClearMemory = document.getElementById('btn-clear-memory') as HTMLButtonElement;
  suggestionActions = document.getElementById('suggestion-actions') as HTMLDivElement;
  btnSugAccept = document.getElementById('btn-sug-accept') as HTMLButtonElement;
  btnSugDismiss = document.getElementById('btn-sug-dismiss') as HTMLButtonElement;
  btnActJump = document.getElementById('btn-act-jump') as HTMLButtonElement;
  btnActDance = document.getElementById('btn-act-dance') as HTMLButtonElement;
  btnActPat = document.getElementById('btn-act-pat') as HTMLButtonElement;
  btnActFlip = document.getElementById('btn-act-flip') as HTMLButtonElement;
  btnActSpin = document.getElementById('btn-act-spin') as HTMLButtonElement;
  btnActDuck = document.getElementById('btn-act-duck') as HTMLButtonElement;
  btnActTimer = document.getElementById('btn-act-timer') as HTMLButtonElement;
  btnActCenter = document.getElementById('btn-act-center') as HTMLButtonElement;
  btnActFeed = document.getElementById('btn-act-feed') as HTMLButtonElement;
  btnActEnterWin = document.getElementById('btn-act-enter-win') as HTMLButtonElement;
  btnActFrameKey = document.getElementById('btn-act-frame-key') as HTMLButtonElement;
  btnPcYt = document.getElementById('btn-pc-yt') as HTMLButtonElement;
  btnPcShot = document.getElementById('btn-pc-shot') as HTMLButtonElement;
  btnPcOpenShot = document.getElementById('btn-pc-openshot') as HTMLButtonElement;
  btnPcNote = document.getElementById('btn-pc-note') as HTMLButtonElement;
  btnPcCleanRam = document.getElementById('btn-pc-cleanram') as HTMLButtonElement;
  btnPcBrightDown = document.getElementById('btn-pc-brightdown') as HTMLButtonElement;
  btnPcBrightUp = document.getElementById('btn-pc-brightup') as HTMLButtonElement;
  btnPcOcr = document.getElementById('btn-pc-ocr') as HTMLButtonElement;
  btnPcVolDown = document.getElementById('btn-pc-voldown') as HTMLButtonElement;
  btnPcPlay = document.getElementById('btn-pc-play') as HTMLButtonElement;
  btnPcVolUp = document.getElementById('btn-pc-volup') as HTMLButtonElement;
  winTargetName = document.getElementById('win-target-name') as HTMLDivElement;
  btnWinPushL = document.getElementById('btn-win-push-l') as HTMLButtonElement;
  btnWinPushR = document.getElementById('btn-win-push-r') as HTMLButtonElement;
  btnWinShrink = document.getElementById('btn-win-shrink') as HTMLButtonElement;
  btnWinExpand = document.getElementById('btn-win-expand') as HTMLButtonElement;
  btnWinMin = document.getElementById('btn-win-min') as HTMLButtonElement;
  bubbleInput = document.getElementById('bubble-input') as HTMLInputElement;
  btnSendMsg = document.getElementById('btn-send-msg') as HTMLButtonElement;
  btnOpenStudio = document.getElementById('btn-open-studio') as HTMLButtonElement;
  btnLoadVrm = document.getElementById('btn-load-vrm') as HTMLButtonElement;

  companionDock = document.getElementById('companion-dock') as HTMLDivElement;
  dockBtnLeft = document.getElementById('dock-btn-left') as HTMLButtonElement;
  dockBtnChat = document.getElementById('dock-btn-chat') as HTMLButtonElement;
  dockBtnRight = document.getElementById('dock-btn-right') as HTMLButtonElement;
  dockBtnStudio = document.getElementById('dock-btn-studio') as HTMLButtonElement;
  dockBtnMini = document.getElementById('dock-btn-mini') as HTMLButtonElement;

  studioPanel = document.getElementById('studio-panel') as HTMLDivElement;
  btnCloseStudio = document.getElementById('btn-close-studio') as HTMLButtonElement;
  presetAlicia = document.getElementById('preset-alicia') as HTMLButtonElement;
  presetVrm1 = document.getElementById('preset-vrm1') as HTMLButtonElement;
  presetBuiltin = document.getElementById('preset-builtin') as HTMLButtonElement;
  presetMicroduck = document.getElementById('preset-microduck') as HTMLButtonElement;
  vrmUrlInput = document.getElementById('vrm-url-input') as HTMLInputElement;
  btnLoadUrl = document.getElementById('btn-load-url') as HTMLButtonElement;
  btnStudioFile = document.getElementById('btn-studio-file') as HTMLButtonElement;

  sliderScale = document.getElementById('slider-scale') as HTMLInputElement;
  valScale = document.getElementById('val-scale') as HTMLSpanElement;
  sliderGravity = document.getElementById('slider-gravity') as HTMLInputElement;
  valGravity = document.getElementById('val-gravity') as HTMLSpanElement;
  sliderBounce = document.getElementById('slider-bounce') as HTMLInputElement;
  valBounce = document.getElementById('val-bounce') as HTMLSpanElement;
  chkAutoroam = document.getElementById('chk-autoroam') as HTMLInputElement;
  chkLookat = document.getElementById('chk-lookat') as HTMLInputElement;
  chkWinInteract = document.getElementById('chk-win-interact') as HTMLInputElement;
  inputOllamaModel = document.getElementById('input-ollama-model') as HTMLInputElement;
  inputGeminiKey = document.getElementById('input-gemini-key') as HTMLInputElement;
  inputGeminiModel = document.getElementById('input-gemini-model') as HTMLInputElement;
  selectLlmRoute = document.getElementById('select-llm-route') as HTMLSelectElement;
  chkAutocheck = document.getElementById('chk-autocheck') as HTMLInputElement;
  inputAlertCpu = document.getElementById('input-alert-cpu') as HTMLInputElement;
  inputAlertRam = document.getElementById('input-alert-ram') as HTMLInputElement;

  longMemoryPanel = document.getElementById('long-memory-panel') as HTMLDivElement;
  btnOpenLongMem = document.getElementById('btn-open-long-mem') as HTMLButtonElement;
  btnCloseLongMem = document.getElementById('btn-close-long-mem') as HTMLButtonElement;
  lmPresetCute = document.getElementById('lm-preset-cute') as HTMLButtonElement;
  lmPresetDev = document.getElementById('lm-preset-dev') as HTMLButtonElement;
  lmPresetTsun = document.getElementById('lm-preset-tsun') as HTMLButtonElement;
  lmPersonaInput = document.getElementById('lm-persona-input') as HTMLTextAreaElement;
  btnSavePersona = document.getElementById('btn-save-persona') as HTMLButtonElement;
  lmCatSelect = document.getElementById('lm-cat-select') as HTMLSelectElement;
  lmTitleInput = document.getElementById('lm-title-input') as HTMLInputElement;
  lmContentInput = document.getElementById('lm-content-input') as HTMLInputElement;
  btnAddLongMem = document.getElementById('btn-add-long-mem') as HTMLButtonElement;

  fileInput = document.getElementById('vrm-file-input') as HTMLInputElement;
}

let typewriterTarget = '';
let typewriterIndex = 0;
let typewriterAcc = 0;

export function speakMessage(msg: string) {
  typewriterTarget = msg;
  typewriterIndex = 0;
  typewriterAcc = 0;
  if (bubbleContent) bubbleContent.textContent = '';
  appState.speechLipSyncTimer = Math.min(2.6, Math.max(0.9, msg.length * 0.032));
}

export function updateTypewriter(delta: number) {
  if (bubbleContent && typewriterIndex < typewriterTarget.length) {
    typewriterAcc += delta * 55;
    const nextIdx = Math.min(typewriterTarget.length, Math.floor(typewriterAcc));
    if (nextIdx > typewriterIndex) {
      typewriterIndex = nextIdx;
      bubbleContent.textContent = typewriterTarget.slice(0, typewriterIndex);
    }
  }
}

let pomodoroSeconds = 0;
let pomodoroRunning = false;
let pomodoroInterval: number | null = null;

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function togglePomodoro() {
  if (pomodoroRunning) {
    pomodoroRunning = false;
    if (pomodoroInterval !== null) {
      window.clearInterval(pomodoroInterval);
      pomodoroInterval = null;
    }
    timerBadge.style.display = 'none';
    btnActTimer.classList.remove('active');
    speakMessage('Đã tắt bộ đếm Pomodoro. Khi nào cần tập trung hãy gọi tớ nhé!');
    return;
  }

  pomodoroSeconds = 25 * 60;
  pomodoroRunning = true;
  timerBadge.style.display = 'inline-block';
  timerBadge.textContent = formatTime(pomodoroSeconds);
  btnActTimer.classList.add('active');
  speakMessage('Bắt đầu phiên tập trung 25 phút! Tớ sẽ ngồi ngoan canh chừng cho bạn.');

  pomodoroInterval = window.setInterval(() => {
    pomodoroSeconds--;
    timerBadge.textContent = formatTime(Math.max(0, pomodoroSeconds));
    if (pomodoroSeconds <= 0) {
      togglePomodoro();
      triggerDance();
      speakMessage('Hết giờ Pomodoro 25 phút rồi! Nghỉ ngơi vài phút nhé bạn.');
      appState.changeMood(12);
    }
  }, 1000);
}

export function triggerDance() {
  appState.activeWindowTask = null;
  appState.attachedWindowHwnd = null;
  appState.setState('DANCING');
  spawnParticles(appState.posX, appState.posY - 100, 10, 0xf472b6);
  speakMessage('Lên nhạc nào! Chế độ Idol đang bật.');
  appState.changeMood(6);
}

export function triggerHeadpat() {
  appState.activeWindowTask = null;
  appState.setState('HEADPAT');
  spawnParticles(appState.posX, appState.posY - 140, 10, 0xf472b6);
  appState.changeMood(8);
  speakMessage('Thích quá đi! Cảm ơn bạn đã xoa đầu tớ nhé.');
}

export function toggleLeftPanel(forceState?: boolean) {
  appState.isLeftPanelOpen =
    forceState !== undefined ? forceState : !appState.isLeftPanelOpen;
  leftTelemetryPanel.style.display = appState.isLeftPanelOpen ? 'block' : 'none';
  dockBtnLeft.classList.toggle('active', appState.isLeftPanelOpen);
  if (appState.isLeftPanelOpen) {
    const hw = document.getElementById('card-group-hw');
    const net = document.getElementById('card-net');
    const btc = document.getElementById('card-btc');
    const alerts = document.getElementById('card-alerts');
    const mem = document.getElementById('card-memory');
    const anyVisible =
      (hw && hw.style.display !== 'none') ||
      (net && net.style.display !== 'none') ||
      (btc && btc.style.display !== 'none') ||
      (alerts && alerts.style.display !== 'none') ||
      (mem && mem.style.display !== 'none');
    if (!anyVisible) {
      showTelemetrySection('all');
      return;
    }
  }
  syncHitboxToRust(true);
}

export function showTelemetrySection(mode: 'hw' | 'net' | 'btc' | 'alert' | 'memory' | 'all') {
  const titleEl = document.getElementById('left-panel-title');
  const hwEl = document.getElementById('card-group-hw');
  const netEl = document.getElementById('card-net');
  const btcEl = document.getElementById('card-btc');
  const alertEl = document.getElementById('card-alerts');
  const memEl = document.getElementById('card-memory');

  const titles: Record<typeof mode, string> = {
    hw: 'Thông số Phần cứng',
    net: 'Kết nối Mạng & LLM',
    btc: 'Thị trường Bitcoin',
    alert: 'Cảnh báo Hệ thống',
    memory: 'Trí nhớ & Thói quen (SQLite)',
    all: 'Giám sát Hệ thống',
  };
  if (titleEl) titleEl.textContent = titles[mode];

  if (hwEl) hwEl.style.display = mode === 'hw' || mode === 'all' ? 'block' : 'none';
  if (netEl) netEl.style.display = mode === 'net' || mode === 'all' ? 'block' : 'none';
  if (btcEl) btcEl.style.display = mode === 'btc' || mode === 'all' ? 'block' : 'none';
  if (alertEl) alertEl.style.display = mode === 'alert' || mode === 'all' ? 'block' : 'none';
  if (memEl) memEl.style.display = mode === 'memory' || mode === 'all' ? 'block' : 'none';

  appState.isLeftPanelOpen = true;
  leftTelemetryPanel.style.display = 'block';
  dockBtnLeft.classList.add('active');
  syncHitboxToRust(true);
}

let activeSugAccept: (() => void) | null = null;
let activeSugDismiss: (() => void) | null = null;

export function showSuggestionButtons(onAccept: () => void, onDismiss: () => void) {
  activeSugAccept = onAccept;
  activeSugDismiss = onDismiss;
  if (suggestionActions) suggestionActions.style.display = 'flex';
  syncHitboxToRust(true);
}

export function hideSuggestionButtons() {
  activeSugAccept = null;
  activeSugDismiss = null;
  if (suggestionActions) suggestionActions.style.display = 'none';
}

export function toggleRightPanel(forceState?: boolean) {
  appState.isRightPanelOpen =
    forceState !== undefined ? forceState : !appState.isRightPanelOpen;
  rightActionPanel.style.display = appState.isRightPanelOpen ? 'block' : 'none';
  dockBtnRight.classList.toggle('active', appState.isRightPanelOpen);
  syncHitboxToRust(true);
}

export function toggleBubbleVisibility(forceState?: boolean) {
  appState.isBubbleVisible =
    forceState !== undefined ? forceState : !appState.isBubbleVisible;
  speechBubble.style.display = appState.isBubbleVisible ? 'block' : 'none';
  dockBtnChat.classList.toggle('active', appState.isBubbleVisible);
  syncHitboxToRust(true);
}

export function toggleStudioModal(forceState?: boolean) {
  appState.isStudioOpen = forceState !== undefined ? forceState : !appState.isStudioOpen;
  studioPanel.style.display = appState.isStudioOpen ? 'block' : 'none';
  dockBtnStudio.classList.toggle('active', appState.isStudioOpen);
  syncHitboxToRust(true);
}

export function toggleLongMemoryModal(forceState?: boolean) {
  appState.isLongMemoryOpen =
    forceState !== undefined ? forceState : !appState.isLongMemoryOpen;
  longMemoryPanel.style.display = appState.isLongMemoryOpen ? 'block' : 'none';
  if (appState.isLongMemoryOpen) {
    void refreshLongMemoryUi();
  }
  syncHitboxToRust(true);
}

let lastHitboxSync = 0;

export function syncHitboxToRust(force = false) {
  if (!companionDock) return;
  const now = performance.now();
  if (!force && now - lastHitboxSync < 28) {
    return;
  }
  lastHitboxSync = now;

  const dpr = window.devicePixelRatio || 1;
  const uiRects: Array<{ x: number; y: number; w: number; h: number }> = [];

  const pushRect = (el: HTMLElement, visible: boolean) => {
    if (!visible || !el) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      uiRects.push({
        x: Math.round(r.left * dpr),
        y: Math.round(r.top * dpr),
        w: Math.round(r.width * dpr),
        h: Math.round(r.height * dpr),
      });
    }
  };

  pushRect(leftTelemetryPanel, appState.isLeftPanelOpen);
  pushRect(rightActionPanel, appState.isRightPanelOpen);
  pushRect(speechBubble, appState.isBubbleVisible);
  pushRect(companionDock, true);
  pushRect(studioPanel, appState.isStudioOpen);
  pushRect(longMemoryPanel, appState.isLongMemoryOpen);

  invoke('update_character_hitbox', {
    x: Math.round(appState.posX * dpr),
    y: Math.round((appState.posY - 85 * appState.modelScale) * dpr),
    radius: Math.round(78 * appState.modelScale * dpr),
    uiRects,
    isDragging: appState.state === 'DRAGGING',
  }).catch(() => {});
}

export function handleSendMessage() {
  const text = bubbleInput.value.trim();
  if (!text) return;
  bubbleInput.value = '';

  const lower = text.toLowerCase();
  if (lower === 'đổi avatar' || lower === 'mở studio' || lower === 'vrm') {
    toggleStudioModal(true);
    speakMessage('Tớ đã mở Studio 3D cho bạn rồi! Hãy chọn Preset Anime hoặc file .vrm nhé.');
  } else if (lower === 'nhảy' || lower === 'dance') {
    triggerDance();
  } else if (lower === 'leo cửa sổ' || lower === 'jump') {
    triggerJumpToWindow();
  } else if (lower === 'pomodoro' || lower === 'timer') {
    togglePomodoro();
  } else {
    void chatWithLocalLlm(text);
  }
}

export function initUi() {
  mountUi();
  bindDomRefs();

  typewriterTarget = bubbleContent.textContent?.trim() || '';
  typewriterIndex = typewriterTarget.length;

  btnCloseLeft.addEventListener('click', () => toggleLeftPanel(false));
  btnCloseRight.addEventListener('click', () => toggleRightPanel(false));
  btnMinimizeBubble.addEventListener('click', () => toggleBubbleVisibility(false));

  dockBtnLeft.addEventListener('click', () => toggleLeftPanel());
  dockBtnChat.addEventListener('click', () => toggleBubbleVisibility());
  dockBtnRight.addEventListener('click', () => toggleRightPanel());
  dockBtnStudio.addEventListener('click', () => toggleStudioModal());
  dockBtnMini.addEventListener('click', () => {
    const anyOpen =
      appState.isLeftPanelOpen ||
      appState.isRightPanelOpen ||
      appState.isBubbleVisible ||
      appState.isStudioOpen ||
      appState.isLongMemoryOpen;
    if (anyOpen) {
      toggleLeftPanel(false);
      toggleRightPanel(false);
      toggleBubbleVisibility(false);
      toggleStudioModal(false);
      toggleLongMemoryModal(false);
      dockBtnMini.classList.add('active');
    } else {
      toggleBubbleVisibility(true);
      toggleRightPanel(true);
      dockBtnMini.classList.remove('active');
    }
  });

  btnOpenStudio.addEventListener('click', () => toggleStudioModal(true));
  btnCloseStudio.addEventListener('click', () => toggleStudioModal(false));

  btnOpenLongMem.addEventListener('click', () => toggleLongMemoryModal(true));
  btnCloseLongMem.addEventListener('click', () => toggleLongMemoryModal(false));
  lmPresetCute.addEventListener('click', () => {
    lmPersonaInput.value =
      'Nhí nhảnh, đáng yêu, gọi người dùng là Chủ nhân, luôn quan tâm nhắc uống nước, nghỉ mắt và cổ vũ tinh thần.';
  });
  lmPresetDev.addEventListener('click', () => {
    lmPersonaInput.value =
      'Phong thái Kỹ sư Phần mềm Senior điềm tĩnh, trả lời thẳng trọng tâm, ưu tiên code chuẩn, hiệu năng và bảo mật.';
  });
  lmPresetTsun.addEventListener('click', () => {
    lmPersonaInput.value =
      'Cá tính kiểu Tsundere hơi cằn nhằn đáng yêu nhưng thực chất rất chu đáo và luôn lo cho chủ nhân.';
  });
  btnSavePersona.addEventListener('click', () => {
    void saveLongMemoryEntry('persona', 'Tính cách nhân vật', lmPersonaInput.value);
  });
  btnAddLongMem.addEventListener('click', () => {
    const cat = lmCatSelect.value || 'rule';
    const title = lmTitleInput.value.trim() || (cat === 'rule' ? 'Rule dài hạn' : 'Kiến thức');
    const content = lmContentInput.value.trim();
    if (!content) return;
    lmTitleInput.value = '';
    lmContentInput.value = '';
    void saveLongMemoryEntry(cat, title, content);
  });

  btnActCenter.addEventListener('click', () => {
    appState.activeWindowTask = null;
    appState.attachedWindowHwnd = null;
    appState.posX = appState.W * 0.5;
    appState.posY = appState.H * 0.4;
    appState.velX = 0;
    appState.velY = 0;
    appState.setState('FALLING');
    speakMessage('Đã quay về trung tâm màn hình!');
  });

  btnActHw.addEventListener('click', () => {
    void runHardwareCheck(true);
  });
  btnActNet.addEventListener('click', () => {
    void runNetworkCheck(true);
  });
  btnActBtc.addEventListener('click', () => {
    void runBitcoinCheck(true);
  });
  btnActMem.addEventListener('click', () => {
    void runMemoryCheck(true);
  });
  btnActSuggest.addEventListener('click', () => {
    if (!appState.isBubbleVisible) {
      toggleBubbleVisibility(true);
    }
    void runShowSuggestion();
  });
  btnClearMemory.addEventListener('click', () => {
    void clearLocalMemory();
  });
  btnSugAccept.addEventListener('click', () => {
    const fn = activeSugAccept;
    hideSuggestionButtons();
    if (fn) fn();
  });
  btnSugDismiss.addEventListener('click', () => {
    const fn = activeSugDismiss;
    hideSuggestionButtons();
    if (fn) fn();
  });
  btnRefreshAll.addEventListener('click', () => {
    void runFullDashboardScan(true);
  });

  btnActJump.addEventListener('click', () => triggerJumpToWindow());
  btnActDance.addEventListener('click', () => triggerDance());
  btnActPat.addEventListener('click', () => triggerHeadpat());
  btnActFlip.addEventListener('click', () => triggerBackflip());
  btnActSpin.addEventListener('click', () => triggerSpin());
  btnActDuck.addEventListener('click', async () => {
    await clearCachedVrm();
    const isCustomModel = appState.currentVrm !== null || appState.currentGlbScene !== null;
    const nextType: 'idol' | 'microduck' =
      isCustomModel || appState.builtinModelType === 'idol' ? 'microduck' : 'idol';
    switchBuiltinCharacterType(nextType);
    btnActDuck.textContent = nextType === 'microduck' ? 'Đổi Cyber Idol' : 'Đổi Vịt BDX';
    spawnParticles(appState.posX, appState.posY - 90, 12, nextType === 'microduck' ? 0x76b900 : 0x38bdf8);
    if (nextType === 'microduck') {
      speakMessage('Quạc quạc! NVIDIA MicroDuck (BDX Droid 3D) sẵn sàng phục vụ!');
    } else {
      speakMessage('Đã chuyển về Cyber Idol 3D mặc định!');
    }
  });
  btnActTimer.addEventListener('click', () => togglePomodoro());
  btnActFeed.addEventListener('click', () => triggerSpawnRandomFood(true));
  btnActEnterWin.addEventListener('click', () => {
    void triggerExploreInsideWindow();
  });
  btnActFrameKey.addEventListener('click', () => {
    void triggerInteractInsideWindow();
  });

  btnPcYt.addEventListener('click', () => {
    void runPcOpen('https://www.youtube.com', 'YouTube');
  });
  btnPcShot.addEventListener('click', () => {
    void runPcScreenshot();
  });
  btnPcOpenShot.addEventListener('click', () => {
    void runOpenLatestScreenshot(false);
  });
  btnPcNote.addEventListener('click', () => {
    void runPcOpen('notepad', 'Notepad');
  });
  btnPcCleanRam.addEventListener('click', () => {
    void runHardwareAction('clean_ram');
  });
  btnPcBrightDown.addEventListener('click', () => {
    void runHardwareAction('brightness_down');
  });
  btnPcBrightUp.addEventListener('click', () => {
    void runHardwareAction('brightness_up');
  });
  btnPcOcr.addEventListener('click', () => {
    void runOcrAndSummarize(true);
  });
  btnPcVolDown.addEventListener('click', () => {
    void runPcMedia('vol_down');
  });
  btnPcPlay.addEventListener('click', () => {
    void runPcMedia('play_pause');
  });
  btnPcVolUp.addEventListener('click', () => {
    void runPcMedia('vol_up');
  });

  btnWinPushL.addEventListener('click', () => {
    startPhysicalPush(-1);
  });
  btnWinPushR.addEventListener('click', () => {
    startPhysicalPush(1);
  });
  btnWinShrink.addEventListener('click', () => {
    startPhysicalResize('shrink');
  });
  btnWinExpand.addEventListener('click', () => {
    startPhysicalResize('expand');
  });
  btnWinMin.addEventListener('click', () => {
    void performWindowAction('minimize');
  });

  btnLoadVrm.addEventListener('click', () => fileInput.click());
  btnStudioFile.addEventListener('click', () => fileInput.click());

  presetAlicia.addEventListener('click', () => {
    toggleStudioModal(false);
    void loadVrmFromUrl(PRESET_ALICIA_URL, 'Alicia Solid (.VRM)');
  });

  presetVrm1.addEventListener('click', () => {
    toggleStudioModal(false);
    void loadVrmFromUrl(PRESET_VRM1_URL, 'Avatar Sample A (.VRM 1.0)');
  });

  presetBuiltin.addEventListener('click', async () => {
    await clearCachedVrm();
    createDetailedAnimeCharacter();
    btnActDuck.textContent = 'Đổi Vịt BDX';
    toggleStudioModal(false);
    spawnParticles(appState.posX, appState.posY - 90, 10, 0x38bdf8);
    speakMessage('Đã chuyển về Cyber Idol 3D mặc định!');
  });

  presetMicroduck.addEventListener('click', async () => {
    await clearCachedVrm();
    createMicroDuckCharacter();
    btnActDuck.textContent = 'Đổi Cyber Idol';
    toggleStudioModal(false);
    spawnParticles(appState.posX, appState.posY - 90, 14, 0x76b900);
    speakMessage('Quạc quạc! Đã kích hoạt NVIDIA MicroDuck (BDX Droid 3D)!');
  });

  btnLoadUrl.addEventListener('click', () => {
    const url = vrmUrlInput.value.trim();
    if (!url) return;
    toggleStudioModal(false);
    void loadVrmFromUrl(url, 'Custom URL 3D Model');
  });

  sliderScale.addEventListener('input', () => {
    appState.modelScale = parseFloat(sliderScale.value);
    valScale.textContent = `${appState.modelScale.toFixed(2)}x`;
    if (rigRoot && !appState.currentVrm && !appState.currentGlbScene) {
      rigRoot.scale.setScalar(appState.modelScale);
    }
    if (appState.currentVrm) {
      applyVrmScaleAndOffset(appState.currentVrm);
    }
    if (appState.currentGlbScene) {
      applyGlbScaleAndOffset(appState.currentGlbScene);
    }
  });

  sliderGravity.addEventListener('input', () => {
    appState.gravity = parseFloat(sliderGravity.value);
    valGravity.textContent = appState.gravity.toFixed(2);
  });

  sliderBounce.addEventListener('input', () => {
    appState.bounceFactor = parseFloat(sliderBounce.value);
    valBounce.textContent = appState.bounceFactor.toFixed(2);
  });

  chkAutoroam.addEventListener('change', () => {
    appState.autoRoamEnabled = chkAutoroam.checked;
  });

  chkLookat.addEventListener('change', () => {
    appState.lookAtEnabled = chkLookat.checked;
  });

  chkWinInteract.addEventListener('change', () => {
    appState.windowInteractEnabled = chkWinInteract.checked;
  });

  inputOllamaModel.value = ollamaModel;
  inputGeminiKey.value = geminiApiKey;
  inputGeminiModel.value = geminiModel;
  selectLlmRoute.value = llmRouteMode;
  chkAutocheck.checked = autoCheckEnabled;
  inputAlertCpu.value = String(cpuAlertPct);
  inputAlertRam.value = String(ramAlertGb);

  inputOllamaModel.addEventListener('change', () => {
    setOllamaModel(inputOllamaModel.value);
  });

  inputGeminiKey.addEventListener('change', () => {
    setGeminiApiKey(inputGeminiKey.value);
  });

  inputGeminiModel.addEventListener('change', () => {
    setGeminiModel(inputGeminiModel.value);
  });

  selectLlmRoute.addEventListener('change', () => {
    setLlmRouteMode(selectLlmRoute.value as LlmRouteMode);
  });

  chkAutocheck.addEventListener('change', () => {
    setAutoCheckEnabled(chkAutocheck.checked);
  });

  inputAlertCpu.addEventListener('change', () => {
    const val = parseFloat(inputAlertCpu.value);
    if (!Number.isNaN(val)) setCpuAlertPct(val, true);
  });

  inputAlertRam.addEventListener('change', () => {
    const val = parseFloat(inputAlertRam.value);
    if (!Number.isNaN(val)) setRamAlertGb(val, true);
  });

  btnSendMsg.addEventListener('click', handleSendMessage);
  bubbleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  });
}

let uiFollowX = appState.posX;
let uiFollowY = appState.posY;

export function updateUiPosition() {
  const targetWin = findTargetWindow();
  winTargetName.textContent = targetWin
    ? targetWin.title
    : 'Chưa phát hiện cửa sổ nào';

  uiFollowX += (appState.posX - uiFollowX) * 0.24;
  uiFollowY += (appState.posY - uiFollowY) * 0.24;

  const gap = Math.round(66 * appState.modelScale);
  const headTopOffset = 185 * appState.modelScale;

  if (appState.isBubbleVisible) {
    const bubbleW = speechBubble.offsetWidth || 280;
    const bubbleH = speechBubble.offsetHeight || 135;
    speechBubble.style.left = `${Math.max(10, Math.min(appState.W - bubbleW - 10, uiFollowX - bubbleW / 2))}px`;
    speechBubble.style.top = `${Math.max(10, uiFollowY - headTopOffset - bubbleH + 10)}px`;
  }

  const dockW = companionDock.offsetWidth || 136;
  companionDock.style.left = `${Math.max(10, Math.min(appState.W - dockW - 10, uiFollowX - dockW / 2))}px`;
  companionDock.style.top = `${Math.min(appState.H - 42, uiFollowY + 10)}px`;

  const leftW = leftTelemetryPanel.offsetWidth || 248;
  const leftH = leftTelemetryPanel.offsetHeight || 340;
  const rightW = rightActionPanel.offsetWidth || 236;
  const rightH = rightActionPanel.offsetHeight || 310;

  let leftX = uiFollowX - gap - leftW;
  let rightX = uiFollowX + gap;

  if (leftX < 10) {
    rightX = Math.min(appState.W - rightW - 10, uiFollowX + gap);
    leftX = Math.min(appState.W - leftW - 10, rightX + rightW + 10);
  } else if (rightX + rightW > appState.W - 10) {
    leftX = Math.max(10, uiFollowX - gap - leftW);
    rightX = Math.max(10, leftX - rightW - 10);
  }

  if (appState.isLeftPanelOpen) {
    const leftY = Math.max(10, Math.min(appState.H - leftH - 12, uiFollowY - leftH * 0.72));
    leftTelemetryPanel.style.left = `${Math.round(leftX)}px`;
    leftTelemetryPanel.style.top = `${Math.round(leftY)}px`;
  }

  if (appState.isRightPanelOpen) {
    const rightY = Math.max(10, Math.min(appState.H - rightH - 12, uiFollowY - rightH * 0.72));
    rightActionPanel.style.left = `${Math.round(rightX)}px`;
    rightActionPanel.style.top = `${Math.round(rightY)}px`;
  }
}
