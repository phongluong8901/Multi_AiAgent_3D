import { invoke } from '@tauri-apps/api/core';
import { NotificationItem } from '../../backend/notificationService';
import { syncChatPushToCloud } from '../../backend/toolForge';

export interface NotifAutoReplyConfig {
  quickReplyEnabled: boolean;
  autoReplyEnabled: boolean;
  allowedApps: string[];
  senderFilter: string;
  autoReplyMessage: string;
  cooldownSec: number;
}

const STORAGE_KEY = 'mate_notif_autoreply_cfg_v1';

const DEFAULT_CONFIG: NotifAutoReplyConfig = {
  quickReplyEnabled: true,
  autoReplyEnabled: false,
  allowedApps: ['Zalo', 'Telegram', 'Discord'],
  senderFilter: '',
  autoReplyMessage: 'Mình đang bận xíu, nhận được tin nhắn rồi sẽ trả lời lại ngay nhé!',
  cooldownSec: 300,
};

export function loadNotifAutoReplyConfig(): NotifAutoReplyConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<NotifAutoReplyConfig>;
    return {
      quickReplyEnabled:
        typeof parsed.quickReplyEnabled === 'boolean'
          ? parsed.quickReplyEnabled
          : DEFAULT_CONFIG.quickReplyEnabled,
      autoReplyEnabled:
        typeof parsed.autoReplyEnabled === 'boolean'
          ? parsed.autoReplyEnabled
          : DEFAULT_CONFIG.autoReplyEnabled,
      allowedApps: Array.isArray(parsed.allowedApps)
        ? parsed.allowedApps.map((x) => String(x).trim()).filter(Boolean)
        : [...DEFAULT_CONFIG.allowedApps],
      senderFilter: typeof parsed.senderFilter === 'string' ? parsed.senderFilter.trim() : '',
      autoReplyMessage:
        typeof parsed.autoReplyMessage === 'string' && parsed.autoReplyMessage.trim()
          ? parsed.autoReplyMessage.trim()
          : DEFAULT_CONFIG.autoReplyMessage,
      cooldownSec:
        Number.isFinite(Number(parsed.cooldownSec)) && Number(parsed.cooldownSec) >= 15
          ? Math.round(Number(parsed.cooldownSec))
          : DEFAULT_CONFIG.cooldownSec,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveNotifAutoReplyConfig(cfg: NotifAutoReplyConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export interface NotifAutoReplyDeps {
  speakMessage: (msg: string) => void;
  appendChatMessage: (role: 'user' | 'assistant', text: string) => void;
  toggleBubbleVisibility?: (forceState?: boolean) => void;
}

let savedDeps: NotifAutoReplyDeps | null = null;
let pendingReplyTarget: { app: string; contact: string } | null = null;
const replyCooldownMap = new Map<string, number>();

function resolveTargetAppName(appOrOrigin: string, allowedApps: string[]): string | null {
  const low = appOrOrigin.trim().toLowerCase();
  for (const allowed of allowedApps) {
    const alLow = allowed.toLowerCase().replace(/\.exe$/, '');
    if (alLow && (low.includes(alLow) || alLow.includes(low.replace(/\.exe$/, '')))) {
      if (alLow.includes('zalo')) return 'Zalo';
      if (alLow.includes('telegram')) return 'Telegram';
      if (alLow.includes('discord')) return 'Discord';
      if (alLow.includes('messenger')) return 'Messenger';
      return allowed.replace(/\.exe$/i, '');
    }
  }
  return null;
}

function extractSenderNameFromNotif(item: NotificationItem): string {
  let clean = (item.title || '').trim();
  clean = clean.replace(/^\[[^\]]+\]\s*/, '').trim();
  if (clean.includes(':')) {
    clean = clean.split(':')[0].trim();
  }
  if (clean.includes(' - ')) {
    clean = clean.split(' - ')[0].trim();
  }
  clean = clean.replace(/^(tin nhắn mới từ|new message from)\s+/i, '').trim();
  return clean;
}

function hideQuickReplyBar() {
  const bar = document.getElementById('notif-quick-reply-bar');
  if (bar) bar.style.display = 'none';
  pendingReplyTarget = null;
}

async function sendQuickReplyNow(messageText: string) {
  if (!pendingReplyTarget || !savedDeps) return;
  const cleanMsg = messageText.trim();
  if (!cleanMsg) return;

  const { app, contact } = pendingReplyTarget;
  hideQuickReplyBar();
  savedDeps.speakMessage(`[QUICK REPLY] Đang trả lời "${contact}" trên ${app}: "${cleanMsg}"...`);

  try {
    const res = await invoke<string>('auto_chat_app_send_message', {
      app,
      contact,
      message: cleanMsg,
    });
    savedDeps.speakMessage(res);
    savedDeps.appendChatMessage('assistant', res);
    void syncChatPushToCloud(
      `qr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      'assistant',
      res,
      Date.now()
    ).catch(() => {});
  } catch (err) {
    const errText = `[QUICK REPLY ERR] ${String(err)}`;
    savedDeps.speakMessage(errText);
    savedDeps.appendChatMessage('assistant', errText);
  }
}

export async function handleIncomingNotificationForReply(item: NotificationItem): Promise<void> {
  if (!item.allowed || item.app_or_origin === 'Lịch hẹn Duck AI') return;
  const cfg = loadNotifAutoReplyConfig();
  if (!cfg.quickReplyEnabled && !cfg.autoReplyEnabled) return;

  const targetApp = resolveTargetAppName(item.app_or_origin, cfg.allowedApps);
  if (!targetApp) return;

  const sender = extractSenderNameFromNotif(item);
  if (!sender || sender.length < 2) return;

  if (cfg.senderFilter) {
    const allowList = cfg.senderFilter
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (allowList.length > 0 && !allowList.some((kw) => sender.toLowerCase().includes(kw))) {
      return;
    }
  }

  const key = `${targetApp}:${sender.toLowerCase()}`;
  const nowSec = Math.floor(Date.now() / 1000);
  const lastAt = replyCooldownMap.get(key) || 0;

  if (cfg.autoReplyEnabled && nowSec - lastAt >= cfg.cooldownSec) {
    replyCooldownMap.set(key, nowSec);
    try {
      const out = await invoke<string>('auto_chat_app_send_message', {
        app: targetApp,
        contact: sender,
        message: cfg.autoReplyMessage,
      });
      const note = `[AUTO-REPLY -> ${targetApp}/${sender}] ${out}`;
      savedDeps?.speakMessage(note);
      savedDeps?.appendChatMessage('assistant', note);
      void syncChatPushToCloud(
        `ar_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        'assistant',
        note,
        Date.now()
      ).catch(() => {});
    } catch (err) {
      savedDeps?.appendChatMessage('assistant', `[AUTO-REPLY ERR] ${String(err)}`);
    }
    return;
  }

  if (cfg.quickReplyEnabled) {
    pendingReplyTarget = { app: targetApp, contact: sender };
    const bar = document.getElementById('notif-quick-reply-bar');
    const hdr = document.getElementById('notif-qr-header');
    const inp = document.getElementById('notif-qr-input') as HTMLInputElement | null;
    if (hdr) {
      const bodyPreview = (item.body || '').trim().slice(0, 42);
      hdr.textContent = `[TRẢ LỜI NHANH ${targetApp}] ${sender}: ${bodyPreview}`;
    }
    if (inp) {
      inp.value = '';
      inp.placeholder = `Nhắn trả lời nhanh tới ${sender}...`;
    }
    if (bar) {
      bar.style.display = 'flex';
    }
    savedDeps?.toggleBubbleVisibility?.(true);
  }
}

export function syncNotificationAutoReplyForm() {
  const cfg = loadNotifAutoReplyConfig();
  const chkQuick = document.getElementById('chk-notif-quick-reply') as HTMLInputElement | null;
  const chkAuto = document.getElementById('chk-notif-auto-reply') as HTMLInputElement | null;
  const inpApps = document.getElementById('inp-notif-ar-apps') as HTMLInputElement | null;
  const inpSender = document.getElementById('inp-notif-ar-sender') as HTMLInputElement | null;
  const inpMsg = document.getElementById('inp-notif-ar-message') as HTMLInputElement | null;
  const inpCooldown = document.getElementById('inp-notif-ar-cooldown') as HTMLInputElement | null;

  if (chkQuick) chkQuick.checked = cfg.quickReplyEnabled;
  if (chkAuto) chkAuto.checked = cfg.autoReplyEnabled;
  if (inpApps) inpApps.value = cfg.allowedApps.join(', ');
  if (inpSender) inpSender.value = cfg.senderFilter;
  if (inpMsg) inpMsg.value = cfg.autoReplyMessage;
  if (inpCooldown) inpCooldown.value = String(cfg.cooldownSec);
}

export function initNotificationAutoReplyUi(deps: NotifAutoReplyDeps) {
  savedDeps = deps;
  syncNotificationAutoReplyForm();

  const chkQuick = document.getElementById('chk-notif-quick-reply') as HTMLInputElement | null;
  const chkAuto = document.getElementById('chk-notif-auto-reply') as HTMLInputElement | null;
  const inpApps = document.getElementById('inp-notif-ar-apps') as HTMLInputElement | null;
  const inpSender = document.getElementById('inp-notif-ar-sender') as HTMLInputElement | null;
  const inpMsg = document.getElementById('inp-notif-ar-message') as HTMLInputElement | null;
  const inpCooldown = document.getElementById('inp-notif-ar-cooldown') as HTMLInputElement | null;
  const statusEl = document.getElementById('notif-ar-status');

  const persistFromForm = (): NotifAutoReplyConfig => {
    const next: NotifAutoReplyConfig = {
      quickReplyEnabled: chkQuick?.checked ?? true,
      autoReplyEnabled: chkAuto?.checked ?? false,
      allowedApps: (inpApps?.value || 'Zalo, Telegram, Discord')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      senderFilter: inpSender?.value.trim() || '',
      autoReplyMessage:
        inpMsg?.value.trim() || DEFAULT_CONFIG.autoReplyMessage,
      cooldownSec: Math.max(15, Number(inpCooldown?.value || 300) || 300),
    };
    saveNotifAutoReplyConfig(next);
    return next;
  };

  document.getElementById('btn-save-notif-autoreply')?.addEventListener('click', (ev) => {
    const saved = persistFromForm();
    if (statusEl) {
      statusEl.textContent = `[SAVED] QuickReply=${saved.quickReplyEnabled ? 'ON' : 'OFF'} | AutoReply=${saved.autoReplyEnabled ? 'ON' : 'OFF'} (${saved.allowedApps.join(', ')})`;
    }
    const btn = ev.currentTarget as HTMLButtonElement | null;
    if (btn) {
      const prev = btn.textContent || 'Lưu Cấu Hình Auto-Reply';
      btn.textContent = 'Đã Lưu!';
      window.setTimeout(() => {
        btn.textContent = prev;
      }, 1400);
    }
  });

  document.getElementById('btn-test-notif-autoreply')?.addEventListener('click', () => {
    persistFromForm();
    void handleIncomingNotificationForReply({
      id: `test_${Date.now()}`,
      source: 'app',
      app_or_origin: 'Zalo.exe',
      title: 'Anh Thư',
      body: 'Đang làm gì đó?',
      timestamp: Math.floor(Date.now() / 1000),
      allowed: true,
    });
    if (statusEl) {
      statusEl.textContent = '[TEST] Đã kích hoạt thử thanh Trả lời nhanh / Auto-Reply với Zalo ("Anh Thư").';
    }
  });

  const inpQr = document.getElementById('notif-qr-input') as HTMLInputElement | null;
  document.getElementById('btn-notif-qr-send')?.addEventListener('click', () => {
    if (inpQr?.value.trim()) {
      void sendQuickReplyNow(inpQr.value);
    }
  });
  inpQr?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && inpQr.value.trim()) {
      void sendQuickReplyNow(inpQr.value);
    }
  });
  document.getElementById('btn-notif-qr-busy')?.addEventListener('click', () => {
    void sendQuickReplyNow('Đang bận xíu, lát nhắn lại nhé!');
  });
  document.getElementById('btn-notif-qr-ok')?.addEventListener('click', () => {
    void sendQuickReplyNow('Ok bạn nhé!');
  });
  document.getElementById('btn-notif-qr-close')?.addEventListener('click', () => {
    hideQuickReplyBar();
  });
}
