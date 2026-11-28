import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  clearSpeechMessage,
  clearStickyNotes,
  openFileAnalyticsDashboard,
  pinStickyNote,
  renderDashboardAiSummary,
  setBubbleThinkingState,
  setFileDragHoverMode,
  setStreamSpeechText,
  speakVietnameseTts,
  startCustomTimer,
  stopCustomTimer,
  toggleBubbleVisibility,
  toggleEdgePeekMode,
  toggleMiniScreenPanel,
  toggleStickyNotesWidget,
  toggleTarotModal,
} from '../frontend/ui';
import { appState } from '../core/state';
import {
  fireAnimationTrigger,
  getClipById,
  playRandomClipFromDeck,
  previewClip,
  stopAllThinkingClips,
} from '../core/animationBinder';
import { syncChatPushToCloud, syncChatStreamChunkToCloud } from './toolForge';
import {
  buildPinnedFilesPromptContext,
  clearPinnedChatFiles,
  formatPinnedFilesChatTag,
  getPinnedAnalyses,
  getPinnedChatFiles,
  getPrimaryPinnedFile,
  pinFileToChatBar,
} from '../frontend/features/pinnedChatFiles';
import { speakEnglishTts } from '../frontend/features/voiceTts';
import { runMultiStepDesktopAgent } from './agentLoop';
import {
  buildCompactedHistoryWindow,
  extractSuggestedSkillFromTurn,
  verifyActionHonesty,
} from './contextCompactor';
import {
  COMPACT_LOCAL_TOOLSET_PROMPT,
  DESKTOP_TOOLSET_PROMPT,
  parseAiToolCalls,
  ToolCallItem,
} from './assistantPrompts';
import {
  isQuestionOrMetaDiscussion,
  parseAccessoryCommand,
  parseClipboardCommand,
  parseDeepSystemCommand,
  parseDesktopIconCommand,
  parseProcessCommand,
  parseStickyNoteCommand,
  parseTimerCommand,
  parseWebSearchCommand,
  parseWorkspaceCommand,
} from './commandParsers';

export { COMPACT_LOCAL_TOOLSET_PROMPT, DESKTOP_TOOLSET_PROMPT, parseAiToolCalls };
export type { ToolCallItem };

let activeToolAnimDepth = 0;

async function runWithToolAnim<T>(
  toolKey: string,
  fn: () => Promise<T>,
  isOk?: (res: T) => boolean
): Promise<T> {
  const ownTrigger = activeToolAnimDepth === 0;
  if (ownTrigger) {
    fireAnimationTrigger('tool', toolKey, 'start');
    setBubbleThinkingState(true, `[TOOL: ${toolKey.toUpperCase()}] Đang thực thi...`);
  }
  activeToolAnimDepth++;
  let ok = false;
  try {
    const res = await fn();
    ok = isOk ? isOk(res) : true;
    return res;
  } catch (err) {
    ok = false;
    throw err;
  } finally {
    activeToolAnimDepth = Math.max(0, activeToolAnimDepth - 1);
    if (ownTrigger) {
      if (!isStreamingActive) setBubbleThinkingState(false);
      fireAnimationTrigger('tool', toolKey, ok ? 'success' : 'error');
    }
  }
}

function scheduleScanIdleReset(delayMs = 1800) {
  window.setTimeout(() => {
    if (appState.state === 'SCANNING') {
      appState.setState(appState.attachedWindowHwnd !== null ? 'SITTING_WINDOW' : 'IDLE');
    }
  }, delayMs);
}

const telemetryTtlCache = new Map<string, { ts: number; value: unknown }>();
const TELEMETRY_CACHE_TTL_MS = 15_000;

async function invokeCachedTelemetry<T>(
  cacheKey: string,
  command: string,
  bypassCache = false
): Promise<T> {
  const now = Date.now();
  const cached = telemetryTtlCache.get(cacheKey);
  if (!bypassCache && cached && now - cached.ts < TELEMETRY_CACHE_TTL_MS) {
    return cached.value as T;
  }
  const fresh = await invoke<T>(command);
  telemetryTtlCache.set(cacheKey, { ts: now, value: fresh });
  return fresh;
}
import {
  show3DRadar,
  showFishingRod,
  spawnAlertEffect,
  spawnBlackHole,
  spawnParticles,
  spawnScanEffect,
  spawnShockwave,
  triggerRandomSpecial3DEffect,
} from '../core/particles';
import {
  AppProcessMetrics,
  BitcoinInfo,
  BrowserInsights,
  ChatEntry,
  ClipboardHistoryEntry,
  CognitiveContextBundle,
  EnglishVocabItem,
  HardwareInfo,
  IngestedFileAnalysis,
  LongMemoryEntry,
  MacroEntry,
  MemoryInsights,
  NetworkInfo,
  NewsArticleItem,
  OcrResultInfo,
  OllamaMessage,
  PackExecResult,
  PackRouteResult,
  RichToolTraceItem,
  RichTurnMeta,
  RouterChatResponse,
  RouterStatusPayload,
  ScheduledNoteEntry,
  TranslateResult,
  WeatherEffectMode,
  WeatherInfo,
} from '../core/types';
import {
  playCastRodSound,
  playSuccessChimeSound,
  playAlertBeep,
} from '../core/soundFx';
import {
  arrangeDesktopWindows,
  findTargetWindow,
  minimizeMultipleWindows,
  performWindowAction,
  startPhysicalPush,
  startPhysicalResize,
} from '../physics/windowInteract';
import {
  arrangeDesktopIcons,
  startDragDesktopIcon,
} from '../physics/desktopIconInteract';
import { AccessoryType, equipAccessory3D } from '../characters/accessories3d';
import {
  clearTemporaryAccessoryTimer,
  triggerGooseMischiefMode,
  triggerManualBeatDance,
  triggerTerritoryDefenseMode,
} from '../core/rhythmAndGoose';
import {
  triggerBackflip,
  triggerBlackHoleTeleport,
  triggerClimbWindow,
  triggerDuckRadarScan,
  triggerDuckSleepMode,
  triggerDuckWheelRoll,
  triggerExploreInsideWindow,
  triggerInteractInsideWindow,
  triggerJumpToWindow,
  triggerSpawnRandomFood,
  triggerSpin,
  triggerStartSwimming,
  triggerStopSwimming,
  triggerWindowSwing,
  triggerWindowPaperCrash,
  triggerHulkRageMode,
} from '../physics/physics';
import { clearCachedVrm } from '../characters/vrmManager';
import {
  createDetailedAnimeCharacter,
  createMicroDuckCharacter,
} from '../characters/characterRig';
import {
  appendChatMessage,
  hideSuggestionButtons,
  showSuggestionButtons,
  showTelemetrySection,
} from '../frontend/ui';
import { isP2pSessionActive } from '../core/p2pArena';
import {
  buildCustomSkillsPromptBlock,
  detectToolForgeRequestIntent,
  executeSavedSkillWithSelfHeal,
  extractArgsWithLocalLlmIfAvailable,
  extractChatContactAndMessage,
  forgeNewToolFromRequest,
  getCachedCustomSkills,
  isSendChatSkill,
  matchSavedSkillForUserText,
  refreshCustomSkills,
  registerToolForgeContext,
  validateSendChatSkillArgs,
} from './toolForge';
import { fetchNotificationHistory } from './notificationService';

let speakCb: ((msg: string) => void) | null = null;
let danceCb: (() => void) | null = null;

export function registerAssistantCallbacks(
  onSpeak: (msg: string) => void,
  onDance: () => void
) {
  speakCb = onSpeak;
  danceCb = onDance;
}

function speak(msg: string) {
  if (speakCb) {
    speakCb(msg);
  }
}

export type LlmRouteMode = 'auto' | 'colab' | 'gemini' | 'local';

export interface ColabScanResult {
  online: boolean;
  tunnel_url: string;
  default_model: string;
  enabled: boolean;
  models: string[];
  error: string;
}

export let colabCloudOnline = false;
export let colabCloudUrl = '';
export let colabCloudModel = localStorage.getItem('mate_colab_model') || 'qwen2.5-coder:14b';

export function setColabCloudModel(modelName: string) {
  const clean = modelName.trim();
  if (!clean) return;
  colabCloudModel = clean;
  localStorage.setItem('mate_colab_model', clean);
}

export async function scanColabCloudModels(customUrl?: string): Promise<ColabScanResult> {
  const res = await invoke<ColabScanResult>('colab_cloud_scan', {
    customUrl: customUrl ?? null,
  });
  colabCloudOnline = Boolean(res.online);
  if (res.tunnel_url) colabCloudUrl = res.tunnel_url;
  if (res.online && res.models.length > 0 && !res.models.includes(colabCloudModel)) {
    colabCloudModel = res.models[0];
  }
  updateLlmBadge(isOllamaOnline);
  return res;
}

export async function saveColabCloudConfig(
  tunnelUrl: string,
  defaultModel: string,
  enabled = true
): Promise<ColabScanResult> {
  const res = await invoke<ColabScanResult>('colab_cloud_save_config', {
    tunnelUrl,
    defaultModel,
    enabled,
  });
  colabCloudOnline = Boolean(res.online);
  colabCloudUrl = res.tunnel_url;
  if (defaultModel.trim()) {
    setColabCloudModel(defaultModel);
  }
  updateLlmBadge(isOllamaOnline);
  return res;
}

export let ollamaModel = localStorage.getItem('mate_ollama_model') || 'qwen2.5:1.5b';
export let geminiApiKey = '';
localStorage.removeItem('mate_gemini_api_key');
const rawGeminiModel = localStorage.getItem('mate_gemini_model') || '';
export let geminiModel =
  !rawGeminiModel || rawGeminiModel === 'gemini-2.5-flash' || rawGeminiModel === 'gemini-2.0-flash'
    ? 'gemini-3.5-flash'
    : rawGeminiModel;
if (!rawGeminiModel || rawGeminiModel === 'gemini-2.5-flash' || rawGeminiModel === 'gemini-2.0-flash') {
  localStorage.setItem('mate_gemini_model', 'gemini-3.5-flash');
}
export let llmRouteMode: LlmRouteMode =
  (localStorage.getItem('mate_llm_route_mode') as LlmRouteMode) || 'auto';
export let autoCheckEnabled = localStorage.getItem('mate_autocheck') !== 'false';
export let cpuAlertPct = Number(localStorage.getItem('mate_alert_cpu_pct') || '85') || 85;
export let ramAlertGb = Number(localStorage.getItem('mate_alert_ram_gb') || '12') || 12;

let isOllamaOnline = false;
let isBusy = false;
export let routerHealthyCount = 0;
export let lastRouterEndpointLabel = '';
const executedToolsThisTurn: string[] = [];
const richTraceThisTurn: RichToolTraceItem[] = [];
const createdImagesThisTurn: string[] = [];

window.addEventListener('duck-9router-updated', (ev: Event) => {
  const custom = ev as CustomEvent<{ healthy?: number }>;
  if (typeof custom.detail?.healthy === 'number') {
    routerHealthyCount = custom.detail.healthy;
    updateLlmBadge(isOllamaOnline);
  }
});

export function isAssistantBusy(): boolean {
  return isBusy;
}
let lastBtcPrice: number | null = null;
let lastHwAlertAt = 0;
let proactiveStep = 0;

const chatHistory: OllamaMessage[] = [];

export function setOllamaModel(model: string) {
  const cleaned = model.trim() || 'qwen2.5:1.5b';
  ollamaModel = cleaned;
  localStorage.setItem('mate_ollama_model', cleaned);
  void refreshLlmStatus();
}

export function setGeminiApiKey(key: string, persistToEnv = false) {
  const cleaned = key.trim();
  geminiApiKey = cleaned;
  localStorage.removeItem('mate_gemini_api_key');
  const el = document.getElementById('input-gemini-key') as HTMLInputElement | null;
  if (el && el.value !== cleaned) el.value = cleaned;
  updateLlmBadge(isOllamaOnline);
  if (persistToEnv) {
    void invoke('save_gemini_api_key_env', { apiKey: cleaned }).catch(() => { });
  }
}

export function setGeminiModel(model: string) {
  const cleaned = model.trim() || 'gemini-3.5-flash';
  geminiModel = cleaned;
  localStorage.setItem('mate_gemini_model', cleaned);
  updateLlmBadge(isOllamaOnline);
}

export function setLlmRouteMode(mode: LlmRouteMode) {
  llmRouteMode = mode;
  localStorage.setItem('mate_llm_route_mode', mode);
  updateLlmBadge(isOllamaOnline);
}

export function shouldRouteToGemini(userText: string, isHeavyTask = false): boolean {
  const hasCloudPool = Boolean(geminiApiKey.trim()) || routerHealthyCount > 0;
  if (!hasCloudPool) return false;
  const lower = userText.toLowerCase().trim();
  if (lower.startsWith('@local') || lower.startsWith('/l ')) return false;
  if (lower.startsWith('@gemini') || lower.startsWith('@9router') || lower.startsWith('/g ')) return true;
  if (llmRouteMode === 'local') return false;
  if (llmRouteMode === 'gemini') return true;

  if (!isOllamaOnline || isHeavyTask) return true;
  if (userText.trim().length > 18) return true;
  return /giải thích|tại sao|vì sao|làm sao|như thế nào|hướng dẫn|viết|code|lỗi|bug|python|rust|javascript|typescript|sql|so sánh|phân tích|tóm tắt|dịch|là gì|cách làm|thuật toán|kiến trúc|zalo|telegram|discord|messenger|gmail|mail|google sheet|gg sheet|google doc|nhắn|nhan tin|gửi tin|gui tin|hỏi\s+|hoi\s+|điền form|dien form|lấy bảng|lay bang|tự động|tu dong|automate|file|csv|xlsx|pdf|tool|skill|check|kiểm tra|kiem tra|lọc|loc|thêm|them|sửa|sua|xóa|xoa|tạo|tao/i.test(
    userText
  );
}

async function askHybridLlm(
  localSystemPrompt: string,
  geminiSystemPrompt: string,
  messages: OllamaMessage[],
  preferGemini: boolean,
  thinkingBudget = 0,
  maxOutputTokens = 2048
): Promise<{ reply: string; engine: 'Gemini' | 'Local' | 'Colab' }> {
  const localMessages = messages.slice(-4);
  const colabMessages = messages.slice(-8);
  const hasCloudPool = Boolean(geminiApiKey.trim()) || routerHealthyCount > 0;

  if (colabCloudOnline && (llmRouteMode === 'colab' || (preferGemini && !hasCloudPool))) {
    try {
      activeStreamEngine = 'Local';
      const reply = await invoke<string>('ask_colab_cloud_stream', {
        tunnelUrl: colabCloudUrl || null,
        model: colabCloudModel,
        messages: [{ role: 'system', content: geminiSystemPrompt }, ...colabMessages],
      });
      updateLlmBadge(isOllamaOnline, 'Colab');
      return { reply, engine: 'Colab' };
    } catch {
      colabCloudOnline = false;
      updateLlmBadge(isOllamaOnline);
    }
  }

  if (preferGemini && hasCloudPool) {
    try {
      const rRes = await invoke<RouterChatResponse>('ask_9router', {
        preferred: geminiModel,
        apiKey: geminiApiKey || null,
        systemPrompt: geminiSystemPrompt,
        messages,
        jsonMode: false,
        maxOutputTokens,
        thinkingBudget,
      });
      lastRouterEndpointLabel = rRes.endpoint_id;
      return { reply: rRes.reply, engine: 'Gemini' };
    } catch (err) {
      if (colabCloudOnline) {
        try {
          activeStreamEngine = 'Local';
          const reply = await invoke<string>('ask_colab_cloud_stream', {
            tunnelUrl: colabCloudUrl || null,
            model: colabCloudModel,
            messages: [{ role: 'system', content: geminiSystemPrompt }, ...colabMessages],
          });
          updateLlmBadge(isOllamaOnline, 'Colab');
          return { reply, engine: 'Colab' };
        } catch {
          colabCloudOnline = false;
        }
      }
      if (isOllamaOnline) {
        activeStreamEngine = 'Local';
        const reply = await invoke<string>('ask_ollama_stream', {
          model: ollamaModel,
          messages: [{ role: 'system', content: localSystemPrompt }, ...localMessages],
        });
        updateLlmBadge(true, 'Local');
        return { reply, engine: 'Local' };
      }
      throw err;
    }
  }

  try {
    activeStreamEngine = 'Local';
    const reply = await invoke<string>('ask_ollama_stream', {
      model: ollamaModel,
      messages: [{ role: 'system', content: localSystemPrompt }, ...localMessages],
    });
    updateLlmBadge(true, 'Local');
    return { reply, engine: 'Local' };
  } catch (err) {
    updateLlmBadge(false);
    if (colabCloudOnline) {
      try {
        activeStreamEngine = 'Local';
        const reply = await invoke<string>('ask_colab_cloud_stream', {
          tunnelUrl: colabCloudUrl || null,
          model: colabCloudModel,
          messages: [{ role: 'system', content: geminiSystemPrompt }, ...colabMessages],
        });
        updateLlmBadge(false, 'Colab');
        return { reply, engine: 'Colab' };
      } catch {
        colabCloudOnline = false;
      }
    }
    if (hasCloudPool) {
      const rRes = await invoke<RouterChatResponse>('ask_9router', {
        preferred: geminiModel,
        apiKey: geminiApiKey || null,
        systemPrompt: geminiSystemPrompt,
        messages,
        jsonMode: false,
        maxOutputTokens,
        thinkingBudget,
      });
      lastRouterEndpointLabel = rRes.endpoint_id;
      return { reply: rRes.reply, engine: 'Gemini' };
    }
    throw err;
  }
}

export function setAutoCheckEnabled(enabled: boolean) {
  autoCheckEnabled = enabled;
  localStorage.setItem('mate_autocheck', String(enabled));
}

export function setCpuAlertPct(pct: number, saveDb = true) {
  const clamped = Math.max(10, Math.min(100, Math.round(pct)));
  cpuAlertPct = clamped;
  lastHwAlertAt = 0;
  localStorage.setItem('mate_alert_cpu_pct', String(clamped));
  const inputEl = document.getElementById('input-alert-cpu') as HTMLInputElement | null;
  if (inputEl) inputEl.value = String(clamped);
  if (saveDb) {
    void invoke('memory_save_profile', {
      key: 'Ngưỡng CPU',
      value: `${clamped}%`,
    }).catch(() => { });
    void checkHardwareAlertNow();
  }
}

export function setRamAlertGb(gb: number, saveDb = true) {
  const clamped = Math.max(1, Math.min(128, Math.round(gb * 10) / 10));
  ramAlertGb = clamped;
  lastHwAlertAt = 0;
  localStorage.setItem('mate_alert_ram_gb', String(clamped));
  const inputEl = document.getElementById('input-alert-ram') as HTMLInputElement | null;
  if (inputEl) inputEl.value = String(clamped);
  if (saveDb) {
    void invoke('memory_save_profile', {
      key: 'Ngưỡng RAM',
      value: `${clamped} GB`,
    }).catch(() => { });
    void checkHardwareAlertNow();
  }
}

function isHardwareOverThreshold(hw: HardwareInfo): { cpuHigh: boolean; ramHigh: boolean } {
  return {
    cpuHigh: hw.cpu_load_pct >= cpuAlertPct,
    ramHigh: hw.ram_used_gb >= ramAlertGb,
  };
}

function triggerHardwareAlertUi(hw: HardwareInfo) {
  const reasons: string[] = [];
  if (hw.cpu_load_pct >= cpuAlertPct) {
    reasons.push(`CPU ${hw.cpu_load_pct.toFixed(0)}% (ngưỡng >${cpuAlertPct}%)`);
  }
  if (hw.ram_used_gb >= ramAlertGb) {
    reasons.push(`RAM ${hw.ram_used_gb.toFixed(1)} GB (ngưỡng >${ramAlertGb} GB)`);
  }
  if (reasons.length === 0) return;

  const alertText = reasons.join(', ');
  const bubbleEl = document.getElementById('speech-bubble');
  if (bubbleEl && !appState.isBubbleVisible) {
    bubbleEl.style.display = 'flex';
    appState.isBubbleVisible = true;
    document.getElementById('dock-btn-chat')?.classList.add('active');
  }

  appState.velY = -7;
  appState.setState('ALERT');
  appState.setExpression('surprised', 4.0);
  spawnAlertEffect(appState.posX, appState.posY);
  fireAnimationTrigger('event', 'hw_high_alert', 'enter');
  playAlertBeep(appState.posX);
  showTelemetrySection('alert');
  pushDashboardAlert(`CẢNH BÁO: ${alertText}`);
  speak(`[CẢNH BÁO TÀI NGUYÊN] ${alertText}! Bạn kiểm tra bảng bên trái nhé.`);
}

async function checkHardwareAlertNow() {
  if (isP2pSessionActive()) return;
  try {
    const hw = await invoke<HardwareInfo>('check_hardware');
    updateHardwareDashboard(hw);
    const { cpuHigh, ramHigh } = isHardwareOverThreshold(hw);
    const now = Date.now();
    if ((cpuHigh || ramHigh) && now - lastHwAlertAt >= 60_000) {
      lastHwAlertAt = now;
      triggerHardwareAlertUi(hw);
    }
  } catch {
    // Bỏ qua lỗi nền
  }
}

export function pushDashboardAlert(text: string) {
  const container = document.getElementById('dash-alerts');
  if (!container) return;
  const timeStr = new Date().toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const item = document.createElement('div');
  item.className = 'alert-item';
  item.textContent = `[${timeStr}] ${text}`;
  container.prepend(item);
  while (container.children.length > 8) {
    container.removeChild(container.lastChild!);
  }
}

function updateHardwareDashboard(hw: HardwareInfo) {
  const cpuNameEl = document.getElementById('dash-cpu-name');
  const cpuPctEl = document.getElementById('dash-cpu-pct');
  const cpuBarEl = document.getElementById('dash-cpu-bar');
  const ramValEl = document.getElementById('dash-ram-val');
  const ramBarEl = document.getElementById('dash-ram-bar');
  const gpuNameEl = document.getElementById('dash-gpu-name');
  const diskValEl = document.getElementById('dash-disk-val');

  const cpuShort = hw.cpu_name.replace(/\(R\)|\(TM\)|CPU|Processor/gi, '').trim();
  const gpuShort = hw.gpu_name.replace(/NVIDIA|AMD|Intel\(R\)/gi, '').trim();

  if (cpuNameEl) cpuNameEl.textContent = cpuShort;
  if (cpuPctEl) cpuPctEl.textContent = `${hw.cpu_load_pct.toFixed(0)}%`;
  if (cpuBarEl) {
    cpuBarEl.style.width = `${Math.min(100, hw.cpu_load_pct)}%`;
    cpuBarEl.classList.toggle('warn', hw.cpu_load_pct >= cpuAlertPct);
  }

  if (ramValEl) {
    ramValEl.textContent = `${hw.ram_used_gb.toFixed(1)} / ${hw.ram_total_gb.toFixed(1)} GB (${hw.ram_used_pct.toFixed(0)}%)`;
  }
  if (ramBarEl) {
    ramBarEl.style.width = `${Math.min(100, hw.ram_used_pct)}%`;
    ramBarEl.classList.toggle('warn', hw.ram_used_gb >= ramAlertGb);
  }

  if (gpuNameEl) gpuNameEl.textContent = gpuShort;
  if (diskValEl) {
    diskValEl.textContent = `${hw.disk_free_gb.toFixed(0)} / ${hw.disk_total_gb.toFixed(0)} GB trống`;
  }

  const batEl = document.getElementById('dash-bat-val');
  if (batEl) {
    if (hw.battery_pct !== undefined && hw.battery_pct >= 0) {
      batEl.textContent = `${hw.battery_pct}%${hw.battery_charging ? ' (Đang sạc)' : ''}`;
    } else {
      batEl.textContent = 'Máy bàn (AC)';
    }
  }

  const procsEl = document.getElementById('dash-top-procs');
  if (procsEl && hw.top_processes) {
    procsEl.textContent = `Top RAM: ${hw.top_processes}`;
  }
}

export function updateAppMetricsDashboard(m: AppProcessMetrics) {
  const pidEl = document.getElementById('dash-app-pid');
  const ramEl = document.getElementById('dash-app-ram');
  const ramSubEl = document.getElementById('dash-app-ram-sub');
  const ramBar = document.getElementById('dash-app-ram-bar');
  const cpuEl = document.getElementById('dash-app-cpu');
  const cpuSubEl = document.getElementById('dash-app-cpu-sub');
  const cpuBar = document.getElementById('dash-app-cpu-bar');
  const uptimeEl = document.getElementById('dash-app-uptime');
  const statusBadge = document.getElementById('dash-app-status-badge');

  if (pidEl) pidEl.textContent = `PID: ${m.pid}`;
  if (ramEl) ramEl.textContent = `${m.app_ram_mb.toFixed(1)} MB`;
  if (ramSubEl) {
    ramSubEl.textContent = `Đỉnh: ${m.app_peak_ram_mb.toFixed(1)} MB | Ảo: ${m.app_virtual_mem_mb.toFixed(1)} MB`;
  }
  if (ramBar) {
    const ramPct = Math.min(100, Math.max(5, (m.app_ram_mb / 450) * 100));
    ramBar.style.width = `${ramPct}%`;
  }
  if (cpuEl) cpuEl.textContent = `${m.app_cpu_pct.toFixed(1)}%`;
  if (cpuSubEl) {
    cpuSubEl.textContent = `Trên ${m.system_cpu_cores} CPU Cores | ${m.app_handles} Handles`;
  }
  if (cpuBar) {
    const cpuPct = Math.min(100, Math.max(4, m.app_cpu_pct * 6));
    cpuBar.style.width = `${cpuPct}%`;
  }
  if (uptimeEl) {
    const mns = Math.floor(m.uptime_seconds / 60);
    const hrs = Math.floor(mns / 60);
    const remM = mns % 60;
    const secs = m.uptime_seconds % 60;
    uptimeEl.textContent = hrs > 0 ? `${hrs}h ${remM}p` : `${remM}p ${secs}s`;
  }
  if (statusBadge) {
    if (m.app_ram_mb < 220 && m.app_cpu_pct < 5) {
      statusBadge.textContent = '[RẤT TỐI ƯU]';
      statusBadge.style.color = '#34d399';
    } else if (m.app_ram_mb < 450 && m.app_cpu_pct < 15) {
      statusBadge.textContent = '[BÌNH THƯỜNG]';
      statusBadge.style.color = '#38bdf8';
    } else {
      statusBadge.textContent = '[ĐANG TẢI]';
      statusBadge.style.color = '#fbbf24';
    }
  }
}

function formatUptimeText(secs: number): string {
  const m = Math.floor(secs / 60);
  const h = Math.floor(m / 60);
  const remM = m % 60;
  const remS = secs % 60;
  if (h > 0) return `${h} giờ ${remM} phút`;
  if (remM > 0) return `${remM} phút ${remS} giây`;
  return `${secs} giây`;
}

export async function runCheckAppMetrics(interactive = true): Promise<string> {
  const exec = async () => {
    if (interactive) {
      appState.setState('SCANNING');
      spawnScanEffect(appState.posX, appState.posY);
    }
    try {
      const m = await invokeCachedTelemetry<AppProcessMetrics>(
        'app_metrics',
        'get_app_process_metrics',
        interactive
      );
      updateAppMetricsDashboard(m);
      if (interactive) {
        showTelemetrySection('app_metrics');
      }
      const upStr = formatUptimeText(m.uptime_seconds);
      const summary = `[HIỆU NĂNG APP DUCK AI MANAGER] PID: ${m.pid} | CPU: ${m.app_cpu_pct}% (trên ${m.system_cpu_cores} nhân) | RAM: ${m.app_ram_mb} MB (Đỉnh: ${m.app_peak_ram_mb} MB, Bộ nhớ ảo: ${m.app_virtual_mem_mb} MB) | ${m.app_handles} Handles | Thời gian chạy: ${upStr}`;
      if (interactive) {
        speak(`App Duck AI Manager đang chạy siêu nhẹ: CPU chỉ ngốn ${m.app_cpu_pct}% trên ${m.system_cpu_cores} nhân, RAM chỉ chiếm ${m.app_ram_mb} MB. Xem chi tiết bảng bên trái nhé!`);
      }
      return summary;
    } catch (err) {
      const msg = `[LỖI ĐO HIỆU NĂNG APP] ${String(err)}`;
      if (interactive) speak(msg);
      return msg;
    } finally {
      if (interactive) scheduleScanIdleReset();
    }
  };
  return interactive
    ? runWithToolAnim('telemetry', exec, (s) => !s.startsWith('[LỖI'))
    : exec();
}

function updateNetworkDashboard(net: NetworkInfo) {
  const pingEl = document.getElementById('dash-net-ping');
  const detailEl = document.getElementById('dash-net-detail');
  if (pingEl) {
    pingEl.textContent = net.internet_ok ? `${net.latency_ms} ms` : 'OFFLINE';
    pingEl.style.color = net.internet_ok ? '#34d399' : '#f87171';
  }
  if (detailEl) {
    const inet = net.internet_ok ? 'Internet OK' : 'Mất mạng';
    const ipPart = net.local_ip ? ` | IP: ${net.local_ip}` : '';
    const wifiPart = net.wifi_ssid ? ` (${net.wifi_ssid})` : '';
    const connPart = net.conn_summary ? ` | ${net.conn_summary}` : '';
    const llm = net.ollama_ok ? ` | Ollama OK` : ' | Ollama Offline';
    detailEl.textContent = `${inet}${ipPart}${wifiPart}${connPart}${llm}`;
  }
}

function updateBitcoinDashboard(btc: BitcoinInfo) {
  const priceEl = document.getElementById('dash-btc-price');
  const changeEl = document.getElementById('dash-btc-change');
  const srcEl = document.getElementById('dash-btc-src');

  const sign = btc.change_24h_pct >= 0 ? '+' : '';
  const priceFmt = btc.price_usd.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (priceEl) priceEl.textContent = `$${priceFmt}`;
  if (srcEl) srcEl.textContent = btc.source;
  if (changeEl) {
    changeEl.textContent = `${sign}${btc.change_24h_pct.toFixed(2)}%`;
    changeEl.classList.remove('up', 'down');
    changeEl.classList.add(btc.change_24h_pct >= 0 ? 'up' : 'down');
  }
}

function updateLlmBadge(online: boolean, activeEngine?: 'Gemini' | 'Local' | 'Colab') {
  isOllamaOnline = online;
  const badge = document.getElementById('llm-badge');
  if (!badge) return;

  const hasGemini = geminiApiKey.trim().length > 0 || routerHealthyCount > 0;
  const routerTag = lastRouterEndpointLabel || `9Router(${routerHealthyCount || 1})`;
  const routerDisplay = /9router/i.test(routerTag) ? `[${routerTag}]` : `[9ROUTER: ${routerTag}]`;
  if (activeEngine === 'Colab' || (colabCloudOnline && llmRouteMode === 'colab')) {
    badge.textContent = `[COLAB: ${colabCloudModel}]`;
    badge.style.color = '#fde68a';
    badge.style.borderColor = 'rgba(245, 158, 11, 0.5)';
    badge.style.background = 'rgba(245, 158, 11, 0.16)';
  } else if (activeEngine === 'Gemini' && hasGemini) {
    badge.textContent = `[9ROUTER: ${routerTag}]`;
    badge.textContent = routerDisplay;
    badge.style.color = '#93c5fd';
    badge.style.borderColor = 'rgba(59, 130, 246, 0.45)';
    badge.style.background = 'rgba(59, 130, 246, 0.16)';
  } else if (hasGemini && online && llmRouteMode === 'auto') {
    badge.textContent = `[AUTO: 9Router(${routerHealthyCount || 1}) + Local]`;
    badge.style.color = '#a7f3d0';
    badge.style.borderColor = 'rgba(52, 211, 153, 0.45)';
    badge.style.background = 'rgba(52, 211, 153, 0.16)';
  } else if (hasGemini && llmRouteMode !== 'local') {
    badge.textContent = `[9ROUTER: ${routerTag}]`;
    badge.textContent = routerDisplay;
    badge.style.color = '#93c5fd';
    badge.style.borderColor = 'rgba(59, 130, 246, 0.45)';
    badge.style.background = 'rgba(59, 130, 246, 0.16)';
  } else if (online) {
    badge.textContent = `[LOCAL: ${ollamaModel}]`;
    badge.style.color = '#86efac';
    badge.style.borderColor = 'rgba(34, 197, 94, 0.4)';
    badge.style.background = 'rgba(34, 197, 94, 0.16)';
  } else {
    badge.textContent = '[LLM: OFFLINE]';
    badge.style.color = '#fca5a5';
    badge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    badge.style.background = 'rgba(239, 68, 68, 0.16)';
  }
}

export async function refreshLlmStatus(): Promise<NetworkInfo | null> {
  try {
    const rStat = await invoke<RouterStatusPayload>('router_get_status').catch(() => null);
    if (rStat) {
      routerHealthyCount = rStat.healthy_endpoints;
    }
    const net = await invoke<NetworkInfo>('check_network');
    let isOnline = net.ollama_ok;
    if (!isOnline) {
      // Fallback check: Kiểm tra danh sách model Ollama trực tiếp qua API tags
      try {
        const models = await invoke<string[]>('list_ollama_models');
        if (models && models.length > 0) {
          isOnline = true;
          net.ollama_ok = true;
          if (!models.includes(ollamaModel)) {
            const matched = models.find((m) => m.toLowerCase().includes('qwen')) || models[0];
            if (matched) {
              ollamaModel = matched;
              localStorage.setItem('mate_ollama_model', matched);
              const inputEl = document.getElementById('input-ollama-model') as HTMLInputElement | null;
              if (inputEl) inputEl.value = matched;
            }
          }
        }
      } catch { }
    }
    updateLlmBadge(isOnline);
    updateNetworkDashboard(net);
    return net;
  } catch {
    updateLlmBadge(false);
    return null;
  }
}

function formatHardwareSummary(hw: HardwareInfo): string {
  const cpuShort = hw.cpu_name.replace(/\(R\)|\(TM\)|CPU|Processor/gi, '').trim().slice(0, 28);
  const gpuShort = hw.gpu_name.replace(/NVIDIA|AMD|Intel\(R\)/gi, '').trim().slice(0, 24);
  return `CPU: ${cpuShort} (${hw.cpu_load_pct.toFixed(0)}%) | RAM: ${hw.ram_used_gb.toFixed(1)}/${hw.ram_total_gb.toFixed(1)} GB (${hw.ram_used_pct.toFixed(0)}%) | GPU: ${gpuShort}`;
}

function formatNetworkSummary(net: NetworkInfo): string {
  const inetText = net.internet_ok ? `Internet OK (Ping ${net.latency_ms}ms)` : 'Mất kết nối Internet';
  const ipText = net.local_ip ? ` | IP: ${net.local_ip}` : '';
  const wifiText = net.wifi_ssid ? ` (${net.wifi_ssid})` : '';
  const connText = net.conn_summary ? ` | ${net.conn_summary}` : '';
  const llmText = net.ollama_ok ? ` | Ollama OK` : ' | Ollama chưa chạy';
  return `${inetText}${ipText}${wifiText}${connText}${llmText}`;
}

function resolveWeatherModeFromInfo(w: WeatherInfo): WeatherEffectMode {
  const desc = (w.description || '').toLowerCase();
  const code = typeof w.weather_code === 'number' ? w.weather_code : -1;
  const hour = new Date().getHours();

  if (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    (code >= 95 && code <= 99) ||
    /mưa|mua\b|dông|dong\b|giông|giong\b|sấm|sét|bão|rain|drizzle|thunder|storm|shower|downpour/.test(
      desc
    )
  ) {
    return 'rain';
  }
  if (
    (code >= 71 && code <= 77) ||
    code === 85 ||
    code === 86 ||
    /tuyết|tuyet|băng|rét|sương giá|snow|sleet|ice|frost|blizzard/.test(desc) ||
    w.temp_c <= 18 ||
    w.feels_like_c <= 17
  ) {
    return 'cold';
  }
  if (
    (w.wind_kmh >= 24 && w.temp_c < 33) ||
    w.wind_kmh >= 30 ||
    /gió mạnh|gió lớn|gió giật|gale|squall|lốc|windy/.test(desc)
  ) {
    return 'wind';
  }
  if (w.is_day === false || (w.is_day === undefined && (hour >= 18 || hour < 6))) {
    return 'night';
  }
  if (
    w.temp_c >= 31 ||
    w.feels_like_c >= 33 ||
    (/nắng|nang\b|sunny|hot/.test(desc) && w.temp_c >= 28)
  ) {
    return 'hot';
  }
  return 'clear';
}

const WEATHER_ACCESSORY_SET = new Set<AccessoryType>([
  'sun_hat_glasses',
  'rain_umbrella',
  'winter_beanie',
  'propeller',
  'halo',
]);

function applyWeatherAccessory(mode: WeatherEffectMode) {
  const desired: AccessoryType =
    mode === 'hot'
      ? 'sun_hat_glasses'
      : mode === 'rain'
        ? 'rain_umbrella'
        : mode === 'cold'
          ? 'winter_beanie'
          : mode === 'wind'
            ? 'propeller'
            : mode === 'night'
              ? 'halo'
              : 'none';

  if (desired === 'none') {
    if (WEATHER_ACCESSORY_SET.has(appState.activeAccessory)) {
      equipAccessory3D('none', false);
    }
    return;
  }
  if (appState.activeAccessory !== desired) {
    equipAccessory3D(desired, false);
  }
}

function syncWeatherUiAndTriggerEvent(
  mode: WeatherEffectMode,
  dropdownMode: WeatherEffectMode | 'auto',
  fireEvent: boolean
) {
  const sel = document.getElementById('select-weather-fx') as HTMLSelectElement | null;
  if (sel) {
    sel.value = dropdownMode;
  }
  if (fireEvent) {
    fireAnimationTrigger('event', `weather:${mode}`, 'enter');
  }
}

export async function runWeatherCheck(city?: string, interactive = true): Promise<string> {
  if (!city && appState.weatherSourceMode === 'custom') {
    return await syncLiveWeather3D('auto', interactive);
  }
  const exec = async () => {
    if (interactive) {
      appState.setState('SCANNING');
      spawnScanEffect(appState.posX, appState.posY);
    }
    try {
      const prevMode = appState.weatherMode;
      const w = await invoke<WeatherInfo>('check_weather', { city: city || null });
      updateWeatherDashboard(w);
      const nextMode = resolveWeatherModeFromInfo(w);
      appState.weatherMode = nextMode;
      applyWeatherAccessory(nextMode);
      updateStudioWeatherPreviewUi();
      syncWeatherUiAndTriggerEvent(nextMode, 'auto', interactive || nextMode !== prevMode);
      const summary = `Thời tiết ${w.location}: ${w.temp_c}°C (cảm giác ${w.feels_like_c}°C), ${w.description}, độ ẩm ${w.humidity_pct}%, gió ${w.wind_kmh} km/h (${nextMode})`;
      if (interactive) {
        pushDashboardAlert(summary);
        appState.setExpression('happy', 3.0);
        speak(summary);
      }
      return summary;
    } catch (err) {
      const msg = `Lỗi thời tiết: ${String(err)}`;
      if (interactive) speak(msg);
      return msg;
    } finally {
      if (interactive) scheduleScanIdleReset();
    }
  };
  return interactive
    ? runWithToolAnim('weather_3d', exec, (s) => !s.startsWith('Lỗi'))
    : exec();
}

function formatBitcoinSummary(btc: BitcoinInfo): string {
  const sign = btc.change_24h_pct >= 0 ? '+' : '';
  const priceFmt = btc.price_usd.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Bitcoin: $${priceFmt} (${sign}${btc.change_24h_pct.toFixed(2)}% / 24h)`;
}

export async function runHardwareCheck(interactive = true): Promise<string> {
  const exec = async () => {
    if (interactive) {
      appState.setState('SCANNING');
      spawnScanEffect(appState.posX, appState.posY);
    }
    try {
      const hw = await invokeCachedTelemetry<HardwareInfo>('hw', 'check_hardware', interactive);
      updateHardwareDashboard(hw);
      const summary = formatHardwareSummary(hw);
      if (interactive) {
        showTelemetrySection('hw');
      }
      const { cpuHigh, ramHigh } = isHardwareOverThreshold(hw);
      if (cpuHigh || ramHigh) {
        pushDashboardAlert(
          `CẢNH BÁO TÀI NGUYÊN: CPU ${hw.cpu_load_pct.toFixed(0)}% (>${cpuAlertPct}%), RAM ${hw.ram_used_gb.toFixed(1)} GB (>${ramAlertGb} GB)`
        );
        if (interactive) {
          appState.setState('ALERT');
          appState.setExpression('surprised', 3.5);
          spawnAlertEffect(appState.posX, appState.posY);
          speak('Máy đang vượt ngưỡng cảnh báo rồi! Kiểm tra bảng bên trái nhé.');
        }
      } else if (interactive) {
        speak('Đã quét xong phần cứng! Xem chi tiết bên trái nhé.');
      }
      return summary;
    } catch (err) {
      const msg = `Lỗi phần cứng: ${String(err)}`;
      if (interactive) {
        showTelemetrySection('alert');
        pushDashboardAlert(msg);
        speak(msg);
      }
      return msg;
    } finally {
      if (interactive) scheduleScanIdleReset();
    }
  };
  return interactive
    ? runWithToolAnim('telemetry', exec, (s) => !s.startsWith('Lỗi'))
    : exec();
}

export async function runNetworkCheck(interactive = true): Promise<string> {
  const exec = async () => {
    if (interactive) {
      appState.setState('SCANNING');
      spawnScanEffect(appState.posX, appState.posY);
    }
    try {
      const net = await invokeCachedTelemetry<NetworkInfo>('net', 'check_network', interactive);
      updateLlmBadge(net.ollama_ok);
      updateNetworkDashboard(net);
      const summary = formatNetworkSummary(net);
      if (interactive) {
        showTelemetrySection('net');
      }
      if (!net.internet_ok) {
        pushDashboardAlert('CẢNH BÁO: Mất kết nối Internet!');
        if (interactive) {
          appState.setState('ALERT');
          spawnAlertEffect(appState.posX, appState.posY);
        }
      }
      if (interactive) {
        speak(`Đã kiểm tra mạng (${net.internet_ok ? `Ping ${net.latency_ms}ms` : 'Mất mạng'}). Xem bên trái nhé!`);
      }
      return summary;
    } catch (err) {
      const msg = `Lỗi mạng: ${String(err)}`;
      if (interactive) speak(msg);
      return msg;
    } finally {
      if (interactive) scheduleScanIdleReset();
    }
  };
  return interactive
    ? runWithToolAnim('telemetry', exec, (s) => !s.startsWith('Lỗi'))
    : exec();
}

export async function runBitcoinCheck(interactive = true): Promise<string> {
  const exec = async () => {
    if (interactive) {
      appState.setState('SCANNING');
      spawnScanEffect(appState.posX, appState.posY);
    }
    try {
      const btc = await invokeCachedTelemetry<BitcoinInfo>('btc', 'check_bitcoin', interactive);
      lastBtcPrice = btc.price_usd;
      updateBitcoinDashboard(btc);
      const summary = formatBitcoinSummary(btc);
      if (interactive) {
        showTelemetrySection('btc');
        if (btc.change_24h_pct >= 2.0 && danceCb) {
          danceCb();
        } else {
          spawnParticles(appState.posX, appState.posY - 100, 8, 0xfbbf24);
        }
        speak(`${summary} — Đã hiển thị bên trái!`);
      }
      return summary;
    } catch (err) {
      const msg = `Lỗi lấy giá BTC: ${String(err)}`;
      if (interactive) {
        showTelemetrySection('alert');
        pushDashboardAlert(msg);
        speak(msg);
      }
      return msg;
    } finally {
      if (interactive) scheduleScanIdleReset();
    }
  };
  return interactive
    ? runWithToolAnim('telemetry', exec, (s) => !s.startsWith('Lỗi'))
    : exec();
}

export async function runGeminiVisionScreen(query?: string) {
  if (!geminiApiKey.trim()) {
    speak('Bạn chưa nhập Gemini API Key trong Studio 3D để dùng tính năng Gemini Vision!');
    return;
  }
  await runWithToolAnim('vision', async () => {
    appState.setState('SCANNING');
    spawnScanEffect(appState.posX, appState.posY);
    speak('Đang chụp màn hình và gửi cho Gemini Vision phân tích...');

    try {
      const base64Img = await invoke<string>('capture_and_encode_screenshot');
      const promptText = query && query.trim().length > 0
        ? `Bạn là trợ lý Duck AI Manager. Hãy nhìn vào ảnh chụp màn hình desktop của người dùng và trả lời câu hỏi: "${query}". Trả lời ngắn gọn, trực tiếp, xúc tích bằng tiếng Việt trong 2-3 câu.`
        : 'Bạn là trợ lý Duck AI Manager. Hãy nhìn vào ảnh chụp màn hình desktop hiện tại của người dùng và tóm tắt ngắn gọn: Người dùng đang mở ứng dụng/công việc gì? Có lỗi code, thông báo hay nội dung gì đáng chú ý không? Trả lời xúc tích trong 2-3 câu tiếng Việt.';

      const analysis = await invoke<string>('ask_gemini_vision', {
        apiKey: geminiApiKey,
        model: geminiModel || 'gemini-3.5-flash',
        prompt: promptText,
        imageBase64: base64Img,
      });

      appState.setState('WAVING');
      appState.setExpression('happy', 3.5);
      speak(`[GEMINI VISION] ${analysis}`);
      pushChatHistory('assistant', `[Gemini Vision] ${analysis}`);
      return true;
    } catch (err) {
      const msg = `Lỗi Gemini Vision: ${String(err)}`;
      appState.setState('ALERT');
      speak(msg);
      return false;
    } finally {
      scheduleScanIdleReset(600);
    }
  }, (ok) => ok);
}

export async function runFullDashboardScan(interactive = false) {
  if (interactive) {
    appState.setState('SCANNING');
    spawnScanEffect(appState.posX, appState.posY);
    speak('[ĐANG QUÉT] Đang cập nhật toàn bộ Dashboard bên trái...');
  }
  await Promise.all([
    runCheckAppMetrics(false),
    runHardwareCheck(false),
    runNetworkCheck(false),
    runBitcoinCheck(false),
    runMemoryCheck(false),
    syncLiveWeather3D('auto', false),
    refreshEnglishVocabHistoryUi(),
  ]);
  if (interactive) {
    showTelemetrySection('all');
    pushDashboardAlert('Đã quét lại toàn bộ thông số hệ thống.');
    speak('Đã cập nhật xong phần cứng, mạng, BTC, thời tiết, trí nhớ & English trên Dashboard!');
  }
}

function normalizeAppName(title: string, processName?: string): string {
  const lower = title.toLowerCase();
  const proc = (processName ?? '').toLowerCase();

  const isBrowser =
    proc === 'chrome.exe' ||
    proc === 'msedge.exe' ||
    proc === 'brave.exe' ||
    proc === 'browser.exe' ||
    proc === 'firefox.exe' ||
    lower.includes('google chrome') ||
    lower.includes('microsoft edge') ||
    lower.includes('cốc cốc');

  if (isBrowser) {
    const cleaned = title
      .replace(/^\(\d+\)\s*/, '')
      .replace(
        /\s*[-—|]\s*(?:[^-—|]*[-—|]\s*)?(?:Google Chrome|Microsoft[\u200b]?\s*Edge|Brave|Cốc Cốc|Mozilla Firefox).*$/i,
        ''
      )
      .trim();

    if (lower.includes('youtube')) {
      const ytTitle = cleaned.replace(/\s*[-—|]\s*YouTube$/i, '').trim();
      if (ytTitle && ytTitle.toLowerCase() !== 'youtube') {
        return `YT: ${ytTitle.slice(0, 32)}`;
      }
      return 'YouTube';
    }

    if (
      cleaned &&
      !/^(?:new tab|tab mới|start page|trang chủ|extensions|settings)$/i.test(cleaned)
    ) {
      return `Web: ${cleaned.slice(0, 28)}`;
    }
    return proc === 'msedge.exe' ? 'Microsoft Edge' : 'Google Chrome';
  }

  if (lower.includes('youtube')) return 'YouTube';
  if (proc === 'code.exe' || lower.includes('visual studio code') || lower.includes('vs code')) {
    return 'VS Code';
  }
  if (proc === 'antigravity.exe' || lower.includes('antigravity')) return 'Antigravity';
  if (proc === 'explorer.exe' || lower.includes('explorer')) return 'File Explorer';
  if (
    proc === 'windowsterminal.exe' ||
    proc === 'powershell.exe' ||
    proc === 'cmd.exe' ||
    lower.includes('powershell') ||
    lower.includes('terminal')
  ) {
    return 'Terminal';
  }
  if (proc === 'discord.exe' || lower.includes('discord')) return 'Discord';
  if (proc === 'zalo.exe' || lower.includes('zalo')) return 'Zalo';
  if (proc) return proc.replace(/\.exe$/i, '');
  return title.slice(0, 26);
}

function updateMemoryDashboard(ins: MemoryInsights) {
  const chatsEl = document.getElementById('dash-mem-chats');
  const profileEl = document.getElementById('dash-mem-profile');
  const appsEl = document.getElementById('dash-mem-apps');
  const summaryEl = document.getElementById('dash-mem-summary');

  if (chatsEl) {
    chatsEl.textContent = ins.db_ready ? `${ins.total_chat_count} tin lưu` : 'DB lỗi';
  }
  if (profileEl) {
    profileEl.innerHTML = '';
    if (ins.profile_facts.length === 0) {
      profileEl.textContent = 'Chưa học được thông tin cá nhân (hãy thử giới thiệu tên hoặc sở thích!).';
    } else {
      for (const f of ins.profile_facts) {
        const row = document.createElement('div');
        row.style.cssText =
          'display:flex;align-items:center;justify-content:space-between;gap:6px;padding:3px 0;border-bottom:1px solid rgba(148,163,184,0.12);';

        const txt = document.createElement('span');
        txt.style.cssText = 'font-size:11px;color:#e2e8f0;word-break:break-word;';
        txt.textContent = `${f.key}: ${f.value}`;

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.title = `Xóa "${f.key}"`;
        delBtn.textContent = 'X';
        delBtn.style.cssText =
          'flex-shrink:0;width:18px;height:18px;border-radius:4px;border:1px solid rgba(248,113,113,0.35);background:rgba(248,113,113,0.12);color:#fca5a5;font-size:10px;cursor:pointer;line-height:1;';
        delBtn.addEventListener('click', () => {
          void invoke('memory_delete_profile', { key: f.key })
            .then(() => {
              if (f.key === 'Quy tắc cửa sổ') {
                appState.windowInteractEnabled = true;
                syncCheckbox('chk-win-interact', true);
              } else if (f.key === 'Quy tắc chủ động') {
                setAutoCheckEnabled(true);
                syncCheckbox('chk-autocheck', true);
              }
              void runMemoryCheck(false);
            })
            .catch(() => { });
        });

        row.appendChild(txt);
        row.appendChild(delBtn);
        profileEl.appendChild(row);
      }
    }
  }
  if (appsEl) {
    if (ins.top_apps_today.length === 0) {
      appsEl.textContent = 'Đang thu thập thói quen sử dụng cửa sổ...';
    } else {
      appsEl.textContent = ins.top_apps_today
        .map((a) => `${a.app_title} (${Math.max(1, Math.round(a.total_sec / 60))}p)`)
        .join(', ');
    }
  }
  if (summaryEl) {
    void invoke<string | null>('memory_get_daily_summary')
      .then((sum) => {
        if (sum && summaryEl) {
          summaryEl.textContent = sum;
        }
      })
      .catch(() => { });
  }
}

export async function runMemoryCheck(interactive = true): Promise<MemoryInsights | null> {
  if (interactive) {
    appState.setState('SCANNING');
    spawnScanEffect(appState.posX, appState.posY);
  }
  try {
    const hour = new Date().getHours();
    const ins = await invoke<MemoryInsights>('memory_get_insights', { currentHour: hour });
    updateMemoryDashboard(ins);
    if (interactive) {
      showTelemetrySection('memory');
      const topStr =
        ins.top_apps_today.length > 0
          ? `Hôm nay bạn dùng nhiều nhất: ${ins.top_apps_today[0].app_title} (${Math.max(1, Math.round(ins.top_apps_today[0].total_sec / 60))} phút).`
          : 'Tớ đang bắt đầu ghi nhớ thói quen dùng máy của bạn.';
      speak(`[TRÍ NHỚ SQLITE] Đã nhớ ${ins.profile_facts.length} sở thích & ${ins.total_chat_count} tin nhắn. ${topStr}`);
    }
    return ins;
  } catch {
    return null;
  }
}

export async function runBrowserHistoryCheck(interactive = true): Promise<BrowserInsights | null> {
  if (interactive) {
    appState.setState('SCANNING');
    spawnScanEffect(appState.posX, appState.posY);
  }
  try {
    const bh = await invoke<BrowserInsights>('memory_scan_browser_history');
    const appsEl = document.getElementById('dash-mem-apps');
    if (appsEl && (bh.top_youtube.length > 0 || bh.top_sites.length > 0)) {
      const ytStr = bh.top_youtube
        .slice(0, 2)
        .map((y) => `${y.title.slice(0, 24)} (${y.visit_count}x)`)
        .join(', ');
      const webStr = bh.top_sites
        .slice(0, 2)
        .map((s) => `${s.title.slice(0, 20)} (${s.visit_count}x)`)
        .join(', ');
      const existing = appsEl.textContent || '';
      const browserNote = `[${bh.browser_name}] YT: ${ytStr || 'trống'} | Web: ${webStr || 'trống'}`;
      if (!existing.includes(`[${bh.browser_name}]`)) {
        appsEl.textContent = existing ? `${existing}\n${browserNote}` : browserNote;
      }
    }

    if (interactive) {
      showTelemetrySection('memory');
      const topYt = bh.top_youtube[0];
      const topSite = bh.top_sites[0];
      if (topYt) {
        const cleanTitle = topYt.title.replace(/\s*[-—|]\s*YouTube$/i, '').trim();
        speak(
          `[${bh.browser_name}] Bạn hay nghe/xem "${cleanTitle}" (${topYt.visit_count} lượt)${topSite ? ` và hay vào "${topSite.title.slice(0, 24)}"` : ''
          }. Bấm "Đồng ý" để mở ngay video/kênh này nhé!`
        );
        showSuggestionButtons(
          () => {
            appState.setExpression('happy', 3.0);
            void runPcOpen(topYt.url, cleanTitle);
          },
          () => {
            if (topSite) {
              void runPcOpen(topSite.url, topSite.title.slice(0, 24));
            } else {
              speak('Okela, khi nào muốn mở hãy bảo tớ nhé!');
            }
          }
        );
      } else if (topSite) {
        speak(
          `[${bh.browser_name}] Trang bạn hay vào nhất là "${topSite.title.slice(0, 28)}" (${topSite.visit_count} lượt). Muốn mở luôn không?`
        );
        showSuggestionButtons(
          () => void runPcOpen(topSite.url, topSite.title.slice(0, 24)),
          () => speak('Okela, khi nào cần hãy gọi tớ nhé!')
        );
      } else {
        speak(`[${bh.browser_name}] Đã quét xong lịch sử web nhưng chưa có lượt truy cập nổi bật.`);
      }
    }
    return bh;
  } catch (err) {
    if (interactive) {
      speak(`[TRÌNH DUYỆT] Không đọc được History (${String(err)}), tớ vẫn đang theo dõi tab Chrome/Edge theo thời gian thực nhé.`);
    }
    return null;
  }
}

export async function refreshLongMemoryUi(): Promise<LongMemoryEntry[]> {
  try {
    const list = await invoke<LongMemoryEntry[]>('long_memory_list');
    const personaInput = document.getElementById('lm-persona-input') as HTMLTextAreaElement | null;
    const activePersona = list.find((e) => e.category === 'persona');
    if (personaInput && activePersona) {
      personaInput.value = activePersona.content;
    }

    const container = document.getElementById('lm-list-container');
    if (container) {
      container.innerHTML = '';
      if (list.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'dash-sub';
        empty.textContent = 'Chưa có Long Memory nào.';
        container.appendChild(empty);
      } else {
        for (const entry of list) {
          const card = document.createElement('div');
          card.style.cssText =
            'display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:7px 9px;border-radius:8px;background:rgba(15,23,42,0.72);border:1px solid rgba(148,163,184,0.16);';

          const left = document.createElement('label');
          left.style.cssText = 'display:flex;align-items:flex-start;gap:7px;cursor:pointer;flex:1;';

          const chk = document.createElement('input');
          chk.type = 'checkbox';
          chk.checked = entry.enabled;
          chk.style.marginTop = '3px';
          chk.addEventListener('change', async () => {
            chk.disabled = true;
            try {
              await invoke('long_memory_toggle', { id: entry.id, enabled: chk.checked });
              await refreshLongMemoryUi();
            } catch {
              chk.checked = !chk.checked;
            } finally {
              chk.disabled = false;
            }
          });

          const txtWrap = document.createElement('div');
          txtWrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;flex:1;';

          const headerLine = document.createElement('div');
          headerLine.style.cssText = 'display:flex;align-items:center;gap:6px;';
          const catBadge = document.createElement('span');
          catBadge.className = 'badge';
          catBadge.textContent = `[${entry.category.toUpperCase()}]`;
          const titleSpan = document.createElement('span');
          titleSpan.style.cssText = 'font-size:11.5px;font-weight:600;color:#e2e8f0;';
          titleSpan.textContent = entry.title;
          headerLine.appendChild(catBadge);
          headerLine.appendChild(titleSpan);

          const bodySpan = document.createElement('div');
          bodySpan.style.cssText = `font-size:11px;line-height:1.35;color:${entry.enabled ? '#cbd5e1' : '#64748b'
            };word-break:break-word;`;
          bodySpan.textContent = entry.content;

          txtWrap.appendChild(headerLine);
          txtWrap.appendChild(bodySpan);
          left.appendChild(chk);
          left.appendChild(txtWrap);

          const delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.textContent = 'X';
          delBtn.title = `Xóa "${entry.title}"`;
          delBtn.style.cssText =
            'flex-shrink:0;width:20px;height:20px;border-radius:5px;border:1px solid rgba(248,113,113,0.35);background:rgba(248,113,113,0.12);color:#fca5a5;font-size:10px;cursor:pointer;';
          delBtn.addEventListener('click', async () => {
            delBtn.disabled = true;
            delBtn.textContent = '...';
            try {
              await invoke('long_memory_delete', { id: entry.id });
              await refreshLongMemoryUi();
            } catch {
              delBtn.disabled = false;
              delBtn.textContent = 'X';
            }
          });

          card.appendChild(left);
          card.appendChild(delBtn);
          container.appendChild(card);
        }
      }
    }
    window.dispatchEvent(new CustomEvent('duck-long-memory-updated'));
    return list;
  } catch {
    return [];
  }
}

export async function saveLongMemoryEntry(category: string, title: string, content: string) {
  const cleaned = content.trim();
  if (!cleaned) {
    speak('[LONG MEMORY] Nội dung không được để trống!');
    return;
  }
  try {
    await invoke('long_memory_upsert', { category, title, content: cleaned });
    await refreshLongMemoryUi();
    appState.setExpression('happy', 2.8);
    speak(`[LONG MEMORY] Đã lưu "${title}" vào bảng long_memory!`);
  } catch (err) {
    speak(`[LỖI LONG MEMORY] ${String(err)}`);
  }
}

async function buildLongMemoryPromptBlock(): Promise<string> {
  try {
    const entries = await invoke<LongMemoryEntry[]>('long_memory_list');
    const active = entries.filter((e) => e.enabled);
    if (active.length === 0) return '';

    const personas = active.filter((e) => e.category === 'persona').map((e) => e.content);
    const rules = active.filter((e) => e.category === 'rule').map((e) => `${e.title}: ${e.content}`);
    const knowledge = active
      .filter((e) => e.category !== 'persona' && e.category !== 'rule')
      .map((e) => `${e.title}: ${e.content}`);

    const lines: string[] = [];
    if (personas.length > 0) lines.push(`Tính cách nhân vật (Persona): ${personas.join(' | ')}`);
    if (rules.length > 0) lines.push(`Quy tắc dài hạn bắt buộc: ${rules.join('; ')}`);
    if (knowledge.length > 0) lines.push(`Ghi nhớ cố định: ${knowledge.join('; ')}`);
    return lines.length > 0 ? `\n${lines.join('\n')}` : '';
  } catch {
    return '';
  }
}

export async function clearLocalMemory() {
  try {
    await invoke('memory_clear_all');
    chatHistory.length = 0;
    await runMemoryCheck(true);
    speak('[ĐÃ XÓA] Tớ đã làm mới toàn bộ bộ nhớ SQLite cục bộ.');
  } catch (err) {
    speak(`[LỖI XÓA BỘ NHỚ] ${String(err)}`);
  }
}

function pushChatHistory(role: 'user' | 'assistant', content: string) {
  chatHistory.push({ role, content });
  if (chatHistory.length > 8) {
    chatHistory.splice(0, chatHistory.length - 8);
  }
  appendChatMessage(role, content);
  void invoke('memory_save_chat', { role, content }).catch(() => { });
  const syncMsgId = `desk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  void syncChatPushToCloud(syncMsgId, role, content, Date.now()).catch(() => { });
}

function recordLearnedCommand(cmdLabel: string) {
  const hour = new Date().getHours();
  const patternKey = `hour_${hour}_${cmdLabel}`;
  void invoke('memory_log_activity', {
    appTitle: cmdLabel,
    hourOfDay: hour,
    durationSec: 60,
  }).catch(() => { });
  void invoke('memory_record_feedback', { patternKey, accepted: true }).catch(() => { });
}

function syncCheckbox(id: string, checked: boolean) {
  const el = document.getElementById(id) as HTMLInputElement | null;
  if (el) el.checked = checked;
}

async function extractAndSaveUserFacts(userText: string): Promise<string | null> {
  const lower = userText.toLowerCase();
  let ruleConfirmation: string | null = null;

  // 1. Tự học quy tắc hành vi cửa sổ (ví dụ: "đừng tự ý kéo cửa sổ" hoặc "đừng tự ý đẩy cửa sổ vậy chứ")
  if (
    /(?:đừng|dung|không|khong)[^.!?]{0,25}(?:kéo|keo|đẩy|day)[^.!?]{0,20}cửa sổ/i.test(lower) ||
    lower.includes('tắt tương tác cửa sổ') ||
    lower.includes('tắt kéo cửa sổ')
  ) {
    appState.windowInteractEnabled = false;
    syncCheckbox('chk-win-interact', false);
    await invoke('memory_save_profile', {
      key: 'Quy tắc cửa sổ',
      value: 'Không tự ý kéo/đẩy cửa sổ',
    }).catch(() => { });
    ruleConfirmation = 'Đã ghi nhớ vào SQLite: Tớ sẽ không tự ý kéo hay đẩy cửa sổ của bạn nữa!';
  } else if (
    lower.includes('cho phép kéo cửa sổ') ||
    lower.includes('bật tương tác cửa sổ') ||
    lower.includes('tự do đẩy cửa sổ')
  ) {
    appState.windowInteractEnabled = true;
    syncCheckbox('chk-win-interact', true);
    await invoke('memory_save_profile', {
      key: 'Quy tắc cửa sổ',
      value: 'Cho phép tương tác cửa sổ',
    }).catch(() => { });
    ruleConfirmation = 'Đã ghi nhớ: Tớ có thể tương tác kéo/đẩy cửa sổ giúp bạn!';
  }

  // 2. Tự học quy tắc chủ động kiểm tra / nhắc nhở
  if (
    lower.includes('đừng tự kiểm tra') ||
    lower.includes('đừng làm phiền') ||
    lower.includes('đừng tự nhắc') ||
    lower.includes('tắt tự động kiểm tra')
  ) {
    setAutoCheckEnabled(false);
    syncCheckbox('chk-autocheck', false);
    await invoke('memory_save_profile', {
      key: 'Quy tắc chủ động',
      value: 'Tắt tự động nhắc/kiểm tra',
    }).catch(() => { });
    ruleConfirmation = 'Đã ghi nhớ: Tớ sẽ giữ yên lặng, chỉ kiểm tra khi bạn hỏi!';
  } else if (lower.includes('bật tự động kiểm tra') || lower.includes('tự nhắc tớ')) {
    setAutoCheckEnabled(true);
    syncCheckbox('chk-autocheck', true);
    await invoke('memory_save_profile', {
      key: 'Quy tắc chủ động',
      value: 'Bật tự động nhắc/kiểm tra',
    }).catch(() => { });
    ruleConfirmation = 'Đã ghi nhớ: Tớ sẽ chủ động theo dõi và nhắc bạn định kỳ!';
  }

  // 2b. Tự học cấu hình ngưỡng cảnh báo CPU (%) & RAM (GB)
  const cpuMatch = lower.match(/cpu\s*(?:trên|tren|vượt|vuot|quá|qua|>|>=)\s*(\d+(?:[.,]\d+)?)\s*%?/i);
  const ramMatch = lower.match(/ram\s*(?:trên|tren|vượt|vuot|quá|qua|>|>=)\s*(\d+(?:[.,]\d+)?)\s*(?:gb|g)?/i);
  if (cpuMatch?.[1] || ramMatch?.[1]) {
    const parts: string[] = [];
    if (cpuMatch?.[1]) {
      const val = parseFloat(cpuMatch[1].replace(',', '.'));
      if (!Number.isNaN(val)) {
        setCpuAlertPct(val, true);
        parts.push(`CPU > ${cpuAlertPct}%`);
      }
    }
    if (ramMatch?.[1]) {
      const val = parseFloat(ramMatch[1].replace(',', '.'));
      if (!Number.isNaN(val)) {
        setRamAlertGb(val, true);
        parts.push(`RAM > ${ramAlertGb} GB`);
      }
    }
    if (parts.length > 0) {
      ruleConfirmation = `Đã lưu cấu hình cảnh báo vào SQLite: ${parts.join(' và ')}!`;
    }
  }

  // 2c. Nhận diện nhanh Gemini API Key nếu người dùng dán trực tiếp vào chat
  const keyMatch = userText.match(/\b(AIza[0-9A-Za-z_-]{30,45}|AQ\.[0-9A-Za-z_-]{20,})\b/);
  if (keyMatch?.[1]) {
    setGeminiApiKey(keyMatch[1], true);
    ruleConfirmation = `Đã lưu GEMINI_API_KEY vào file .env (${geminiModel}, không lưu vào SQLite/Git)! Bây giờ bạn có thể hỏi mọi kiến thức phức tạp hoặc gõ @gemini / @local để chọn luồng.`;
  }

  // 2d. Thêm rule dài hạn / đổi tính cách trực tiếp qua chat
  const longRuleMatch = userText.match(/(?:thêm rule dài hạn|them rule dai han|thêm quy tắc dài hạn)\s*[:\-]?\s*(.+)/i);
  if (longRuleMatch?.[1]) {
    const val = longRuleMatch[1].trim();
    await invoke('long_memory_upsert', {
      category: 'rule',
      title: 'Rule qua chat',
      content: val,
    }).catch(() => { });
    void refreshLongMemoryUi();
    ruleConfirmation = `Đã thêm vào Long Memory (Rule dài hạn): "${val}"`;
  }
  const personaChatMatch = userText.match(/(?:đổi tính cách|doi tinh cach|setup tính cách)\s*[:\-]?\s*(.+)/i);
  if (personaChatMatch?.[1]) {
    const val = personaChatMatch[1].trim();
    await invoke('long_memory_upsert', {
      category: 'persona',
      title: 'Tính cách nhân vật',
      content: val,
    }).catch(() => { });
    void refreshLongMemoryUi();
    ruleConfirmation = `Đã cập nhật Prompt Tính cách trong Long Memory: "${val}"`;
  }

  // 3. Thông tin cá nhân & sở thích
  const nameMatch = userText.match(
    /(?:tên tớ là|tên tôi là|tớ tên|tôi tên|gọi tớ là|gọi tôi là|gọi t là|mình tên|tên tao là)\s+([^,.!?]{2,24})/i
  );
  if (nameMatch?.[1]) {
    await invoke('memory_save_profile', {
      key: 'Tên chủ nhân',
      value: nameMatch[1].trim(),
    }).catch(() => { });
  }

  const likeMatch = userText.match(
    /(?:tớ thích|tôi thích|mình thích|tao thích|t thích|hay nghe|hay dùng|hay xem)\s+([^,.!?]{3,40})/i
  );
  if (likeMatch?.[1]) {
    await invoke('memory_save_profile', {
      key: 'Sở thích',
      value: likeMatch[1].trim(),
    }).catch(() => { });
  }

  const roleMatch = userText.match(
    /(?:tớ làm|tôi làm|mình làm|công việc của tớ là|công việc của tôi là)\s+([^,.!?]{3,36})/i
  );
  if (roleMatch?.[1]) {
    await invoke('memory_save_profile', {
      key: 'Công việc',
      value: roleMatch[1].trim(),
    }).catch(() => { });
  }

  // 4. Lưu ý / mệnh lệnh ghi nhớ chung ("nhớ là...", "lưu ý...", "từ giờ...")
  const noteMatch = userText.match(/(?:nhớ là|lưu ý|từ giờ|từ nay)\s+([^.!?]{4,60})/i);
  if (!ruleConfirmation && noteMatch?.[1]) {
    await invoke('memory_save_profile', {
      key: 'Lưu ý cá nhân',
      value: noteMatch[1].trim(),
    }).catch(() => { });
  }

  return ruleConfirmation;
}

export async function runPcOpen(target: string, label: string) {
  await runWithToolAnim('open_app', async () => {
    try {
      appState.setState('FISHING');
      appState.setExpression('happy', 3.0);
      playCastRodSound(appState.posX);
      speak(`[CÂU CÁ APP] Quăng cần câu ứng dụng "${label}"...`);

      showFishingRod(true, label, async () => {
        try {
          await invoke<string>('open_web_or_app', { target });
          appState.squashX = 0.88;
          appState.squashY = 1.15;
          appState.velY = -10;
          appState.setState('JUMPING');
          spawnParticles(appState.posX, appState.posY - 90, 14, 0x38bdf8);
          spawnShockwave(appState.posX, appState.posY, 0x38bdf8);
          playSuccessChimeSound(appState.posX);
          appState.changeMood(3);
          speak(`Câu trúng rồi! Đã giật cần mở ứng dụng "${label}" lên cho bạn nhé!`);
        } catch (err) {
          speak(`[LỖI MỞ ỨNG DỤNG] ${String(err)}`);
        }
      });
      return true;
    } catch (err) {
      speak(`[LỖI MỞ ỨNG DỤNG] ${String(err)}`);
      return false;
    }
  }, (ok) => ok);
}

export async function runPcOpenFile(fileTarget: string) {
  await runWithToolAnim('open_file', async () => {
    try {
      appState.setState('FISHING');
      appState.setExpression('happy', 3.0);
      playCastRodSound(appState.posX);
      speak(`[CÂU CÁ FILE] Đang tìm kiếm và quăng cần mở file "${fileTarget}"...`);

      showFishingRod(true, fileTarget, async () => {
        try {
          const fullPath = await invoke<string>('open_local_file_or_search', { query: fileTarget });
          appState.squashX = 0.88;
          appState.squashY = 1.15;
          appState.velY = -10;
          appState.setState('JUMPING');
          spawnParticles(appState.posX, appState.posY - 90, 14, 0x38bdf8);
          spawnShockwave(appState.posX, appState.posY, 0x38bdf8);
          playSuccessChimeSound(appState.posX);
          appState.changeMood(5);
          speak(`[THÀNH CÔNG] Đã mở file "${fileTarget}" (${fullPath}) bằng ứng dụng mặc định cho bạn rồi nhé!`);
        } catch (err) {
          speak(`[LỖI MỞ FILE] ${String(err)}`);
        }
      });
      return true;
    } catch (err) {
      speak(`[LỖI MỞ FILE] ${String(err)}`);
      return false;
    }
  }, (ok) => ok);
}

export async function runPcMedia(
  action: 'vol_up' | 'vol_down' | 'mute' | 'play_pause' | 'next' | 'prev'
) {
  await runWithToolAnim('media', async () => {
    try {
      const msg = await invoke<string>('control_media', { action });
      spawnParticles(appState.posX, appState.posY - 100, 6, 0xa78bfa);
      speak(`[MEDIA] ${msg}!`);
      return true;
    } catch (err) {
      speak(`[LỖI MEDIA] ${String(err)}`);
      return false;
    }
  }, (ok) => ok);
}

export async function runOpenLatestScreenshot(openFolder = false) {
  await runWithToolAnim('screenshot', async () => {
    try {
      const path = await invoke<string>('open_latest_screenshot', { openFolder });
      appState.setExpression('happy', 2.5);
      speak(openFolder ? `[MỞ THƯ MỤC ẢNH] ${path}` : `[ĐÃ MỞ ẢNH] ${path}`);
      return true;
    } catch (err) {
      speak(`[LỖI MỞ ẢNH] ${String(err)}`);
      return false;
    }
  }, (ok) => ok);
}

export async function runHardwareAction(
  action: 'brightness_up' | 'brightness_down' | 'clean_ram' | 'taskmgr',
  interactive = true
): Promise<string> {
  return runWithToolAnim('hardware', async () => {
    if (interactive) {
      appState.setState('SCANNING');
      spawnScanEffect(appState.posX, appState.posY);
    }
    try {
      const msg = await invoke<string>('hardware_action', { action });
      appState.setExpression('happy', 3.0);
      pushDashboardAlert(msg);
      if (interactive) {
        speak(`[PHẦN CỨNG] ${msg}`);
      }
      if (action === 'clean_ram') {
        void runHardwareCheck(false);
      }
      return msg;
    } catch (err) {
      const errMsg = `[LỖI PHẦN CỨNG] ${String(err)}`;
      if (interactive) speak(errMsg);
      return errMsg;
    } finally {
      if (interactive) scheduleScanIdleReset();
    }
  }, (s) => !s.startsWith('[LỖI'));
}

export async function translateTextWithAi(
  text: string,
  targetLangLabel: string
): Promise<{ translated: string; engine: string }> {
  const cleaned = text.trim().slice(0, 3000);
  if (!cleaned) {
    throw new Error('Nội dung cần dịch đang trống');
  }
  const sys = `Bạn là chuyên gia dịch thuật đa ngôn ngữ. Hãy dịch chính xác văn bản sang ${targetLangLabel}. Chỉ trả về bản dịch tự nhiên, giữ cấu trúc dòng hợp lý, không giải thích thêm và không dùng emoji.`;
  const res = await askHybridLlm(
    sys,
    sys,
    [{ role: 'user', content: cleaned }],
    shouldRouteToGemini(cleaned, true)
  );
  if (!res.reply?.trim()) {
    throw new Error('AI không trả về bản dịch');
  }
  return { translated: res.reply.trim(), engine: `${res.engine} AI` };
}

export async function runOcrAndSummarize(takeNew = true): Promise<string> {
  return runWithToolAnim('ocr', async () => {
    appState.setState('SCANNING');
    spawnScanEffect(appState.posX, appState.posY);
    speak('[OCR MÀN HÌNH] Đang chụp và đọc chữ trên màn hình...');
    try {
      const ocr = await invoke<OcrResultInfo>('ocr_latest_screenshot', { takeNew });
      const cleaned = ocr.raw_text.replace(/\s+/g, ' ').trim();
      if (!cleaned) {
        const emptyMsg = '[OCR] Đã quét ảnh nhưng chưa thấy văn bản nào rõ ràng trên màn hình!';
        speak(emptyMsg);
        return emptyMsg;
      }

      let summary = `Nội dung quét được trên màn hình: "${cleaned.slice(0, 180)}${cleaned.length > 180 ? '...' : ''}"`;
      if (!isStreamingActive && (isOllamaOnline || geminiApiKey.trim())) {
        try {
          const ocrSys =
            'Bạn là trợ lý phân tích màn hình. Hãy tóm tắt thật súc tích trong tối đa 2 câu tiếng Việt có dấu (không dùng emoji) cho biết ảnh chụp màn hình này đang hiển thị nội dung gì.';
          const res = await askHybridLlm(
            ocrSys,
            ocrSys,
            [
              {
                role: 'user',
                content: `Văn bản OCR quét được từ ảnh chụp màn hình:\n${cleaned.slice(0, 1200)}`,
              },
            ],
            shouldRouteToGemini(cleaned, true)
          );
          if (res.reply) {
            summary = `[${res.engine}] ${res.reply}`;
          }
        } catch {
          // Giữ fallback summary nếu cả Local & Gemini bận/offline
        }
      }

      appState.setExpression('happy', 3.2);
      pushDashboardAlert(`[OCR] ${summary}`);
      pushChatHistory('assistant', summary);
      speak(`[TÓM TẮT OCR] ${summary} (Bấm "Đồng ý" để mở ảnh vừa chụp)`);
      showSuggestionButtons(
        () => void runOpenLatestScreenshot(false),
        () => void runOpenLatestScreenshot(true)
      );
      return summary;
    } catch (err) {
      const errMsg = `[LỖI OCR] ${String(err)}`;
      speak(errMsg);
      return errMsg;
    } finally {
      scheduleScanIdleReset();
    }
  }, (s) => !s.startsWith('[LỖI'));
}

export async function runPcScreenshot(): Promise<string> {
  return runWithToolAnim('screenshot', async () => {
    speak('[CHỤP MÀN HÌNH] Đang chụp lại màn hình cho bạn...');
    try {
      const savedPath = await invoke<string>('take_screenshot');
      spawnParticles(appState.posX, appState.posY - 110, 12, 0x34d399);
      spawnShockwave(appState.posX, appState.posY, 0x34d399);
      appState.setExpression('happy', 3.0);
      const msg = `[ĐÃ LƯU ẢNH] Đã chụp màn hình (${savedPath})! Bấm "Đồng ý" để mở xem ảnh ngay, hoặc "Để sau" để mở thư mục chứa ảnh.`;
      speak(msg);
      showSuggestionButtons(
        () => void runOpenLatestScreenshot(false),
        () => void runOpenLatestScreenshot(true)
      );
      return `Đã chụp màn hình và lưu tại ${savedPath}`;
    } catch (err) {
      const errMsg = `[LỖI CHỤP MÀN HÌNH] ${String(err)}`;
      speak(errMsg);
      return errMsg;
    }
  }, (s) => !s.startsWith('[LỖI'));
}

export async function runProcessManager(
  action: 'top' | 'kill' = 'top',
  target = '',
  interactive = true
): Promise<string> {
  return runWithToolAnim('process_manager', async () => {
    if (interactive) {
      appState.setState('SCANNING');
      spawnScanEffect(appState.posX, appState.posY);
    }
    try {
      const res = await invoke<string>('manage_processes', {
        action,
        target: target.trim() || null,
      });
      appState.setExpression(action === 'kill' ? 'happy' : 'neutral', 2.8);
      if (action === 'kill') {
        spawnParticles(appState.posX, appState.posY - 90, 10, 0x34d399);
        void runHardwareCheck(false);
      }
      pushDashboardAlert(`[TIẾN TRÌNH] ${res}`);
      if (interactive) {
        speak(`[TIẾN TRÌNH] ${res}`);
      }
      return res;
    } catch (err) {
      const errMsg = `[LỖI TIẾN TRÌNH] ${String(err)}`;
      appState.setExpression('sad', 2.5);
      if (interactive) speak(errMsg);
      return errMsg;
    } finally {
      if (interactive) scheduleScanIdleReset();
    }
  }, (s) => !s.startsWith('[LỖI'));
}

export async function runSmartWebSearch(
  engine: string,
  query: string,
  interactive = true
): Promise<string> {
  return runWithToolAnim('web_search', async () => {
    const cleanEngine = engine.trim().toLowerCase() || 'google';
    const cleanQuery = query.trim();
    const encoded = encodeURIComponent(cleanQuery);

    let url = 'https://www.google.com';
    let engineLabel = 'Google';

    if (cleanEngine.includes('youtube') || cleanEngine === 'yt') {
      engineLabel = 'YouTube';
      url = cleanQuery ? `https://www.youtube.com/results?search_query=${encoded}` : 'https://www.youtube.com';
    } else if (cleanEngine.includes('github') || cleanEngine === 'gh') {
      engineLabel = 'GitHub';
      url = cleanQuery ? `https://github.com/search?q=${encoded}` : 'https://github.com';
    } else if (cleanEngine.includes('stackoverflow') || cleanEngine === 'so') {
      engineLabel = 'StackOverflow';
      url = cleanQuery ? `https://stackoverflow.com/search?q=${encoded}` : 'https://stackoverflow.com';
    } else if (cleanEngine.includes('duckduckgo') || cleanEngine === 'ddg') {
      engineLabel = 'DuckDuckGo';
      url = cleanQuery ? `https://duckduckgo.com/?q=${encoded}` : 'https://duckduckgo.com';
    } else {
      engineLabel = 'Google';
      url = cleanQuery ? `https://www.google.com/search?q=${encoded}` : 'https://www.google.com';
    }

    const label = cleanQuery ? `${engineLabel} (${cleanQuery})` : engineLabel;
    if (interactive) {
      await runPcOpen(url, label);
    } else {
      await invoke<string>('open_web_or_app', { target: url }).catch(() => { });
    }
    return cleanQuery
      ? `Đã mở tìm kiếm ${engineLabel} cho "${cleanQuery}".`
      : `Đã mở trang ${engineLabel}.`;
  });
}

export async function runClipboardTool(
  action: 'read' | 'summarize' | 'translate' | 'copy' = 'read',
  text = '',
  interactive = true
): Promise<string> {
  return runWithToolAnim('clipboard', async () => {
    try {
      if (action === 'copy') {
        const content = text.trim();
        if (!content) {
          const emptyErr = '[CLIPBOARD] Không có nội dung để chép vào Clipboard.';
          if (interactive) speak(emptyErr);
          return emptyErr;
        }
        const res = await invoke<string>('set_clipboard_text', { text: content });
        spawnParticles(appState.posX, appState.posY - 90, 8, 0x38bdf8);
        if (interactive) speak(`[CLIPBOARD] ${res}`);
        return res;
      }

      const clipRaw = await invoke<string>('get_clipboard_text');
      const clean = clipRaw.trim();
      if (!clean) {
        const emptyMsg = '[CLIPBOARD] Clipboard hiện đang trống!';
        if (interactive) speak(emptyMsg);
        return emptyMsg;
      }

      if (action === 'read') {
        const preview = `${clean.slice(0, 220)}${clean.length > 220 ? '...' : ''}`;
        const msg = `[CLIPBOARD] Nội dung đang copy: "${preview}"`;
        if (interactive) {
          speak(msg);
        }
        return msg;
      }

      if (!isStreamingActive && (isOllamaOnline || geminiApiKey.trim())) {
        const taskPrompt =
          action === 'translate'
            ? 'Dịch nội dung sau sang tiếng Việt tự nhiên, súc tích (tối đa 3 câu, không dùng emoji):'
            : 'Tóm tắt hoặc giải thích nhanh nội dung sau bằng tiếng Việt súc tích (tối đa 2-3 câu, không dùng emoji):';
        const llmRes = await askHybridLlm(
          taskPrompt,
          taskPrompt,
          [{ role: 'user', content: clean.slice(0, 1500) }],
          shouldRouteToGemini(clean, true)
        );
        const resultText = llmRes.reply?.trim() || clean.slice(0, 200);
        if (interactive) {
          speak(`[CLIPBOARD - ${action === 'translate' ? 'DỊCH' : 'TÓM TẮT'}] ${resultText} (Bấm "Đồng ý" để chép kết quả vào Clipboard)`);
          showSuggestionButtons(
            () => {
              void invoke<string>('set_clipboard_text', { text: resultText })
                .then((m) => speak(`[CLIPBOARD] ${m}`))
                .catch(() => { });
            },
            () => { }
          );
        }
        return resultText;
      }

      return `[CLIPBOARD] Đã đọc (${clean.length} ký tự): "${clean.slice(0, 180)}"`;
    } catch (err) {
      const errMsg = `[LỖI CLIPBOARD] ${String(err)}`;
      if (interactive) speak(errMsg);
      return errMsg;
    }
  }, (s) => !s.startsWith('[LỖI'));
}

export async function runDeepSystemControl(
  action: string,
  param = '',
  interactive = true
): Promise<string> {
  return runWithToolAnim('system_control', async () => {
    if (interactive) {
      appState.setState('SCANNING');
      spawnScanEffect(appState.posX, appState.posY);
    }
    try {
      const res = await invoke<string>('deep_system_control', {
        action,
        param: param.trim() || null,
      });
      appState.setExpression('happy', 3.0);
      spawnParticles(appState.posX, appState.posY - 90, 10, 0x38bdf8);
      pushDashboardAlert(`[HỆ THỐNG] ${res}`);
      if (interactive) {
        speak(`[HỆ THỐNG] ${res}`);
      }
      return res;
    } catch (err) {
      const errMsg = `[LỖI HỆ THỐNG] ${String(err)}`;
      appState.setExpression('sad', 2.8);
      if (interactive) speak(errMsg);
      return errMsg;
    } finally {
      if (interactive) scheduleScanIdleReset();
    }
  }, (s) => !s.startsWith('[LỖI'));
}

function launchHabitAppTitle(appTitle: string) {
  if (appTitle.startsWith('YT: ')) {
    const topic = appTitle.slice(4).trim();
    void runPcOpen(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(topic)}`,
      topic
    );
    return;
  }
  if (appTitle.startsWith('Web: ')) {
    const site = appTitle.slice(5).trim();
    void runPcOpen(`https://www.google.com/search?q=${encodeURIComponent(site)}`, site);
    return;
  }
  const resolved = resolveToolTarget(appTitle);
  void runPcOpen(resolved.target, resolved.label);
}

export async function runSmartDbSupportBriefing(
  autoLaunchWorkspace = false
): Promise<string> {
  return runWithToolAnim('workspace', async () => {
    const hour = new Date().getHours();
    const [insights, schedules, longList, browser] = await Promise.all([
      runMemoryCheck(false),
      invoke<ScheduledNoteEntry[]>('schedule_note_list').catch(() => [] as ScheduledNoteEntry[]),
      invoke<LongMemoryEntry[]>('long_memory_list').catch(() => [] as LongMemoryEntry[]),
      invoke<BrowserInsights | null>('memory_scan_browser_history').catch(() => null),
    ]);

    const pendingNotes = schedules.filter((n) => !n.is_done);
    const timedNotes = pendingNotes.filter((n) => n.schedule_time);
    const topApps = insights?.top_apps_today?.slice(0, 3) || [];
    const habit = insights?.habit_for_hour;
    const activeLong = longList.filter((l) => l.enabled);
    const topYt = browser?.top_youtube?.[0];

    if (autoLaunchWorkspace) {
      if (habit) {
        launchHabitAppTitle(habit.app_title);
      } else if (topApps[0]) {
        launchHabitAppTitle(topApps[0].app_title);
      } else if (topYt) {
        void runPcOpen(topYt.url, topYt.title.slice(0, 28));
      }
      if (pendingNotes.length > 0) {
        toggleStickyNotesWidget(true);
      }
    }

    const parts: string[] = [];
    if (pendingNotes.length > 0) {
      const sample = timedNotes[0] || pendingNotes[0];
      parts.push(
        `Có ${pendingNotes.length} lịch/note chưa xong (gần nhất: "${sample.content.slice(0, 30)}"${sample.schedule_time ? ` lúc ${sample.schedule_time}` : ''})`
      );
    } else {
      parts.push('Không còn lịch hẹn tồn đọng');
    }

    if (habit) {
      parts.push(`Khung ${hour}h bạn hay dùng "${habit.app_title}"`);
    } else if (topApps.length > 0) {
      parts.push(
        `Hôm nay dùng nhiều: ${topApps.map((a) => `${a.app_title} (${Math.max(1, Math.round(a.total_sec / 60))}p)`).join(', ')}`
      );
    }

    const factCount = (insights?.profile_facts?.length || 0) + activeLong.length;
    parts.push(`DB đang áp dụng ${factCount} quy tắc & sở thích cá nhân`);

    const summary = `[TRỢ LÝ DB & WORKSPACE] ${parts.join(' | ')}.`;
    showTelemetrySection('memory');
    pushDashboardAlert(summary);
    appState.setState('WAVING');
    appState.setExpression('happy', 3.5);

    if (habit || topYt || pendingNotes.length > 0) {
      speak(`${summary} Bấm "Đồng ý" để mở nhanh Workspace thói quen & xem Lịch hẹn nhé!`);
      showSuggestionButtons(
        () => {
          if (habit) {
            launchHabitAppTitle(habit.app_title);
          } else if (topYt) {
            void runPcOpen(topYt.url, topYt.title.slice(0, 28));
          }
          if (pendingNotes.length > 0) {
            toggleStickyNotesWidget(true);
          }
        },
        () => {
          if (pendingNotes.length > 0) toggleStickyNotesWidget(true);
        }
      );
    } else {
      speak(summary);
    }
    return summary;
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

let lastIngestedAnalysis: IngestedFileAnalysis | null = null;

function buildCompleteOfflineSummary(analysis: IngestedFileAnalysis): string {
  const statsLines = analysis.numeric_stats
    .slice(0, 5)
    .map((s) => `- Cột "${s.column}": nhỏ nhất ${s.min}, trung bình ${s.avg}, lớn nhất ${s.max}, tổng ${s.sum}.`)
    .join('\n');

  const rawNorm = (analysis.raw_excerpt || '').replace(/\r\n/g, '\n').trim();
  let excerptPart = '';
  if (rawNorm) {
    if (rawNorm.length <= 750) {
      excerptPart = rawNorm;
    } else {
      const slice = rawNorm.slice(0, 750);
      const lastBreak = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('\n'));
      excerptPart = (lastBreak > 240 ? slice.slice(0, lastBreak + 1) : slice).trim();
    }
  }

  return [
    `[TÓM TẮT ${analysis.file_type}] ${analysis.quick_overview}`,
    statsLines ? `Số liệu chính:\n${statsLines}` : '',
    excerptPart ? `Nội dung chính:\n${excerptPart}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function summarizeLastIngestedFile(
  overrideAnalysis?: IngestedFileAnalysis
): Promise<string> {
  const analysis = overrideAnalysis || lastIngestedAnalysis;
  if (!analysis) {
    const empty = '[TÓM TẮT FILE] Chưa có tệp nào được nạp vào miệng Vịt gần đây.';
    speak(empty);
    return empty;
  }

  appState.setState('SCANNING');
  spawnScanEffect(appState.posX, appState.posY);
  fireAnimationTrigger('tool', 'file_cleanup', 'start');
  speak(`[ĐANG TÓM TẮT ${analysis.file_type}] Vịt đang đọc toàn bộ "${analysis.file_name}" cho bạn...`);

  let finalSummary = '';
  const statsSnippet = analysis.numeric_stats
    .slice(0, 5)
    .map((s) => `${s.column}: min ${s.min}, avg ${s.avg}, max ${s.max}, sum ${s.sum}`)
    .join(' | ');
  const aiContext = [
    `Tên file: ${analysis.file_name} (${analysis.file_type}, ${analysis.file_size_kb} KB)`,
    `Tổng quan cấu trúc: ${analysis.quick_overview}`,
    analysis.columns.length > 0 ? `Danh sách cột: ${analysis.columns.join(', ')}` : '',
    statsSnippet ? `Thống kê số liệu: ${statsSnippet}` : '',
    analysis.raw_excerpt ? `Nội dung chi tiết:\n${analysis.raw_excerpt.slice(0, 3200)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  if (!isStreamingActive && (isOllamaOnline || geminiApiKey.trim())) {
    try {
      const prompt = `Bạn là trợ lý Duck AI Manager. Hãy đọc kỹ dữ liệu của tệp "${analysis.file_name}" và viết bản tóm tắt ĐẦY ĐỦ, MẠCH LẠC bằng tiếng Việt (3 đến 5 câu hoàn chỉnh kết thúc trọn vẹn bằng dấu chấm, KHÔNG bỏ lửng giữa chừng, KHÔNG dùng emoji): nêu rõ chủ đề chính, các số liệu/thông tin quan trọng và kết luận rút ra.`;
      const llmRes = await askHybridLlm(
        prompt,
        prompt,
        [{ role: 'user', content: aiContext }],
        shouldRouteToGemini(aiContext, true)
      );
      if (llmRes.reply?.trim()) {
        finalSummary = `[TÓM TẮT ${analysis.file_type} - ${llmRes.engine}]\n${llmRes.reply.trim()}`;
      }
    } catch {
      // Fallback sang bộ tổng hợp hoàn chỉnh không ngắt chữ
    }
  }

  if (!finalSummary) {
    finalSummary = buildCompleteOfflineSummary(analysis);
  }

  appState.setState('WAVING');
  appState.setExpression('happy', 3.4);
  fireAnimationTrigger('tool', 'file_cleanup', 'success');
  renderDashboardAiSummary(analysis.file_name, finalSummary);
  pushChatHistory('assistant', finalSummary);
  pushDashboardAlert(`[TÓM TẮT] ${analysis.file_name}: ${finalSummary.slice(0, 120)}...`);
  speak(finalSummary);
  showSuggestionButtons(
    () => {
      openFileAnalyticsDashboard(analysis);
    },
    () => {
      void invoke<string>('set_clipboard_text', { text: finalSummary })
        .then((m) => speak(`[CLIPBOARD] ${m}`))
        .catch(() => { });
    },
    'Show Dashboard',
    'Copy Tóm Tắt'
  );
  return finalSummary;
}

export async function handleDroppedAnyFile(
  fileOrPath: File | string
): Promise<IngestedFileAnalysis | null> {
  setFileDragHoverMode(false);
  fireAnimationTrigger('event', 'file_drop', 'enter');
  const isPathStr = typeof fileOrPath === 'string';
  const fileName = isPathStr
    ? fileOrPath.split(/[\\/]/).pop() || 'dropped_file'
    : fileOrPath.name;
  const lower = fileName.toLowerCase();

  const isBinaryDoc =
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.bmp') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.pdf') ||
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls');

  if (!appState.isBubbleVisible) {
    toggleBubbleVisibility(true);
  }
  appState.setState('EATING');
  appState.setExpression('happy', 3.5);
  appState.changeHunger(12);
  appState.changeMood(6);
  spawnBlackHole(appState.posX, appState.posY - 120, 0.9, 'suction');
  spawnParticles(appState.posX, appState.posY - 105, 18, 0xa855f7);
  playSuccessChimeSound(appState.posX);
  speak(`[ĐANG NUỐT FILE] Ực! Vịt vừa há mồm đớp trọn tệp "${fileName}"! Đang giải mã dữ liệu...`);

  try {
    let analysis: IngestedFileAnalysis;
    if (isPathStr) {
      analysis = await invoke<IngestedFileAnalysis>('analyze_ingested_file', {
        filePath: fileOrPath,
        fileName,
        contentBase64: null,
        textPreview: null,
      });
    } else if (isBinaryDoc) {
      const buf = await fileOrPath.slice(0, 6_000_000).arrayBuffer();
      const b64 = arrayBufferToBase64(buf);
      analysis = await invoke<IngestedFileAnalysis>('analyze_ingested_file', {
        filePath: null,
        fileName,
        contentBase64: b64,
        textPreview: null,
      });
    } else {
      const previewText = await fileOrPath.slice(0, 120_000).text();
      analysis = await invoke<IngestedFileAnalysis>('analyze_ingested_file', {
        filePath: null,
        fileName,
        contentBase64: null,
        textPreview: previewText,
      });
    }

    lastIngestedAnalysis = analysis;
    pinFileToChatBar(analysis);
    window.dispatchEvent(new CustomEvent('duck-focus-chat-input'));
    const promptMsg = `[ĐÃ GHIM ${analysis.file_type}] Đã hấp thụ và ghim "${analysis.file_name}" (${analysis.file_size_kb} KB) vào thanh chat! ${analysis.quick_overview} — Hãy gõ yêu cầu xử lý file ngay bên dưới (tóm tắt, phân tích, chỉnh sửa, lọc dữ liệu...) hoặc bấm Tóm tắt / Dashboard ở thanh ghim.`;
    pushChatHistory('assistant', promptMsg);
    pushDashboardAlert(analysis.quick_overview);
    appState.setState('WAVING');
    appState.setExpression('happy', 3.5);
    speak(promptMsg);
    hideSuggestionButtons();
    return analysis;
  } catch (err) {
    const errMsg = `[LỖI HẤP THỤ FILE] ${String(err)}`;
    appState.setExpression('sad', 2.5);
    speak(errMsg);
    return null;
  }
}

export async function runPortManager(
  action: 'list' | 'kill' = 'list',
  port?: number,
  interactive = true
): Promise<string> {
  return runWithToolAnim('port_manager', async () => {
    if (interactive) {
      appState.setState('SCANNING');
      spawnScanEffect(appState.posX, appState.posY);
    }
    try {
      const res = await invoke<string>('manage_ports', {
        action,
        port: port && port > 0 ? port : null,
      });
      appState.setExpression('happy', 2.8);
      if (action === 'kill') {
        spawnParticles(appState.posX, appState.posY - 90, 12, 0x34d399);
      }
      pushDashboardAlert(`[PORT DEV] ${res}`);
      if (interactive) {
        speak(`[PORT DEV] ${res}`);
      }
      return res;
    } catch (err) {
      const errMsg = `[LỖI PORT DEV] ${String(err)}`;
      appState.setExpression('sad', 2.5);
      if (interactive) speak(errMsg);
      return errMsg;
    } finally {
      if (interactive) scheduleScanIdleReset();
    }
  }, (s) => !s.startsWith('[LỖI'));
}

export async function runGitStatusCheck(path = '', interactive = true): Promise<string> {
  return runWithToolAnim('git_status', async () => {
    if (interactive) {
      appState.setState('SCANNING');
      spawnScanEffect(appState.posX, appState.posY);
    }
    try {
      const res = await invoke<string>('check_git_status', {
        path: path.trim() || null,
      });
      appState.setExpression('happy', 3.0);
      pushDashboardAlert(res);
      if (interactive) {
        speak(res);
      }
      return res;
    } catch (err) {
      const errMsg = `[LỖI GIT] ${String(err)}`;
      appState.setExpression('sad', 2.5);
      if (interactive) speak(errMsg);
      return errMsg;
    } finally {
      if (interactive) scheduleScanIdleReset();
    }
  }, (s) => !s.startsWith('[LỖI'));
}

export async function runClipboardHistoryCheck(interactive = true): Promise<string> {
  return runWithToolAnim('clipboard_history', async () => {
    try {
      const items = await invoke<ClipboardHistoryEntry[]>('clipboard_history_list');
      if (!items || items.length === 0) {
        const empty = '[CLIPBOARD HISTORY] Chưa lưu lịch sử copy nào trong phiên hôm nay.';
        if (interactive) speak(empty);
        return empty;
      }
      const previewList = items
        .slice(0, 3)
        .map((it, idx) => `#${idx + 1}: "${it.content.slice(0, 38)}${it.content.length > 38 ? '...' : ''}"`)
        .join(' | ');
      const msg = `[LỊCH SỬ CLIPBOARD (${items.length} mục)] ${previewList}`;
      if (interactive) {
        const pick = items[Math.min(1, items.length - 1)];
        speak(`${msg} — Bấm "Đồng ý" để copy lại mục "${pick.content.slice(0, 26)}"!`);
        showSuggestionButtons(
          () => {
            void invoke<string>('set_clipboard_text', { text: pick.content })
              .then((m) => speak(`[CLIPBOARD] ${m}`))
              .catch(() => { });
          },
          () => { }
        );
      }
      return msg;
    } catch (err) {
      const errMsg = `[LỖI CLIPBOARD HISTORY] ${String(err)}`;
      if (interactive) speak(errMsg);
      return errMsg;
    }
  }, (s) => !s.startsWith('[LỖI'));
}

export async function createCustomMacroFromText(
  triggerName: string,
  rawCommands: string
): Promise<string> {
  const cleanName = triggerName.trim().toLowerCase();
  const cleanCmds = rawCommands.trim();
  if (!cleanName || !cleanCmds) {
    return '[MACRO] Thiếu tên macro hoặc chuỗi hành động.';
  }
  await invoke('macro_upsert', {
    triggerName: cleanName,
    actionsJson: cleanCmds,
  });
  return `[MACRO SQLITE] Đã lưu Macro "${cleanName}": ${cleanCmds}`;
}

export async function runMacroRoutine(name: string, interactive = true): Promise<string> {
  return runWithToolAnim('macro', async () => {
    const query = name.trim().toLowerCase();
    try {
      const list = await invoke<MacroEntry[]>('macro_list');
      if (list.length === 0) {
        const msg = '[MACRO] Chưa có Macro nào trong SQLite.';
        if (interactive) speak(msg);
        return msg;
      }
      if (!query || query === 'list') {
        const summary = `[MACRO ĐÃ LƯU (${list.length})] ${list.map((m) => `"${m.trigger_name}"`).join(', ')}.`;
        if (interactive) speak(summary);
        return summary;
      }

      const found =
        list.find((m) => m.trigger_name.toLowerCase() === query) ||
        list.find((m) => m.trigger_name.toLowerCase().includes(query) || query.includes(m.trigger_name.toLowerCase()));

      if (!found) {
        const msg = `[MACRO] Không tìm thấy Macro "${name}". Hiện có: ${list.map((m) => m.trigger_name).join(', ')}.`;
        if (interactive) speak(msg);
        return msg;
      }

      appState.setState('WAVING');
      appState.setExpression('happy', 3.5);
      spawnParticles(appState.posX, appState.posY - 90, 14, 0x38bdf8);

      const parsed = parseAiToolCalls(found.actions_json);
      if (parsed.toolCalls.length > 0) {
        for (let i = 0; i < parsed.toolCalls.length; i++) {
          await dispatchAiToolCall(parsed.toolCalls[i]);
          if (i < parsed.toolCalls.length - 1) {
            await new Promise((r) => setTimeout(r, 700));
          }
        }
      } else {
        await executeChainedHeuristicCommands(found.actions_json);
      }

      const msg = `[MACRO "${found.trigger_name.toUpperCase()}"] Đã kích hoạt xong ${Math.max(1, parsed.toolCalls.length)} hành động tự động!`;
      if (interactive) speak(msg);
      return msg;
    } catch (err) {
      const errMsg = `[LỖI MACRO] ${String(err)}`;
      if (interactive) speak(errMsg);
      return errMsg;
    }
  }, (s) => !s.startsWith('[LỖI'));
}

export function updateWeatherDashboard(w: WeatherInfo) {
  appState.weatherTempC = w.temp_c;
  appState.weatherFeelsLikeC = w.feels_like_c;
  appState.weatherHumidity = w.humidity_pct;
  appState.weatherWindKmh = w.wind_kmh;
  appState.weatherDesc = w.description;
  appState.weatherLocation = w.location;

  const setTxt = (id: string, val: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setTxt('val-weather-temp', `${w.temp_c.toFixed(1)} °C`);
  setTxt('val-weather-loc', `Khu vực: ${w.location}`);
  setTxt('val-weather-feels', `${w.feels_like_c.toFixed(1)} °C`);
  setTxt('val-weather-hum', `${w.humidity_pct}%`);
  setTxt('val-weather-wind', `${w.wind_kmh.toFixed(1)} km/h`);
  setTxt('val-weather-desc', w.description);
}

export function updateStudioWeatherPreviewUi() {
  const preview = document.getElementById('studio-weather-live-preview');
  if (!preview) return;
  if (appState.weatherSourceMode === 'custom') {
    preview.textContent = `[CUSTOM] ${appState.weatherCustomLocation}: ${appState.weatherCustomTempC.toFixed(1)}°C | Độ ẩm ${appState.weatherCustomHumidityPct}% | ${appState.weatherCustomDesc} (${appState.weatherCustomMode})`;
  } else {
    preview.textContent = `[API LIVE] ${appState.weatherLocation}: ${appState.weatherTempC.toFixed(1)}°C | Độ ẩm ${appState.weatherHumidity}% | ${appState.weatherDesc} (${appState.weatherMode})`;
  }
}

export async function syncLiveWeather3D(
  overrideMode: WeatherEffectMode | 'auto' = 'auto',
  interactive = true,
  cityOverride?: string
): Promise<string> {
  const exec = async (): Promise<string> => {
    const prevMode = appState.weatherMode;
    if (cityOverride !== undefined) {
      const cleanCity = cityOverride.trim() || 'auto';
      appState.weatherCityQuery = cleanCity;
      localStorage.setItem('mate_weather_city', cleanCity);
    } else {
      appState.weatherCityQuery = localStorage.getItem('mate_weather_city') || 'auto';
    }

    if (overrideMode === 'auto' && appState.weatherSourceMode === 'custom' && cityOverride === undefined) {
      const customMode = appState.weatherCustomMode || 'clear';
      const customInfo: WeatherInfo = {
        location: appState.weatherCustomLocation || 'Tùy chỉnh',
        temp_c: appState.weatherCustomTempC,
        feels_like_c: appState.weatherCustomTempC,
        humidity_pct: appState.weatherCustomHumidityPct,
        wind_kmh: customMode === 'wind' ? 28 : 8,
        description: appState.weatherCustomDesc || 'Thời tiết tùy chỉnh',
      };
      updateWeatherDashboard(customInfo);
      appState.weatherMode = customMode;
      applyWeatherAccessory(customMode);
      updateStudioWeatherPreviewUi();
      syncWeatherUiAndTriggerEvent(customMode, 'auto', interactive || customMode !== prevMode);
      const msg = `[THỜI TIẾT CUSTOM] ${customInfo.location}: ${customInfo.temp_c.toFixed(1)}°C, Độ ẩm ${customInfo.humidity_pct}% - ${customInfo.description}. Hiệu ứng 3D: "${customMode}".`;
      if (interactive) {
        showTelemetrySection('weather');
        pushDashboardAlert(msg);
        speak(msg);
      }
      return msg;
    }

    if (overrideMode !== 'auto') {
      appState.weatherMode = overrideMode;
      applyWeatherAccessory(overrideMode);
      updateStudioWeatherPreviewUi();
      syncWeatherUiAndTriggerEvent(overrideMode, overrideMode, interactive || overrideMode !== prevMode);
      const labels: Record<WeatherEffectMode, string> = {
        clear: 'Trời quang đãng (Mây trắng + Mặt trời nhẹ)',
        rain: 'Mưa rơi 3D + Mây Sấm Sét + Ô che mưa',
        hot: 'Nắng nóng 3D + Mặt Trời rực rỡ + Nón rơm & Kính râm',
        cold: 'Tuyết rơi 3D + Người Tuyết + Mũ Len ấm áp',
        wind: 'Gió xoáy 3D + Lốc xoáy & Mũ chong chóng',
        night: 'Ban đêm 3D + Trăng Sao + Vòng hào quang',
      };
      const msg = `[THỜI TIẾT 3D] Đã chuyển môi trường & phụ kiện sang: ${labels[overrideMode]}.`;
      if (interactive) {
        showTelemetrySection('weather');
        speak(msg);
      }
      return msg;
    }

    try {
      const cityParam = appState.weatherCityQuery || 'auto';
      const w = await invoke<WeatherInfo>('check_weather', { city: cityParam });
      updateWeatherDashboard(w);
      const mode = resolveWeatherModeFromInfo(w);
      appState.weatherMode = mode;
      applyWeatherAccessory(mode);
      updateStudioWeatherPreviewUi();
      syncWeatherUiAndTriggerEvent(mode, 'auto', interactive || mode !== prevMode);
      const msg = `[THỜI TIẾT LIVE] ${w.location}: ${w.temp_c.toFixed(1)}°C (cảm giác ${w.feels_like_c.toFixed(1)}°C), Độ ẩm ${w.humidity_pct}%, Gió ${w.wind_kmh.toFixed(1)} km/h - ${w.description}. Hiệu ứng 3D: "${mode}".`;
      if (interactive) {
        showTelemetrySection('weather');
        pushDashboardAlert(msg);
        speak(msg);
      }
      return msg;
    } catch {
      const hour = new Date().getHours();
      const fallbackMode: WeatherEffectMode = hour >= 18 || hour < 6 ? 'night' : 'clear';
      appState.weatherMode = fallbackMode;
      applyWeatherAccessory(fallbackMode);
      updateStudioWeatherPreviewUi();
      syncWeatherUiAndTriggerEvent(fallbackMode, 'auto', interactive || fallbackMode !== prevMode);
      const msg = `[THỜI TIẾT 3D] Offline -> tự động đặt chế độ "${fallbackMode}".`;
      if (interactive) speak(msg);
      return msg;
    }
  };
  return interactive ? runWithToolAnim('weather_3d', exec) : exec();
}

let cachedNewsArticles: NewsArticleItem[] = [];
let currentEnglishItem: EnglishVocabItem | null = null;

export function getCachedNewsArticles(): NewsArticleItem[] {
  return cachedNewsArticles;
}

export function getConfiguredNewsSource(): { mode: string; customUrl: string } {
  const mode = localStorage.getItem('mate_news_source') || 'multi_random';
  const customUrl = localStorage.getItem('mate_news_custom_url') || '';
  return { mode, customUrl };
}

export async function loadAndSpeakLiveNews(
  sourceOverride?: string,
  interactive = true
): Promise<string> {
  const exec = async () => {
    if (interactive) {
      appState.setState('SCANNING');
      spawnScanEffect(appState.posX, appState.posY);
    }
    const { mode, customUrl } = getConfiguredNewsSource();
    const requested = (sourceOverride || mode || 'multi_random').trim();

    const pool = ['znews', 'cafef', 'money', 'vnexpress'];
    let targetSource = requested;
    if (requested === 'multi_random') {
      targetSource = pool[Math.floor(Math.random() * pool.length)];
    } else if (requested === 'custom') {
      targetSource = customUrl.trim() || 'https://znews.vn';
    }

    try {
      let articles = await invoke<NewsArticleItem[]>('fetch_live_news', { source: targetSource }).catch(
        () => [] as NewsArticleItem[]
      );
      // Nếu chế độ ngẫu nhiên gặp nguồn lỗi tạm thời, thử các nguồn dự phòng trong danh sách
      if (articles.length === 0 && requested === 'multi_random') {
        for (const alt of pool) {
          if (alt === targetSource) continue;
          articles = await invoke<NewsArticleItem[]>('fetch_live_news', { source: alt }).catch(
            () => [] as NewsArticleItem[]
          );
          if (articles.length > 0) {
            targetSource = alt;
            break;
          }
        }
      }

      if (articles.length === 0) {
        const errMsg = `[TIN TỨC] Không tải được tin mới từ nguồn "${targetSource}". Kiểm tra lại mạng hoặc URL RSS.`;
        if (interactive) speak(errMsg);
        return errMsg;
      }

      cachedNewsArticles = articles;
      const badgeEl = document.getElementById('val-news-badge');
      if (badgeEl) badgeEl.textContent = articles[0].source.toUpperCase();

      const listEl = document.getElementById('news-feed-list');
      if (listEl) {
        listEl.innerHTML = '';
        articles.slice(0, 8).forEach((art, idx) => {
          const row = document.createElement('div');
          row.className = 'news-item-row';
          row.title = 'Click để mở bài báo gốc trong trình duyệt';

          const titleDiv = document.createElement('div');
          titleDiv.className = 'news-item-title';
          titleDiv.textContent = `${idx + 1}. ${art.title}`;

          const metaDiv = document.createElement('div');
          metaDiv.className = 'news-item-meta';
          metaDiv.textContent = `[${art.source}] ${art.pub_date || 'Mới nhất'}`;

          row.appendChild(titleDiv);
          row.appendChild(metaDiv);
          row.addEventListener('click', () => {
            if (art.link) {
              void runPcOpen(art.link, art.source);
            }
          });
          listEl.appendChild(row);
        });
      }

      const pickIdx = Math.min(articles.length - 1, Math.floor(Math.random() * Math.min(3, articles.length)));
      const top = articles[pickIdx];
      const second = articles[(pickIdx + 1) % articles.length];
      const spoken =
        articles.length > 1 && second.title !== top.title
          ? `[TIN MỚI - ${top.source.toUpperCase()}] 1) ${top.title} | 2) ${second.title}`
          : `[TIN MỚI - ${top.source.toUpperCase()}] ${top.title}`;

      if (interactive) {
        showTelemetrySection('news');
        appState.setState('WAVING');
        appState.setExpression('happy', 3.0);
        speak(spoken);
        pushDashboardAlert(`[NEWS ${top.source}] ${top.title}`);
        if (top.link) {
          showSuggestionButtons(
            () => void runPcOpen(top.link, top.source),
            () => { }
          );
        }
      }
      return spoken;
    } catch (err) {
      const errMsg = `[LỖI TIN TỨC] ${String(err)}`;
      if (interactive) speak(errMsg);
      return errMsg;
    } finally {
      if (interactive) scheduleScanIdleReset();
    }
  };
  return interactive
    ? runWithToolAnim('news', exec, (s) => !s.startsWith('[TIN TỨC] Không') && !s.startsWith('[LỖI'))
    : exec();
}

export function playEnglishVocabAudio(
  item?: EnglishVocabItem | null,
  opts?: { slow?: boolean; sentence?: boolean }
) {
  const target = item || currentEnglishItem;
  if (!target || !target.word) return;
  const textToSpeak = opts?.sentence && target.example_en ? target.example_en : target.word;
  const audioUrl = !opts?.sentence && !opts?.slow ? target.audio_url || '' : '';
  void speakEnglishTts(textToSpeak, Boolean(opts?.slow), audioUrl);
}

const englishAutoRepairedWords = new Set<string>();

function hasVietnameseDiacritics(text: string): boolean {
  return /[\u00C0-\u1EF9đĐ]/.test(text);
}

function formatPartOfSpeechVi(pos: string): string {
  const low = pos.trim().toLowerCase();
  const map: Record<string, string> = {
    noun: 'Danh từ (noun)',
    verb: 'Động từ (verb)',
    adjective: 'Tính từ (adj)',
    adj: 'Tính từ (adj)',
    adverb: 'Trạng từ (adv)',
    adv: 'Trạng từ (adv)',
    preposition: 'Giới từ (prep)',
    conjunction: 'Liên từ (conj)',
    pronoun: 'Đại từ (pron)',
    interjection: 'Thán từ (interj)',
    vocab: 'Từ vựng',
  };
  return map[low] || pos;
}

function isUntranslatedOrPlaceholderVi(text: string, sourceEn: string, requireDiacriticWhenAsciiMatch = true): boolean {
  const t = text.trim();
  const s = sourceEn.trim();
  if (!t) return true;
  const lowT = t.toLowerCase();
  if (
    lowT.includes('chưa dịch được') ||
    lowT.includes('mymemory warning') ||
    lowT.includes('query length limit')
  ) {
    return true;
  }
  if (s && lowT === s.toLowerCase()) return true;
  if (requireDiacriticWhenAsciiMatch && s && !hasVietnameseDiacritics(t)) {
    return true;
  }
  return false;
}

function needsVietnameseTranslation(item: EnglishVocabItem): boolean {
  const meaningBad =
    isUntranslatedOrPlaceholderVi(item.meaning_vi || '', item.word, true) ||
    (Boolean(item.definition_en) &&
      (item.meaning_vi || '').toLowerCase().includes(item.definition_en.trim().toLowerCase()));
  const exampleBad = isUntranslatedOrPlaceholderVi(
    item.example_vi || '',
    item.example_en || '',
    true
  );
  return meaningBad || exampleBad;
}

async function quickTranslateEnToVi(text: string): Promise<string> {
  const clean = text.trim();
  if (!clean) return '';
  try {
    const res = await invoke<TranslateResult>('translate_text_quick', {
      text: clean,
      targetLang: 'vi',
    });
    const out = (res?.translated_text || '').trim();
    if (!out) return '';
    if (isUntranslatedOrPlaceholderVi(out, clean, false)) return '';
    return out;
  } catch {
    return '';
  }
}

export async function translateEnglishItemToVi(
  item: EnglishVocabItem,
  force = false
): Promise<EnglishVocabItem> {
  const updated: EnglishVocabItem = { ...item };
  let needMeaning =
    force ||
    isUntranslatedOrPlaceholderVi(updated.meaning_vi || '', updated.word, true) ||
    (Boolean(updated.definition_en) &&
      (updated.meaning_vi || '').toLowerCase().includes(updated.definition_en.trim().toLowerCase()));
  let needExample =
    force ||
    isUntranslatedOrPlaceholderVi(updated.example_vi || '', updated.example_en || '', true);

  if (!needMeaning && !needExample) {
    return updated;
  }

  // Step 1: Online translate fallback via Rust quick translator
  if (needMeaning) {
    const [wVi, dVi] = await Promise.all([
      quickTranslateEnToVi(updated.word),
      updated.definition_en ? quickTranslateEnToVi(updated.definition_en) : Promise.resolve(''),
    ]);
    const validW = wVi && !isUntranslatedOrPlaceholderVi(wVi, updated.word, true) ? wVi : '';
    const validD =
      dVi && !isUntranslatedOrPlaceholderVi(dVi, updated.definition_en || '', true) ? dVi : '';
    if (validW && validD) {
      updated.meaning_vi = validW.toLowerCase() === validD.toLowerCase() ? validW : `${validW} - ${validD}`;
      needMeaning = false;
    } else if (validW) {
      updated.meaning_vi = validW;
      needMeaning = false;
    } else if (validD) {
      updated.meaning_vi = validD;
      needMeaning = false;
    }
  }

  if (needExample && updated.example_en) {
    const exVi = await quickTranslateEnToVi(updated.example_en);
    if (exVi && !isUntranslatedOrPlaceholderVi(exVi, updated.example_en, true)) {
      updated.example_vi = exVi;
      needExample = false;
    }
  }

  // Step 2: AI translation fallback (Gemini / Local Ollama) if online translator failed or echoed English
  if ((needMeaning || needExample) && (isOllamaOnline || geminiApiKey.trim())) {
    try {
      const sysPrompt =
        'Bạn là từ điển Anh-Việt chính xác. Dịch ngắn gọn, tự nhiên sang tiếng Việt có dấu, KHÔNG dùng emoji. Trả về đúng 2 dòng theo mẫu:\nNGHIA_VI: <nghĩa tiếng Việt ngắn gọn kèm giải thích nếu cần>\nVIDU_VI: <bản dịch tiếng Việt cho câu ví dụ>';
      const userPrompt = `Từ: ${updated.word} (${updated.part_of_speech})\nĐịnh nghĩa: ${updated.definition_en}\nCâu ví dụ: ${updated.example_en}`;
      const res = await askHybridLlm(
        sysPrompt,
        sysPrompt,
        [{ role: 'user', content: userPrompt }],
        Boolean(geminiApiKey.trim())
      );
      const reply = (res.reply || '').trim();
      if (reply) {
        const nghiaMatch = reply.match(/NGHIA_VI\s*:\s*(.+)/i);
        const viduMatch = reply.match(/VIDU_VI\s*:\s*(.+)/i);
        if (needMeaning && nghiaMatch?.[1]?.trim()) {
          updated.meaning_vi = nghiaMatch[1].trim();
          needMeaning = false;
        }
        if (needExample && viduMatch?.[1]?.trim()) {
          updated.example_vi = viduMatch[1].trim();
          needExample = false;
        }
      }
    } catch {
      // Giữ trạng thái fallback bên dưới nếu AI offline
    }
  }

  if (isUntranslatedOrPlaceholderVi(updated.meaning_vi || '', updated.word, false)) {
    updated.meaning_vi = 'Chưa dịch được nghĩa tiếng Việt (bấm "Dịch TV" để dịch bằng AI)';
  }
  if (
    updated.example_en &&
    isUntranslatedOrPlaceholderVi(updated.example_vi || '', updated.example_en, false)
  ) {
    updated.example_vi = '(Chưa dịch được câu ví dụ - bấm "Dịch TV" để dịch)';
  }

  return updated;
}

function renderEnglishCard(item: EnglishVocabItem) {
  currentEnglishItem = item;
  const setTxt = (id: string, val: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setTxt('eng-word', item.word);
  setTxt('eng-pos', formatPartOfSpeechVi(item.part_of_speech));
  setTxt('eng-phonetic', `${item.phonetic}  [${item.topic}]`);
  setTxt('eng-meaning-vi', `Nghĩa TV: ${item.meaning_vi}`);
  setTxt('eng-def-en', `Định nghĩa EN: ${item.definition_en}`);
  setTxt('eng-example-en', item.example_en ? `Ví dụ EN: "${item.example_en}"` : '');
  setTxt('eng-example-vi', item.example_vi ? `Dịch TV: ${item.example_vi}` : '');
}

export async function translateCurrentEnglishLesson(): Promise<string> {
  let target = currentEnglishItem;
  if (!target) {
    const list = await invoke<EnglishVocabItem[]>('vocab_list_words', { limit: 1 }).catch(
      () => [] as EnglishVocabItem[]
    );
    if (list.length > 0) target = list[0];
  }
  if (!target) {
    return loadNextEnglishLesson(undefined, true);
  }

  const btn = document.getElementById('btn-eng-translate') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Đang dịch...';
  }
  try {
    const translated = await translateEnglishItemToVi(target, true);
    await invoke<EnglishVocabItem[]>('vocab_save_word', { item: translated }).catch(() => []);
    renderEnglishCard(translated);
    await refreshEnglishVocabHistoryUi();
    const msg = `[DỊCH TIẾNG ANH -> TV] ${translated.word.toUpperCase()} (${formatPartOfSpeechVi(translated.part_of_speech)}): ${translated.meaning_vi} | Ví dụ: "${translated.example_en}" -> ${translated.example_vi}`;
    speak(msg);
    return msg;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Dịch TV';
    }
  }
}

export async function refreshEnglishVocabHistoryUi(): Promise<EnglishVocabItem[]> {
  try {
    const list = await invoke<EnglishVocabItem[]>('vocab_list_words', { limit: 40 });
    const countEl = document.getElementById('eng-saved-count');
    if (countEl) countEl.textContent = `${list.length} từ đã học`;

    const histEl = document.getElementById('eng-history-list');
    if (histEl) {
      histEl.innerHTML = '';
      list.slice(0, 15).forEach((item) => {
        const chip = document.createElement('div');
        chip.className = 'eng-word-chip';
        chip.title = `${item.word} ${item.phonetic}: ${item.meaning_vi}`;
        const boldWord = document.createElement('b');
        boldWord.style.color = '#c4b5fd';
        boldWord.textContent = item.word;
        const meaningSpan = document.createElement('span');
        meaningSpan.style.cssText =
          'color:#94a3b8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
        meaningSpan.textContent = item.meaning_vi;
        chip.append(boldWord, meaningSpan);
        chip.addEventListener('click', () => {
          void (async () => {
            let displayItem = item;
            if (needsVietnameseTranslation(item) && !englishAutoRepairedWords.has(item.word)) {
              englishAutoRepairedWords.add(item.word);
              displayItem = await translateEnglishItemToVi(item, false);
              if (!needsVietnameseTranslation(displayItem)) {
                await invoke<EnglishVocabItem[]>('vocab_save_word', { item: displayItem }).catch(
                  () => []
                );
              }
            }
            renderEnglishCard(displayItem);
            playEnglishVocabAudio(displayItem);
            speak(
              `[ÔN TẬP] ${displayItem.word} ${displayItem.phonetic} (${formatPartOfSpeechVi(displayItem.part_of_speech)}): ${displayItem.meaning_vi}. VD: ${displayItem.example_en}${displayItem.example_vi ? ` -> ${displayItem.example_vi}` : ''}`
            );
          })();
        });
        histEl.appendChild(chip);
      });
    }
    if (!currentEnglishItem && list.length > 0) {
      const first = list[0];
      renderEnglishCard(first);
      if (needsVietnameseTranslation(first) && !englishAutoRepairedWords.has(first.word)) {
        englishAutoRepairedWords.add(first.word);
        void translateEnglishItemToVi(first, false).then((fixed) => {
          if (!needsVietnameseTranslation(fixed)) {
            void invoke('vocab_save_word', { item: fixed }).catch(() => { });
            if (currentEnglishItem?.word === fixed.word) {
              renderEnglishCard(fixed);
            }
            void refreshEnglishVocabHistoryUi();
          }
        });
      }
    }
    return list;
  } catch {
    return [];
  }
}

export async function loadNextEnglishLesson(
  topicOverride?: string,
  interactive = true
): Promise<string> {
  const exec = async () => {
    if (interactive) {
      appState.setState('SCANNING');
      spawnScanEffect(appState.posX, appState.posY);
      speak('[ENGLISH LIVE] Đang tải từ vựng mới và dịch nghĩa tiếng Việt...');
    }

    const savedTopic = localStorage.getItem('mate_english_topic') || 'random';
    const topicToUse = (topicOverride ?? savedTopic).trim() || 'random';

    try {
      const existing = await invoke<EnglishVocabItem[]>('vocab_list_words', { limit: 120 }).catch(
        () => [] as EnglishVocabItem[]
      );
      const excludeWords = existing.map((e) => e.word);

      const rawItem = await invoke<EnglishVocabItem>('fetch_real_english_lesson', {
        topic: topicToUse,
        excludeWords,
      });
      const item = await translateEnglishItemToVi(rawItem, false);

      await invoke<EnglishVocabItem[]>('vocab_save_word', { item }).catch(() => []);
      renderEnglishCard(item);
      await refreshEnglishVocabHistoryUi();

      const msg = `[HỌC TIẾNG ANH LIVE] ${item.word.toUpperCase()} (${formatPartOfSpeechVi(item.part_of_speech)}) ${item.phonetic} => Nghĩa: ${item.meaning_vi} | VD: "${item.example_en}" (${item.example_vi})`;
      if (interactive) {
        showTelemetrySection('english');
        playEnglishVocabAudio(item);
        appState.setState('WAVING');
        appState.setExpression('happy', 3.4);
        spawnParticles(appState.posX, appState.posY - 100, 12, 0xa78bfa);
        speak(msg);
        pushDashboardAlert(`[ENGLISH] ${item.word}: ${item.meaning_vi}`);
      }
      return msg;
    } catch (err) {
      const errMsg = `[LỖI HỌC TIẾNG ANH] ${String(err)}`;
      if (interactive) speak(errMsg);
      return errMsg;
    } finally {
      if (interactive) scheduleScanIdleReset();
    }
  };
  return interactive
    ? runWithToolAnim('english', exec, (s) => !s.startsWith('[LỖI'))
    : exec();
}

export async function runEnglishMiniQuiz(): Promise<string> {
  return runWithToolAnim('english', async () => {
    const list = await refreshEnglishVocabHistoryUi();
    if (list.length === 0) {
      return loadNextEnglishLesson('random', true);
    }
    const rawPick = list[Math.floor(Math.random() * list.length)];
    let pick = rawPick;
    if (needsVietnameseTranslation(rawPick)) {
      pick = await translateEnglishItemToVi(rawPick, false);
      if (!needsVietnameseTranslation(pick)) {
        await invoke<EnglishVocabItem[]>('vocab_save_word', { item: pick }).catch(() => []);
      }
    }
    renderEnglishCard(pick);
    playEnglishVocabAudio(pick);
    const quizText = `[ĐỐ VUI TIẾNG ANH] Từ "${pick.word}" (${pick.phonetic}, ${formatPartOfSpeechVi(pick.part_of_speech)}) có nghĩa tiếng Việt là gì? Bấm "Đồng ý" để xem đáp án & câu ví dụ!`;
    showTelemetrySection('english');
    speak(quizText);
    showSuggestionButtons(
      () => {
        playEnglishVocabAudio(pick);
        speak(`[ĐÁP ÁN] "${pick.word}" = ${pick.meaning_vi} | VD: "${pick.example_en}" (${pick.example_vi})`);
        appState.changeMood(5);
      },
      () => {
        void loadNextEnglishLesson('random', true);
      }
    );
    return quizText;
  });
}

export function getCurrentEnglishVocabItem(): EnglishVocabItem | null {
  return currentEnglishItem;
}

export function setCurrentEnglishVocabItem(item: EnglishVocabItem | null) {
  if (!item) {
    currentEnglishItem = null;
    return;
  }
  renderEnglishCard(item);
}

export async function askEnglishCoachAi(
  scenario: string,
  userText: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<{ reply: string; engine: string }> {
  const systemPrompt =
    `You are Duck English Coach tutoring a Vietnamese learner in "${scenario}". ` +
    `Reply warmly in concise natural English (under 45 words), then optionally add one short Vietnamese tip after "VN_HINT: ". ` +
    `Gently fix any major grammar mistake if present.`;
  const msgs: OllamaMessage[] = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: userText },
  ];
  return askHybridLlm(systemPrompt, systemPrompt, msgs, true);
}

export async function triggerRandomFeatureOrEffect(interactive = true): Promise<string> {
  const fxName = triggerRandomSpecial3DEffect(appState.posX, appState.posY);
  const fxLabels: Record<string, string> = {
    meteor_shower: 'Mưa Sao Băng 3D',
    aurora_ring: 'Vòng Cực Quang Đa Sắc',
    cyber_fireworks: 'Pháo Hoa 3D Cyber',
    starlight_fountain: 'Đài Phun Ánh Sao',
    matrix_pulse: 'Sóng Dữ Liệu Matrix',
    plasma_nova: 'Vụ Nổ Plasma Nova 3D',
    sakura_vortex: 'Lốc Xoáy Hoa Anh Đào',
    cyber_dna_helix: 'Chuỗi Xoắn Kép Cyber DNA',
    golden_jackpot: 'Suối Vàng Thần Tài',
  };
  const roll = Math.random();
  if (roll < 0.42) {
    const picked = playRandomClipFromDeck();
    appState.setExpression('happy', picked.defaultDuration + 0.4);
    const msg = `[HIỆU ỨNG & HOẠT ẢNH 3D] ${fxLabels[fxName] || fxName} + diễn "${picked.label}"!`;
    if (interactive) speak(msg);
    return msg;
  }
  if (roll < 0.56) {
    const hats: AccessoryType[] = ['crown', 'cyber_visor', 'headset', 'propeller', 'halo'];
    const randomHat = hats[Math.floor(Math.random() * hats.length)];
    clearTemporaryAccessoryTimer();
    equipAccessory3D(randomHat, false);
    appState.setState('DANCING');
    appState.setExpression('happy', 3.2);
    const msg = `[HIỆU ỨNG RANDOM] Bùng nổ ${fxLabels[fxName] || fxName} + đội phụ kiện "${randomHat}"!`;
    if (interactive) speak(msg);
    return msg;
  }
  if (roll < 0.68) {
    triggerTerritoryDefenseMode(true);
    return `[HIỆU ỨNG RANDOM] ${fxLabels[fxName] || fxName} + Bảo Vệ Lãnh Thổ: Rút Kiếm Cyber!`;
  }
  if (roll < 0.78) {
    return triggerWindowSwing();
  }
  if (roll < 0.87) {
    return syncLiveWeather3D('auto', interactive);
  }
  if (roll < 0.94) {
    return loadAndSpeakLiveNews(undefined, interactive);
  }
  return loadNextEnglishLesson('random', interactive);
}

const COMMON_TOOLS: Array<{ keys: string[]; target: string; label: string }> = [
  { keys: ['vs code', 'vscode', 'vs_code', 'visual studio code'], target: 'code', label: 'VS Code' },
  { keys: ['chrome', 'google chrome'], target: 'chrome', label: 'Google Chrome' },
  { keys: ['edge', 'microsoft edge'], target: 'msedge', label: 'Microsoft Edge' },
  { keys: ['youtube', 'youtobe', 'yt'], target: 'https://www.youtube.com', label: 'YouTube' },
  { keys: ['google', 'gg'], target: 'https://www.google.com', label: 'Google' },
  { keys: ['facebook', 'fb'], target: 'https://www.facebook.com', label: 'Facebook' },
  { keys: ['github'], target: 'https://github.com', label: 'GitHub' },
  { keys: ['gmail'], target: 'https://mail.google.com', label: 'Gmail' },
  { keys: ['chatgpt', 'gpt'], target: 'https://chatgpt.com', label: 'ChatGPT' },
  { keys: ['tiktok'], target: 'https://www.tiktok.com', label: 'TikTok' },
  { keys: ['notepad', 'ghi chú'], target: 'notepad', label: 'Notepad' },
  { keys: ['máy tính', 'may tinh', 'calc', 'calculator'], target: 'calc', label: 'Máy tính (Calculator)' },
  { keys: ['paint', 'vẽ'], target: 'mspaint', label: 'Paint' },
  { keys: ['powershell', 'terminal', 'cmd'], target: 'cmd', label: 'Command Prompt' },
  { keys: ['explorer', 'thư mục', 'thu muc'], target: 'explorer', label: 'File Explorer' },
  { keys: ['cài đặt', 'cai dat', 'settings'], target: 'ms-settings:', label: 'Cài đặt Windows' },
  { keys: ['task manager', 'quản lý tác vụ'], target: 'taskmgr', label: 'Task Manager' },
  { keys: ['word'], target: 'winword', label: 'Microsoft Word' },
  { keys: ['excel'], target: 'excel', label: 'Microsoft Excel' },
];

function resolveToolTarget(rawName: string): { target: string; label: string } {
  const norm = rawName.trim().toLowerCase().replace(/[_-]+/g, ' ');
  for (const tool of COMMON_TOOLS) {
    if (tool.keys.some((k) => norm === k || norm.includes(k))) {
      return { target: tool.target, label: tool.label };
    }
  }
  return { target: rawName.trim(), label: rawName.trim() };
}

async function tryHandlePcCommand(userText: string): Promise<boolean> {
  const lower = userText.toLowerCase().trim();

  // 1. Chụp màn hình, OCR & Mở ảnh chụp
  if (
    lower.includes('ocr') ||
    lower.includes('đọc ảnh') ||
    lower.includes('doc anh') ||
    lower.includes('đọc màn hình') ||
    lower.includes('tóm tắt ảnh') ||
    lower.includes('tom tat anh') ||
    lower.includes('tóm tắt màn hình') ||
    lower.includes('trên màn hình là gì')
  ) {
    await runOcrAndSummarize(true);
    return true;
  }
  if (lower.includes('mở ảnh') || lower.includes('mo anh') || lower.includes('xem ảnh chụp') || lower.includes('show ảnh')) {
    await runOpenLatestScreenshot(false);
    return true;
  }
  if (lower.includes('chụp màn hình') || lower.includes('chup man hinh') || lower.includes('chụp ảnh') || lower.includes('screenshot')) {
    await runPcScreenshot();
    return true;
  }

  // 1b. Tương tác phần cứng (Độ sáng / Dọn RAM / Task Manager)
  if (lower.includes('tăng độ sáng') || lower.includes('tang do sang') || lower.includes('sáng lên')) {
    await runHardwareAction('brightness_up');
    return true;
  }
  if (lower.includes('giảm độ sáng') || lower.includes('giam do sang') || lower.includes('tối đi')) {
    await runHardwareAction('brightness_down');
    return true;
  }
  if (lower.includes('dọn ram') || lower.includes('don ram') || lower.includes('giải phóng ram') || lower.includes('xóa ram')) {
    await runHardwareAction('clean_ram');
    return true;
  }

  // 2. Khóa màn hình
  if (lower.includes('khóa màn hình') || lower.includes('khoa man hinh') || lower === 'lock') {
    speak('Đang khóa màn hình máy tính ngay đây!');
    await invoke('lock_pc_screen').catch(() => { });
    return true;
  }

  // 3. Điều khiển Âm lượng & Media
  if (lower.includes('tăng âm') || lower.includes('tang am') || lower.includes('to tiếng') || lower.includes('vol up')) {
    await runPcMedia('vol_up');
    return true;
  }
  if (lower.includes('giảm âm') || lower.includes('giam am') || lower.includes('nhỏ tiếng') || lower.includes('vol down')) {
    await runPcMedia('vol_down');
    return true;
  }
  if (lower.includes('tắt tiếng') || lower.includes('tat tieng') || lower.includes('im lặng') || lower.includes('mute')) {
    await runPcMedia('mute');
    return true;
  }
  if (lower.includes('dừng nhạc') || lower.includes('dung nhac') || lower.includes('tạm dừng') || lower.includes('phát nhạc') || lower.includes('bật nhạc')) {
    await runPcMedia('play_pause');
    return true;
  }
  if (lower.includes('qua bài') || lower.includes('bài tiếp') || lower.includes('next track')) {
    await runPcMedia('next');
    return true;
  }
  if (lower.includes('bài trước') || lower.includes('bai truoc')) {
    await runPcMedia('prev');
    return true;
  }

  // 4. Mở YouTube / Tìm YouTube (hỗ trợ cả lỗi chính tả youtobe, yt)
  const ytMatch = lower.match(/(?:mở|mo|tìm|tim|bật|bat|xem)\s+(?:youtube|youtobe|yt)(?:\s+(.+))?/i);
  if (ytMatch || lower.includes('youtube') || lower.includes('youtobe')) {
    const rawQuery = ytMatch?.[1]?.replace(/\b(lên|len|giúp|giup|đi|di|nào|nao|nhé|nhe)\b/gi, '').trim();
    if (rawQuery && rawQuery.length > 0) {
      await runPcOpen(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(rawQuery)}`,
        `YouTube (${rawQuery})`
      );
    } else {
      await runPcOpen('https://www.youtube.com', 'YouTube');
    }
    return true;
  }

  // 5. Tìm kiếm Google
  const ggSearch = lower.match(/(?:tìm|tim|search|tra)\s+(?:google|gg)?\s*(.+)/i);
  if (ggSearch && ggSearch[1] && !lower.includes('cửa sổ') && !lower.includes('phần cứng') && !lower.includes('mạng') && !lower.includes('bitcoin') && !lower.includes('btc')) {
    const q = ggSearch[1].replace(/\b(giúp|giup|với|voi|nhé|nhe)\b/gi, '').trim();
    if (q.length > 0 && !['google', 'gg'].includes(q)) {
      await runPcOpen(`https://www.google.com/search?q=${encodeURIComponent(q)}`, `Google (${q})`);
      return true;
    }
  }

  // 6. Mở các trang web & ứng dụng Windows phổ biến
  const urlMatch = userText.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    await runPcOpen(urlMatch[0], urlMatch[0]);
    return true;
  }

  const isOpenVerb =
    lower.includes('mở') || lower.includes('mo ') || lower.includes('mo t') || lower.includes('bật') || lower.includes('bat ') || lower.includes('chạy') || lower.includes('open');
  if (isOpenVerb) {
    for (const item of COMMON_TOOLS) {
      if (item.keys.some((k) => lower.includes(k))) {
        await runPcOpen(item.target, item.label);
        return true;
      }
    }
  }

  // 7. Mở File / Mở Tệp Tin trên máy tính (ví dụ: "mo t file a.csv", "mở file a.csv", "mở tệp data.xlsx", "mở file D:\...")
  const explicitFileMatch = userText.match(
    /(?:mở|mo|bật|bat|chạy|chay|open)\s+(?:t\s+|tớ\s+|cho tớ\s+|cho t\s+|giúp\s+|hộ\s+)?(?:file|tệp|tep|tập tin|tap tin)\s*["']?([a-zA-Z0-9_.\-\\/: ]+)["']?/i
  );
  const extFileMatch = userText.match(
    /(?:mở|mo|bật|bat|chạy|chay|open|xem)\s+(?:t\s+|tớ\s+|cho tớ\s+|cho t\s+|giúp\s+|hộ\s+)?["']?([a-zA-Z0-9_.\-\\/: ]+\.[a-zA-Z0-9]{1,8})["']?/i
  );

  const matchedFile = explicitFileMatch?.[1]?.trim() || extFileMatch?.[1]?.trim();
  if (matchedFile) {
    const cleanFile = matchedFile.replace(/[?!.]+$/, '').trim();
    if (
      !cleanFile.startsWith('http') &&
      !cleanFile.includes('youtube') &&
      !cleanFile.includes('google')
    ) {
      await runPcOpenFile(cleanFile);
      return true;
    }
  }

  // 8. Mở Folder / Thư mục (Desktop, Downloads, Documents,...)
  const folderMatch = userText.match(
    /(?:mở|mo|open)\s+(?:t\s+|tớ\s+|cho tớ\s+|cho t\s+|giúp\s+|hộ\s+)?(?:thư mục|thu muc|folder|directory)\s*(.*)/i
  );
  if (folderMatch) {
    const rawFolder = folderMatch[1]?.trim().toLowerCase() || '';
    let targetPath = folderMatch[1]?.trim() || '.';
    if (rawFolder === 'desktop' || rawFolder === 'màn hình') targetPath = '%USERPROFILE%\\Desktop';
    else if (rawFolder === 'download' || rawFolder === 'downloads' || rawFolder === 'tải về') targetPath = '%USERPROFILE%\\Downloads';
    else if (rawFolder === 'document' || rawFolder === 'documents' || rawFolder === 'tài liệu') targetPath = '%USERPROFILE%\\Documents';
    await runPcOpen(targetPath, folderMatch[1]?.trim() || 'Thư mục');
    return true;
  }

  return false;
}

async function saveSemanticMemory(text: string) {
  if (!isOllamaOnline || text.trim().length < 6) return;
  try {
    const emb = await invoke<number[]>('embed_ollama', {
      model: ollamaModel,
      text: text.trim(),
    });
    if (emb.length > 0) {
      await invoke('memory_save_embedding', { content: text.trim(), embedding: emb });
    }
  } catch {
    // Bỏ qua nếu model không hỗ trợ embeddings
  }
}

async function searchSemanticMemory(query: string): Promise<string[]> {
  if (!isOllamaOnline || query.trim().length < 4) return [];
  try {
    const task = (async () => {
      const emb = await invoke<number[]>('embed_ollama', {
        model: ollamaModel,
        text: query.trim(),
      });
      if (!emb || emb.length === 0) return [] as string[];
      return await invoke<string[]>('memory_search_similar', {
        queryEmbedding: emb,
        topK: 2,
      });
    })();
    const timeout = new Promise<string[]>((resolve) => setTimeout(() => resolve([]), 900));
    return await Promise.race([task, timeout]);
  } catch {
    return [];
  }
}

async function generateDailySummary(ins: MemoryInsights): Promise<string> {
  const appsText =
    ins.top_apps_today.length > 0
      ? ins.top_apps_today
        .map((a) => `${a.app_title} (${Math.max(1, Math.round(a.total_sec / 60))} phút)`)
        .join(', ')
      : 'Chưa có dữ liệu ứng dụng';
  const rulesText =
    ins.profile_facts.length > 0
      ? ins.profile_facts.map((f) => `${f.key}: ${f.value}`).join('; ')
      : 'Chưa có quy tắc';

  let summary = `Hôm nay bạn dùng nhiều nhất: ${appsText}. Đã ghi nhớ ${ins.profile_facts.length} thông tin/quy tắc và ${ins.total_chat_count} lượt tương tác.`;
  if (isOllamaOnline || geminiApiKey.trim()) {
    try {
      const sumSys =
        'Tóm tắt ngắn gọn trong 1-2 câu bằng tiếng Việt có dấu (không emoji) về hoạt động hôm nay của chủ nhân.';
      const res = await askHybridLlm(
        sumSys,
        sumSys,
        [
          {
            role: 'user',
            content: `Ứng dụng hôm nay: ${appsText}. Quy tắc/thông tin: ${rulesText}. Tổng chat: ${ins.total_chat_count}.`,
          },
        ],
        shouldRouteToGemini('', true)
      );
      if (res.reply) summary = res.reply;
    } catch {
      // Dùng summary mặc định
    }
  }
  await invoke('memory_save_daily_summary', { summary }).catch(() => { });
  const summaryEl = document.getElementById('dash-mem-summary');
  if (summaryEl) summaryEl.textContent = summary;
  return summary;
}

let lastToolOutputSummary = '';

/**
 * Bọc lớp điều phối Tool để phát trigger hoạt ảnh (start / success / error)
 * cho Animation Binder mà không chạm vào logic từng tool.
 */
export async function dispatchAiToolCall(toolCall: ToolCallItem): Promise<boolean> {
  const toolName = String(toolCall.tool || '').toLowerCase().trim();
  fireAnimationTrigger('tool', toolName, 'start');
  activeToolAnimDepth++;
  let ok = false;
  try {
    ok = await dispatchAiToolCallInner(toolCall);
  } finally {
    activeToolAnimDepth = Math.max(0, activeToolAnimDepth - 1);
    fireAnimationTrigger('tool', toolName, ok ? 'success' : 'error');
  }
  return ok;
}

async function dispatchAiToolCallInner(toolCall: ToolCallItem): Promise<boolean> {
  const { tool, params } = toolCall;
  const toolName = tool.toLowerCase().trim();

  try {
    switch (toolName) {
      case 'open_file': {
        const filePath = String(params.path || params.file || params.target || '').trim();
        if (filePath) {
          await runPcOpenFile(filePath);
          return true;
        }
        break;
      }
      case 'open_app': {
        const rawTarget = String(params.target || params.app || params.url || '').trim();
        if (rawTarget) {
          const resolved = resolveToolTarget(rawTarget);
          const label = params.label || resolved.label;
          await runPcOpen(resolved.target, label);
          return true;
        }
        break;
      }
      case 'open_folder': {
        const rawFolder = String(params.path || params.folder || '').trim().toLowerCase();
        let target = params.path || '.';
        let label = 'Thư mục';
        if (['desktop', 'màn hình'].includes(rawFolder)) {
          target = '%USERPROFILE%\\Desktop';
          label = 'Desktop';
        } else if (['download', 'downloads', 'tải về'].includes(rawFolder)) {
          target = '%USERPROFILE%\\Downloads';
          label = 'Downloads';
        } else if (['document', 'documents', 'tài liệu'].includes(rawFolder)) {
          target = '%USERPROFILE%\\Documents';
          label = 'Documents';
        }
        await runPcOpen(target, label);
        return true;
      }
      case 'control_window': {
        const action = String(params.action || '').toLowerCase().trim();
        if (action === 'shrink') startPhysicalResize('shrink');
        else if (action === 'expand') startPhysicalResize('expand');
        else if (action === 'push_left') startPhysicalPush(-1);
        else if (action === 'push_right') startPhysicalPush(1);
        else if (action === 'minimize') await performWindowAction('minimize');
        else if (action === 'maximize') await performWindowAction('maximize');
        else if (action === 'center') await arrangeDesktopWindows('center');
        else if (action === 'split_2') await arrangeDesktopWindows('split_2');
        else if (action === 'grid') await arrangeDesktopWindows('grid');
        else if (action === 'cascade') await arrangeDesktopWindows('cascade');
        else if (action === 'climb') triggerClimbWindow();
        else if (action === 'swing' || action === 'window_swing') triggerWindowSwing();
        else if (action === 'explore') await triggerExploreInsideWindow();
        else if (action === 'interact') await triggerInteractInsideWindow();
        return true;
      }
      case 'swim': {
        const action = String(params.action || 'start').toLowerCase().trim();
        if (action === 'stop' || action === 'end' || action === 'shore') {
          triggerStopSwimming(true);
        } else {
          triggerStartSwimming(true);
        }
        return true;
      }
      case 'character_action': {
        const action = String(
          params.action ||
          params.target ||
          params.type ||
          (params.raw && params.raw.match(/action["':\s]+([a-zA-Z0-9_]+)/i)?.[1]) ||
          ''
        ).toLowerCase().trim();
        if (action === 'dance') {
          if (danceCb) danceCb();
          else triggerBackflip();
        } else if (action === 'backflip' || action === 'flip') {
          triggerBackflip();
        } else if (action === 'spin') {
          triggerSpin();
        } else if (action === 'wheel_roll' || action === 'roll') {
          await triggerDuckWheelRoll();
        } else if (action === 'radar' || action === 'scan') {
          await triggerDuckRadarScan();
        } else if (action === 'sleep') {
          await triggerDuckSleepMode();
        } else if (action === 'blackhole' || action === 'teleport' || action === 'warp') {
          triggerBlackHoleTeleport();
        } else if (action === 'feed' || action === 'eat') {
          triggerSpawnRandomFood(true);
        } else if (action === 'jump_window' || action === 'jump') {
          triggerJumpToWindow();
        } else if (action === 'climb') {
          triggerClimbWindow();
        } else if (action === 'swing' || action === 'window_swing') {
          triggerWindowSwing();
        } else if (action === 'paper_crash' || action === 'crash_window') {
          triggerWindowPaperCrash();
        } else if (action === 'hulk' || action === 'hulk_rage') {
          triggerHulkRageMode();
        } else if (action === 'switch_duck') {
          await clearCachedVrm();
          createMicroDuckCharacter();
          spawnParticles(appState.posX, appState.posY - 90, 14, 0x76b900);
        } else if (action === 'switch_idol') {
          await clearCachedVrm();
          createDetailedAnimeCharacter();
          spawnParticles(appState.posX, appState.posY - 90, 10, 0x38bdf8);
        } else if (action === 'random' || action === 'ngau_nhien' || action === 'random_clip') {
          const picked = playRandomClipFromDeck();
          appState.setExpression('happy', picked.defaultDuration + 0.4);
        } else {
          const clipAliases: Record<string, string> = {
            salute: 'cyber_salute',
            cyber_salute: 'cyber_salute',
            gym: 'gym_pump',
            gym_pump: 'gym_pump',
            saiyan: 'super_saiyan_charge',
            super_saiyan_charge: 'super_saiyan_charge',
            photo: 'paparazzi_pose',
            paparazzi_pose: 'paparazzi_pose',
            hologram: 'hologram_code',
            hologram_code: 'hologram_code',
            love: 'love_serenade',
            love_serenade: 'love_serenade',
            celebrate: 'celebrate_backhop',
            celebrate_backhop: 'celebrate_backhop',
            flop: 'dramatic_flop',
            dramatic_flop: 'dramatic_flop',
            read: 'reading_study',
            books: 'reading_study',
            reading_study: 'reading_study',
            pipe: 'pipe_ponder',
            pipe_ponder: 'pipe_ponder',
            coffee: 'coffee_sip',
            coffee_sip: 'coffee_sip',
            royal: 'royal_parade',
            parade: 'royal_parade',
            royal_parade: 'royal_parade',
            thinking: 'ai_thinking_orbit',
            ai_thinking_orbit: 'ai_thinking_orbit',
            flutter: 'wing_flutter_joy',
            wing_flutter_joy: 'wing_flutter_joy',
            bow: 'polite_bow',
            nod: 'nod',
            shake: 'head_shake',
            think: 'think',
            typing: 'typing',
            idea: 'eureka_idea',
            eureka: 'eureka_idea',
            detective: 'detective_scan',
            guard: 'focus_guard',
            focus: 'focus_guard',
            dizzy: 'dizzy_spin',
            poke: 'poke_giggle',
            explain: 'chat_explain',
            groove: 'groove',
            cheer: 'cheer',
            victory: 'victory',
            stalk: 'stalking_crouch',
            wake: 'wake_stretch',
            stretch: 'stretch',
            levitate: 'levitate',
            chomp: 'chomp',
            sneeze: 'sneeze',
            shiver: 'shiver',
            facepalm: 'facepalm',
            jelly: 'jelly',
            twirl: 'twirl',
            hop: 'hop',
          };
          const resolvedClip = clipAliases[action] || (getClipById(action) ? action : '');
          if (resolvedClip) {
            previewClip(resolvedClip);
          } else {
            playRandomClipFromDeck();
          }
        }
        return true;
      }
      case 'telemetry': {
        const type = String(
          params.type ||
          params.target ||
          params.action ||
          (params.raw && params.raw.match(/type["':\s]+([a-zA-Z0-9_]+)/i)?.[1]) ||
          ''
        ).toLowerCase().trim();
        if (type === 'hardware' || type === 'cpu' || type === 'ram') {
          const hw = await runHardwareCheck(false);
          showTelemetrySection('hw');
          pushDashboardAlert(hw);
          lastToolOutputSummary = hw;
        } else if (type === 'network' || type === 'ping' || type === 'wifi') {
          const net = await runNetworkCheck(false);
          showTelemetrySection('net');
          pushDashboardAlert(net);
          lastToolOutputSummary = net;
        } else if (type === 'app_metrics' || type === 'metrics' || type === 'app') {
          const am = await runCheckAppMetrics(false);
          showTelemetrySection('app_metrics');
          pushDashboardAlert(am);
          lastToolOutputSummary = am;
        } else if (type === 'bitcoin' || type === 'btc' || type === 'coin') {
          const btc = await runBitcoinCheck(false);
          showTelemetrySection('btc');
          pushDashboardAlert(btc);
          lastToolOutputSummary = btc;
        } else if (type === 'weather') {
          const wt = await runWeatherCheck(params.city, false);
          pushDashboardAlert(wt);
          lastToolOutputSummary = wt;
        }
        return true;
      }
      case 'hardware': {
        const action = String(
          params.action ||
          params.target ||
          params.type ||
          (params.raw && params.raw.match(/action["':\s]+([a-zA-Z0-9_]+)/i)?.[1]) ||
          ''
        ).toLowerCase().trim();
        if (action === 'clean_ram') {
          lastToolOutputSummary = await runHardwareAction('clean_ram', false);
        } else if (action === 'brightness_up') {
          lastToolOutputSummary = await runHardwareAction('brightness_up', false);
        } else if (action === 'brightness_down') {
          lastToolOutputSummary = await runHardwareAction('brightness_down', false);
        } else if (action === 'taskmgr') {
          lastToolOutputSummary = await runHardwareAction('taskmgr', false);
        } else if (action === 'lock_screen' || action === 'lock') {
          await invoke('lock_pc_screen').catch(() => { });
          lastToolOutputSummary = 'Đã khóa màn hình Windows.';
        }
        return true;
      }
      case 'media': {
        const rawAct = String(
          params.action ||
          params.target ||
          params.type ||
          (params.raw && params.raw.match(/action["':\s]+([a-zA-Z0-9_]+)/i)?.[1]) ||
          ''
        ).toLowerCase().trim();
        const mediaAlias: Record<string, 'vol_up' | 'vol_down' | 'mute' | 'play_pause' | 'next' | 'prev'> = {
          vol_up: 'vol_up',
          up: 'vol_up',
          volume_up: 'vol_up',
          vol_down: 'vol_down',
          down: 'vol_down',
          volume_down: 'vol_down',
          mute: 'mute',
          play_pause: 'play_pause',
          play: 'play_pause',
          pause: 'play_pause',
          next: 'next',
          prev: 'prev',
          previous: 'prev',
        };
        const mapped = mediaAlias[rawAct];
        if (mapped) {
          await runPcMedia(mapped);
          return true;
        }
        break;
      }
      case 'vision': {
        await runGeminiVisionScreen(String(params.query || ''));
        return true;
      }
      case 'screenshot':
      case 'ocr': {
        const mode = String(
          params.mode ||
          params.action ||
          params.type ||
          (toolName === 'ocr' ? 'ocr' : 'capture')
        ).toLowerCase().trim();
        if (mode === 'ocr' || mode === 'read') {
          lastToolOutputSummary = await runOcrAndSummarize(true);
        } else if (mode === 'open') {
          await runOpenLatestScreenshot(false);
          lastToolOutputSummary = 'Đã mở ảnh chụp màn hình gần nhất.';
        } else {
          lastToolOutputSummary = await runPcScreenshot();
        }
        return true;
      }
      case 'timer':
      case 'reminder': {
        const act = String(params.action || '').toLowerCase().trim();
        if (act === 'stop' || act === 'cancel' || act === 'off') {
          lastToolOutputSummary = stopCustomTimer();
          return true;
        }
        let mins = Number(params.minutes ?? params.mins ?? params.duration ?? params.time ?? 0);
        if (!Number.isFinite(mins) || mins <= 0) {
          const secs = Number(params.seconds ?? params.sec ?? 0);
          mins = secs > 0 ? secs / 60 : 5;
        }
        const taskNote = String(params.task || params.note || params.label || params.message || 'Hẹn giờ').trim();
        lastToolOutputSummary = startCustomTimer(mins, taskNote);
        return true;
      }
      case 'process':
      case 'process_manager': {
        const rawAct = String(
          params.action ||
          params.type ||
          (params.raw && params.raw.match(/action["':\s]+([a-zA-Z0-9_]+)/i)?.[1]) ||
          'top'
        ).toLowerCase().trim();
        const act: 'top' | 'kill' =
          rawAct === 'kill' || rawAct === 'close' || rawAct === 'stop' ? 'kill' : 'top';
        const target = String(params.target || params.name || params.app || '').trim();
        lastToolOutputSummary = await runProcessManager(act, target, false);
        return true;
      }
      case 'web_search':
      case 'search': {
        const engine = String(params.engine || params.site || 'google').trim();
        const query = String(params.query || params.q || params.keyword || params.target || '').trim();
        lastToolOutputSummary = await runSmartWebSearch(engine, query, true);
        return true;
      }
      case 'sticky_note':
      case 'note': {
        const act = String(params.action || params.type || 'pin').toLowerCase().trim();
        if (act === 'clear' || act === 'delete' || act === 'reset') {
          lastToolOutputSummary = await clearStickyNotes();
          return true;
        }
        const noteText = String(params.text || params.content || params.note || params.target || '').trim();
        const saveDesktop =
          act === 'save_desktop' || act === 'save' || act === 'desktop' || Boolean(params.save_desktop);
        const scheduleTime = String(params.time || params.schedule_time || '').trim();
        const repeatDaily = Boolean(params.daily ?? params.repeat_daily);
        if (noteText) {
          lastToolOutputSummary = await pinStickyNote(noteText, saveDesktop, scheduleTime, repeatDaily);
          return true;
        }
        toggleStickyNotesWidget(true);
        lastToolOutputSummary = 'Đã mở bảng Ghi chú & Lịch hẹn trên màn hình.';
        return true;
      }
      case 'clipboard': {
        const actRaw = String(params.action || params.type || 'read').toLowerCase().trim();
        const clipAction: 'read' | 'summarize' | 'translate' | 'copy' =
          actRaw === 'copy' || actRaw === 'write' || actRaw === 'set'
            ? 'copy'
            : actRaw === 'summarize' || actRaw === 'summary'
              ? 'summarize'
              : actRaw === 'translate'
                ? 'translate'
                : 'read';
        const clipText = String(params.text || params.content || '').trim();
        lastToolOutputSummary = await runClipboardTool(clipAction, clipText, false);
        return true;
      }
      case 'system_control':
      case 'system': {
        const act = String(
          params.action ||
          params.type ||
          (params.raw && params.raw.match(/action["':\s]+([a-zA-Z0-9_]+)/i)?.[1]) ||
          ''
        ).toLowerCase().trim();
        const param = String(params.param || params.target || params.minutes || '').trim();
        if (act) {
          lastToolOutputSummary = await runDeepSystemControl(act, param, false);
          return true;
        }
        break;
      }
      case 'workspace':
      case 'briefing':
      case 'db_support': {
        const act = String(params.action || 'briefing').toLowerCase().trim();
        lastToolOutputSummary = await runSmartDbSupportBriefing(
          act === 'restore' || act === 'launch' || act === 'open'
        );
        return true;
      }
      case 'desktop_icon': {
        const action = String(
          params.action ||
          (params.raw && params.raw.match(/action["':\s]+([a-zA-Z0-9_]+)/i)?.[1]) ||
          'drag'
        ).toLowerCase().trim();
        if (action === 'circle' || action === 'grid' || action === 'restore') {
          return await arrangeDesktopIcons(action);
        }
        const iconName = String(
          params.name ||
          params.target ||
          (params.raw && params.raw.match(/name["':\s]+([^,}]+)/i)?.[1]) ||
          ''
        ).trim();
        return await startDragDesktopIcon(iconName);
      }
      case 'accessory': {
        const accType = String(
          params.type ||
          params.target ||
          params.action ||
          (params.raw && params.raw.match(/type["':\s]+([a-zA-Z0-9_]+)/i)?.[1]) ||
          'random'
        ).toLowerCase().trim() as AccessoryType | 'random';
        clearTemporaryAccessoryTimer();
        equipAccessory3D(accType, true);
        return true;
      }
      case 'goose_mode': {
        triggerGooseMischiefMode(true);
        return true;
      }
      case 'beat_dance': {
        triggerManualBeatDance();
        return true;
      }
      case 'port_manager':
      case 'port': {
        const actRaw = String(params.action || 'list').toLowerCase().trim();
        const act: 'list' | 'kill' = actRaw === 'kill' || actRaw === 'close' ? 'kill' : 'list';
        const portNum = Number(params.port ?? params.target ?? 0) || undefined;
        lastToolOutputSummary = await runPortManager(act, portNum, false);
        return true;
      }
      case 'git_status':
      case 'git': {
        const dirPath = String(params.path || '').trim();
        lastToolOutputSummary = await runGitStatusCheck(dirPath, false);
        return true;
      }
      case 'clipboard_history': {
        const act = String(params.action || 'list').toLowerCase().trim();
        if (act === 'clear') {
          await invoke('clipboard_history_clear').catch(() => { });
          lastToolOutputSummary = 'Đã xóa lịch sử Clipboard trong SQLite.';
        } else {
          lastToolOutputSummary = await runClipboardHistoryCheck(false);
        }
        return true;
      }
      case 'macro':
      case 'routine': {
        const act = String(params.action || 'run').toLowerCase().trim();
        const name = String(params.name || params.target || '').trim();
        if (act === 'create' || act === 'add') {
          const cmds = String(params.commands || params.actions || '').trim();
          lastToolOutputSummary = await createCustomMacroFromText(name, cmds);
        } else if (act === 'list') {
          lastToolOutputSummary = await runMacroRoutine('list', false);
        } else {
          lastToolOutputSummary = await runMacroRoutine(name || 'list', false);
        }
        return true;
      }
      case 'weather_3d':
      case 'weather': {
        const rawMode = String(params.mode || params.type || 'auto').toLowerCase().trim();
        const city = params.city ? String(params.city).trim() : undefined;
        const validModes = ['auto', 'clear', 'rain', 'hot', 'cold', 'wind', 'night'];
        const mode = (validModes.includes(rawMode) ? rawMode : 'auto') as WeatherEffectMode | 'auto';
        lastToolOutputSummary = await syncLiveWeather3D(mode, true, city);
        return true;
      }
      case 'tarot': {
        toggleTarotModal(true);
        lastToolOutputSummary = 'Đã mở bàn trải bài Tarot & Tử Vi 6H.';
        return true;
      }
      case 'mini_screen': {
        toggleMiniScreenPanel(true, 'web');
        lastToolOutputSummary = 'Đã mở Màn Hình Mini (PiP).';
        return true;
      }
      case 'news':
      case 'read_news': {
        const src = String(params.source || params.url || '').trim();
        lastToolOutputSummary = await loadAndSpeakLiveNews(src || undefined, true);
        return true;
      }
      case 'english':
      case 'learn_english': {
        const act = String(params.action || 'learn').toLowerCase().trim();
        const topic = params.topic ? String(params.topic).trim() : undefined;
        const word = params.word || params.query || params.target ? String(params.word || params.query || params.target).trim() : undefined;
        if (act === 'open_coach' || act === 'coach' || act === 'flashcard' || act === 'lookup' || act === 'search' || act === 'speak' || act === 'srs') {
          window.dispatchEvent(
            new CustomEvent('duck-open-english-coach', {
              detail: {
                tab: act === 'speak' ? 'speak' : act === 'srs' ? 'srs' : 'learn',
                wordQuery: word,
              },
            })
          );
          lastToolOutputSummary = word
            ? `Đã mở Duck English Coach và tra từ "${word}".`
            : 'Đã mở Duck English Coach Studio 4 Tab.';
        } else if (act === 'quiz' || act === 'test') {
          lastToolOutputSummary = await runEnglishMiniQuiz();
        } else {
          lastToolOutputSummary = await loadNextEnglishLesson(topic, true);
        }
        return true;
      }
      case 'random_fx':
      case 'random_effect': {
        lastToolOutputSummary = await triggerRandomFeatureOrEffect(true);
        return true;
      }
      case 'edge_peek':
      case 'focus_mode': {
        const act = String(params.action || 'toggle').toLowerCase().trim();
        const force = act === 'on' || act === 'start' || act === 'enable'
          ? true
          : act === 'off' || act === 'stop' || act === 'disable'
            ? false
            : undefined;
        lastToolOutputSummary = toggleEdgePeekMode(force);
        return true;
      }
      case 'custom_skill': {
        const skillId = String(params.id || params.skill_id || '').trim();
        const rawArgs: Record<string, unknown> =
          params.args && typeof params.args === 'object'
            ? { ...(params.args as Record<string, unknown>) }
            : {};
        const primaryPinned = getPrimaryPinnedFile();
        if (primaryPinned?.filePath) {
          for (const key of Object.keys(rawArgs)) {
            const kLow = key.toLowerCase();
            if (
              (kLow.includes('path') || kLow.includes('file')) &&
              typeof rawArgs[key] === 'string' &&
              !String(rawArgs[key]).trim()
            ) {
              rawArgs[key] = primaryPinned.filePath;
            }
          }
        }
        if (skillId) {
          const skillDef = getCachedCustomSkills().find((s) => s.id === skillId);
          if (skillDef && isSendChatSkill(skillDef)) {
            const lastUserMsg =
              [...chatHistory].reverse().find((m) => m.role === 'user')?.content || '';
            const unsafeReason = validateSendChatSkillArgs(lastUserMsg, rawArgs);
            if (unsafeReason) {
              lastToolOutputSummary = `[AN TOÀN] ${unsafeReason}`;
              return true;
            }
          }
          lastToolOutputSummary = await executeSavedSkillWithSelfHeal(
            skillId,
            rawArgs,
            (msg) => setStreamSpeechText(msg)
          );
          return true;
        }
        break;
      }
      case 'pack_skill': {
        const targetTool = String(params.tool || params.name || params.id || '').trim();
        const rawArgsObj =
          params.args && typeof params.args === 'object'
            ? (params.args as Record<string, unknown>)
            : {};
        if (targetTool) {
          const lastUserMsg =
            [...chatHistory].reverse().find((m) => m.role === 'user')?.content || '';
          const needsClearScreen =
            /zalo|screen|capture|screenshot|mouse|keyboard|uia|window|ocr|click|desktop|vision|snip/i.test(
              targetTool
            );
          setStreamSpeechText(`[PACK SKILL] Đang thực thi ${targetTool}...`);
          if (needsClearScreen) {
            window.dispatchEvent(new CustomEvent('duck-overlay-temp-hide', { detail: { hide: true } }));
            await new Promise((r) => setTimeout(r, 120));
          }
          let res: PackExecResult;
          try {
            res = await invoke<PackExecResult>('pack_execute_skill', {
              toolName: targetTool,
              argsJson: JSON.stringify(rawArgsObj),
              userQuery: lastUserMsg || null,
            });
          } finally {
            if (needsClearScreen) {
              window.dispatchEvent(new CustomEvent('duck-overlay-temp-hide', { detail: { hide: false } }));
            }
          }
          executedToolsThisTurn.push(res.tool_name);
          const basePrefix = res.tool_name.split('__')[0] || res.tool_name;
          richTraceThisTurn.push({
            tool: res.tool_name,
            pack: res.pack || 'auto_skills',
            module_name: basePrefix.startsWith('skill_') ? basePrefix : `skill_${basePrefix}`,
            args: rawArgsObj,
            ok: res.ok,
            elapsed_ms: res.duration_ms,
            mem_ref: res.mem_ref || undefined,
            error: res.ok ? undefined : res.error,
            created_files: res.created_files,
          });
          for (const fp of res.created_files || []) {
            if (/\.(png|jpg|jpeg|webp|gif|svg)$/i.test(fp) && !createdImagesThisTurn.includes(fp)) {
              createdImagesThisTurn.push(fp);
            }
          }
          lastToolOutputSummary = res.summary_text;
          return true;
        }
        break;
      }
      case 'pack_pipeline': {
        const rawSteps = Array.isArray(params.steps) ? params.steps : [];
        if (rawSteps.length > 0) {
          const lastUserMsg =
            [...chatHistory].reverse().find((m) => m.role === 'user')?.content || '';
          const mappedSteps = rawSteps.map((st: Record<string, unknown>) => ({
            tool: String(st.tool || st.name || ''),
            args_json:
              typeof st.args_json === 'string'
                ? st.args_json
                : JSON.stringify(st.args || {}),
            save_as: String(st.save_as || ''),
          }));
          const needsClearScreen = mappedSteps.some((st) =>
            /zalo|screen|capture|screenshot|mouse|keyboard|uia|window|ocr|click|desktop|vision|snip/i.test(
              st.tool
            )
          );
          setStreamSpeechText(`[PACK PIPELINE] Đang chạy chuỗi ${mappedSteps.length} bước ($mem_N)...`);
          if (needsClearScreen) {
            window.dispatchEvent(new CustomEvent('duck-overlay-temp-hide', { detail: { hide: true } }));
            await new Promise((r) => setTimeout(r, 120));
          }
          let results: PackExecResult[];
          try {
            results = await invoke<PackExecResult[]>('pack_execute_pipeline', {
              steps: mappedSteps,
              userQuery: lastUserMsg || null,
            });
          } finally {
            if (needsClearScreen) {
              window.dispatchEvent(new CustomEvent('duck-overlay-temp-hide', { detail: { hide: false } }));
            }
          }
          for (const r of results) {
            executedToolsThisTurn.push(r.tool_name);
            const basePrefix = r.tool_name.split('__')[0] || r.tool_name;
            richTraceThisTurn.push({
              tool: r.tool_name,
              pack: r.pack || 'auto_skills',
              module_name: basePrefix.startsWith('skill_') ? basePrefix : `skill_${basePrefix}`,
              args: {},
              ok: r.ok,
              elapsed_ms: r.duration_ms,
              mem_ref: r.mem_ref || undefined,
              error: r.ok ? undefined : r.error,
              created_files: r.created_files,
            });
            for (const fp of r.created_files || []) {
              if (/\.(png|jpg|jpeg|webp|gif|svg)$/i.test(fp) && !createdImagesThisTurn.includes(fp)) {
                createdImagesThisTurn.push(fp);
              }
            }
          }
          lastToolOutputSummary = results.map((r) => r.summary_text).join('\n');
          return true;
        }
        break;
      }
      case 'discover_tools': {
        const q = String(params.query || params.q || '').trim();
        if (q) {
          const routed = await invoke<PackRouteResult>('pack_route_skills', {
            query: q,
            topK: Number(params.top_k || 5) || 5,
          });
          lastToolOutputSummary = `[DISCOVER TOOLS] Đã mở khóa ${routed.routed.length} tools: ${routed.routed
            .map((t) => `${t.tool_name} (${t.pack})`)
            .join(', ')}`;
          return true;
        }
        break;
      }
      case 'forge_tool': {
        const reqText = String(params.request || params.description || params.prompt || '').trim();
        if (reqText) {
          window.dispatchEvent(
            new CustomEvent('duck-open-tool-forge', { detail: { generatingRequest: reqText } })
          );
          const draft = await forgeNewToolFromRequest(reqText, 'auto', (line) => {
            setStreamSpeechText(line);
          });
          window.dispatchEvent(new CustomEvent('duck-open-tool-forge', { detail: { draft } }));
          if (draft.sandbox?.verified) {
            lastToolOutputSummary = `[TOOL FORGE PASS] Gemini đã viết skill "${draft.name}" và kiểm nghiệm Sandbox thành công (${draft.sandbox.duration_ms}ms). Hãy bấm "Xác Nhận & Đóng Gói Skill" trong Xưởng Skill để lưu cho Local LLM!`;
          } else {
            lastToolOutputSummary = `[TOOL FORGE] Đã mở Xưởng Skill cho "${draft.name}" nhưng Sandbox chưa pass (${draft.sandbox?.failure_reason || 'Cần kiểm tra'}). Chưa đóng gói cho tới khi kiểm chứng đạt.`;
          }
          return true;
        }
        break;
      }
      case 'agent_task':
      case 'automate': {
        const goalText = String(params.goal || params.task || params.request || '').trim();
        if (goalText) {
          lastToolOutputSummary = await runDesktopAgentGoal(goalText);
          speak(lastToolOutputSummary);
          return true;
        }
        break;
      }
    }
  } catch (err) {
    console.error('[DISPATCH_TOOL_ERROR]', toolName, err);
  }
  return false;
}

export async function runDesktopAgentGoal(
  goalText: string,
  onProgress?: (txt: string) => void
): Promise<string> {
  const res = await runMultiStepDesktopAgent(goalText, {
    getGeminiKey: () => geminiApiKey,
    getGeminiModel: () => geminiModel,
    getOllamaModel: () => ollamaModel,
    isOllamaOnline: () => isOllamaOnline,
    isColabOnline: () => colabCloudOnline,
    getColabUrl: () => colabCloudUrl,
    getColabModel: () => colabCloudModel,
    onProgress: (txt) => {
      setStreamSpeechText(txt);
      onProgress?.(txt);
    },
  });
  lastToolOutputSummary = res;
  return res;
}

export async function executeChainedHeuristicCommands(userText: string): Promise<boolean> {
  const clauseDelimiters = /(?:\s+(?:rồi|sau đó|tiếp theo|đồng thời|với lại|và rồi|then|and then)\s+|\s*;\s*)/i;
  if (!clauseDelimiters.test(userText)) {
    return false;
  }
  const rawClauses = userText.split(clauseDelimiters).map((s) => s.trim()).filter((s) => s.length > 1);
  if (rawClauses.length <= 1) {
    return false;
  }

  let anyHandled = false;
  for (let i = 0; i < rawClauses.length; i++) {
    const clause = rawClauses[i];
    const handled = await fallbackHeuristicCommandHandler(clause, false);
    if (handled) {
      anyHandled = true;
      if (i < rawClauses.length - 1) {
        await new Promise((r) => setTimeout(r, 1350));
      }
    }
  }
  return anyHandled;
}

export async function fallbackHeuristicCommandHandler(
  userText: string,
  allowChaining = true
): Promise<boolean> {
  if (allowChaining) {
    const chained = await executeChainedHeuristicCommands(userText);
    if (chained) return true;
  }

  const lower = userText.toLowerCase();

  if (
    lower.includes('trí nhớ') ||
    lower.includes('tri nho') ||
    lower.includes('bộ nhớ') ||
    lower.includes('thói quen') ||
    lower.includes('thoi quen') ||
    lower.includes('đánh giá hôm nay') ||
    lower.includes('tổng kết ngày')
  ) {
    const ins = await runMemoryCheck(true);
    if (ins && (lower.includes('đánh giá hôm nay') || lower.includes('tổng kết ngày'))) {
      const sum = await generateDailySummary(ins);
      speak(`[TỔNG KẾT NGÀY] ${sum}`);
      pushChatHistory('assistant', sum);
    } else {
      pushChatHistory('assistant', 'Đã hiển thị trí nhớ & thói quen học được trên bảng trái.');
    }
    return true;
  }

  if (
    lower.includes('hay nghe') ||
    lower.includes('kênh youtube') ||
    lower.includes('kenh youtube') ||
    lower.includes('hay xem') ||
    lower.includes('trang hay vào') ||
    lower.includes('trang web hay') ||
    lower.includes('lịch sử web') ||
    lower.includes('gợi ý nhạc') ||
    lower.includes('theo dõi trình duyệt')
  ) {
    recordLearnedCommand('Xem lịch sử trình duyệt');
    await runBrowserHistoryCheck(true);
    pushChatHistory('assistant', 'Đã kiểm tra thói quen trình duyệt & kênh YouTube hay xem.');
    return true;
  }

  if (
    lower.includes('microduck') ||
    lower.includes('con vịt') ||
    lower.includes('nhân vật vịt') ||
    lower.includes('đổi sang vịt') ||
    lower.includes('doi sang vit') ||
    lower.includes('bdx')
  ) {
    recordLearnedCommand('Đổi NVIDIA MicroDuck');
    await clearCachedVrm();
    createMicroDuckCharacter();
    spawnParticles(appState.posX, appState.posY - 90, 14, 0x76b900);
    const reply = 'Quạc quạc! Tớ đã biến hình thành NVIDIA MicroDuck (BDX Droid 3D) rồi đây!';
    speak(reply);
    pushChatHistory('assistant', reply);
    return true;
  }
  if (
    lower.includes('cyber idol') ||
    lower.includes('nhân vật nữ') ||
    lower.includes('đổi về idol') ||
    lower.includes('doi ve idol')
  ) {
    recordLearnedCommand('Đổi Cyber Idol');
    await clearCachedVrm();
    createDetailedAnimeCharacter();
    spawnParticles(appState.posX, appState.posY - 90, 10, 0x38bdf8);
    const reply = 'Đã chuyển về nhân vật Cyber Idol 3D!';
    speak(reply);
    pushChatHistory('assistant', reply);
    return true;
  }
  if (lower.includes('lộn nhào') || lower.includes('lon nhao') || lower.includes('backflip') || lower.includes('nhào lộn')) {
    recordLearnedCommand('Lộn nhào Backflip');
    triggerBackflip();
    pushChatHistory('assistant', 'Đã thực hiện cú lộn nhào Backflip.');
    return true;
  }
  if (lower.includes('xoay vòng') || lower.includes('xoay tít') || lower.includes('xoay tit') || lower === 'spin') {
    recordLearnedCommand('Xoay vòng Spin');
    triggerSpin();
    pushChatHistory('assistant', 'Đã xoay vòng tròn tốc độ cao.');
    return true;
  }
  if (
    lower.includes('bánh xe') ||
    lower.includes('banh xe') ||
    lower.includes('gập người') ||
    lower.includes('gap nguoi') ||
    lower.includes('lướt xe') ||
    lower.includes('luot xe') ||
    lower.includes('đi nhanh') ||
    lower.includes('di nhanh')
  ) {
    recordLearnedCommand('Gập Lướt Bánh Xe');
    await triggerDuckWheelRoll();
    pushChatHistory('assistant', 'Đã bật chế độ MicroDuck gập người lướt bánh xe.');
    return true;
  }
  if (lower.includes('radar') || lower.includes('quét radar') || lower.includes('quet radar')) {
    recordLearnedCommand('Quét Radar 360');
    await triggerDuckRadarScan();
    pushChatHistory('assistant', 'MicroDuck đã kích hoạt chế độ Radar quét môi trường.');
    return true;
  }
  if (
    lower.includes('ngủ đi') ||
    lower.includes('ngu di') ||
    lower.includes('ngủ đông') ||
    lower.includes('sleep') ||
    lower.includes('nghi ngoi')
  ) {
    recordLearnedCommand('Ngủ đông');
    await triggerDuckSleepMode();
    pushChatHistory('assistant', 'MicroDuck đã vào chế độ ngủ đông.');
    return true;
  }
  if (
    lower.includes('đi bơi') ||
    lower.includes('di boi') ||
    lower.includes('bơi lội') ||
    lower.includes('boi loi') ||
    lower.includes('bơi đi') ||
    lower.includes('boi di') ||
    lower.includes('hồ bơi') ||
    lower.includes('ho boi') ||
    lower.includes('tắm biển') ||
    lower.includes('tam bien') ||
    lower.includes('swimming') ||
    lower.includes('swim')
  ) {
    recordLearnedCommand('Đi Bơi Hồ 3D');
    triggerStartSwimming(true);
    pushChatHistory('assistant', 'Đã tạo bản đồ hồ bơi 3D, MicroDuck đang nhảy xuống nước bơi sải ra xa giải nhiệt.');
    return true;
  }
  if (
    lower.includes('lên bờ') ||
    lower.includes('len bo') ||
    lower.includes('dừng bơi') ||
    lower.includes('dung boi') ||
    lower.includes('thôi bơi') ||
    lower.includes('thoi boi') ||
    lower.includes('stop swim')
  ) {
    recordLearnedCommand('Lên bờ dừng bơi');
    triggerStopSwimming(true);
    pushChatHistory('assistant', 'MicroDuck đã bơi vào bờ và rũ lông khô ráo.');
    return true;
  }
  if (
    lower.includes('xem màn hình') ||
    lower.includes('xem man hinh') ||
    lower.includes('nhìn màn hình') ||
    lower.includes('gemini vision') ||
    lower.includes('màn hình đang có gì') ||
    lower.includes('trên màn hình đang có gì') ||
    lower.includes('màn hình đang làm gì')
  ) {
    recordLearnedCommand('Gemini Vision Màn hình');
    await runGeminiVisionScreen(userText);
    return true;
  }

  if (
    lower.includes('cắt vùng ocr') ||
    lower.includes('cat vung ocr') ||
    lower.includes('ocr vùng') ||
    lower.includes('ocr vung') ||
    lower.includes('cắt màn hình dịch') ||
    lower.includes('cat man hinh dich') ||
    lower.includes('dịch vùng') ||
    lower.includes('dich vung') ||
    lower.includes('ocr dịch') ||
    lower.includes('ocr dich')
  ) {
    recordLearnedCommand('OCR Cắt Vùng & Dịch Thuật');
    window.dispatchEvent(new CustomEvent('duck-start-ocr-snip'));
    pushChatHistory('assistant', 'Đang mở chế độ kéo cắt vùng màn hình để OCR & dịch thuật.');
    return true;
  }

  if (
    lower.includes('điều khiển máy tính') ||
    lower.includes('dieu khien may tinh') ||
    lower.includes('bảng máy tính') ||
    lower.includes('bang may tinh')
  ) {
    recordLearnedCommand('Mở Dialog Điều Khiển Máy Tính');
    window.dispatchEvent(new CustomEvent('duck-open-pc-control'));
    pushChatHistory('assistant', 'Đã mở hộp thoại Điều khiển Máy tính & Google.');
    return true;
  }

  if (
    lower.includes('đâm thủng cửa sổ') ||
    lower.includes('dam thung cua so') ||
    lower.includes('đâm xuyên cửa sổ') ||
    lower.includes('dam xuyen cua so') ||
    lower.includes('thủng trang giấy') ||
    lower.includes('thung trang giay')
  ) {
    recordLearnedCommand('Đâm thủng cửa sổ trang giấy');
    const crashMsg = triggerWindowPaperCrash();
    pushChatHistory('assistant', crashMsg);
    return true;
  }

  if (
    lower.includes('hóa hulk') ||
    lower.includes('hoa hulk') ||
    lower.includes('hulk xanh') ||
    lower.includes('khổng lồ xanh') ||
    lower.includes('khong lo xanh')
  ) {
    recordLearnedCommand('Hóa HULK xanh giận dữ');
    const hulkMsg = triggerHulkRageMode();
    pushChatHistory('assistant', hulkMsg);
    return true;
  }

  if (
    lower.includes('đu cửa sổ') ||
    lower.includes('du cua so') ||
    lower.includes('bám cửa sổ') ||
    lower.includes('bam cua so') ||
    lower.includes('dập mông') ||
    lower.includes('dap mong') ||
    lower.includes('ngồi dập mông') ||
    lower.includes('ngoi dap mong') ||
    lower.includes('window swing')
  ) {
    recordLearnedCommand('Đu cửa sổ & Dập mông');
    const swingMsg = triggerWindowSwing();
    pushChatHistory('assistant', swingMsg);
    return true;
  }

  if (
    lower.includes('trèo cửa sổ') ||
    lower.includes('leo cửa sổ') ||
    lower.includes('leo mép') ||
    lower.includes('trèo lên cửa sổ') ||
    lower.includes('leo lên cửa sổ') ||
    lower.includes('trèo mép') ||
    lower.includes('bám mép') ||
    lower.includes('climb window')
  ) {
    recordLearnedCommand('Trèo mép cửa sổ');
    triggerClimbWindow();
    pushChatHistory('assistant', 'Đang tiếp cận và trèo lên mép cửa sổ.');
    return true;
  }

  if (
    lower.includes('chia đôi') ||
    lower.includes('chia doi') ||
    lower.includes('split screen')
  ) {
    recordLearnedCommand('Chia đôi 2 App');
    await arrangeDesktopWindows('split_2');
    pushChatHistory('assistant', 'Đã chia đôi 2 cửa sổ ứng dụng sang trái/phải 50/50.');
    return true;
  }
  if (lower.includes('xếp lưới') || lower.includes('xep luoi') || lower.includes('grid app')) {
    recordLearnedCommand('Xếp lưới App');
    await arrangeDesktopWindows('grid');
    pushChatHistory('assistant', 'Đã xếp các cửa sổ ứng dụng theo dạng lưới gọn gàng.');
    return true;
  }
  if (lower.includes('xếp tầng') || lower.includes('xep tang') || lower.includes('cascade')) {
    recordLearnedCommand('Xếp tầng App');
    await arrangeDesktopWindows('cascade');
    pushChatHistory('assistant', 'Đã xếp các cửa sổ theo tầng Cascade.');
    return true;
  }
  if (lower.includes('căn giữa app') || lower.includes('căn giữa cửa sổ') || lower.includes('can giua app')) {
    recordLearnedCommand('Căn giữa App');
    await arrangeDesktopWindows('center');
    pushChatHistory('assistant', 'Đã căn giữa cửa sổ đang active trên màn hình.');
    return true;
  }
  if (
    lower.includes('sắp xếp app') ||
    lower.includes('sắp xếp cửa sổ') ||
    lower.includes('sap xep app') ||
    lower.includes('sap xep cua so') ||
    lower.includes('sắp xếp lại màn hình') ||
    lower.includes('sap xep lai')
  ) {
    recordLearnedCommand('Sắp xếp Desktop');
    await arrangeDesktopWindows('grid');
    pushChatHistory('assistant', 'Đã tự động sắp xếp lại các cửa sổ ứng dụng trên màn hình desktop.');
    return true;
  }

  if (lower.includes('dọn màn hình') || lower.includes('don man hinh') || lower.includes('thu hết')) {
    recordLearnedCommand('Dọn màn hình');
    await minimizeMultipleWindows();
    pushChatHistory('assistant', 'Đã dọn gọn các cửa sổ trên màn hình.');
    return true;
  }
  if (lower.includes('thu nhỏ') || lower.includes('thu nho') || lower.includes('nhỏ lại')) {
    recordLearnedCommand('Thu nhỏ cửa sổ');
    startPhysicalResize('shrink');
    pushChatHistory('assistant', 'Đã thu nhỏ cửa sổ đang active.');
    return true;
  }
  if (lower.includes('kéo to') || lower.includes('keo to') || lower.includes('phóng to') || lower.includes('to ra')) {
    recordLearnedCommand('Kéo to cửa sổ');
    startPhysicalResize('expand');
    pushChatHistory('assistant', 'Đã kéo to cửa sổ đang active.');
    return true;
  }
  if (lower.includes('đẩy phải') || lower.includes('sang phải') || lower.includes('day phai')) {
    recordLearnedCommand('Đẩy cửa sổ phải');
    startPhysicalPush(1);
    pushChatHistory('assistant', 'Đã đẩy cửa sổ sang phải.');
    return true;
  }
  if (lower.includes('đẩy trái') || lower.includes('sang trái') || lower.includes('day trai')) {
    recordLearnedCommand('Đẩy cửa sổ trái');
    startPhysicalPush(-1);
    pushChatHistory('assistant', 'Đã đẩy cửa sổ sang trái.');
    return true;
  }
  if (lower.includes('hạ xuống') || lower.includes('ẩn cửa sổ') || lower.includes('ha xuong')) {
    recordLearnedCommand('Ẩn cửa sổ');
    await performWindowAction('minimize');
    pushChatHistory('assistant', 'Đã hạ cửa sổ đang active xuống.');
    return true;
  }
  if (lower.includes('vào trong cửa sổ') || lower.includes('quét khung') || lower.includes('quet khung') || lower.includes('nhảy vào trong')) {
    recordLearnedCommand('Vào trong khung');
    await triggerExploreInsideWindow();
    pushChatHistory('assistant', 'Đã quét khung và nhảy vào bên trong cửa sổ.');
    return true;
  }
  if (lower.includes('chuyển tab') || lower.includes('tác động khung') || lower.includes('tac dong khung') || lower.includes('bật terminal')) {
    recordLearnedCommand('Tác động khung');
    await triggerInteractInsideWindow();
    pushChatHistory('assistant', 'Đã tác động vào khung cửa sổ đang active.');
    return true;
  }

  const desktopIconCmd = parseDesktopIconCommand(userText);
  if (desktopIconCmd) {
    recordLearnedCommand('Kéo/Xếp Icon Desktop');
    if (desktopIconCmd.mode === 'drag') {
      await startDragDesktopIcon(desktopIconCmd.name);
      pushChatHistory('assistant', `Đang thực hiện kéo icon Desktop ${desktopIconCmd.name || 'ngẫu nhiên'}.`);
    } else {
      await arrangeDesktopIcons(desktopIconCmd.mode);
      pushChatHistory('assistant', `Đã sắp xếp icon Desktop (${desktopIconCmd.mode}).`);
    }
    return true;
  }

  const accCmd = parseAccessoryCommand(userText);
  if (accCmd !== null) {
    recordLearnedCommand('Phụ kiện 3D');
    clearTemporaryAccessoryTimer();
    const resType = equipAccessory3D(accCmd, true);
    pushChatHistory('assistant', `Đã cập nhật phụ kiện 3D: ${resType}.`);
    return true;
  }

  if (
    lower.includes('vịt tinh nghịch') ||
    lower.includes('vit tinh nghich') ||
    lower.includes('goose mode') ||
    lower.includes('trêu chuột') ||
    lower.includes('kéo chuột')
  ) {
    recordLearnedCommand('Vịt Tinh Nghịch');
    triggerGooseMischiefMode(true);
    pushChatHistory('assistant', 'Đã bật chế độ Vịt Tinh Nghịch bám theo con trỏ chuột.');
    return true;
  }

  if (
    lower.includes('nhảy theo nhạc') ||
    lower.includes('nhay theo nhac') ||
    lower.includes('beat dance') ||
    lower.includes('cảm nhận nhạc')
  ) {
    recordLearnedCommand('Beat Dance');
    triggerManualBeatDance();
    pushChatHistory('assistant', 'Đang bật chế độ nhảy Equalizer 3D theo nhịp nhạc hệ thống.');
    return true;
  }

  const timerCmd = parseTimerCommand(userText);
  if (timerCmd) {
    recordLearnedCommand('Hẹn giờ / Nhắc việc');
    const msg =
      timerCmd.mode === 'stop'
        ? stopCustomTimer()
        : startCustomTimer(timerCmd.minutes, timerCmd.task);
    pushChatHistory('assistant', msg);
    return true;
  }

  const procCmd = parseProcessCommand(userText);
  if (procCmd) {
    recordLearnedCommand(procCmd.action === 'kill' ? 'Đóng tiến trình' : 'Top ngốn RAM');
    const msg = await runProcessManager(procCmd.action, procCmd.target, true);
    pushChatHistory('assistant', msg);
    return true;
  }

  const stickyCmd = parseStickyNoteCommand(userText);
  if (stickyCmd) {
    recordLearnedCommand('Ghim & Lịch Hẹn');
    const msg =
      stickyCmd.mode === 'clear'
        ? await clearStickyNotes()
        : stickyCmd.mode === 'open'
          ? (toggleStickyNotesWidget(true), 'Đã mở bảng Ghi chú & Lịch hẹn trên màn hình.')
          : await pinStickyNote(
            stickyCmd.text,
            stickyCmd.saveDesktop,
            stickyCmd.scheduleTime,
            stickyCmd.repeatDaily
          );
    speak(msg);
    pushChatHistory('assistant', msg);
    return true;
  }

  const sysCmd = parseDeepSystemCommand(userText);
  if (sysCmd) {
    recordLearnedCommand('Điều khiển Hệ thống');
    const msg = await runDeepSystemControl(sysCmd.action, sysCmd.param, true);
    pushChatHistory('assistant', msg);
    return true;
  }

  const wsCmd = parseWorkspaceCommand(userText);
  if (wsCmd) {
    recordLearnedCommand('Trợ lý DB & Workspace');
    const msg = await runSmartDbSupportBriefing(wsCmd.autoRestore);
    pushChatHistory('assistant', msg);
    return true;
  }

  const devMacroRes = await tryRunDevMacroWeatherEdgeCommand(userText);
  if (devMacroRes !== null) {
    recordLearnedCommand(devMacroRes.label);
    pushChatHistory('assistant', devMacroRes.msg);
    return true;
  }

  const clipCmd = parseClipboardCommand(userText);
  if (clipCmd) {
    recordLearnedCommand('Clipboard Tool');
    const msg = await runClipboardTool(clipCmd.action, clipCmd.text, true);
    pushChatHistory('assistant', msg);
    return true;
  }

  const webSearchCmd = parseWebSearchCommand(userText);
  if (webSearchCmd) {
    recordLearnedCommand(`Tìm ${webSearchCmd.engine}`);
    const msg = await runSmartWebSearch(webSearchCmd.engine, webSearchCmd.query, true);
    pushChatHistory('assistant', msg);
    return true;
  }

  if (await tryHandlePcCommand(userText)) {
    recordLearnedCommand(userText.slice(0, 26));
    pushChatHistory('assistant', `Đã thực hiện lệnh: ${userText}`);
    return true;
  }

  return false;
}

let isStreamingActive = false;
let streamingBuffer = '';
let activeStreamEngine = 'Local';
let streamEmotionApplied = false;

export function applyAutoEmotionFromText(rawText: string): string {
  let clean = rawText;
  let explicitEmotion = '';
  const tagRegex = /\[EMOTION:([a-zA-Z0-9_]+)\]/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRegex.exec(rawText)) !== null) {
    explicitEmotion = m[1].trim().toLowerCase();
  }
  clean = clean.replace(tagRegex, '').trim();

  const lower = clean.toLowerCase();
  if (
    explicitEmotion === 'surprised' ||
    /cảnh báo|quá tải|ngạc nhiên|bất ngờ|wow|ối|chú ý|\?!/.test(lower)
  ) {
    appState.setExpression('surprised', 4.2);
    spawnShockwave(appState.posX, appState.posY - 70 * appState.modelScale, 0x38bdf8);
  } else if (
    explicitEmotion === 'sad' ||
    /xin lỗi|tiếc|buồn|mệt|lỗi|không thể|thất bại/.test(lower)
  ) {
    appState.setExpression('sad', 4.0);
    spawnParticles(appState.posX, appState.posY - 80 * appState.modelScale, 8, 0x60a5fa);
  } else if (
    explicitEmotion === 'happy' ||
    explicitEmotion === 'excited' ||
    explicitEmotion === 'proud' ||
    /tuyệt vời|xuất sắc|hoàn tất|thành công|quạc|ngay đây|sẵn sàng|vui|haha|hihi|!/.test(lower)
  ) {
    appState.setExpression('happy', 4.5);
    spawnParticles(appState.posX, appState.posY - 90 * appState.modelScale, 12, 0xf472b6);
  }

  return clean;
}

function sanitizeStreamingText(raw: string): string {
  let clean = parseAiToolCalls(raw).cleanText;
  // Loại bỏ thẻ cảm xúc & đoạn thẻ tool/code đang dở dang ở cuối luồng stream
  clean = clean
    .replace(/\[EMOTION:[^\]]*\]/gi, '')
    .replace(/(?:\[|\*\*)\s*(?:T(?:O(?:O(?:L(?:_CALL)?)?)?)?|A(?:C(?:T(?:I(?:O(?:N)?)?)?)?)?|E(?:M(?:O(?:T(?:I(?:O(?:N)?)?)?)?)?)?)(?::[\s\S]*)?$/i, '')
    .replace(/\b(?:TOOL|TOOL_CALL|EMOTION):[\s\S]*$/i, '')
    .replace(/```[\s\S]*$/g, '')
    .replace(/(?:Hãy|Bạn hãy|Vui lòng)?\s*(?:chèn|nhập|gửi|cung cấp)\s*thẻ[\s\S]*$/i, '')
    .trim();
  return clean;
}

async function tryRunDevMacroWeatherEdgeCommand(
  text: string
): Promise<{ label: string; msg: string } | null> {
  if (isQuestionOrMetaDiscussion(text)) return null;
  const lower = text.toLowerCase().trim();

  // 1. Nấp mép màn hình / Focus mode
  if (/(?:nấp mép|nap mep|chế độ nấp|ẩn sang mép|edge peek|ra khỏi mép)/i.test(lower)) {
    const force = /tắt|thoát|ra khỏi|off/i.test(lower) ? false : /bật|vào|on/i.test(lower) ? true : undefined;
    const msg = toggleEdgePeekMode(force);
    return { label: 'Nấp mép màn hình', msg };
  }

  // 2. Thời tiết, Nhiệt độ, Độ ẩm & Hiệu ứng 3D
  if (
    /(?:thời tiết|thoi tiet|nhiệt độ\s+(?:hôm nay|ở|tại|ngoài trời|hiện tại)|độ ẩm\s+(?:hôm nay|ở|tại|ngoài trời)|hiệu ứng\s*(?:mưa|nắng|tuyết|lạnh|gió|ban đêm|quang|trời)|gió xoáy|bật trời|cho trời|trời\s*(?:mưa|nắng|tuyết|lạnh|gió|quang|tối|ban đêm)|tắt hiệu ứng thời tiết)/i.test(
      lower
    )
  ) {
    let mode: WeatherEffectMode | 'auto' = 'auto';
    if (lower.includes('tắt hiệu ứng') || lower.includes('trời quang') || lower.includes('hiệu ứng quang')) {
      mode = 'clear';
    } else if (lower.includes('hiệu ứng mưa') || lower.includes('trời mưa') || lower.includes('bật mưa')) {
      mode = 'rain';
    } else if (lower.includes('hiệu ứng nắng') || lower.includes('trời nắng') || lower.includes('nắng nóng')) {
      mode = 'hot';
    } else if (
      lower.includes('hiệu ứng tuyết') ||
      lower.includes('hiệu ứng lạnh') ||
      lower.includes('trời tuyết') ||
      lower.includes('trời lạnh')
    ) {
      mode = 'cold';
    } else if (lower.includes('hiệu ứng gió') || lower.includes('gió xoáy') || lower.includes('trời gió')) {
      mode = 'wind';
    } else if (lower.includes('hiệu ứng ban đêm') || lower.includes('ban đêm') || lower.includes('trời tối')) {
      mode = 'night';
    }

    let cityOverride: string | undefined;
    if (lower.includes('sài gòn') || lower.includes('sai gon') || lower.includes('hồ chí minh') || lower.includes('hcm')) {
      cityOverride = 'Ho Chi Minh';
    } else if (lower.includes('hà nội') || lower.includes('ha noi')) {
      cityOverride = 'Hanoi';
    } else if (lower.includes('đà nẵng') || lower.includes('da nang')) {
      cityOverride = 'Da Nang';
    } else if (lower.includes('đà lạt') || lower.includes('da lat')) {
      cityOverride = 'Da Lat';
    } else if (lower.includes('hải phòng') || lower.includes('hai phong')) {
      cityOverride = 'Hai Phong';
    } else if (lower.includes('cần thơ') || lower.includes('can tho')) {
      cityOverride = 'Can Tho';
    } else if (lower.includes('nha trang')) {
      cityOverride = 'Nha Trang';
    } else if (lower.includes('huế') || lower.includes('hue')) {
      cityOverride = 'Hue';
    } else if (lower.includes('vũng tàu') || lower.includes('vung tau')) {
      cityOverride = 'Vung Tau';
    } else if (lower.includes('sa pa') || lower.includes('sapa')) {
      cityOverride = 'Sapa';
    } else {
      const mCity = text.match(
        /(?:thời tiết|thoi tiet|nhiệt độ|nhiet do)\s+(?:ở|o|tại|tai|của|cua|in|at)?\s*([a-zA-ZÀ-ỹ0-9\s\-]{2,32})$/i
      );
      if (mCity?.[1]) {
        const cand = mCity[1].trim();
        const cl = cand.toLowerCase();
        if (
          !/^(?:hôm nay|hom nay|bây giờ|bay gio|hiện tại|hien tai|thế nào|the nao|sao rồi|ra sao|3d|live|auto)$/i.test(
            cl
          )
        ) {
          cityOverride = cand;
        }
      }
    }
    const msg = await syncLiveWeather3D(mode, true, cityOverride);
    return { label: 'Thời tiết & Độ ẩm Live', msg };
  }

  // 2b. Đọc tin tức mới cấu hình được (Znews, CafeF, Money, VnExpress...)
  if (
    /(?:đọc báo|doc bao|điểm tin|diem tin|xem tin tức|đọc tin mới|tin tức hôm nay|tin tức mới|znews|cafef|moneyh|vneconomy|vnexpress|dantri|tuoitre|hackernews)/i.test(
      lower
    )
  ) {
    let srcOverride: string | undefined;
    if (lower.includes('znews') || lower.includes('zing')) srcOverride = 'znews';
    else if (lower.includes('cafef')) srcOverride = 'cafef';
    else if (lower.includes('money') || lower.includes('tài chính') || lower.includes('vneconomy')) srcOverride = 'money';
    else if (lower.includes('vnexpress')) srcOverride = 'vnexpress';
    else if (lower.includes('dantri') || lower.includes('dân trí')) srcOverride = 'dantri';
    else if (lower.includes('tuoitre') || lower.includes('tuổi trẻ')) srcOverride = 'tuoitre';
    else if (lower.includes('hackernews')) srcOverride = 'hackernews';
    const msg = await loadAndSpeakLiveNews(srcOverride, true);
    return { label: 'Đọc Tin Mới Live', msg };
  }

  // 2c. Học Tiếng Anh vô tận từ MongoDB / Internet, mở English Coach & Đố vui từ vựng
  if (
    /(?:mở bảng học tiếng anh|mở english coach|luyện nói tiếng anh|học flashcard|flashcard tiếng anh|sổ từ srs)/i.test(
      lower
    )
  ) {
    const tab = lower.includes('nói') ? 'speak' : lower.includes('srs') || lower.includes('sổ') ? 'srs' : 'learn';
    window.dispatchEvent(new CustomEvent('duck-open-english-coach', { detail: { tab } }));
    return { label: 'Duck English Coach', msg: 'Đã mở bảng Duck English Coach 4 Tab cho bạn!' };
  }
  const lookupMatch = text.match(/^(?:tra\s+từ|tra\s+nghĩa\s+từ)\s+([a-zA-Z\-']{2,32})/i);
  if (lookupMatch?.[1]) {
    const wordQuery = lookupMatch[1].trim();
    window.dispatchEvent(
      new CustomEvent('duck-open-english-coach', { detail: { tab: 'learn', wordQuery } })
    );
    return { label: 'Tra Từ Tiếng Anh', msg: `Đang tra từ "${wordQuery}" trên MongoDB & từ điển...` };
  }
  if (
    /(?:đố vui tiếng anh|on tap tieng anh|ôn tập tiếng anh|kiểm tra từ vựng|quiz tiếng anh)/i.test(lower)
  ) {
    const msg = await runEnglishMiniQuiz();
    return { label: 'Đố Vui Tiếng Anh', msg };
  }
  if (/(?:học tiếng anh|hoc tieng anh|học từ vựng|hoc tu vung|dạy tiếng anh|day tieng anh|từ vựng hôm nay|english word|new word)/i.test(lower)) {
    const topicMatch = text.match(/(?:chủ đề|chu de|topic)\s+([a-zA-Z0-9\s\-]{2,32})$/i);
    const topic = topicMatch?.[1]?.trim();
    const msg = await loadNextEnglishLesson(topic, true);
    return { label: 'Học Tiếng Anh Live', msg };
  }

  // 2d. Chạy Hiệu Ứng 3D & Tính Năng Random
  if (/(?:hiệu ứng random|tính năng random|hiệu ứng ngẫu nhiên|random effect|random fx|bung hiệu ứng)/i.test(lower)) {
    const msg = await triggerRandomFeatureOrEffect(true);
    return { label: 'Hiệu Ứng Random', msg };
  }

  // 3. Port Manager
  const killPortMatch = lower.match(/(?:kill|đóng|dong|tắt|tat|giải phóng|giai phong)\s*(?:port|cổng|cong)\s*(\d{2,5})/i);
  if (killPortMatch?.[1]) {
    const p = Number(killPortMatch[1]);
    const msg = await runPortManager('kill', p, true);
    return { label: `Kill Port ${p}`, msg };
  }
  if (/(?:quét port|xem port|port nào|kiểm tra port|kiểm tra cổng|list port|dev port)/i.test(lower)) {
    const msg = await runPortManager('list', undefined, true);
    return { label: 'Quét Port Dev', msg };
  }

  // 4. Git Status
  if (/(?:check git|git status|kiểm tra git|trạng thái git|nhánh git)/i.test(lower)) {
    const msg = await runGitStatusCheck('', true);
    return { label: 'Check Git Status', msg };
  }

  // 5. Clipboard History
  if (/(?:xóa lịch sử clipboard|clear clipboard history)/i.test(lower)) {
    await invoke('clipboard_history_clear').catch(() => { });
    const msg = '[CLIPBOARD HISTORY] Đã xóa sạch lịch sử clipboard trong SQLite.';
    speak(msg);
    return { label: 'Xóa lịch sử Clipboard', msg };
  }
  if (/(?:lịch sử clipboard|clipboard history|clipboard cũ|các đoạn đã copy|xem lại copy)/i.test(lower)) {
    const msg = await runClipboardHistoryCheck(true);
    return { label: 'Lịch sử Clipboard', msg };
  }

  // 6. Macro SQLite (Tạo mới / Liệt kê / Chạy Macro)
  const createMacroMatch = text.match(/tạo macro\s+([^:]{2,30}):\s*(.+)$/i);
  if (createMacroMatch?.[1] && createMacroMatch?.[2]) {
    const msg = await createCustomMacroFromText(createMacroMatch[1], createMacroMatch[2]);
    speak(msg);
    return { label: 'Tạo Macro SQLite', msg };
  }
  if (/(?:danh sách macro|xem macro|list macro)/i.test(lower)) {
    const msg = await runMacroRoutine('list', true);
    return { label: 'Danh sách Macro', msg };
  }
  const runMacroMatch = lower.match(
    /(?:chạy|chay|bật|bat|kích hoạt|kich hoat|mở|mo|run)\s+(?:macro\s+)?(chế độ\s+code|chế độ\s+họp|chế độ\s+giải lao|[a-z0-9_ ]{2,25})/i
  );
  const runMacroBuiltin =
    /(?:chạy|chay|bật|bat|kích hoạt|kich hoat|mở|mo|run)\s+(?:macro\s+)?(?:chế độ\s+code|chế độ\s+họp|chế độ\s+giải lao)/i.test(
      lower
    );
  if (
    runMacroBuiltin ||
    lower.startsWith('chạy macro ') ||
    lower.startsWith('run macro ')
  ) {
    const targetName = lower.startsWith('chạy macro ')
      ? text.slice(11).trim()
      : lower.startsWith('run macro ')
        ? text.slice(10).trim()
        : runMacroMatch?.[1] || lower;
    const msg = await runMacroRoutine(targetName, true);
    return { label: `Macro: ${targetName}`, msg };
  }

  return null;
}

export { extractChatContactAndMessage as parseChatAppMessageCommand };

function parseReadOnlyCheckChatAppCommand(text: string): { app: string } | null {
  if (extractChatContactAndMessage(text)) return null;
  const norm = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

  if (
    /\b(?:gui|send|nhan cho|nhan tin cho|tra loi|reply|ib cho|inbox cho)\b/.test(norm)
  ) {
    return null;
  }

  const appMatch = norm.match(/\b(zalo|telegram|discord|messenger)\b/);
  if (!appMatch?.[1]) return null;

  const hasCheckIntent =
    /\b(?:check|kiem tra|xem|doc|co tin nhan|tin nhan moi|thong bao|notification|unread|chua doc|new message)\b/.test(
      norm
    );
  if (!hasCheckIntent) return null;

  const rawApp = appMatch[1].toLowerCase();
  const app = rawApp.charAt(0).toUpperCase() + rawApp.slice(1);
  return { app };
}

function formatRelativeTimeVi(rawTs: number): string {
  const tsMs = rawTs > 1e12 ? rawTs : rawTs * 1000;
  const diffSec = Math.max(0, Math.floor((Date.now() - tsMs) / 1000));
  if (diffSec < 60) return 'vừa xong';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
  return new Date(tsMs).toLocaleDateString('vi-VN');
}

async function tryZeroLatencyFastPath(userText: string): Promise<boolean> {
  const text = userText.trim();
  const lower = text.toLowerCase();

  // 0. Mở bảng Tarot & Tử Vi Vận Mệnh 6 Giờ
  const normTarotCheck = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

  const pinnedAnalyses = getPinnedAnalyses();
  const primaryPinned = getPrimaryPinnedFile();
  const historyTag = formatPinnedFilesChatTag();

  // 0-pin. Thao tác nhanh trực tiếp trên File đang ghim (bỏ ghim / mở / dashboard / tóm tắt)
  if (primaryPinned) {
    if (
      /^(?:bỏ ghim|bo ghim|gỡ ghim|go ghim|xóa file ghim|xoa file ghim|xóa đính kèm|xoa dinh kem|clear pinned|unpin)(?:\s+(?:file|tệp|hết|all|này|nay))?[?!.\s]*$/i.test(
        text
      )
    ) {
      pushChatHistory('user', `${historyTag}${text}`);
      clearPinnedChatFiles();
      const reply = '[GHIM FILE] Đã bỏ ghim tất cả file khỏi thanh chat.';
      speak(reply);
      pushChatHistory('assistant', reply);
      return true;
    }

    if (
      /(?:mở|mo|open)\s+(?:giúp\s+|hộ\s+)?(?:file|tệp|tep)\s+(?:này|nay|đang ghim|dang ghim|vừa kéo|vua keo|vừa thả|vua tha)/i.test(
        lower
      ) &&
      primaryPinned.filePath
    ) {
      pushChatHistory('user', `${historyTag}${text}`);
      void runPcOpenFile(primaryPinned.filePath);
      const reply = `[FAST-PATH] Đang mở file đang ghim "${primaryPinned.fileName}" cho bạn!`;
      speak(reply);
      pushChatHistory('assistant', reply);
      return true;
    }

    if (
      /(?:mở|mo|xem|show|hiện|hien)\s+(?:bảng\s+)?(?:dashboard|biểu đồ|bieu do)(?:\s+(?:của\s+)?(?:file|tệp|này|nay|đang ghim))?/i.test(
        lower
      )
    ) {
      pushChatHistory('user', `${historyTag}${text}`);
      openFileAnalyticsDashboard(primaryPinned.analysis);
      const reply = `[DASHBOARD] Đã mở bảng phân tích cho "${primaryPinned.fileName}"!`;
      speak(reply);
      pushChatHistory('assistant', reply);
      return true;
    }

    if (
      /^(?:hãy\s+|hay\s+|giúp\s+tớ\s+|giup\s+to\s+)?(?:tóm tắt|tom tat|summarize)(?:\s+(?:nhanh|lại|lai|giúp|giup|hộ|ho|cho tớ|cho to|cho tôi|cho toi))?(?:\s+(?:file|tệp|tep|tài liệu|tai lieu)(?:\s+(?:này|nay|đang ghim|dang ghim|vừa kéo|vua keo))?)?[?!.\s]*$/i.test(
        text
      )
    ) {
      pushChatHistory('user', `${historyTag}${text}`);
      await summarizeLastIngestedFile(primaryPinned.analysis);
      return true;
    }
  }

  // 0a3. Kiểm tra tin nhắn/thông báo mới CHỈ ĐỌC (không bao giờ tự gửi tin nhắn)
  const checkChatCmd = parseReadOnlyCheckChatAppCommand(text);
  if (checkChatCmd) {
    pushChatHistory('user', `${historyTag}${text}`);
    const appLow = checkChatCmd.app.toLowerCase();
    const history = await fetchNotificationHistory();
    const matchedNotifs = history
      .filter(
        (n) =>
          n.app_or_origin.toLowerCase().includes(appLow) ||
          n.title.toLowerCase().includes(appLow) ||
          n.body.toLowerCase().includes(appLow)
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);

    const openAppWin = appState.openWindows.find(
      (w) =>
        (w.process_name || '').toLowerCase().includes(appLow) ||
        w.title.toLowerCase().includes(appLow)
    );
    const unreadMatch = openAppWin?.title.match(/\((\d+)\)/);
    const winStatus = openAppWin
      ? `Cửa sổ ${checkChatCmd.app} đang mở ("${openAppWin.title}")${unreadMatch?.[1] ? ` - có dấu hiệu ${unreadMatch[1]} mục chưa đọc trên tiêu đề.` : '.'
      }`
      : `Không thấy cửa sổ ${checkChatCmd.app} đang mở trên Desktop.`;

    let reply: string;
    if (matchedNotifs.length > 0) {
      const lines = matchedNotifs.map(
        (n, i) =>
          `${i + 1}. [${formatRelativeTimeVi(n.timestamp)}] ${n.title}: "${n.body.slice(0, 120)}"`
      );
      reply = `[KIỂM TRA ${checkChatCmd.app.toUpperCase()} - CHỈ ĐỌC]\n${winStatus}\nCó ${matchedNotifs.length} thông báo ${checkChatCmd.app} gần đây:\n${lines.join('\n')}`;
    } else {
      reply = `[KIỂM TRA ${checkChatCmd.app.toUpperCase()} - CHỈ ĐỌC]\n${winStatus}\nChưa ghi nhận thông báo ${checkChatCmd.app} mới nào trong Lịch sử Thông báo hệ thống. Nếu bạn muốn Vịt nhìn trực tiếp màn hình ${checkChatCmd.app}, hãy nói "xem màn hình".`;
    }
    speak(reply);
    pushChatHistory('assistant', reply);
    return true;
  }

  // Bỏ qua toàn bộ fast-path còn lại nếu câu nói là câu hỏi kiến thức, giải thích, hoặc phản hồi/than phiền lỗi
  if (isQuestionOrMetaDiscussion(text)) {
    return false;
  }

  // 0-mini. Màn Hình Mini (Mini Screen PiP - YouTube/Web Always-on-Top hoặc Chiếu App/Tab Live)
  if (
    /(?:man hinh mini|mini screen|mini youtube|youtube mini|mini web|trong mini)|(?:chieu|mirror)\s+(?:tab|app|cua so|trinh duyet)/.test(
      normTarotCheck
    )
  ) {
    pushChatHistory('user', text);
    const wantsMirror =
      /(?:chieu|mirror)\s+(?:tab|app|cua so|trinh duyet)|capture app|live app/.test(
        normTarotCheck
      ) && !/youtube|web|tiktok|google|http/.test(normTarotCheck);

    if (wantsMirror) {
      toggleMiniScreenPanel(true, 'mirror');
      const msg =
        '[MINI SCREEN] Đã mở bảng Màn Hình Mini ở chế độ Chiếu App / Tab Live! Chọn cửa sổ hoặc nhấn "Bắt Tab / Màn 60 FPS" để xem ngay.';
      speak(msg);
      pushChatHistory('assistant', msg);
      return true;
    }

    let target = '';
    const urlMatch = text.match(/https?:\/\/\S+/i);
    if (urlMatch?.[0]) {
      target = urlMatch[0];
    } else if (/yt music|youtube music/.test(normTarotCheck)) {
      target = 'ytmusic';
    } else if (/lofi/.test(normTarotCheck)) {
      target = 'lofi';
    } else if (/youtube/.test(normTarotCheck)) {
      target = 'youtube';
    } else if (/tiktok/.test(normTarotCheck)) {
      target = 'tiktok';
    } else if (/google/.test(normTarotCheck)) {
      target = 'google';
    } else if (/chatgpt/.test(normTarotCheck)) {
      target = 'chatgpt';
    }

    toggleMiniScreenPanel(true, 'web');
    if (target) {
      try {
        await invoke('mini_screen_open_web', { target });
        const inp = document.getElementById('mini-web-url-input') as HTMLInputElement | null;
        if (inp) inp.value = target;
        const msg = `[MINI SCREEN] Đã mở "${target}" trong cửa sổ Mini Screen ghim nổi (Always-on-Top)!`;
        speak(msg);
        pushChatHistory('assistant', msg);
      } catch (err) {
        const errMsg = `[MINI SCREEN LỖI] ${String(err)}`;
        speak(errMsg);
        pushChatHistory('assistant', errMsg);
      }
    } else {
      const msg =
        '[MINI SCREEN] Đã mở Màn Hình Mini (PiP)! Bạn có thể bấm YouTube, dán link web hoặc chuyển sang tab "Chiếu App / Tab Live".';
      speak(msg);
      pushChatHistory('assistant', msg);
    }
    return true;
  }

  if (
    /(?:boc|lat|xem|rut)\s+(?:the\s+|bai\s+|que\s+)?(?:tarot|boi|tu vi|van menh|van may)|(?:hom nay|nay)\s+(?:co\s+)?(?:may man|xui xeo).*(?:tarot|boi|tu vi|van menh|van may|que)|\bxem boi\b/.test(
      normTarotCheck
    )
  ) {
    pushChatHistory('user', text);
    toggleTarotModal(true);
    const msg =
      '[TAROT & TỬ VI 6H] Tớ đã mở bàn trải bài Tarot cho bạn! Chọn 1 trong 3 lá bài hoặc nhấn "Bốc & Lật Quẻ Tarot Ngay" để Vịt làm phép lật thẻ 3D định vận Cát/Hung nhé.';
    speak(msg);
    pushChatHistory('assistant', msg);
    return true;
  }

  // 0a. Duck Skill Forge: Phát hiện yêu cầu mở Xưởng Skill hoặc nhờ Gemini tạo + kiểm nghiệm Sandbox tool mới
  const forgeIntent = detectToolForgeRequestIntent(text);
  if (forgeIntent) {
    pushChatHistory('user', text);
    if (forgeIntent.mode === 'open') {
      window.dispatchEvent(new CustomEvent('duck-open-tool-forge'));
      const msg = 'Đã mở Xưởng Skill AI & Sandbox Kiểm Nghiệm.';
      speak(msg);
      pushChatHistory('assistant', msg);
      return true;
    }

    isBusy = true;
    try {
      const handoffMsg =
        '[TOOL FORGE] Local LLM chưa có tool này & không tự viết code -> Chuyển sang Gemini Architect + Sandbox máy để viết và kiểm nghiệm...';
      speak(handoffMsg);
      window.dispatchEvent(
        new CustomEvent('duck-open-tool-forge', { detail: { generatingRequest: forgeIntent.request } })
      );
      const draft = await forgeNewToolFromRequest(forgeIntent.request, 'auto', (line) => {
        setStreamSpeechText(line);
      });
      window.dispatchEvent(new CustomEvent('duck-open-tool-forge', { detail: { draft } }));

      const summary = draft.sandbox?.verified
        ? `[SANDBOX PASS] Gemini đã viết xong skill "${draft.name}" và kiểm nghiệm đạt trên Sandbox (${draft.sandbox.duration_ms}ms). Hãy bấm "Xác Nhận & Đóng Gói Skill" để lưu cho Local LLM dùng sau này!`
        : `[SANDBOX CHƯA ĐẠT] Gemini đã viết nháp "${draft.name}" nhưng chưa pass kiểm chứng (${draft.sandbox?.failure_reason || 'Lỗi'}). Tool chưa được đóng gói; bạn có thể bấm "Tự Vá" hoặc sửa trên Xưởng Skill.`;
      speak(summary);
      pushChatHistory('assistant', summary);
    } catch (err) {
      const failMsg = `[TOOL FORGE LỖI] ${String(err)}`;
      speak(failMsg);
      pushChatHistory('assistant', failMsg);
    } finally {
      isBusy = false;
    }
    return true;
  }

  // 0a2. Fast-path OCR & Chụp màn hình tức thì
  if (
    /(?:cắt vùng ocr|cat vung ocr|ocr vùng|ocr vung|cắt màn hình dịch|cat man hinh dich|dịch vùng|dich vung|ocr dịch|ocr dich)/i.test(
      lower
    )
  ) {
    pushChatHistory('user', text);
    fireAnimationTrigger('tool', 'ocr', 'start');
    window.dispatchEvent(new CustomEvent('duck-start-ocr-snip'));
    const reply = '[OCR VÙNG] Đang mở chế độ kéo cắt vùng màn hình để nhận diện chữ & dịch thuật!';
    speak(reply);
    pushChatHistory('assistant', reply);
    return true;
  }
  if (
    /(?:chạy|chay|quét|quet|đọc|doc|bật|bat|cắt|cat|dùng|dung|run|scan)\s+(?:vùng\s+|vung\s+|màn hình\s+|man hinh\s+)?ocr\b|\bocr\s+(?:màn hình|man hinh|ảnh|anh|vùng|vung)|đọc chữ màn hình|doc chu man hinh|quét chữ màn hình|quet chu man hinh|đọc ảnh chụp|doc anh chup/i.test(
      lower
    ) ||
    lower === 'ocr'
  ) {
    pushChatHistory('user', text);
    await runOcrAndSummarize(true);
    return true;
  }
  if (
    /(?:chụp màn hình|chup man hinh|chụp ảnh màn hình|chup anh man hinh|take screenshot)/i.test(
      lower
    )
  ) {
    pushChatHistory('user', text);
    const out = await runPcScreenshot();
    pushChatHistory('assistant', out);
    return true;
  }

  const matchedSkill = matchSavedSkillForUserText(text, pinnedAnalyses);
  if (matchedSkill) {
    isBusy = true;
    let pushedUserMsg = false;
    try {
      const finalArgs = await extractArgsWithLocalLlmIfAvailable(
        matchedSkill.skill,
        text,
        matchedSkill.args,
        pinnedAnalyses
      );
      if (finalArgs && finalArgs._should_execute === false) {
        return false;
      }

      const cleanArgs: Record<string, unknown> = { ...finalArgs };
      delete cleanArgs._should_execute;
      delete cleanArgs._reason;

      if (isSendChatSkill(matchedSkill.skill)) {
        const unsafeReason = validateSendChatSkillArgs(text, cleanArgs);
        if (unsafeReason) {
          pushChatHistory('user', `${historyTag}${text}`);
          pushedUserMsg = true;
          const blockedMsg = `[AN TOÀN] ${unsafeReason}`;
          speak(blockedMsg);
          pushChatHistory('assistant', blockedMsg);
          return true;
        }
      }

      pushChatHistory('user', `${historyTag}${text}`);
      pushedUserMsg = true;
      speak(`[SKILL: ${matchedSkill.skill.name}] Đang phân tích yêu cầu, chuẩn bị dữ liệu & thực thi tool đã lưu...`);
      const outMsg = await executeSavedSkillWithSelfHeal(
        matchedSkill.skill.id,
        cleanArgs,
        (line) => setStreamSpeechText(line)
      );
      speak(outMsg);
      pushChatHistory('assistant', outMsg);
    } catch (err) {
      if (!pushedUserMsg) {
        pushChatHistory('user', `${historyTag}${text}`);
      }
      const errMsg = `[SKILL LỖI] ${String(err)}`;
      speak(errMsg);
      pushChatHistory('assistant', errMsg);
    } finally {
      isBusy = false;
    }
    return true;
  }

  // Nếu đang ghim file mà không khớp thao tác nhanh / skill sửa file -> chuyển thẳng cho LLM xử lý theo dữ liệu đang ghim
  if (pinnedAnalyses.length > 0) {
    return false;
  }

  // Nếu là chuỗi đa lệnh ("... rồi ...", "... sau đó ..."), bỏ qua fast-path đơn lẻ để LLM/chained handler thực thi trọn vẹn tất cả mệnh đề
  if (/(?:\s+(?:rồi|sau đó|tiếp theo|đồng thời|và rồi|then|and then)\s+|\s*;\s*)/i.test(text)) {
    return false;
  }

  // 0. Fast-Path điều khiển trực tiếp App Chat (Zalo / Telegram / Discord / Messenger)
  const chatAppCmd = extractChatContactAndMessage(text);
  if (chatAppCmd) {
    pushChatHistory('user', text);
    isBusy = true;
    setStreamSpeechText(
      `[AUTO CHAT] Đang mở ${chatAppCmd.app}, tìm "${chatAppCmd.contact}" và gửi "${chatAppCmd.message}"...`
    );
    try {
      const out = await invoke<string>('auto_chat_app_send_message', chatAppCmd);
      window.dispatchEvent(
        new CustomEvent('duck-agent-suggest-tool', {
          detail: {
            goal: text,
            summary: out,
            steps: [
              {
                step: 1,
                action: 'chat_app_send',
                params: chatAppCmd,
                obs: out,
              },
            ],
            createdAt: Date.now(),
          },
        })
      );
      speak(out);
      pushChatHistory('assistant', out);
    } catch (err) {
      const failMsg = `[AUTO CHAT LỖI] ${String(err)}`;
      speak(failMsg);
      pushChatHistory('assistant', failMsg);
    } finally {
      isBusy = false;
    }
    return true;
  }

  // 0a. Kéo thả & Sắp xếp Icon ngoài Desktop
  const iconCmd = parseDesktopIconCommand(text);
  if (iconCmd) {
    pushChatHistory('user', text);
    if (iconCmd.mode === 'drag') {
      await startDragDesktopIcon(iconCmd.name);
      pushChatHistory(
        'assistant',
        `Tớ đang chạy tới ngoạm và kéo icon "${iconCmd.name || 'ngẫu nhiên'}" ngoài Desktop đây!`
      );
    } else {
      await arrangeDesktopIcons(iconCmd.mode);
      pushChatHistory('assistant', `Đã sắp xếp lại toàn bộ icon Desktop (${iconCmd.mode}).`);
    }
    return true;
  }

  // 0b. Phụ kiện 3D, Vịt Tinh Nghịch & Nhảy Theo Nhạc
  const accCmd = parseAccessoryCommand(text);
  if (accCmd !== null) {
    pushChatHistory('user', text);
    clearTemporaryAccessoryTimer();
    const resType = equipAccessory3D(accCmd, true);
    pushChatHistory('assistant', `[FAST-PATH] Đã cập nhật phụ kiện 3D: ${resType}`);
    return true;
  }
  if (
    lower.includes('vịt tinh nghịch') ||
    lower.includes('vit tinh nghich') ||
    lower.includes('goose mode') ||
    lower.includes('trêu chuột') ||
    lower.includes('kéo chuột')
  ) {
    pushChatHistory('user', text);
    triggerGooseMischiefMode(true);
    pushChatHistory('assistant', '[FAST-PATH] Đã bật chế độ Vịt Tinh Nghịch!');
    return true;
  }
  if (
    lower.includes('nhảy theo nhạc') ||
    lower.includes('nhay theo nhac') ||
    lower.includes('beat dance') ||
    lower.includes('cảm nhận nhạc')
  ) {
    pushChatHistory('user', text);
    triggerManualBeatDance();
    pushChatHistory('assistant', '[FAST-PATH] Đang nhảy theo nhịp nhạc hệ thống!');
    return true;
  }

  // 0c. 5 Tool Mới (Timer, Process Manager, Sticky Note, Clipboard, Web Search)
  const timerCmd = parseTimerCommand(text);
  if (timerCmd) {
    pushChatHistory('user', text);
    const msg =
      timerCmd.mode === 'stop'
        ? stopCustomTimer()
        : startCustomTimer(timerCmd.minutes, timerCmd.task);
    pushChatHistory('assistant', msg);
    speak(msg);
    return true;
  }

  const procCmd = parseProcessCommand(text);
  if (procCmd) {
    pushChatHistory('user', text);
    const msg = await runProcessManager(procCmd.action, procCmd.target, true);
    pushChatHistory('assistant', msg);
    return true;
  }

  const stickyCmd = parseStickyNoteCommand(text);
  if (stickyCmd) {
    pushChatHistory('user', text);
    const msg =
      stickyCmd.mode === 'clear'
        ? await clearStickyNotes()
        : stickyCmd.mode === 'open'
          ? (toggleStickyNotesWidget(true), 'Đã mở bảng Ghi chú & Lịch hẹn trên màn hình.')
          : await pinStickyNote(
            stickyCmd.text,
            stickyCmd.saveDesktop,
            stickyCmd.scheduleTime,
            stickyCmd.repeatDaily
          );
    pushChatHistory('assistant', msg);
    speak(msg);
    return true;
  }

  const sysCmd = parseDeepSystemCommand(text);
  if (sysCmd) {
    pushChatHistory('user', text);
    const msg = await runDeepSystemControl(sysCmd.action, sysCmd.param, true);
    pushChatHistory('assistant', msg);
    return true;
  }

  const wsCmd = parseWorkspaceCommand(text);
  if (wsCmd) {
    pushChatHistory('user', text);
    const msg = await runSmartDbSupportBriefing(wsCmd.autoRestore);
    pushChatHistory('assistant', msg);
    return true;
  }

  const devMacroRes = await tryRunDevMacroWeatherEdgeCommand(text);
  if (devMacroRes !== null) {
    pushChatHistory('user', text);
    pushChatHistory('assistant', devMacroRes.msg);
    return true;
  }

  const clipCmd = parseClipboardCommand(text);
  if (clipCmd) {
    pushChatHistory('user', text);
    const msg = await runClipboardTool(clipCmd.action, clipCmd.text, true);
    pushChatHistory('assistant', msg);
    return true;
  }

  const webSearchCmd = parseWebSearchCommand(text);
  if (webSearchCmd) {
    pushChatHistory('user', text);
    const msg = await runSmartWebSearch(webSearchCmd.engine, webSearchCmd.query, true);
    pushChatHistory('assistant', msg);
    return true;
  }

  // 1. Mở file: "mo t file a.csv", "mở file data.xlsx", "open file config.json"
  const fileMatch = text.match(
    /^(?:hãy\s+|hay\s+|giúp\s+tớ\s+|giup\s+to\s+|nhờ\s+|nho\s+)?(?:mở|mo|bật|bat|chạy|chay|open)\s+(?:t\s+|tớ\s+|cho tớ\s+|cho t\s+|giúp\s+|hộ\s+)?(?:file|tệp|tep|tập tin|tap tin)?\s*["']?([a-zA-Z0-9_.\-\\/: ]+\.[a-zA-Z0-9]{1,8})["']?$/i
  );
  if (fileMatch?.[1]) {
    const filename = fileMatch[1].trim();
    void runPcOpenFile(filename);
    pushChatHistory('user', text);
    const reply = `Tớ mở file ${filename} cho bạn ngay đây nhé!`;
    pushChatHistory('assistant', reply);
    speak(`[FAST-PATH] ${reply}`);
    appState.velY = -5;
    appState.setState('JUMPING');
    appState.setExpression('happy', 2.5);
    return true;
  }

  // 2. Đi bơi / lên bờ
  if (
    lower.includes('đi bơi') ||
    lower.includes('bơi đi') ||
    lower.includes('xuống hồ') ||
    lower === 'swim'
  ) {
    triggerStartSwimming(true);
    pushChatHistory('user', text);
    const reply = 'Nóng quá, tớ nhảy xuống hồ bơi giải nhiệt ngay đây!';
    pushChatHistory('assistant', reply);
    speak(`[FAST-PATH] ${reply}`);
    return true;
  }
  if (lower.includes('lên bờ') || lower.includes('dừng bơi') || lower.includes('vào bờ')) {
    triggerStopSwimming(true);
    pushChatHistory('user', text);
    const reply = 'Tớ bơi xong rồi, đã lên bờ lại cùng bạn nhé!';
    pushChatHistory('assistant', reply);
    speak(`[FAST-PATH] ${reply}`);
    return true;
  }

  // 3. Động tác 3D
  if (
    lower.includes('đâm thủng cửa sổ') ||
    lower.includes('dam thung cua so') ||
    lower.includes('đâm xuyên cửa sổ') ||
    lower.includes('dam xuyen cua so') ||
    lower.includes('thủng trang giấy') ||
    lower.includes('thung trang giay')
  ) {
    const crashMsg = triggerWindowPaperCrash();
    pushChatHistory('user', text);
    pushChatHistory('assistant', crashMsg);
    return true;
  }
  if (
    lower.includes('hóa hulk') ||
    lower.includes('hoa hulk') ||
    lower.includes('hulk xanh') ||
    lower.includes('khổng lồ xanh') ||
    lower.includes('khong lo xanh')
  ) {
    const hulkMsg = triggerHulkRageMode();
    pushChatHistory('user', text);
    pushChatHistory('assistant', hulkMsg);
    return true;
  }
  if (lower.includes('lộn nhào') || lower === 'backflip' || lower.includes('nhào lộn')) {
    triggerBackflip();
    pushChatHistory('user', text);
    const reply = 'Xem cú lộn nhào ngoạn mục của tớ này!';
    pushChatHistory('assistant', reply);
    speak(`[FAST-PATH] ${reply}`);
    return true;
  }
  if (lower.includes('nhảy múa') || lower.includes('múa đi') || lower === 'dance') {
    if (danceCb) danceCb();
    pushChatHistory('user', text);
    const reply = 'Cùng nhảy theo điệu nhạc sôi động nào!';
    pushChatHistory('assistant', reply);
    speak(`[FAST-PATH] ${reply}`);
    return true;
  }
  if (lower.includes('quét radar') || lower.includes('radar scan')) {
    triggerDuckRadarScan();
    pushChatHistory('user', text);
    const reply = 'Đang bật radar quét 360 độ toàn bộ desktop!';
    pushChatHistory('assistant', reply);
    speak(`[FAST-PATH] ${reply}`);
    return true;
  }
  if (
    lower.includes('bảo vệ lãnh thổ') ||
    lower.includes('đấu kiếm') ||
    lower.includes('cầm kiếm') ||
    lower.includes('đuổi vịt') ||
    lower.includes('kẻ xâm phạm') ||
    lower.includes('đĩa bay') ||
    lower.includes('ufo') ||
    lower.includes('bắn súng')
  ) {
    const isUfoCmd =
      lower.includes('đĩa bay') || lower.includes('ufo') || lower.includes('bắn súng');
    triggerTerritoryDefenseMode(true, isUfoCmd ? 'ufo' : undefined);
    pushChatHistory('user', text);
    const reply = isUfoCmd
      ? 'Báo động đĩa bay xâm nhập! Rút Súng Laser bắn hạ UFO bảo vệ lãnh thổ ngay!'
      : 'Kích hoạt chế độ Bảo vệ Lãnh thổ! Đánh đuổi vịt xâm phạm ngay!';
    pushChatHistory('assistant', reply);
    return true;
  }

  // 4. Quản lý cửa sổ
  const hasWinCtx = /(?:màn hình|man hinh|cửa sổ|cua so|window|app)/i.test(lower);
  if (
    (lower.includes('chia đôi') || lower.includes('chia 2') || (lower.includes('split') && hasWinCtx)) &&
    (hasWinCtx || text.length <= 16)
  ) {
    void arrangeDesktopWindows('split_2');
    pushChatHistory('user', text);
    const reply = 'Tớ chia đôi màn hình 50/50 cho bạn ngay đây!';
    pushChatHistory('assistant', reply);
    speak(`[FAST-PATH] ${reply}`);
    return true;
  }
  if (
    (lower.includes('xếp lưới') || lower.includes('dọn màn hình') || (lower.includes('grid') && hasWinCtx)) &&
    (hasWinCtx || text.length <= 16)
  ) {
    void arrangeDesktopWindows('grid');
    pushChatHistory('user', text);
    const reply = 'Đã sắp xếp toàn bộ cửa sổ thành lưới gọn gàng cho bạn!';
    pushChatHistory('assistant', reply);
    speak(`[FAST-PATH] ${reply}`);
    return true;
  }
  if (
    (lower.includes('thu nhỏ') || (lower.includes('shrink') && hasWinCtx)) &&
    (hasWinCtx || text.length <= 16)
  ) {
    startPhysicalResize('shrink');
    pushChatHistory('user', text);
    const reply = 'Đã thu nhỏ kích thước cửa sổ cho bạn!';
    pushChatHistory('assistant', reply);
    speak(`[FAST-PATH] ${reply}`);
    return true;
  }

  // 5. Phần cứng
  if (lower.includes('dọn ram') || lower.includes('clean ram') || lower.includes('giải phóng ram')) {
    void runHardwareAction('clean_ram');
    pushChatHistory('user', text);
    const reply = 'Đang giải phóng và tối ưu bộ nhớ RAM cho hệ thống!';
    pushChatHistory('assistant', reply);
    speak(`[FAST-PATH] ${reply}`);
    return true;
  }
  if (lower.includes('kiểm tra cpu') || lower.includes('kiểm tra phần cứng') || lower.includes('check cpu') || lower.includes('thông số máy')) {
    void runHardwareCheck(true);
    pushChatHistory('user', text);
    const reply = 'Đây là toàn bộ thông số phần cứng hiện tại của máy tính bạn nhé!';
    pushChatHistory('assistant', reply);
    speak(`[FAST-PATH] ${reply}`);
    return true;
  }

  // 6. Mở app
  const appMatch = lower.match(/^(?:mở|bật|chạy|open)\s+(chrome|notepad|calculator|calc|vscode|code|cmd|terminal|youtube)/i);
  if (appMatch?.[1]) {
    const app = appMatch[1].toLowerCase();
    const target = app === 'calc' || app === 'calculator' ? 'calc'
      : app === 'vscode' || app === 'code' ? 'code'
        : app === 'youtube' ? 'https://www.youtube.com'
          : app;
    void runPcOpen(target, app);
    pushChatHistory('user', text);
    const reply = `Tớ mở ${app} cho bạn ngay đây nhé!`;
    pushChatHistory('assistant', reply);
    speak(`[FAST-PATH] ${reply}`);
    return true;
  }

  // 7. Hiệu năng ứng dụng Duck AI Manager
  if (
    lower.includes('hiệu năng app') ||
    lower.includes('hiệu năng của app') ||
    lower.includes('hiệu năng vịt') ||
    lower.includes('app metrics') ||
    lower.includes('thông số app')
  ) {
    const res = await runCheckAppMetrics(true);
    pushChatHistory('user', text);
    pushChatHistory('assistant', res);
    speak(res);
    return true;
  }

  // 8. Kiểm tra mạng / Ping
  if (lower.includes('kiểm tra mạng') || lower.includes('check mạng') || lower.includes('check ping') || lower.includes('check network') || lower.includes('kiểm tra wifi') || lower.includes('ping mạng')) {
    const res = await runNetworkCheck(true);
    pushChatHistory('user', text);
    pushChatHistory('assistant', res);
    speak(res);
    return true;
  }

  // 9. Trí nhớ & Thói quen
  if (
    /(?:xem|kiểm tra|check|phân tích|phan tich|mở|mo|hiện|hien)\s+.*(?:trí nhớ|tri nho|thói quen|thoi quen)/i.test(
      lower
    ) ||
    (text.length <= 18 && (lower.includes('trí nhớ') || lower.includes('thói quen')))
  ) {
    pushChatHistory('user', text);
    const ins = await runMemoryCheck(true);
    const topApps = ins?.top_apps_today?.slice(0, 3).map((a) => a.app_title).join(', ') || 'Chưa có';
    const factCount = ins?.profile_facts?.length || 0;
    const reply = `Đã phân tích trí nhớ: ${factCount} sự kiện/thói quen, ứng dụng dùng nhiều: ${topApps}.`;
    pushChatHistory('assistant', reply);
    speak(reply);
    return true;
  }

  // 10. Tổng kết ngày
  if (lower.includes('tổng kết ngày') || lower.includes('tổng kết hôm nay')) {
    pushChatHistory('user', text);
    const ins = await runMemoryCheck(false);
    let summary = 'Hôm nay bạn chưa có nhiều hoạt động ghi nhận trong hệ thống.';
    if (ins) {
      summary = await generateDailySummary(ins);
    }
    pushChatHistory('assistant', summary);
    speak(summary);
    return true;
  }

  // 11. Đổi nhân vật
  if (lower.includes('đổi sang nvidia') || lower.includes('vịt microduck') || lower.includes('robot vịt')) {
    pushChatHistory('user', text);
    await clearCachedVrm();
    createMicroDuckCharacter();
    spawnParticles(appState.posX, appState.posY - 90, 14, 0x76b900);
    const reply = 'Đã biến hình thành Robot Vịt MicroDuck NVIDIA!';
    pushChatHistory('assistant', reply);
    speak(reply);
    return true;
  }
  if (lower.includes('đổi sang idol') || lower.includes('cyber idol') || lower.includes('nữ idol')) {
    pushChatHistory('user', text);
    await clearCachedVrm();
    createDetailedAnimeCharacter();
    spawnParticles(appState.posX, appState.posY - 90, 10, 0x38bdf8);
    const reply = 'Đã biến hình thành Nữ Cyber Idol 3D!';
    pushChatHistory('assistant', reply);
    speak(reply);
    return true;
  }

  // 12. Giá Bitcoin
  if (lower.includes('giá bitcoin') || lower.includes('giá btc') || lower.includes('check btc') || lower.includes('kiểm tra coin') || lower.includes('giá coin')) {
    const res = await runBitcoinCheck(true);
    pushChatHistory('user', text);
    pushChatHistory('assistant', res);
    speak(res);
    return true;
  }

  return false;
}

export async function chatWithLocalLlm(userText: string) {
  appState.isChatting = true;
  if (isBusy) {
    speak('[CHỜ CHÚT] Tớ đang suy nghĩ câu trước, đợi xíu nhé...');
    return;
  }
  hideSuggestionButtons();

  // Zero-Latency Fast Path: Xử lý tức thì các thao tác máy tính trong 5ms không cần đợi LLM
  const fastHandled = await tryZeroLatencyFastPath(userText);
  if (fastHandled) {
    return;
  }

  const prevUserTurn =
    [...chatHistory].reverse().find((m) => m.role === 'user')?.content || '';
  const pinnedFiles = getPinnedChatFiles();
  const hasPinnedFiles = pinnedFiles.length > 0;
  const historyTag = formatPinnedFilesChatTag();
  pushChatHistory('user', `${historyTag}${userText}`);
  executedToolsThisTurn.length = 0;
  richTraceThisTurn.length = 0;
  createdImagesThisTurn.length = 0;
  const turnStartMs = performance.now();
  window.dispatchEvent(
    new CustomEvent('duck-ws-user-message', { detail: { text: `${historyTag}${userText}` } })
  );

  // Background học quy tắc & sự kiện cá nhân từ người dùng
  void extractAndSaveUserFacts(userText).catch(() => { });

  const isLlmAvailable =
    isOllamaOnline || colabCloudOnline || Boolean(geminiApiKey.trim()) || routerHealthyCount > 0;

  // Nếu người dùng không bật Ollama, Colab và chưa nhập Gemini API Key -> dùng bộ heuristic xử lý offline
  if (!isLlmAvailable) {
    const handled = await fallbackHeuristicCommandHandler(userText);
    if (handled) return;
    if (hasPinnedFiles) {
      await summarizeLastIngestedFile(pinnedFiles[pinnedFiles.length - 1].analysis);
      return;
    }
    speak('[LLM OFFLINE] Hãy bật Ollama ("ollama serve") hoặc nhập Gemini API Key trong Studio 3D để trò chuyện tự do nhé!');
    return;
  }

  isBusy = true;
  const useGemini = shouldRouteToGemini(userText, hasPinnedFiles);

  // Bật chế độ nhận Token Stream thời gian thực
  activeStreamEngine = useGemini ? geminiModel : ollamaModel;
  isStreamingActive = true;
  streamingBuffer = '';
  streamEmotionApplied = false;
  clearSpeechMessage();
  setBubbleThinkingState(true, `[${activeStreamEngine}] Duck AI đang suy luận...`);
  fireAnimationTrigger('event', 'ai_thinking', 'enter');

  // Tạo ngữ cảnh thời gian thực rút gọn
  const now = new Date();
  const daysVi = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const dayOfWeek = daysVi[now.getDay()];
  const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const temporalStr = `Hôm nay là ${dayOfWeek}, ${timeStr}.`;

  const withTimeout = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
    Promise.race([p.catch(() => fallback), new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

  const looksLikeToolTask =
    hasPinnedFiles ||
    /vẽ|ve |chart|biểu đồ|bieu do|file|tệp|desktop|phân tích|phan tich|doanh thu|tìm|tim |mở|mo |gửi|gui |đọc|doc |tạo|tao |xuất|xuat |zalo|mail|excel|csv|pdf|code|git|ram|cpu|port|xổ số|xo so|nhạc|nhac|thời tiết|thoi tiet|giá|gia /i.test(
      userText
    );
  const routeTopK = looksLikeToolTask || userText.trim().length >= 48 ? 6 : 3;
  const [insights, longMemoryBlock, schedules, semanticHits, cogContext, packRoute] =
    await Promise.all([
      runMemoryCheck(false),
      buildLongMemoryPromptBlock(),
      invoke<ScheduledNoteEntry[]>('schedule_note_list').catch(() => [] as ScheduledNoteEntry[]),
      isOllamaOnline ? withTimeout(searchSemanticMemory(userText), 1200, [] as string[]) : Promise.resolve([] as string[]),
      withTimeout(invoke<CognitiveContextBundle>('cog_build_context', { query: userText }), 1500, null),
      withTimeout(invoke<PackRouteResult>('pack_route_skills', { query: userText, topK: routeTopK }), 1500, null),
    ]);

  const memoryLines: string[] = [];
  if (insights && insights.profile_facts.length > 0) {
    memoryLines.push(
      `Hồ sơ/Quy tắc: ${insights.profile_facts.slice(0, 6).map((f) => `${f.key}=${f.value}`).join(', ')}`
    );
  }
  const pendingSchedules = schedules.filter((s) => !s.is_done).slice(0, 4);
  if (pendingSchedules.length > 0) {
    memoryLines.push(
      `Lịch hẹn & Ghi chú đang có: ${pendingSchedules
        .map((s) => `${s.schedule_time ? `[${s.schedule_time}${s.repeat_daily ? ' hằng ngày' : ''}] ` : ''}${s.content.slice(0, 40)}`)
        .join(' | ')}`
    );
  }
  if (insights?.habit_for_hour) {
    memoryLines.push(
      `Thói quen giờ ${now.getHours()}h: hay dùng ${insights.habit_for_hour.app_title}`
    );
  } else if (insights?.top_apps_today && insights.top_apps_today.length > 0) {
    memoryLines.push(
      `App dùng nhiều hôm nay: ${insights.top_apps_today.slice(0, 3).map((a) => a.app_title).join(', ')}`
    );
  }
  if (appState.openWindows.length > 0) {
    memoryLines.push(
      `Cửa sổ đang mở: ${appState.openWindows.slice(0, 3).map((w) => w.process_name || w.title.slice(0, 20)).join(', ')}`
    );
  }
  if (semanticHits.length > 0) {
    memoryLines.push(`Ký ức liên quan: ${semanticHits.join(' ; ').slice(0, 260)}`);
  }
  if (cogContext?.prompt_block) {
    memoryLines.push(cogContext.prompt_block);
  }

  const memoryBlock = memoryLines.length > 0 ? `\n${memoryLines.join('\n')}` : '';
  const compactLongBlock = longMemoryBlock ? `\n${longMemoryBlock.trim().slice(0, 420)}` : '';
  const packSkillsBlock = packRoute?.prompt_block || '';
  const customSkillsBlock = `${buildCustomSkillsPromptBlock()}${packSkillsBlock}`;
  const pinnedLocalBlock = buildPinnedFilesPromptContext(false);
  const pinnedRichBlock = buildPinnedFilesPromptContext(true);
  const lengthRule = hasPinnedFiles
    ? 'trả lời đầy đủ, rõ ràng, có cấu trúc dựa trên dữ liệu file đang ghim'
    : '2-4 câu ngắn gọn, trọn vẹn ý, tiếng Việt';

  const localSystemPrompt = `Bạn là Duck AI Manager - trợ lý 3D đồng hành trên Windows.
${COMPACT_LOCAL_TOOLSET_PROMPT}${customSkillsBlock}${compactLongBlock}
${temporalStr}${memoryBlock}${pinnedLocalBlock}
YÊU CẦU:
- Tận dụng lịch hẹn, thói quen, hồ sơ chủ nhân, các CUSTOM SKILLS và FILE ĐANG GHIM ở trên để trả lời hữu ích, đúng ngữ cảnh (${lengthRule}).
- TUYỆT ĐỐI KHÔNG dùng emoji.
- Khi cần thực hiện thao tác máy tính, xử lý file hoặc dùng kho 209 tools, CHÍNH BẠN gắn thẻ [TOOL:tên_tool:{...}] ở cuối câu.
- Nếu người dùng yêu cầu một tác vụ chuyên biệt mà kho công cụ hiện tại CHƯA CÓ skill phù hợp (ví dụ lấy dữ liệu API đặc thù mới), hãy giải thích ngắn gọn và gắn thẻ [[SUGGEST_SKILL: skill_<ten_tieng_anh> | <mô tả chi tiết yêu cầu kỹ thuật để SkillEvolver tự đẻ code Python + Pytest>]] ở cuối câu.`;

  const geminiSystemPrompt = `Bạn là Duck AI Manager - trợ lý 3D đồng hành trên Windows.
${DESKTOP_TOOLSET_PROMPT}${customSkillsBlock}${longMemoryBlock}
${temporalStr}${memoryBlock}${pinnedRichBlock}
YÊU CẦU:
- Chủ động tận dụng lịch hẹn, thói quen, quy tắc, CUSTOM SKILLS, FILE ĐANG GHIM và ngữ cảnh đã lưu trong SQLite để hỗ trợ thông minh (${lengthRule}).
- TUYỆT ĐỐI KHÔNG dùng emoji.
- Khi cần thực hiện thao tác máy tính, xử lý file hoặc dùng kho 209 tools, CHÍNH BẠN gắn thẻ [TOOL:tên_tool:{...}] ở cuối câu.
- Nếu người dùng yêu cầu một tác vụ chuyên biệt mà kho công cụ hiện tại CHƯA CÓ skill phù hợp (ví dụ lấy dữ liệu API đặc thù mới), hãy giải thích ngắn gọn và gắn thẻ [[SUGGEST_SKILL: skill_<ten_tieng_anh> | <mô tả chi tiết yêu cầu kỹ thuật để SkillEvolver tự đẻ code Python + Pytest>]] ở cuối câu.`;

  const messagesToSend = buildCompactedHistoryWindow(
    chatHistory,
    userText,
    useGemini ? 10 : 4,
    useGemini ? 4 : 2
  );
  try {
    const isComplexPrompt =
      hasPinnedFiles ||
      userText.length > 140 ||
      /phân tích|tạo skill|viết code|refactor|kiến trúc|so sánh|báo cáo|biểu đồ|pipeline|sau đó|rồi /i.test(userText);
    const { reply: rawReply, engine } = await askHybridLlm(
      localSystemPrompt,
      geminiSystemPrompt,
      messagesToSend,
      useGemini,
      isComplexPrompt ? 1024 : 0,
      isComplexPrompt ? 4096 : 1536
    );
    updateLlmBadge(isOllamaOnline, engine);
    isStreamingActive = false;

    const { cleanText, toolCalls } = parseAiToolCalls(rawReply);
    let finalCleanText = cleanText ? applyAutoEmotionFromText(cleanText) : '';

    // Dispatch tool calls từ LLM tuần tự với độ trễ chuyển động vật lý
    let executedTool = false;
    lastToolOutputSummary = '';
    if (toolCalls.length > 0) {
      for (let i = 0; i < toolCalls.length; i++) {
        const tc = toolCalls[i];
        executedTool = (await dispatchAiToolCall(tc)) || executedTool;
        if (i < toolCalls.length - 1) {
          await new Promise((r) => setTimeout(r, 1350));
        }
      }
    }

    if (!finalCleanText) {
      finalCleanText = lastToolOutputSummary || 'Tớ đã thực hiện yêu cầu của bạn ngay đây!';
      applyAutoEmotionFromText(finalCleanText);
    } else if (lastToolOutputSummary && !finalCleanText.includes(lastToolOutputSummary.slice(0, 12))) {
      finalCleanText = `${finalCleanText} ${lastToolOutputSummary}`;
    }

    // Safety fallback: Chỉ kích hoạt nếu không phải câu hỏi/than phiền và có mục đích gửi tin rõ ràng hoặc không ghim file
    if (!executedTool && !isQuestionOrMetaDiscussion(userText)) {
      if (extractChatContactAndMessage(userText)) {
        executedTool = await dispatchAiToolCall({ tool: 'agent_task', params: { goal: userText } });
        if (executedTool && lastToolOutputSummary) {
          finalCleanText = `${finalCleanText}\n${lastToolOutputSummary}`.trim();
        }
      }
    }
    if (!executedTool && !isQuestionOrMetaDiscussion(userText) && !hasPinnedFiles) {
      const chainedHandled = await executeChainedHeuristicCommands(userText);
      if (chainedHandled) {
        executedTool = true;
      } else {
        const lower = userText.toLowerCase().trim();
        const explicitFileMatch = userText.match(
          /^(?:hãy\s+|hay\s+|giúp\s+tớ\s+|giup\s+to\s+|nhờ\s+|nho\s+)?(?:mở|mo|bật|bat|chạy|chay|open)\s+(?:t\s+|tớ\s+|cho tớ\s+|cho t\s+|giúp\s+|hộ\s+)?(?:file|tệp|tep|tập tin|tap tin)?\s*["']?([a-zA-Z0-9_.\-\\/: ]+\.[a-zA-Z0-9]{1,8})["']?$/i
        );
        if (explicitFileMatch?.[1]) {
          void runPcOpenFile(explicitFileMatch[1].trim());
          executedTool = true;
        } else if (/\b(?:đi bơi|bơi đi|xuống hồ)\b/.test(lower) || lower === 'swim') {
          triggerStartSwimming(true);
          executedTool = true;
        } else if (lower.includes('lên bờ') || lower.includes('dừng bơi')) {
          triggerStopSwimming(true);
          executedTool = true;
        }
      }
    }

    const honesty = verifyActionHonesty(userText, finalCleanText, executedTool);
    finalCleanText = honesty.cleanedReply;
    if (honesty.spoofDetected && packRoute && packRoute.routed.length > 0) {
      finalCleanText = `[SELF-VERIFY] Phát hiện câu trả lời chưa gọi tool thật; gợi ý chạy tool \`${packRoute.routed[0].tool_name}\`.\n${finalCleanText}`;
    }

    const hasAnyOkTool =
      executedTool && (richTraceThisTurn.length === 0 || richTraceThisTurn.some((t) => t.ok));
    const sugParsed = extractSuggestedSkillFromTurn(finalCleanText, userText, hasAnyOkTool);
    finalCleanText = sugParsed.cleanedAnswer;

    // Detect any image paths mentioned directly in text as well
    const pathMatches = finalCleanText.match(/[a-zA-Z]:[\\/][^\s"'`<>|?*]+\.(?:png|jpg|jpeg|webp)/gi) || [];
    for (const pm of pathMatches) {
      if (!createdImagesThisTurn.includes(pm)) createdImagesThisTurn.push(pm);
    }

    const richMeta: RichTurnMeta = {
      engine: engine === 'Gemini' ? (lastRouterEndpointLabel || geminiModel) : engine,
      elapsed_ms: Math.round(performance.now() - turnStartMs),
      routed_tools: (packRoute?.routed || []).map((r) => r.tool_name),
      trace: [...richTraceThisTurn],
      image_paths: [...createdImagesThisTurn],
      suggested_skill: sugParsed.suggested,
      user_prompt: userText,
    };

    pushChatHistory('assistant', finalCleanText);
    window.dispatchEvent(
      new CustomEvent('duck-ws-assistant-message', {
        detail: { content: finalCleanText, meta: richMeta },
      })
    );
    void saveSemanticMemory(`Chủ nhân: ${userText} -> Trợ lý: ${finalCleanText}`);
    void invoke('cog_learn_from_turn', {
      userPrompt: userText,
      prevUserPrompt: prevUserTurn,
      assistantReply: finalCleanText,
      executedTools: [...executedToolsThisTurn],
    }).catch(() => { });

    appState.velY = -6;
    appState.triggerSquash(0.88, 1.15);
    appState.setState('JUMPING');
    if (appState.expressionMood === 'neutral') {
      appState.setExpression('happy', 3.0);
    }
    appState.changeMood(3);
    stopAllThinkingClips();
    setBubbleThinkingState(false);
    fireAnimationTrigger('event', 'chat_reply', 'enter');
    setStreamSpeechText(`[${engine}] ${finalCleanText}`);
    void speakVietnameseTts(finalCleanText);
  } catch (err) {
    stopAllThinkingClips();
    setBubbleThinkingState(false);
    updateLlmBadge(false);
    // Nếu LLM lỗi mạng/offline, tự động chạy heuristic handler dự phòng
    const handled = await fallbackHeuristicCommandHandler(userText);
    if (!handled) {
      speak(
        `[LLM LỖI] ${String(err)}. Hãy kiểm tra mạng hoặc bật Ollama nhé!`
      );
    }
  } finally {
    stopAllThinkingClips();
    setBubbleThinkingState(false);
    isStreamingActive = false;
    isBusy = false;
  }
}

function presentHabitSuggestion(appTitle: string, hour: number, totalSec: number) {
  const patternKey = `hour_${hour}_${appTitle}`;
  const mins = Math.max(1, Math.round(totalSec / 60));
  appState.setState('WAVING');

  if (appTitle.startsWith('YT: ')) {
    const topic = appTitle.slice(4).trim();
    speak(
      `[GỢI Ý YOUTUBE] Khoảng ${hour}h bạn hay nghe/xem "${topic}" (tổng ${mins} phút). Bạn có muốn tớ mở lại trên YouTube không?`
    );
    showSuggestionButtons(
      () => {
        appState.setExpression('happy', 3.0);
        void invoke('memory_record_feedback', { patternKey, accepted: true }).catch(() => { });
        void runPcOpen(
          `https://www.youtube.com/results?search_query=${encodeURIComponent(topic)}`,
          topic
        );
      },
      () => {
        appState.setExpression('sad', 2.4);
        void invoke('memory_record_feedback', { patternKey, accepted: false }).catch(() => { });
        speak('Okela, khi nào cần tớ sẽ nhắc sau nhé!');
      }
    );
    return;
  }

  if (appTitle.startsWith('Web: ')) {
    const site = appTitle.slice(5).trim();
    speak(
      `[GỢI Ý WEB] Khoảng ${hour}h bạn hay mở "${site}" (tổng ${mins} phút). Bạn có muốn tớ tìm mở lại trang này không?`
    );
    showSuggestionButtons(
      () => {
        appState.setExpression('happy', 3.0);
        void invoke('memory_record_feedback', { patternKey, accepted: true }).catch(() => { });
        void runPcOpen(
          `https://www.google.com/search?q=${encodeURIComponent(site)}`,
          site
        );
      },
      () => {
        appState.setExpression('sad', 2.4);
        void invoke('memory_record_feedback', { patternKey, accepted: false }).catch(() => { });
        speak('Okela, khi nào cần tớ sẽ nhắc sau nhé!');
      }
    );
    return;
  }

  speak(
    `[GỢI Ý CÁ NHÂN] Khoảng ${hour}h bạn hay dùng ${appTitle} (tổng ${mins} phút). Bạn có muốn tớ mở ${appTitle} hoặc bật nhạc nhẹ không?`
  );
  showSuggestionButtons(
    () => {
      appState.setExpression('happy', 3.0);
      void invoke('memory_record_feedback', { patternKey, accepted: true }).catch(() => { });
      if (appTitle === 'YouTube') {
        void runPcOpen('https://www.youtube.com', 'YouTube');
      } else if (appTitle === 'VS Code') {
        void runPcOpen('code', 'VS Code');
      } else {
        void runPcOpen('https://www.youtube.com/results?search_query=lofi+chill', 'Nhạc Lofi');
      }
    },
    () => {
      appState.setExpression('sad', 2.4);
      void invoke('memory_record_feedback', { patternKey, accepted: false }).catch(() => { });
      speak('Okela, khi nào cần tớ sẽ nhắc sau nhé!');
    }
  );
}

export async function runShowSuggestion() {
  const hour = new Date().getHours();
  const [ins, bh] = await Promise.all([
    runMemoryCheck(false),
    runBrowserHistoryCheck(false),
  ]);
  const habit = ins?.habit_for_hour;
  const fallbackApp = ins?.top_apps_today[0];
  const topYt = bh?.top_youtube[0];
  const topSite = bh?.top_sites[0];

  if (habit && (habit.app_title.startsWith('YT: ') || habit.app_title.startsWith('Web: '))) {
    presentHabitSuggestion(habit.app_title, hour, habit.total_sec);
    return;
  }

  if (topYt) {
    const cleanTitle = topYt.title.replace(/\s*[-—|]\s*YouTube$/i, '').trim();
    appState.setState('WAVING');
    speak(
      `[GỢI Ý TỪ ${bh.browser_name.toUpperCase()}] Thấy bạn hay nghe/xem "${cleanTitle}" (${topYt.visit_count} lượt). Muốn tớ mở ngay video/kênh này cho bạn không?`
    );
    showSuggestionButtons(
      () => {
        appState.setExpression('happy', 3.0);
        void runPcOpen(topYt.url, cleanTitle);
      },
      () => {
        appState.setExpression('sad', 2.4);
        speak('Okela, để sau nhé!');
      }
    );
    return;
  }

  if (habit) {
    presentHabitSuggestion(habit.app_title, hour, habit.total_sec);
    return;
  }

  if (topSite) {
    appState.setState('WAVING');
    speak(
      `[GỢI Ý WEB] Bạn hay vào trang "${topSite.title.slice(0, 28)}" (${topSite.visit_count} lượt). Có muốn tớ mở lại luôn không?`
    );
    showSuggestionButtons(
      () => {
        appState.setExpression('happy', 3.0);
        void runPcOpen(topSite.url, topSite.title.slice(0, 24));
      },
      () => speak('Okela, để lúc khác nhé!')
    );
    return;
  }

  if (fallbackApp) {
    presentHabitSuggestion(fallbackApp.app_title, hour, fallbackApp.total_sec);
    return;
  }

  appState.setState('WAVING');
  speak(
    '[GỢI Ý CÁ NHÂN] Tớ chưa có đủ dữ liệu thói quen giờ này. Bạn có muốn bật nhạc Lofi chill trong lúc làm việc không?'
  );
  showSuggestionButtons(
    () => {
      void runPcOpen('https://www.youtube.com/results?search_query=lofi+chill', 'Nhạc Lofi');
    },
    () => {
      speak('Okela, cứ làm việc thoải mái nhé!');
    }
  );
}

async function runProactiveCheckIn() {
  if (
    !autoCheckEnabled ||
    isBusy ||
    isP2pSessionActive() ||
    appState.state === 'DRAGGING' ||
    appState.state === 'PUSHING' ||
    appState.state === 'PULLING' ||
    appState.isStudioOpen
  ) {
    return;
  }

  proactiveStep = (proactiveStep + 1) % 4;

  if (proactiveStep === 0) {
    try {
      const hw = await invokeCachedTelemetry<HardwareInfo>('hw', 'check_hardware', false);
      updateHardwareDashboard(hw);
      const { cpuHigh, ramHigh } = isHardwareOverThreshold(hw);
      if (cpuHigh || ramHigh) {
        const alertText = `CPU ${hw.cpu_load_pct.toFixed(0)}% (>${cpuAlertPct}%), RAM ${hw.ram_used_gb.toFixed(1)} GB (>${ramAlertGb} GB) đang vượt ngưỡng!`;
        appState.setExpression('surprised', 3.5);
        showTelemetrySection('alert');
        pushDashboardAlert(`CẢNH BÁO: ${alertText}`);
        speak(`[CẢNH BÁO] ${alertText} Bạn có muốn tắt bớt ứng dụng nền không?`);
      }
    } catch {
      // Bỏ qua lỗi nền
    }
  } else if (proactiveStep === 1) {
    const net = await refreshLlmStatus();
    if (net && !net.internet_ok) {
      showTelemetrySection('alert');
      pushDashboardAlert('CẢNH BÁO MẠNG: Mất kết nối Internet!');
      speak('[CẢNH BÁO MẠNG] Hình như máy tính vừa mất kết nối Internet!');
    }
  } else if (proactiveStep === 2) {
    try {
      const btc = await invokeCachedTelemetry<BitcoinInfo>('btc', 'check_bitcoin', false);
      updateBitcoinDashboard(btc);
      if (lastBtcPrice !== null) {
        const diffPct = Math.abs(((btc.price_usd - lastBtcPrice) / lastBtcPrice) * 100);
        if (diffPct >= 0.8) {
          const sum = formatBitcoinSummary(btc);
          showTelemetrySection('btc');
          pushDashboardAlert(`BIẾN ĐỘNG: ${sum}`);
          speak(`[BIẾN ĐỘNG BTC] ${sum}`);
        }
      }
      lastBtcPrice = btc.price_usd;
    } catch {
      // Bỏ qua lỗi mạng
    }
  } else if (proactiveStep === 3) {
    // Tổng hợp thói quen từ SQLite & đưa gợi ý hành động có nút Đồng ý / Để sau
    const hour = new Date().getHours();
    const ins = await runMemoryCheck(false);
    const habit = ins?.habit_for_hour;
    const nowSec = Math.floor(Date.now() / 1000);

    if (
      habit &&
      habit.total_sec >= 120 &&
      habit.dismissed_count <= habit.accepted_count + 2 &&
      nowSec - habit.last_shown_at >= 1200
    ) {
      presentHabitSuggestion(habit.app_title, hour, habit.total_sec);
      return;
    }

    if (isOllamaOnline) {
      isBusy = true;
      try {
        const hw = await invoke<HardwareInfo>('check_hardware').catch(() => null);
        if (hw) updateHardwareDashboard(hw);
        const hwSnippet = hw
          ? `CPU ${hw.cpu_load_pct.toFixed(0)}%, RAM ${hw.ram_used_pct.toFixed(0)}%.`
          : '';
        const topApp = ins?.top_apps_today[0]
          ? `Hôm nay dùng nhiều nhất: ${ins.top_apps_today[0].app_title}.`
          : '';
        const timeStr = new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const longMemoryBlock = await buildLongMemoryPromptBlock();
        const prompt = `Bây giờ là ${timeStr}. ${hwSnippet} ${topApp} Hãy chủ động hỏi thăm chủ nhân 1 câu thật ngắn gọn (1 câu, tiếng Việt có dấu, không emoji) về công việc hoặc nhắc uống nước / nghỉ mắt.`;

        const reply = await invoke<string>('ask_ollama', {
          model: ollamaModel,
          messages: [
            {
              role: 'system',
              content:
                `Bạn là Duck AI Manager.${longMemoryBlock} Chỉ trả lời đúng 1 câu ngắn bằng tiếng Việt có dấu, không emoji.`,
            },
            { role: 'user', content: prompt },
          ],
        });
        if (reply) {
          appState.setState('WAVING');
          speak(reply);
        }
      } catch {
        updateLlmBadge(false);
      } finally {
        isBusy = false;
      }
    }
  }
}

export type ScheduledContentKind = 'english' | 'news' | 'weather' | 'app_metrics' | 'btc';

let lastEnglishAutoAt = Date.now();
let lastNewsAutoAt = Date.now();
let lastWeatherAutoAt = Date.now();
let lastAppMetricsAutoAt = Date.now();
let lastBtcAutoAt = Date.now();
let lastAutoContentAnnouncementAt = 0;

export function resetContentScheduleTimer(kind?: ScheduledContentKind) {
  const now = Date.now();
  if (!kind || kind === 'english') lastEnglishAutoAt = now;
  if (!kind || kind === 'news') lastNewsAutoAt = now;
  if (!kind || kind === 'weather') lastWeatherAutoAt = now;
  if (!kind || kind === 'app_metrics') lastAppMetricsAutoAt = now;
  if (!kind || kind === 'btc') lastBtcAutoAt = now;
}

async function runScheduledWithRadarEffect(label: string, task: () => Promise<unknown>) {
  if (
    !isP2pSessionActive() &&
    appState.state !== 'SWIMMING' &&
    appState.state !== 'DRAGGING' &&
    appState.state !== 'SWINGING_WINDOW' &&
    appState.state !== 'BUTT_PLANT'
  ) {
    appState.setState('RADAR');
    show3DRadar(true);
    spawnScanEffect(appState.posX, appState.posY);
    speak(`[QUÉT RADAR TỰ ĐỘNG] Đang quét dữ liệu ${label}...`);
    await new Promise((r) => setTimeout(r, 1100));
  }
  await task();
}

export async function triggerScheduledContentNow(kind: ScheduledContentKind) {
  if (kind === 'english') {
    await runScheduledWithRadarEffect('Từ vựng Tiếng Anh', () => loadNextEnglishLesson(undefined, true));
  } else if (kind === 'news') {
    await runScheduledWithRadarEffect('Tin Tức Mới', () => loadAndSpeakLiveNews(undefined, true));
  } else if (kind === 'weather') {
    await runScheduledWithRadarEffect('Thời Tiết & Độ Ẩm', () => syncLiveWeather3D('auto', true));
  } else if (kind === 'app_metrics') {
    await runScheduledWithRadarEffect('Hiệu Năng App', () => runCheckAppMetrics(true));
  } else if (kind === 'btc') {
    await runScheduledWithRadarEffect('Giá Bitcoin (BTC)', () => runBitcoinCheck(true));
  }
}

async function checkScheduledContentIntervals() {
  if (
    isBusy ||
    isP2pSessionActive() ||
    appState.state === 'DRAGGING' ||
    appState.state === 'PUSHING' ||
    appState.state === 'PULLING' ||
    appState.state === 'SWIMMING' ||
    appState.state === 'SWINGING_WINDOW' ||
    appState.state === 'BUTT_PLANT' ||
    appState.isStudioOpen ||
    appState.isEdgePeekMode
  ) {
    return;
  }

  const now = Date.now();
  if (now - lastAutoContentAnnouncementAt < 25_000) {
    return;
  }

  if (
    appState.englishIntervalMin > 0 &&
    now - lastEnglishAutoAt >= appState.englishIntervalMin * 60_000
  ) {
    lastEnglishAutoAt = now;
    lastAutoContentAnnouncementAt = now;
    await triggerScheduledContentNow('english');
    return;
  }

  if (
    appState.newsIntervalMin > 0 &&
    now - lastNewsAutoAt >= appState.newsIntervalMin * 60_000
  ) {
    lastNewsAutoAt = now;
    lastAutoContentAnnouncementAt = now;
    await triggerScheduledContentNow('news');
    return;
  }

  if (
    appState.weatherIntervalMin > 0 &&
    now - lastWeatherAutoAt >= appState.weatherIntervalMin * 60_000
  ) {
    lastWeatherAutoAt = now;
    lastAutoContentAnnouncementAt = now;
    await triggerScheduledContentNow('weather');
    return;
  }

  if (
    appState.appMetricsIntervalMin > 0 &&
    now - lastAppMetricsAutoAt >= appState.appMetricsIntervalMin * 60_000
  ) {
    lastAppMetricsAutoAt = now;
    lastAutoContentAnnouncementAt = now;
    await triggerScheduledContentNow('app_metrics');
    return;
  }

  if (
    appState.btcIntervalMin > 0 &&
    now - lastBtcAutoAt >= appState.btcIntervalMin * 60_000
  ) {
    lastBtcAutoAt = now;
    lastAutoContentAnnouncementAt = now;
    await triggerScheduledContentNow('btc');
    return;
  }
}

let lastClipboardContent = '';
let continuousWorkMinutes = 0;

export function checkClipboardAndBreakInterval() {
  if (isP2pSessionActive()) return;
  continuousWorkMinutes += 2;
  if (continuousWorkMinutes >= 50) {
    continuousWorkMinutes = 0;
    appState.setState('WAVING');
    speak('[NHẮC NGHỈ NGƠI] Bạn đã làm việc liên tục gần 1 tiếng rồi đấy! Hãy đứng dậy uống ngụm nước và cho mắt nghỉ ngơi 3-5 phút nhé.');
    return;
  }

  void invoke<string>('get_clipboard_text').then((text) => {
    if (!text || text.length < 5 || text.length > 500) return;
    const clean = text.trim();
    if (clean === lastClipboardContent) return;
    lastClipboardContent = clean;
    void invoke('clipboard_history_add', { content: clean }).catch(() => { });

    const isUrl = /^https?:\/\/[^\s]+$/i.test(clean);
    const isCode = clean.includes('{') && clean.includes('}') || clean.includes('function') || clean.includes('const ') || clean.includes('def ') || clean.includes('import ');
    const hasEnFunctionWord = /\b(the|and|for|with|that|this|from|have|will|your|about|which|when|what|where|would|could|should)\b/i.test(clean);
    const hasViNoAccentWord = /\b(hoi|xem|chua|com|anh|em|ban|minh|giup|zalo|nhan|gui|khong|duoc|nho|vao|tren|cho|voi|lam|ngu)\b/i.test(clean);
    const isEnglishParagraph =
      /^[a-zA-Z0-9\s.,'"`?!:;()\-]+$/.test(clean) &&
      clean.split(/\s+/).length > 4 &&
      hasEnFunctionWord &&
      !hasViNoAccentWord;

    if (isUrl && clean.includes('youtube.com')) {
      speak('Thấy bạn vừa copy link YouTube! Bạn có muốn tớ mở video này không?');
      showSuggestionButtons(
        () => {
          void runPcOpen(clean, 'YouTube Video');
        },
        () => { }
      );
    } else if (isCode && clean.length > 15) {
      speak(`Bạn vừa copy 1 đoạn code (${clean.slice(0, 28)}...). Cần tớ giải thích hoặc tối ưu không?`);
      showSuggestionButtons(
        () => {
          void chatWithLocalLlm(`Hãy giải thích hoặc kiểm tra lỗi đoạn code này giúp tôi: ${clean}`);
        },
        () => { }
      );
    } else if (isEnglishParagraph) {
      speak(`Bạn vừa copy đoạn tiếng Anh: "${clean.slice(0, 32)}...". Cần tớ dịch sang tiếng Việt không?`);
      showSuggestionButtons(
        () => {
          void chatWithLocalLlm(`Dịch đoạn tiếng Anh này sang tiếng Việt ngắn gọn: ${clean}`);
        },
        () => { }
      );
    }
  }).catch(() => { });
}

export function initAssistant() {
  registerToolForgeContext({
    getGeminiModel: () => geminiModel,
    getGeminiApiKey: () => geminiApiKey,
    getOllamaModel: () => ollamaModel,
    isOllamaOnline: () => isOllamaOnline,
    hasGeminiKey: () => Boolean(geminiApiKey.trim()),
  });
  void refreshCustomSkills();

  setTimeout(() => {
    void refreshLlmStatus();

    // Lắng nghe Token Stream thời gian thực từ Local LLM / Rust và lọc sạch thẻ [TOOL:...] + đồng bộ cảm xúc câu đầu
    let webStreamSentLen = 0;
    let webStreamTimer: number | null = null;
    const flushWebStreamChunk = () => {
      webStreamTimer = null;
      const cleanFull = sanitizeStreamingText(streamingBuffer);
      if (cleanFull.length < webStreamSentLen) {
        webStreamSentLen = 0;
      }
      if (cleanFull.length > webStreamSentLen) {
        const delta = cleanFull.slice(webStreamSentLen);
        webStreamSentLen = cleanFull.length;
        void syncChatStreamChunkToCloud('live', delta, false).catch(() => { });
      }
    };

    void listen<string>('llm_stream_token', (event) => {
      if (!isStreamingActive) return;
      const token = event.payload;
      streamingBuffer += token;
      const cleanPartial = sanitizeStreamingText(streamingBuffer);
      if (cleanPartial) {
        stopAllThinkingClips();
        setBubbleThinkingState(true, `[${activeStreamEngine}] Đang phản hồi trực tiếp...`);
        if (!streamEmotionApplied && (cleanPartial.length >= 28 || /[.!?]/.test(cleanPartial))) {
          streamEmotionApplied = true;
          applyAutoEmotionFromText(cleanPartial);
        }
        setStreamSpeechText(`[${activeStreamEngine}] ${cleanPartial}`);
        if (webStreamTimer === null) {
          webStreamTimer = window.setTimeout(flushWebStreamChunk, 85);
        }
      }
    });

    // Khôi phục lịch sử hội thoại gần nhất từ SQLite (giới hạn 4 tin nhắn để tiết kiệm token)
    void invoke<ChatEntry[]>('memory_get_recent_chats', { limit: 4 })
      .then((entries) => {
        for (const e of entries) {
          if (e.role === 'user' || e.role === 'assistant') {
            chatHistory.push({ role: e.role, content: e.content });
          }
        }
      })
      .catch(() => { });

    // Tự động áp dụng các quy tắc hành vi đã học từ SQLite khi khởi động
    void runMemoryCheck(false).then((ins) => {
      if (!ins) return;
      for (const fact of ins.profile_facts) {
        if (fact.key === 'Quy tắc cửa sổ') {
          const allow = !fact.value.toLowerCase().includes('không');
          appState.windowInteractEnabled = allow;
          syncCheckbox('chk-win-interact', allow);
        } else if (fact.key === 'Quy tắc chủ động') {
          const allow = !fact.value.toLowerCase().includes('tắt');
          setAutoCheckEnabled(allow);
          syncCheckbox('chk-autocheck', allow);
        } else if (fact.key === 'Ngưỡng CPU') {
          const val = parseFloat(fact.value);
          if (!Number.isNaN(val)) setCpuAlertPct(val, false);
        } else if (fact.key === 'Ngưỡng RAM') {
          const val = parseFloat(fact.value);
          if (!Number.isNaN(val)) setRamAlertGb(val, false);
        }
      }
    });

    // Đồng bộ hiệu ứng thời tiết 3D Live Aura & nạp lịch sử từ vựng Tiếng Anh SQLite sau khởi động
    setTimeout(() => {
      void syncLiveWeather3D('auto', false);
      void refreshEnglishVocabHistoryUi();
    }, 5000);
  }, 1200);

  // Tự động thu thập thói quen sử dụng cửa sổ mỗi 15 giây vào SQLite
  window.setInterval(() => {
    if (document.hidden) return;
    const activeWin = findTargetWindow();
    if (activeWin) {
      const appName = normalizeAppName(activeWin.title, activeWin.process_name);
      const hour = new Date().getHours();
      void invoke('memory_log_activity', {
        appTitle: appName,
        hourOfDay: hour,
        durationSec: 15,
      }).catch(() => { });
    }
  }, 15_000);

  // Theo dõi ngưỡng cảnh báo CPU/RAM mỗi 90 giây (tránh spawn PowerShell WMI quá dày gây hao CPU nền)
  window.setInterval(() => {
    if (!document.hidden && autoCheckEnabled && !appState.isStudioOpen) {
      void checkHardwareAlertNow();
    }
  }, 90_000);

  window.setInterval(() => {
    void runProactiveCheckIn();
  }, 120_000);

  window.setInterval(() => {
    void checkScheduledContentIntervals();
  }, 15_000);

  window.setInterval(() => {
    checkClipboardAndBreakInterval();
  }, 120_000);
}
