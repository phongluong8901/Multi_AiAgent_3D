import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export interface NotificationItem {
  id: string;
  source: 'windows' | 'app' | 'web';
  app_or_origin: string;
  title: string;
  body: string;
  timestamp: number;
  allowed: boolean;
}

export interface AppNotificationRule {
  app_id: string;
  name: string;
  enabled: boolean;
  speech_alert: boolean;
}

export interface WebNotificationRule {
  origin: string;
  name: string;
  enabled: boolean;
  speech_alert: boolean;
}

export interface NotificationSettings {
  master_enabled: boolean;
  speech_tts_enabled: boolean;
  character_alert_enabled: boolean;
  windows_apps: AppNotificationRule[];
  web_origins: WebNotificationRule[];
  webhook_port: number;
}

export async function fetchNotificationSettings(): Promise<NotificationSettings> {
  try {
    return await invoke<NotificationSettings>('get_notification_settings');
  } catch (err) {
    console.warn('[WARN] get_notification_settings error, fallback default', err);
    return {
      master_enabled: true,
      speech_tts_enabled: true,
      character_alert_enabled: true,
      windows_apps: [
        { app_id: 'Zalo.exe', name: 'Zalo', enabled: true, speech_alert: true },
        { app_id: 'chrome.exe', name: 'Google Chrome', enabled: true, speech_alert: false },
        { app_id: 'Code.exe', name: 'Visual Studio Code', enabled: true, speech_alert: false },
        { app_id: 'antigravity.exe', name: 'Antigravity', enabled: true, speech_alert: true },
        { app_id: 'cursor.exe', name: 'Cursor IDE', enabled: true, speech_alert: true },
        { app_id: 'Telegram.exe', name: 'Telegram', enabled: true, speech_alert: true },
        { app_id: 'Discord.exe', name: 'Discord', enabled: true, speech_alert: true },
        { app_id: 'slack.exe', name: 'Slack', enabled: true, speech_alert: true },
        { app_id: 'OUTLOOK.EXE', name: 'Microsoft Outlook', enabled: true, speech_alert: true },
        { app_id: 'Teams.exe', name: 'Microsoft Teams', enabled: true, speech_alert: false },
        { app_id: 'msedge.exe', name: 'Microsoft Edge', enabled: true, speech_alert: false },
        { app_id: 'Spotify.exe', name: 'Spotify', enabled: false, speech_alert: false },
      ],
      web_origins: [
        { origin: 'github.com', name: 'GitHub', enabled: true, speech_alert: true },
        { origin: 'mail.google.com', name: 'Gmail', enabled: true, speech_alert: true },
        { origin: 'calendar.google.com', name: 'Google Calendar', enabled: true, speech_alert: true },
        { origin: 'youtube.com', name: 'YouTube', enabled: false, speech_alert: false },
        { origin: 'jira.atlassian.com', name: 'Jira / Confluence', enabled: true, speech_alert: false },
        { origin: 'localhost', name: 'Local Services', enabled: true, speech_alert: true },
        { origin: 'custom-webhook', name: 'Custom Webhook', enabled: true, speech_alert: true },
      ],
      webhook_port: 39281,
    };
  }
}

export async function updateNotificationSettings(
  settings: NotificationSettings
): Promise<string> {
  return await invoke<string>('save_notification_settings', { settings });
}

export async function fetchNotificationHistory(): Promise<NotificationItem[]> {
  try {
    return await invoke<NotificationItem[]>('get_notification_history');
  } catch (err) {
    console.warn('[WARN] get_notification_history error', err);
    return [];
  }
}

export async function clearNotificationHistory(): Promise<string> {
  return await invoke<string>('clear_notification_history');
}

export async function triggerTestNotification(
  source: 'windows' | 'web',
  appOrOrigin: string
): Promise<NotificationItem> {
  return await invoke<NotificationItem>('test_notification', {
    source,
    appOrOrigin,
  });
}

export async function scanRunningWindowsApps(): Promise<string[]> {
  try {
    return await invoke<string[]>('scan_active_windows_apps');
  } catch (err) {
    console.warn('[WARN] scan_active_windows_apps error', err);
    return [];
  }
}

export async function listenToDesktopNotifications(
  handler: (item: NotificationItem, speechAlert: boolean) => void
): Promise<UnlistenFn> {
  return await listen<{ item: NotificationItem; speech_alert: boolean }>(
    'desktop-mate://notification',
    (event) => {
      handler(event.payload.item, event.payload.speech_alert);
    }
  );
}
