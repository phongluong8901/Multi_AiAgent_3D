import { invoke } from '@tauri-apps/api/core';
import { appState } from '../core/state';
import {
  spawnAlertEffect,
  spawnParticles,
  spawnScanEffect,
  spawnShockwave,
} from '../core/particles';
import {
  BitcoinInfo,
  BrowserInsights,
  ChatEntry,
  HardwareInfo,
  LongMemoryEntry,
  MemoryInsights,
  NetworkInfo,
  OcrResultInfo,
  OllamaMessage,
  WeatherInfo,
} from '../core/types';
import {
  findTargetWindow,
  minimizeMultipleWindows,
  performWindowAction,
  startPhysicalPush,
  startPhysicalResize,
} from '../physics/windowInteract';
import {
  triggerBackflip,
  triggerExploreInsideWindow,
  triggerInteractInsideWindow,
  triggerSpin,
} from '../physics/physics';
import { clearCachedVrm } from '../characters/vrmManager';
import {
  createDetailedAnimeCharacter,
  createMicroDuckCharacter,
} from '../characters/characterRig';
import {
  hideSuggestionButtons,
  showSuggestionButtons,
  showTelemetrySection,
} from '../frontend/ui';

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

export type LlmRouteMode = 'auto' | 'gemini' | 'local';

export let ollamaModel = localStorage.getItem('mate_ollama_model') || 'qwen2.5:1.5b';
export let geminiApiKey = localStorage.getItem('mate_gemini_api_key') || '';
export let geminiModel = localStorage.getItem('mate_gemini_model') || 'gemini-2.5-flash';
export let llmRouteMode: LlmRouteMode =
  (localStorage.getItem('mate_llm_route_mode') as LlmRouteMode) || 'auto';
export let autoCheckEnabled = localStorage.getItem('mate_autocheck') !== 'false';
export let cpuAlertPct = Number(localStorage.getItem('mate_alert_cpu_pct') || '85') || 85;
export let ramAlertGb = Number(localStorage.getItem('mate_alert_ram_gb') || '12') || 12;

let isOllamaOnline = false;
let isBusy = false;
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

export function setGeminiApiKey(key: string) {
  const cleaned = key.trim();
  geminiApiKey = cleaned;
  localStorage.setItem('mate_gemini_api_key', cleaned);
  const el = document.getElementById('input-gemini-key') as HTMLInputElement | null;
  if (el && el.value !== cleaned) el.value = cleaned;
  updateLlmBadge(isOllamaOnline);
}

export function setGeminiModel(model: string) {
  const cleaned = model.trim() || 'gemini-2.5-flash';
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
  if (!geminiApiKey.trim()) return false;
  const lower = userText.toLowerCase().trim();
  if (lower.startsWith('@local') || lower.startsWith('/l ')) return false;
  if (lower.startsWith('@gemini') || lower.startsWith('/g ')) return true;
  if (llmRouteMode === 'local') return false;
  if (llmRouteMode === 'gemini') return true;

  if (!isOllamaOnline || isHeavyTask) return true;
  if (userText.trim().length > 36) return true;
  return /giải thích|tại sao|vì sao|làm sao|như thế nào|hướng dẫn|viết|code|lỗi|bug|python|rust|javascript|typescript|sql|so sánh|phân tích|tóm tắt|dịch|là gì|cách làm|thuật toán|kiến trúc/i.test(
    userText
  );
}

async function askHybridLlm(
  systemPrompt: string,
  messages: OllamaMessage[],
  preferGemini: boolean
): Promise<{ reply: string; engine: 'Gemini' | 'Local' }> {
  if (preferGemini && geminiApiKey.trim()) {
    try {
      const reply = await invoke<string>('ask_gemini', {
        apiKey: geminiApiKey,
        model: geminiModel,
        systemPrompt,
        messages,
      });
      return { reply, engine: 'Gemini' };
    } catch (err) {
      if (isOllamaOnline) {
        const reply = await invoke<string>('ask_ollama', {
          model: ollamaModel,
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
        });
        updateLlmBadge(true, 'Local');
        return { reply, engine: 'Local' };
      }
      throw err;
    }
  }

  try {
    const reply = await invoke<string>('ask_ollama', {
      model: ollamaModel,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    });
    updateLlmBadge(true, 'Local');
    return { reply, engine: 'Local' };
  } catch (err) {
    updateLlmBadge(false);
    if (geminiApiKey.trim()) {
      const reply = await invoke<string>('ask_gemini', {
        apiKey: geminiApiKey,
        model: geminiModel,
        systemPrompt,
        messages,
      });
      return { reply, engine: 'Gemini' };
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
    }).catch(() => {});
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
    }).catch(() => {});
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
  showTelemetrySection('alert');
  pushDashboardAlert(`CẢNH BÁO: ${alertText}`);
  speak(`[CẢNH BÁO TÀI NGUYÊN] ${alertText}! Bạn kiểm tra bảng bên trái nhé.`);
}

async function checkHardwareAlertNow() {
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

function updateLlmBadge(online: boolean, activeEngine?: 'Gemini' | 'Local') {
  isOllamaOnline = online;
  const badge = document.getElementById('llm-badge');
  if (!badge) return;

  const hasGemini = geminiApiKey.trim().length > 0;
  if (activeEngine === 'Gemini' && hasGemini) {
    badge.textContent = `[GEMINI: ${geminiModel}]`;
    badge.style.color = '#93c5fd';
    badge.style.borderColor = 'rgba(59, 130, 246, 0.45)';
    badge.style.background = 'rgba(59, 130, 246, 0.16)';
  } else if (hasGemini && online && llmRouteMode === 'auto') {
    badge.textContent = '[AUTO: Gemini + Local]';
    badge.style.color = '#a7f3d0';
    badge.style.borderColor = 'rgba(52, 211, 153, 0.45)';
    badge.style.background = 'rgba(52, 211, 153, 0.16)';
  } else if (hasGemini && llmRouteMode !== 'local') {
    badge.textContent = `[GEMINI: ${geminiModel}]`;
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
    const net = await invoke<NetworkInfo>('check_network');
    updateLlmBadge(net.ollama_ok);
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

export async function runWeatherCheck(city?: string, interactive = true): Promise<string> {
  if (interactive) {
    appState.setState('SCANNING');
    spawnScanEffect(appState.posX, appState.posY);
  }
  try {
    const w = await invoke<WeatherInfo>('check_weather', { city: city || null });
    const summary = `Thời tiết ${w.location}: ${w.temp_c}°C (cảm giác ${w.feels_like_c}°C), ${w.description}, độ ẩm ${w.humidity_pct}%, gió ${w.wind_kmh} km/h`;
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
  }
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
  if (interactive) {
    appState.setState('SCANNING');
    spawnScanEffect(appState.posX, appState.posY);
  }
  try {
    const hw = await invoke<HardwareInfo>('check_hardware');
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
  }
}

export async function runNetworkCheck(interactive = true): Promise<string> {
  if (interactive) {
    appState.setState('SCANNING');
    spawnScanEffect(appState.posX, appState.posY);
  }
  try {
    const net = await invoke<NetworkInfo>('check_network');
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
  }
}

export async function runBitcoinCheck(interactive = true): Promise<string> {
  if (interactive) {
    appState.setState('SCANNING');
    spawnScanEffect(appState.posX, appState.posY);
  }
  try {
    const btc = await invoke<BitcoinInfo>('check_bitcoin');
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
  }
}

export async function runFullDashboardScan(interactive = false) {
  if (interactive) {
    appState.setState('SCANNING');
    spawnScanEffect(appState.posX, appState.posY);
    speak('[ĐANG QUÉT] Đang cập nhật toàn bộ Dashboard bên trái...');
  }
  await Promise.all([
    runHardwareCheck(false),
    runNetworkCheck(false),
    runBitcoinCheck(false),
    runMemoryCheck(false),
  ]);
  if (interactive) {
    showTelemetrySection('all');
    pushDashboardAlert('Đã quét lại toàn bộ thông số hệ thống.');
    speak('Đã cập nhật xong toàn bộ phần cứng, mạng, BTC và trí nhớ trên Dashboard!');
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
            .catch(() => {});
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
      .catch(() => {});
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
          `[${bh.browser_name}] Bạn hay nghe/xem "${cleanTitle}" (${topYt.visit_count} lượt)${
            topSite ? ` và hay vào "${topSite.title.slice(0, 24)}"` : ''
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
          chk.addEventListener('change', () => {
            void invoke('long_memory_toggle', { id: entry.id, enabled: chk.checked })
              .then(() => void refreshLongMemoryUi())
              .catch(() => {});
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
          bodySpan.style.cssText = `font-size:11px;line-height:1.35;color:${
            entry.enabled ? '#cbd5e1' : '#64748b'
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
          delBtn.addEventListener('click', () => {
            void invoke('long_memory_delete', { id: entry.id })
              .then(() => void refreshLongMemoryUi())
              .catch(() => {});
          });

          card.appendChild(left);
          card.appendChild(delBtn);
          container.appendChild(card);
        }
      }
    }
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
  void invoke('memory_save_chat', { role, content }).catch(() => {});
}

function recordLearnedCommand(cmdLabel: string) {
  const hour = new Date().getHours();
  const patternKey = `hour_${hour}_${cmdLabel}`;
  void invoke('memory_log_activity', {
    appTitle: cmdLabel,
    hourOfDay: hour,
    durationSec: 60,
  }).catch(() => {});
  void invoke('memory_record_feedback', { patternKey, accepted: true }).catch(() => {});
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
    }).catch(() => {});
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
    }).catch(() => {});
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
    }).catch(() => {});
    ruleConfirmation = 'Đã ghi nhớ: Tớ sẽ giữ yên lặng, chỉ kiểm tra khi bạn hỏi!';
  } else if (lower.includes('bật tự động kiểm tra') || lower.includes('tự nhắc tớ')) {
    setAutoCheckEnabled(true);
    syncCheckbox('chk-autocheck', true);
    await invoke('memory_save_profile', {
      key: 'Quy tắc chủ động',
      value: 'Bật tự động nhắc/kiểm tra',
    }).catch(() => {});
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
  const keyMatch = userText.match(/\b(AIza[0-9A-Za-z_-]{30,45})\b/);
  if (keyMatch?.[1]) {
    setGeminiApiKey(keyMatch[1]);
    ruleConfirmation = `Đã lưu Gemini API Key (${geminiModel})! Bây giờ bạn có thể hỏi mọi kiến thức phức tạp hoặc gõ @gemini / @local để chọn luồng.`;
  }

  // 2d. Thêm rule dài hạn / đổi tính cách trực tiếp qua chat
  const longRuleMatch = userText.match(/(?:thêm rule dài hạn|them rule dai han|thêm quy tắc dài hạn)\s*[:\-]?\s*(.+)/i);
  if (longRuleMatch?.[1]) {
    const val = longRuleMatch[1].trim();
    await invoke('long_memory_upsert', {
      category: 'rule',
      title: 'Rule qua chat',
      content: val,
    }).catch(() => {});
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
    }).catch(() => {});
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
    }).catch(() => {});
  }

  const likeMatch = userText.match(
    /(?:tớ thích|tôi thích|mình thích|tao thích|t thích|hay nghe|hay dùng|hay xem)\s+([^,.!?]{3,40})/i
  );
  if (likeMatch?.[1]) {
    await invoke('memory_save_profile', {
      key: 'Sở thích',
      value: likeMatch[1].trim(),
    }).catch(() => {});
  }

  const roleMatch = userText.match(
    /(?:tớ làm|tôi làm|mình làm|công việc của tớ là|công việc của tôi là)\s+([^,.!?]{3,36})/i
  );
  if (roleMatch?.[1]) {
    await invoke('memory_save_profile', {
      key: 'Công việc',
      value: roleMatch[1].trim(),
    }).catch(() => {});
  }

  // 4. Lưu ý / mệnh lệnh ghi nhớ chung ("nhớ là...", "lưu ý...", "từ giờ...")
  const noteMatch = userText.match(/(?:nhớ là|lưu ý|từ giờ|từ nay)\s+([^.!?]{4,60})/i);
  if (!ruleConfirmation && noteMatch?.[1]) {
    await invoke('memory_save_profile', {
      key: 'Lưu ý cá nhân',
      value: noteMatch[1].trim(),
    }).catch(() => {});
  }

  return ruleConfirmation;
}

export async function runPcOpen(target: string, label: string) {
  try {
    await invoke<string>('open_web_or_app', { target });
    appState.squashX = 0.88;
    appState.squashY = 1.15;
    appState.velY = -10;
    appState.setState('JUMPING');
    spawnParticles(appState.posX, appState.posY - 90, 10, 0x38bdf8);
    spawnShockwave(appState.posX, appState.posY, 0x38bdf8);
    appState.changeMood(3);
    speak(`Okela! Tớ đã mở ${label} lên cho bạn rồi nhé!`);
  } catch (err) {
    speak(`[LỖI MỞ ỨNG DỤNG] ${String(err)}`);
  }
}

export async function runPcMedia(
  action: 'vol_up' | 'vol_down' | 'mute' | 'play_pause' | 'next' | 'prev'
) {
  try {
    const msg = await invoke<string>('control_media', { action });
    spawnParticles(appState.posX, appState.posY - 100, 6, 0xa78bfa);
    speak(`[MEDIA] ${msg}!`);
  } catch (err) {
    speak(`[LỖI MEDIA] ${String(err)}`);
  }
}

export async function runOpenLatestScreenshot(openFolder = false) {
  try {
    const path = await invoke<string>('open_latest_screenshot', { openFolder });
    appState.setExpression('happy', 2.5);
    speak(openFolder ? `[MỞ THƯ MỤC ẢNH] ${path}` : `[ĐÃ MỞ ẢNH] ${path}`);
  } catch (err) {
    speak(`[LỖI MỞ ẢNH] ${String(err)}`);
  }
}

export async function runHardwareAction(
  action: 'brightness_up' | 'brightness_down' | 'clean_ram' | 'taskmgr'
) {
  appState.setState('SCANNING');
  spawnScanEffect(appState.posX, appState.posY);
  try {
    const msg = await invoke<string>('hardware_action', { action });
    appState.setExpression('happy', 3.0);
    pushDashboardAlert(msg);
    speak(`[PHẦN CỨNG] ${msg}`);
    if (action === 'clean_ram') {
      void runHardwareCheck(false);
    }
  } catch (err) {
    speak(`[LỖI PHẦN CỨNG] ${String(err)}`);
  }
}

export async function runOcrAndSummarize(takeNew = true) {
  appState.setState('SCANNING');
  spawnScanEffect(appState.posX, appState.posY);
  speak('[OCR MÀN HÌNH] Đang chụp và đọc chữ trên màn hình...');
  try {
    const ocr = await invoke<OcrResultInfo>('ocr_latest_screenshot', { takeNew });
    const cleaned = ocr.raw_text.replace(/\s+/g, ' ').trim();
    if (!cleaned) {
      speak('[OCR] Đã quét ảnh nhưng chưa thấy văn bản nào rõ ràng trên màn hình!');
      return;
    }

    let summary = `Nội dung quét được trên màn hình: "${cleaned.slice(0, 180)}${cleaned.length > 180 ? '...' : ''}"`;
    if (isOllamaOnline || geminiApiKey.trim()) {
      try {
        const res = await askHybridLlm(
          'Bạn là trợ lý phân tích màn hình. Hãy tóm tắt thật súc tích trong tối đa 2 câu tiếng Việt có dấu (không dùng emoji) cho biết ảnh chụp màn hình này đang hiển thị nội dung gì.',
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
  } catch (err) {
    speak(`[LỖI OCR] ${String(err)}`);
  }
}

export async function runPcScreenshot() {
  speak('[CHỤP MÀN HÌNH] Đang chụp lại màn hình cho bạn...');
  try {
    const savedPath = await invoke<string>('take_screenshot');
    spawnParticles(appState.posX, appState.posY - 110, 12, 0x34d399);
    spawnShockwave(appState.posX, appState.posY, 0x34d399);
    appState.setExpression('happy', 3.0);
    speak(
      `[ĐÃ LƯU ẢNH] Đã chụp màn hình (${savedPath})! Bấm "Đồng ý" để mở xem ảnh ngay, hoặc "Để sau" để mở thư mục chứa ảnh.`
    );
    showSuggestionButtons(
      () => void runOpenLatestScreenshot(false),
      () => void runOpenLatestScreenshot(true)
    );
  } catch (err) {
    speak(`[LỖI CHỤP MÀN HÌNH] ${String(err)}`);
  }
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
    await invoke('lock_pc_screen').catch(() => {});
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
    lower.includes('mở') || lower.includes('mo ') || lower.includes('bật') || lower.includes('bat ') || lower.includes('chạy') || lower.includes('open');
  if (isOpenVerb) {
    for (const item of COMMON_TOOLS) {
      if (item.keys.some((k) => lower.includes(k))) {
        await runPcOpen(item.target, item.label);
        return true;
      }
    }
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
      const res = await askHybridLlm(
        'Tóm tắt ngắn gọn trong 1-2 câu bằng tiếng Việt có dấu (không emoji) về hoạt động hôm nay của chủ nhân.',
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
  await invoke('memory_save_daily_summary', { summary }).catch(() => {});
  const summaryEl = document.getElementById('dash-mem-summary');
  if (summaryEl) summaryEl.textContent = summary;
  return summary;
}

function executeLlmActionTag(rawReply: string): string {
  const match = rawReply.match(/\[(?:[A-Z_]+:)?ACTION:([^\]]+)\]/i);
  if (!match) return rawReply;
  const spec = match[1].trim();
  const clean = rawReply.replace(/\[(?:[A-Z_]+:)?ACTION:[^\]]+\]/gi, '').trim();

  let knownAction = true;
  if (spec.toLowerCase().startsWith('open:')) {
    const rawTarget = spec.slice(5).trim();
    if (rawTarget) {
      const resolved = resolveToolTarget(rawTarget);
      void runPcOpen(resolved.target, resolved.label);
    } else {
      knownAction = false;
    }
  } else if (spec === 'push_left') {
    startPhysicalPush(-1);
  } else if (spec === 'push_right') {
    startPhysicalPush(1);
  } else if (spec === 'shrink') {
    startPhysicalResize('shrink');
  } else if (spec === 'expand') {
    startPhysicalResize('expand');
  } else if (spec === 'minimize') {
    void performWindowAction('minimize');
  } else {
    knownAction = false;
  }

  if (clean) return clean;
  return knownAction ? 'Đã thực hiện yêu cầu của bạn!' : '';
}

export async function chatWithLocalLlm(userText: string) {
  if (isBusy) {
    speak('[CHỜ CHÚT] Tớ đang suy nghĩ câu trước, đợi xíu nhé...');
    return;
  }
  hideSuggestionButtons();

  // Luôn lưu mọi câu lệnh / tin nhắn của chủ nhân và tự học quy tắc ngay lập tức
  pushChatHistory('user', userText);
  const ruleConfirmation = await extractAndSaveUserFacts(userText);
  if (ruleConfirmation) {
    pushChatHistory('assistant', ruleConfirmation);
    speak(ruleConfirmation);
    void runMemoryCheck(false);
    return;
  }

  const lower = userText.toLowerCase();

  // Kiểm tra người dùng hỏi về trí nhớ / thói quen / đánh giá cá nhân
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
    return;
  }

  // Hỏi về lịch sử web, kênh YouTube hay xem, gợi ý nhạc theo thói quen trình duyệt
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
    return;
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
    return;
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
    return;
  }
  if (lower.includes('lộn nhào') || lower.includes('lon nhao') || lower.includes('backflip') || lower.includes('nhào lộn')) {
    recordLearnedCommand('Lộn nhào Backflip');
    triggerBackflip();
    pushChatHistory('assistant', 'Đã thực hiện cú lộn nhào Backflip.');
    return;
  }
  if (lower.includes('xoay vòng') || lower.includes('xoay tít') || lower.includes('xoay tit') || lower === 'spin') {
    recordLearnedCommand('Xoay vòng Spin');
    triggerSpin();
    pushChatHistory('assistant', 'Đã xoay vòng tròn tốc độ cao.');
    return;
  }

  if (lower.includes('dọn màn hình') || lower.includes('don man hinh') || lower.includes('thu hết')) {
    recordLearnedCommand('Dọn màn hình');
    await minimizeMultipleWindows();
    pushChatHistory('assistant', 'Đã dọn gọn các cửa sổ trên màn hình.');
    return;
  }
  if (lower.includes('thu nhỏ') || lower.includes('thu nho') || lower.includes('nhỏ lại')) {
    recordLearnedCommand('Thu nhỏ cửa sổ');
    startPhysicalResize('shrink');
    pushChatHistory('assistant', 'Đã thu nhỏ cửa sổ đang active.');
    return;
  }
  if (lower.includes('kéo to') || lower.includes('keo to') || lower.includes('phóng to') || lower.includes('to ra')) {
    recordLearnedCommand('Kéo to cửa sổ');
    startPhysicalResize('expand');
    pushChatHistory('assistant', 'Đã kéo to cửa sổ đang active.');
    return;
  }
  if (lower.includes('đẩy phải') || lower.includes('sang phải') || lower.includes('day phai')) {
    recordLearnedCommand('Đẩy cửa sổ phải');
    startPhysicalPush(1);
    pushChatHistory('assistant', 'Đã đẩy cửa sổ sang phải.');
    return;
  }
  if (lower.includes('đẩy trái') || lower.includes('sang trái') || lower.includes('day trai')) {
    recordLearnedCommand('Đẩy cửa sổ trái');
    startPhysicalPush(-1);
    pushChatHistory('assistant', 'Đã đẩy cửa sổ sang trái.');
    return;
  }
  if (lower.includes('hạ xuống') || lower.includes('ẩn cửa sổ') || lower.includes('ha xuong')) {
    recordLearnedCommand('Ẩn cửa sổ');
    await performWindowAction('minimize');
    pushChatHistory('assistant', 'Đã hạ cửa sổ đang active xuống.');
    return;
  }
  if (lower.includes('vào trong cửa sổ') || lower.includes('quét khung') || lower.includes('quet khung') || lower.includes('nhảy vào trong')) {
    recordLearnedCommand('Vào trong khung');
    await triggerExploreInsideWindow();
    pushChatHistory('assistant', 'Đã quét khung và nhảy vào bên trong cửa sổ.');
    return;
  }
  if (lower.includes('chuyển tab') || lower.includes('tác động khung') || lower.includes('tac dong khung') || lower.includes('bật terminal')) {
    recordLearnedCommand('Tác động khung');
    await triggerInteractInsideWindow();
    pushChatHistory('assistant', 'Đã tác động vào khung cửa sổ đang active.');
    return;
  }

  if (await tryHandlePcCommand(userText)) {
    recordLearnedCommand(userText.slice(0, 26));
    pushChatHistory('assistant', `Đã thực hiện lệnh: ${userText}`);
    return;
  }

  isBusy = true;
  speak(`[${ollamaModel}] Đang suy nghĩ...`);
  const contextNotes: string[] = [];
  let fallbackDirect = '';

  const wantsHw =
    lower.includes('phần cứng') ||
    lower.includes('phan cung') ||
    lower.includes('cấu hình') ||
    lower.includes('cpu') ||
    lower.includes('ram') ||
    lower.includes('gpu') ||
    lower.includes('ổ đĩa');

  const wantsNet =
    lower.includes('mạng') ||
    lower.includes('mang') ||
    lower.includes('wifi') ||
    lower.includes('internet') ||
    lower.includes('ping') ||
    lower.includes('network') ||
    lower.includes('connect') ||
    lower.includes('kết nối') ||
    lower.includes('ket noi') ||
    /\bip\b/.test(lower) ||
    lower.includes('port') ||
    /\blan\b/.test(lower);

  const wantsBtc =
    lower.includes('bitcoin') ||
    lower.includes('btc') ||
    lower.includes('crypto') ||
    lower.includes('giá coin');

  const wantsWeather =
    /th[oơờ]i\s*ti[eếệ]t/i.test(lower) ||
    lower.includes('nhiệt độ') ||
    lower.includes('nhiet do') ||
    lower.includes('dự báo') ||
    lower.includes('weather') ||
    lower.includes('mưa không') ||
    lower.includes('nắng không');

  if (wantsHw) {
    recordLearnedCommand('Check phần cứng');
    const hwStr = await runHardwareCheck(false);
    showTelemetrySection('hw');
    contextNotes.push(hwStr);
    fallbackDirect = hwStr;
  }
  if (wantsNet) {
    recordLearnedCommand('Check mạng');
    const netStr = await runNetworkCheck(false);
    showTelemetrySection('net');
    contextNotes.push(netStr);
    fallbackDirect = fallbackDirect ? `${fallbackDirect} | ${netStr}` : netStr;
  }
  if (wantsBtc) {
    recordLearnedCommand('Giá BTC');
    const btcStr = await runBitcoinCheck(false);
    showTelemetrySection('btc');
    contextNotes.push(btcStr);
    fallbackDirect = fallbackDirect ? `${fallbackDirect} | ${btcStr}` : btcStr;
  }
  if (wantsWeather) {
    recordLearnedCommand('Xem thời tiết');
    const weatherStr = await runWeatherCheck(undefined, false);
    pushDashboardAlert(weatherStr);
    contextNotes.push(weatherStr);
    fallbackDirect = fallbackDirect ? `${fallbackDirect} | ${weatherStr}` : weatherStr;
  }

  // Trả lời ngay lập tức trong <2s với dữ liệu thực tế vừa đo/lấy được, không chờ Ollama chậm
  if (fallbackDirect) {
    pushChatHistory('assistant', fallbackDirect);
    appState.setState('SCANNING');
    appState.setExpression('happy', 2.8);
    appState.changeMood(2);
    spawnScanEffect(appState.posX, appState.posY);
    speak(fallbackDirect);
    isBusy = false;
    return;
  }

  const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  // Lấy trí nhớ dài hạn + long_memory từ SQLite (<1ms)
  const [insights, longMemoryBlock] = await Promise.all([
    runMemoryCheck(false),
    buildLongMemoryPromptBlock(),
  ]);
  const memoryLines: string[] = [];
  if (insights && insights.profile_facts.length > 0) {
    memoryLines.push(
      `Thông tin & quy tắc đã học từ chủ nhân: ${insights.profile_facts.map((f) => `${f.key}=${f.value}`).join(', ')}`
    );
  }
  if (insights && insights.top_apps_today.length > 0) {
    memoryLines.push(
      `Ứng dụng/tác vụ chủ nhân dùng hôm nay: ${insights.top_apps_today.map((a) => `${a.app_title} (${Math.max(1, Math.round(a.total_sec / 60))}p)`).join(', ')}`
    );
  }
  const memoryBlock = memoryLines.length > 0 ? `\n${memoryLines.join('\n')}` : '';

  const systemPrompt = `Bạn là AI Desktop Mate - trợ lý ảo 3D cá nhân ngồi trên màn hình Windows của chủ nhân.${longMemoryBlock}
Hãy trả lời đúng trọng tâm bằng tiếng Việt có dấu tự nhiên, ngắn gọn (tối đa 3 câu, không dùng emoji), không bịa thông số nếu không có dữ liệu.
Bây giờ là ${nowStr}.${memoryBlock}`;

  const useGemini = shouldRouteToGemini(userText, false);
  try {
    const { reply: rawReply, engine } = await askHybridLlm(
      systemPrompt,
      chatHistory,
      useGemini
    );
    updateLlmBadge(isOllamaOnline, engine);
    const reply = executeLlmActionTag(rawReply) || 'Tớ đã nhận được câu hỏi của bạn!';
    pushChatHistory('assistant', reply);
    void saveSemanticMemory(`Chủ nhân: ${userText} -> Trợ lý: ${reply}`);
    appState.velY = -6;
    appState.setState('JUMPING');
    appState.setExpression('happy', 2.8);
    appState.changeMood(3);
    speak(`[${engine}] ${reply}`);
  } catch (err) {
    updateLlmBadge(false);
    speak(
      `[LLM OFFLINE] ${String(err)}. Hãy bật Ollama ("ollama serve") hoặc nhập Gemini API Key trong Studio 3D nhé!`
    );
  } finally {
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
        void invoke('memory_record_feedback', { patternKey, accepted: true }).catch(() => {});
        void runPcOpen(
          `https://www.youtube.com/results?search_query=${encodeURIComponent(topic)}`,
          topic
        );
      },
      () => {
        appState.setExpression('sad', 2.4);
        void invoke('memory_record_feedback', { patternKey, accepted: false }).catch(() => {});
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
        void invoke('memory_record_feedback', { patternKey, accepted: true }).catch(() => {});
        void runPcOpen(
          `https://www.google.com/search?q=${encodeURIComponent(site)}`,
          site
        );
      },
      () => {
        appState.setExpression('sad', 2.4);
        void invoke('memory_record_feedback', { patternKey, accepted: false }).catch(() => {});
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
      void invoke('memory_record_feedback', { patternKey, accepted: true }).catch(() => {});
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
      void invoke('memory_record_feedback', { patternKey, accepted: false }).catch(() => {});
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
      const hw = await invoke<HardwareInfo>('check_hardware');
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
      const btc = await invoke<BitcoinInfo>('check_bitcoin');
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
  } else {
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
                `Bạn là AI Desktop Mate.${longMemoryBlock} Chỉ trả lời đúng 1 câu ngắn bằng tiếng Việt có dấu, không emoji.`,
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

export function initAssistant() {
  setTimeout(() => {
    void refreshLlmStatus();
    // Khôi phục lịch sử hội thoại gần nhất từ SQLite
    void invoke<ChatEntry[]>('memory_get_recent_chats', { limit: 6 })
      .then((entries) => {
        for (const e of entries) {
          if (e.role === 'user' || e.role === 'assistant') {
            chatHistory.push({ role: e.role, content: e.content });
          }
        }
      })
      .catch(() => {});

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
  }, 1200);

  // Tự động thu thập thói quen sử dụng cửa sổ mỗi 15 giây vào SQLite
  window.setInterval(() => {
    const activeWin = findTargetWindow();
    if (activeWin && appState.activeWindowHwnd === activeWin.hwnd) {
      const appName = normalizeAppName(activeWin.title, activeWin.process_name);
      const hour = new Date().getHours();
      void invoke('memory_log_activity', {
        appTitle: appName,
        hourOfDay: hour,
        durationSec: 15,
      }).catch(() => {});
    }
  }, 15_000);

  // Theo dõi ngưỡng cảnh báo CPU/RAM mỗi 15 giây (độc lập với vòng hỏi thăm 4 phút)
  window.setInterval(() => {
    if (autoCheckEnabled && !appState.isStudioOpen) {
      void checkHardwareAlertNow();
    }
  }, 15_000);

  window.setInterval(() => {
    void runProactiveCheckIn();
  }, 60_000);
}
