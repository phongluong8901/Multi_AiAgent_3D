import { invoke } from '@tauri-apps/api/core';
import { CdpTabInfo, UiaElementInfo, WinRect } from '../core/types';
import {
  executeSavedSkillWithSelfHeal,
  getCachedCustomSkills,
  syncChatStreamChunkToCloud,
} from './toolForge';

export interface AgentLoopContext {
  getGeminiKey: () => string;
  getGeminiModel: () => string;
  getOllamaModel: () => string;
  isOllamaOnline: () => boolean;
  isColabOnline: () => boolean;
  getColabUrl: () => string;
  getColabModel: () => string;
  onProgress: (text: string) => void;
}

interface AgentActionStep {
  thought?: string;
  action: string;
  index?: number;
  name?: string;
  automation_id?: string;
  press_enter?: boolean;
  port?: number;
  app?: string;
  sub_action?: string;
  contact?: string;
  message?: string;
  hwnd?: number;
  ms?: number;
  reason?: string;
  x?: number;
  y?: number;
  button?: string;
  double_click?: boolean;
  text?: string;
  keys?: string;
  delta?: number;
  target?: string;
  url?: string;
  selector?: string;
  value?: string;
  tab_id?: string;
  skill_id?: string;
  args?: Record<string, unknown>;
  summary?: string;
  question?: string;
}

let agentAbortRequested = false;

export function requestAgentAbort() {
  agentAbortRequested = true;
}

function extractJsonLoose(raw: string): AgentActionStep | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const s = cleaned.indexOf('{');
  const e = cleaned.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  try {
    return JSON.parse(cleaned.slice(s, e + 1)) as AgentActionStep;
  } catch {
    return null;
  }
}

async function askAgentBrain(prompt: string, ctx: AgentLoopContext): Promise<string> {
  const sys =
    'You are an autonomous Windows & Chrome CDP Desktop Agent. Output strictly ONE valid JSON object for the next action.';
  const msg = [{ role: 'user', content: prompt }];

  if (ctx.isColabOnline()) {
    try {
      return await invoke<string>('ask_colab_cloud_stream', {
        tunnelUrl: ctx.getColabUrl() || null,
        model: ctx.getColabModel(),
        messages: [{ role: 'system', content: sys }, ...msg],
      });
    } catch {
      // fallback below
    }
  }
  if (ctx.getGeminiKey().trim()) {
    return invoke<string>('ask_gemini', {
      apiKey: ctx.getGeminiKey(),
      model: ctx.getGeminiModel(),
      systemPrompt: sys,
      messages: msg,
      jsonMode: true,
    });
  }
  if (ctx.isOllamaOnline()) {
    return invoke<string>('ask_ollama', {
      model: ctx.getOllamaModel(),
      messages: [{ role: 'system', content: sys }, ...msg],
    });
  }
  throw new Error('Chưa có LLM nào khả dụng (Gemini / Colab / Local Ollama) để chạy Agent đa bước.');
}

export interface AgentTraceStep {
  step: number;
  action: string;
  params: Record<string, unknown>;
  obs: string;
}

export interface AgentWorkflowTrace {
  goal: string;
  summary: string;
  steps: AgentTraceStep[];
  createdAt: number;
}

export function buildToolForgePromptFromTrace(trace: AgentWorkflowTrace): string {
  const stepLines = trace.steps
    .map((s) => {
      const copy: Record<string, unknown> = { ...s.params };
      delete copy.thought;
      delete copy.action;
      return `  ${s.step}. ${s.action}(${JSON.stringify(copy)}) -> ${s.obs.slice(0, 120)}`;
    })
    .join('\n');
  return [
    `Đóng gói quy trình vừa chạy thành công thành một Tool/Skill tái sử dụng (có tham số hóa các giá trị động như tên người nhận, nội dung tin nhắn, URL, từ khóa nếu có).`,
    `Mục tiêu gốc: "${trace.goal}"`,
    `Kết quả đạt được: "${trace.summary}"`,
    `Các bước thực tế Agent đã chạy:`,
    stepLines,
    `Yêu cầu: Tạo script PowerShell/Python tự động hóa quy trình tương tự một cách ổn định, nhận tham số đầu vào qua params_schema để dùng lại 1-click.`,
  ].join('\n');
}

export async function runMultiStepDesktopAgent(
  goal: string,
  ctx: AgentLoopContext
): Promise<string> {
  agentAbortRequested = false;
  const maxSteps = 8;
  const stepLogs: string[] = [];
  const executedSteps: AgentTraceStep[] = [];
  let lastUiaElements: UiaElementInfo[] = [];

  const escHandler = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') {
      agentAbortRequested = true;
    }
  };
  window.addEventListener('keydown', escHandler);

  try {
    const agentStreamId = `agent_${Date.now()}`;
    const emitProgress = (text: string) => {
      ctx.onProgress(text);
      void syncChatStreamChunkToCloud(agentStreamId, `${text}\n`, false).catch(() => {});
    };

    const preferWeb = /chrome|web|tab|trang|form|bảng|table|google|http/i.test(goal);
    let activeCdpPort = 9222;
    let targetHwnd: number | null = null;
    const knownAppHints = [
      'zalo',
      'notepad',
      'excel',
      'word',
      'outlook',
      'chrome',
      'edge',
      'code',
      'discord',
      'telegram',
      'explorer',
    ].filter((kw) => goal.toLowerCase().includes(kw));

    try {
      for (let step = 1; step <= maxSteps; step++) {
        if (agentAbortRequested) {
          return `[AGENT STOPPED] Đã dừng khẩn cấp theo yêu cầu (Esc) ở bước ${step}.`;
        }

        emitProgress(`[AGENT ${step}/${maxSteps}] Đang quan sát màn hình & DOM/UIA...`);

      // 1. Observe (Chrome 9222 hoặc Electron Hook 9223)
      let cdpInfo = '';
      let tabs: CdpTabInfo[] = [];
      const portsToProbe = preferWeb ? [9222, 9223] : [9223, 9222];
      for (const candidatePort of portsToProbe) {
        try {
          tabs = await invoke<CdpTabInfo[]>('cdp_list_tabs', { port: candidatePort });
          if (tabs.length > 0) {
            activeCdpPort = candidatePort;
            const dom = await invoke<unknown>('cdp_dom_snapshot', {
              tabId: tabs[0].id,
              port: candidatePort,
            });
            cdpInfo = `[CDP port ${candidatePort}] ${JSON.stringify(dom).slice(0, 2600)}`;
            break;
          }
        } catch {
          // try next port
        }
      }
      if (!cdpInfo && preferWeb) {
        cdpInfo = 'Chrome/Electron CDP (9222/9223) chưa mở.';
      }

      let wins: WinRect[] = [];
      try {
        wins = await invoke<WinRect[]>('get_open_windows');
      } catch {
        wins = [];
      }

      if (!targetHwnd || !wins.some((w) => w.hwnd === targetHwnd)) {
        const matched = wins.find((w) => {
          const hay = `${w.title} ${w.process_name}`.toLowerCase();
          return knownAppHints.some((kw) => hay.includes(kw));
        });
        targetHwnd = matched?.hwnd ?? wins[0]?.hwnd ?? null;
      }
      const targetWin = wins.find((w) => w.hwnd === targetHwnd) ?? null;

      try {
        lastUiaElements = await invoke<UiaElementInfo[]>('auto_uia_snapshot', {
          hwnd: targetHwnd,
          maxElements: 40,
        });
      } catch {
        lastUiaElements = [];
      }

      const skillsSummary = getCachedCustomSkills()
        .filter((s) => s.enabled)
        .slice(0, 12)
        .map((s) => `${s.id} (${s.name})`)
        .join(', ');

      const uiaSummary = lastUiaElements
        .slice(0, 35)
        .map((e) => `[${e.index}] ${e.control_type} "${e.name}" (${e.center_x},${e.center_y})${e.value ? ` val="${e.value}"` : ''}`)
        .join('\n');

      const prompt = `MỤC TIÊU NGƯỜI DÙNG: "${goal}"
BƯỚC HIỆN TẠI: ${step}/${maxSteps}
LỊCH SỬ CÁC BƯỚC ĐÃ LÀM:
${stepLogs.length > 0 ? stepLogs.join('\n') : '(Chưa làm bước nào)'}

CỬA SỔ ĐANG MỞ:
${wins.slice(0, 8).map((w) => `- hwnd=${w.hwnd}: "${w.title}" (${w.process_name})`).join('\n') || '(Không có)'}

CỬA SỔ ĐANG TARGET UIA: ${targetWin ? `hwnd=${targetWin.hwnd} "${targetWin.title}" (${targetWin.process_name})` : '(Chưa có)'}

UIA ELEMENTS CỬA SỔ TARGET:
${uiaSummary || '(Không đọc được UIA elements)'}

CHROME CDP DOM SNAPSHOT:
${cdpInfo || '(Không dùng hoặc chưa mở CDP)'}

CUSTOM SKILLS SẴN CÓ: ${skillsSummary || '(Không có)'}

QUY TẮC TRUNG THỰC TUYỆT ĐỐI & ƯU TIÊN CAN THIỆP SÂU:
- LUÔN ƯU TIÊN can thiệp trực tiếp: dùng uia_set_value / uia_invoke / com_action / cdp_* thay vì click tọa độ thô mouse_click bất cứ khi nào có thể.
- Với app Excel / Word / Outlook / File Explorer / deep protocol (zalo://, tg://, vscode://), hãy dùng com_action trước tiên.
- Với app desktop Electron/Chromium (Zalo, Discord, VS Code, Slack, Notion...), có thể dùng launch_hooked_app để mở kèm Accessibility + CDP port 9223.
- MẸO ĐIỀU KHIỂN APP CHAT (Zalo / Telegram / Discord): (1) Nếu chưa mở, gọi open_app hoặc launch_hooked_app với target='Zalo'. (2) Khi cửa sổ Zalo đã có trong CỬA SỔ ĐANG MỞ, bấm press_hotkey keys='ctrl+f' để nhảy vào ô Tìm kiếm. (3) Gọi type_text với tên người nhận (vd: 'Anh Thư'). (4) Bấm press_hotkey keys='enter' (hoặc click vào kết quả tên người đó trong UIA ELEMENTS) để mở khung chat. (5) Gọi type_text với nội dung tin nhắn (vd: 'Ăn cơm chưa?') rồi press_hotkey keys='enter' để gửi.
- CHỈ được gọi action "done" KHI VÀ CHỈ KHI bạn ĐÃ THỰC SỰ THẤY bằng chứng hoàn thành trong "CỬA SỔ ĐANG MỞ", "UIA ELEMENTS", hoặc "CHROME CDP DOM SNAPSHOT" (và đã thực sự thực hiện các bước tương tác như click/gõ chữ/Enter).
- Nếu "LỊCH SỬ CÁC BƯỚC" có lỗi "ERR:", không mở được ứng dụng, hoặc thấy hộp thoại lỗi Windows, TUYỆT ĐỐI KHÔNG được bịa đặt "done" thành công — hãy thử cách khác (như focus_window nếu cửa sổ đã có) hoặc gọi action "fail" với lý do thật!

CHỌN ĐÚNG 1 ACTION TIẾP THEO (trả về DUY NHẤT JSON):
- {"thought":"...","action":"focus_window","hwnd":12345}
- {"thought":"...","action":"uia_invoke","index":3,"name":"Gửi"}
- {"thought":"...","action":"uia_set_value","index":4,"name":"Tìm kiếm","value":"Nội dung","press_enter":true}
- {"thought":"...","action":"launch_hooked_app","target":"Zalo","port":9223}
- {"thought":"...","action":"com_action","app":"excel","sub_action":"read_sheet","target":"A1","value":""}
- {"thought":"...","action":"chat_app_send","app":"Zalo","contact":"Anh Thư","message":"Ăn cơm chưa?"}
- {"thought":"...","action":"uia_click","index":3}
- {"thought":"...","action":"mouse_click","x":500,"y":300,"button":"left","double_click":false}
- {"thought":"...","action":"type_text","text":"..."}
- {"thought":"...","action":"press_hotkey","keys":"ctrl+s"}
- {"thought":"...","action":"scroll","delta":-3}
- {"thought":"...","action":"open_app","target":"notepad"}
- {"thought":"...","action":"wait","ms":1500}
- {"thought":"...","action":"cdp_launch","url":"https://..."}
- {"thought":"...","action":"cdp_navigate","url":"https://..."}
- {"thought":"...","action":"cdp_click","selector":"#id"}
- {"thought":"...","action":"cdp_fill","selector":"input[name=q]","value":"..."}
- {"thought":"...","action":"cdp_extract_table"}
- {"thought":"...","action":"custom_skill","skill_id":"...","args":{}}
- {"thought":"...","action":"fail","reason":"Lý do thật sự không thể hoàn thành"}
- {"thought":"...","action":"done","summary":"Kết quả cuối cùng đã kiểm chứng bằng tiếng Việt"}`;

      const raw = await askAgentBrain(prompt, ctx);
      const parsed = extractJsonLoose(raw);
      if (!parsed || !parsed.action) {
        stepLogs.push(`Bước ${step}: LLM trả JSON không hợp lệ -> dừng.`);
        break;
      }

      if (agentAbortRequested) {
        return `[AGENT STOPPED] Đã dừng khẩn cấp ở bước ${step}.`;
      }

      emitProgress(
        `[AGENT ${step}/${maxSteps}] ${parsed.action}${parsed.thought ? ` - ${parsed.thought}` : ''}`
      );

      let obs = '';
      try {
        switch (parsed.action) {
          case 'done': {
            const finalText = parsed.summary || 'Đã hoàn thành quy trình tự động hóa.';
            if (executedSteps.length > 0 && typeof window !== 'undefined') {
              const trace: AgentWorkflowTrace = {
                goal,
                summary: finalText,
                steps: executedSteps,
                createdAt: Date.now(),
              };
              window.dispatchEvent(new CustomEvent('duck-agent-suggest-tool', { detail: trace }));
              return `[AGENT DONE - ${step} bước]\n${finalText}\n[GỢI Ý TOOL] Quy trình vừa hoàn thành có thể đóng gói thành Tool dùng lại 1-click.`;
            }
            return `[AGENT DONE - ${step} bước]\n${finalText}`;
          }
          case 'fail': {
            const failReason = parsed.reason || parsed.summary || 'Không thể hoàn thành tác vụ.';
            return `[AGENT FAILED - ${step} bước]\n${failReason}\n${stepLogs.join('\n')}`;
          }
          case 'focus_window': {
            const fh = Number(parsed.hwnd || 0);
            obs = await invoke<string>('auto_focus_window', { hwnd: fh });
            if (fh) targetHwnd = fh;
            await new Promise((r) => setTimeout(r, 900));
            break;
          }
          case 'wait':
            await new Promise((r) => setTimeout(r, Math.min(5000, Math.max(200, Number(parsed.ms || 1200)))));
            obs = 'OK: Waited';
            break;
          case 'uia_invoke':
            obs = await invoke<string>('auto_uia_invoke', {
              hwnd: parsed.hwnd ?? targetHwnd,
              index: parsed.index != null ? Number(parsed.index) : null,
              name: parsed.name ?? null,
              automationId: parsed.automation_id ?? null,
            });
            break;
          case 'uia_set_value':
            obs = await invoke<string>('auto_uia_set_value', {
              hwnd: parsed.hwnd ?? targetHwnd,
              index: parsed.index != null ? Number(parsed.index) : null,
              name: parsed.name ?? null,
              automationId: parsed.automation_id ?? null,
              value: String(parsed.value ?? parsed.text ?? ''),
              pressEnter: parsed.press_enter ?? false,
            });
            break;
          case 'launch_hooked_app': {
            obs = await invoke<string>('auto_launch_app_with_hooks', {
              target: String(parsed.target || ''),
              cdpPort: parsed.port != null ? Number(parsed.port) : 9223,
            });
            const m = /hwnd=(\d+)/.exec(obs);
            if (m) targetHwnd = Number(m[1]);
            if (obs.includes('CDP port')) {
              activeCdpPort = parsed.port != null ? Number(parsed.port) : 9223;
            }
            break;
          }
          case 'com_action':
            obs = await invoke<string>('auto_com_action', {
              app: String(parsed.app || ''),
              action: String(parsed.sub_action || 'read_sheet'),
              target: parsed.target ?? null,
              value: parsed.value ?? null,
            });
            break;
          case 'chat_app_send':
            obs = await invoke<string>('auto_chat_app_send_message', {
              app: String(parsed.app || parsed.target || 'Zalo'),
              contact: String(parsed.contact || ''),
              message: String(parsed.message || parsed.value || parsed.text || ''),
            });
            break;
          case 'uia_click': {
            const el = lastUiaElements.find((x) => x.index === Number(parsed.index));
            if (!el) {
              obs = `ERR: Không thấy UIA index ${parsed.index}`;
            } else {
              obs = await invoke<string>('auto_mouse_click', {
                x: el.center_x,
                y: el.center_y,
                button: parsed.button ?? 'left',
                doubleClick: parsed.double_click ?? false,
              });
            }
            break;
          }
          case 'mouse_click':
            obs = await invoke<string>('auto_mouse_click', {
              x: Number(parsed.x || 0),
              y: Number(parsed.y || 0),
              button: parsed.button ?? 'left',
              doubleClick: parsed.double_click ?? false,
            });
            break;
          case 'type_text':
            obs = await invoke<string>('auto_type_text', {
              text: String(parsed.text || ''),
              hwnd: parsed.hwnd ?? targetHwnd,
            });
            await new Promise((r) => setTimeout(r, 500));
            break;
          case 'press_hotkey':
            obs = await invoke<string>('auto_press_hotkey', {
              keys: String(parsed.keys || ''),
              hwnd: parsed.hwnd ?? targetHwnd,
            });
            await new Promise((r) => setTimeout(r, 500));
            break;
          case 'scroll':
            obs = await invoke<string>('auto_scroll', {
              delta: Number(parsed.delta || -3),
              x: parsed.x ?? null,
              y: parsed.y ?? null,
            });
            break;
          case 'open_app': {
            obs = await invoke<string>('open_web_or_app', { target: String(parsed.target || '') });
            const m = /hwnd=(\d+)/.exec(obs);
            if (m) targetHwnd = Number(m[1]);
            await new Promise((r) => setTimeout(r, 1000));
            break;
          }
          case 'cdp_launch':
            obs = await invoke<string>('cdp_launch_debug_chrome', {
              url: parsed.url ?? null,
              port: 9222,
            });
            await new Promise((r) => setTimeout(r, 1500));
            break;
          case 'cdp_navigate':
            obs = await invoke<string>('cdp_action', {
              tabId: parsed.tab_id ?? null,
              action: 'navigate',
              selector: null,
              value: String(parsed.url || ''),
              port: parsed.port != null ? Number(parsed.port) : activeCdpPort,
            });
            await new Promise((r) => setTimeout(r, 1000));
            break;
          case 'cdp_click':
            obs = await invoke<string>('cdp_action', {
              tabId: parsed.tab_id ?? null,
              action: 'click',
              selector: String(parsed.selector || ''),
              value: null,
              port: parsed.port != null ? Number(parsed.port) : activeCdpPort,
            });
            break;
          case 'cdp_fill':
            obs = await invoke<string>('cdp_action', {
              tabId: parsed.tab_id ?? null,
              action: 'fill',
              selector: String(parsed.selector || ''),
              value: String(parsed.value || ''),
              port: parsed.port != null ? Number(parsed.port) : activeCdpPort,
            });
            break;
          case 'cdp_extract_table':
            obs = await invoke<string>('cdp_action', {
              tabId: parsed.tab_id ?? null,
              action: 'extract_table',
              selector: null,
              value: null,
              port: parsed.port != null ? Number(parsed.port) : activeCdpPort,
            });
            break;
          case 'custom_skill':
            obs = await executeSavedSkillWithSelfHeal(
              String(parsed.skill_id || ''),
              parsed.args || {}
            );
            break;
          default:
            obs = `ERR: Action '${parsed.action}' không hợp lệ.`;
        }
      } catch (err) {
        obs = `ERR: ${String(err)}`;
      }

      executedSteps.push({
        step,
        action: parsed.action,
        params: parsed as unknown as Record<string, unknown>,
        obs,
      });
      stepLogs.push(`Bước ${step} (${parsed.action}): ${obs.slice(0, 220)}`);
      await new Promise((r) => setTimeout(r, 450));
    }

    return `[AGENT MAX STEPS (${maxSteps})]\n${stepLogs.join('\n')}`;
    } finally {
      void syncChatStreamChunkToCloud(agentStreamId, '', true).catch(() => {});
    }
  } finally {
    window.removeEventListener('keydown', escHandler);
  }
}
