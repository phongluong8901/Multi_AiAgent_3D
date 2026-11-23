import { invoke } from '@tauri-apps/api/core';
import { AutomationRuleRecord } from '../../core/types';
import { appState } from '../../core/state';
import {
  getCloudAuthStatus,
  syncChatPullFromCloud,
  syncChatPushToCloud,
  syncChatStreamChunkToCloud,
} from '../../backend/toolForge';
import { runDesktopAgentGoal } from '../../backend/assistant';
import {
  AutomationUiDeps,
  refreshAutomationRulesUi,
  runRuleTarget,
} from './automationRulesUi';

export interface WebRemoteSyncDeps {
  getBubbleInput: () => HTMLInputElement | null;
  getBtnSendMsg: () => HTMLButtonElement | null;
  toggleBubbleVisibility: (forceState?: boolean) => void;
  appendChatMessage: (role: 'user' | 'assistant', text: string) => void;
  speakMessage: (msg: string) => void;
  autoDeps: AutomationUiDeps;
  onAuthRefreshed?: (loggedIn: boolean, email: string) => void;
}

export function initWebRemoteSyncLoop(deps: WebRemoteSyncDeps) {
  let lastSyncedChatMs = Date.now() - 60_000;
  const seenSyncedMsgIds = new Set<string>();
  let isLoggedIn = false;

  const pushAssistantToWeb = async (content: string) => {
    deps.appendChatMessage('assistant', content);
    const msgId = `remote_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await syncChatPushToCloud(msgId, 'assistant', content, Date.now()).catch(() => {});
  };

  const handleRemoteSlashCommand = async (content: string): Promise<boolean> => {
    const trimmed = content.trim();
    if (!trimmed.startsWith('/')) return false;

    if (trimmed.toLowerCase().startsWith('/agent ')) {
      const goal = trimmed.slice(7).trim();
      if (!goal) {
        await pushAssistantToWeb('[REMOTE AGENT ERR] Thiếu mục tiêu sau lệnh /agent.');
        return true;
      }
      deps.toggleBubbleVisibility(true);
      deps.appendChatMessage('user', `[WEB AGENT] ${goal}`);
      try {
        const result = await runDesktopAgentGoal(goal, (line) => {
          deps.speakMessage(line);
        });
        await pushAssistantToWeb(result);
      } catch (err) {
        await pushAssistantToWeb(`[REMOTE AGENT ERR] ${String(err)}`);
      }
      return true;
    }

    if (trimmed.toLowerCase() === '/rules') {
      const rules = await invoke<AutomationRuleRecord[]>('auto_rule_list').catch(
        () => [] as AutomationRuleRecord[]
      );
      await syncChatPushToCloud(
        `rules_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        'assistant',
        `[REMOTE_RULES_JSON:${JSON.stringify(rules)}]`,
        Date.now()
      ).catch(() => {});
      return true;
    }

    const toggleMatch = trimmed.match(/^\/rule_toggle\s+(\S+)\s+(on|off|true|false)$/i);
    if (toggleMatch?.[1]) {
      const id = toggleMatch[1].trim();
      const enabled = toggleMatch[2].toLowerCase() === 'on' || toggleMatch[2].toLowerCase() === 'true';
      await invoke('auto_rule_toggle', { id, enabled }).catch(() => {});
      await refreshAutomationRulesUi(deps.autoDeps);
      const rules = await invoke<AutomationRuleRecord[]>('auto_rule_list').catch(
        () => [] as AutomationRuleRecord[]
      );
      await pushAssistantToWeb(
        `[REMOTE RULE] Đã ${enabled ? 'BẬT' : 'TẮT'} rule "${id}".\n[REMOTE_RULES_JSON:${JSON.stringify(rules)}]`
      );
      return true;
    }

    const runMatch = trimmed.match(/^\/rule_run\s+(\S+)$/i);
    if (runMatch?.[1]) {
      const id = runMatch[1].trim();
      const rules = await invoke<AutomationRuleRecord[]>('auto_rule_list').catch(
        () => [] as AutomationRuleRecord[]
      );
      const found = rules.find((r) => r.id === id);
      if (!found) {
        await pushAssistantToWeb(`[REMOTE RULE ERR] Không tìm thấy rule "${id}".`);
        return true;
      }
      deps.appendChatMessage('user', `[WEB RULE RUN] ${found.name}`);
      try {
        const out = await runRuleTarget(found, deps.autoDeps);
        await refreshAutomationRulesUi(deps.autoDeps);
        await pushAssistantToWeb(`[REMOTE RULE OK: ${found.name}]\n${out}`);
      } catch (err) {
        await pushAssistantToWeb(`[REMOTE RULE ERR] ${String(err)}`);
      }
      return true;
    }

    return false;
  };

  const pullSyncedWebChatMessages = async () => {
    if (!isLoggedIn) return;
    try {
      const items = await syncChatPullFromCloud(lastSyncedChatMs);
      for (const m of items) {
        if (m.created_at_ms > lastSyncedChatMs) {
          lastSyncedChatMs = m.created_at_ms;
        }
        if (seenSyncedMsgIds.has(m.msg_id)) continue;
        seenSyncedMsgIds.add(m.msg_id);
        if (m.source === 'web' && m.role === 'user') {
          const handledCmd = await handleRemoteSlashCommand(m.content);
          if (handledCmd) continue;

          if (!appState.isBubbleVisible) deps.toggleBubbleVisibility(true);
          const bubbleInput = deps.getBubbleInput();
          const btnSendMsg = deps.getBtnSendMsg();
          if (!appState.isChatting && bubbleInput && btnSendMsg) {
            bubbleInput.value = m.content;
            btnSendMsg.click();
          } else {
            deps.appendChatMessage('user', `[WEB] ${m.content}`);
          }
        }
      }
    } catch {
      // silent when backend online is not running
    }
  };

  const refreshAuth = async () => {
    try {
      const auth = await getCloudAuthStatus();
      isLoggedIn = Boolean(auth.logged_in);
      deps.onAuthRefreshed?.(isLoggedIn, auth.email || '');
      if (isLoggedIn) {
        void pullSyncedWebChatMessages();
      }
    } catch {
      // ignore offline
    }
  };

  void refreshAuth();
  window.setInterval(() => {
    void pullSyncedWebChatMessages();
  }, 4500);

  window.addEventListener('duck-cloud-auth-changed', (ev: Event) => {
    const det = (ev as CustomEvent).detail as { logged_in?: boolean } | undefined;
    if (typeof det?.logged_in === 'boolean') {
      isLoggedIn = det.logged_in;
    }
  });

  // Expose helper for done stream chunks when needed
  void syncChatStreamChunkToCloud;
  return {
    setLoggedIn: (v: boolean) => {
      isLoggedIn = v;
    },
    pullNow: pullSyncedWebChatMessages,
  };
}
