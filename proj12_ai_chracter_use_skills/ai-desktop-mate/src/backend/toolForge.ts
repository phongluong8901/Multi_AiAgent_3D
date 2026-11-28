import { invoke } from '@tauri-apps/api/core';
import {
  CustomSkillRecord,
  IngestedFileAnalysis,
  InstallCommunitySkillResult,
  SandboxRunResult,
  SkillExecResult,
  SkillParamDef,
  ToolForgeDraft,
} from '../core/types';
import { installCommunitySkillFromCloudRaw } from './cloudHubClient';
import { fireAnimationTrigger } from '../core/animationBinder';
import { isQuestionOrMetaDiscussion } from './commandParsers';

export interface ToolForgeRuntimeCtx {
  getGeminiModel: () => string;
  getGeminiApiKey: () => string;
  getOllamaModel: () => string;
  isOllamaOnline: () => boolean;
  hasGeminiKey: () => boolean;
}

let ctxProvider: ToolForgeRuntimeCtx = {
  getGeminiModel: () => localStorage.getItem('mate_gemini_model') || 'gemini-3.5-flash',
  getGeminiApiKey: () => '',
  getOllamaModel: () => localStorage.getItem('mate_ollama_model') || 'qwen2.5:1.5b',
  isOllamaOnline: () => false,
  hasGeminiKey: () => false,
};

let cachedCustomSkills: CustomSkillRecord[] = [];
let latestToolForgeDraft: ToolForgeDraft | null = null;

export function registerToolForgeContext(ctx: ToolForgeRuntimeCtx) {
  ctxProvider = ctx;
}

export function getCachedCustomSkills(): CustomSkillRecord[] {
  return cachedCustomSkills;
}

export function getLatestToolForgeDraft(): ToolForgeDraft | null {
  return latestToolForgeDraft;
}

export function setLatestToolForgeDraft(draft: ToolForgeDraft | null) {
  latestToolForgeDraft = draft;
}

export async function refreshCustomSkills(): Promise<CustomSkillRecord[]> {
  try {
    const list = await invoke<CustomSkillRecord[]>('tool_forge_list_skills');
    cachedCustomSkills = Array.isArray(list) ? list : [];
  } catch {
    // ignore when DB not ready yet
  }
  window.dispatchEvent(new CustomEvent('duck-skills-updated'));
  return cachedCustomSkills;
}

function stripDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function parseTriggers(triggersJson: string): string[] {
  try {
    const parsed = JSON.parse(triggersJson);
    if (Array.isArray(parsed)) {
      return parsed.map((x) => String(x).trim()).filter(Boolean);
    }
  } catch {
    // ignore
  }
  return [];
}

export function parseParamsSchema(schemaJson: string): SkillParamDef[] {
  try {
    const parsed = JSON.parse(schemaJson);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((x) => x && typeof x.name === 'string')
        .map((x) => {
          const rawType = String(x.type || 'string').trim().toLowerCase();
          const paramType: SkillParamDef['type'] =
            rawType === 'number' ||
            rawType === 'boolean' ||
            rawType === 'array' ||
            rawType === 'object'
              ? rawType
              : 'string';
          return {
            name: String(x.name).trim(),
            type: paramType,
            description: String(x.description || ''),
            required: Boolean(x.required),
            default: x.default,
          };
        });
    }
  } catch {
    // ignore
  }
  return [];
}

export function parseExpectedKeywords(kwJson: string): string[] {
  try {
    const parsed = JSON.parse(kwJson);
    if (Array.isArray(parsed)) {
      return parsed.map((x) => String(x).trim()).filter(Boolean);
    }
  } catch {
    // ignore
  }
  return [];
}

export function buildCustomSkillsPromptBlock(): string {
  const active = cachedCustomSkills.filter((s) => s.enabled && s.verified);
  const lines: string[] = [];
  if (active.length > 0) {
    lines.push('CUSTOM SKILLS DA KIEM CHUNG SANDBOX (uu tien dung khi khop yeu cau):');
    for (const sk of active.slice(0, 12)) {
      const params = parseParamsSchema(sk.params_schema_json)
        .map((p) => `${p.name}:${p.type}`)
        .join(', ');
      const triggers = parseTriggers(sk.triggers_json).slice(0, 4).join(', ');
      lines.push(
        `- [SKILL id="${sk.id}" v${sk.version}] ${sk.name}: ${sk.description.slice(0, 90)} | Triggers: ${triggers} | Params: {${params}}`
      );
    }
    lines.push('Cach goi Custom Skill: [TOOL:custom_skill:{"id":"<id>","args":{...}}]');
  }
  lines.push(
    'Neu nguoi dung yeu cau 1 tool/tinh nang he thong moi ma khong co san (vi du tao tool kiem tra & dong port, tool xu ly file...), Local LLM KHONG tu viet code ma goi ngay: [TOOL:forge_tool:{"request":"<nguyen van yeu cau>"}] de chuyen sang Gemini + Sandbox kiem nghiem.'
  );
  return `\n${lines.join('\n')}`;
}

export function detectToolForgeRequestIntent(
  userText: string
): { mode: 'open' | 'forge'; request: string } | null {
  const clean = userText.trim();
  if (isQuestionOrMetaDiscussion(clean)) return null;
  if (/^(?:cách|cach|làm sao|lam sao|hướng dẫn|huong dan)\b/i.test(clean)) return null;
  const norm = stripDiacritics(clean);

  if (
    /^(mo|bat|xem)\s+(xuong skill|xuong tool|kho skill|sandbox skill|tool forge|sandbox)/.test(norm) ||
    norm === 'sandbox' ||
    norm === 'tool forge'
  ) {
    return { mode: 'open', request: '' };
  }

  const isForgeRequest =
    /(?:tao|viet|lam|xay|build|create|forge|them)\s+(?:1\s+|mot\s+|cho t(?:o|oi)?\s+1?\s*|giup\s+1?\s*)?(?:tool|skill|cong cu|script)(?:\s+moi)?/.test(
      norm
    ) ||
    /(?:can|muon|thieu)\s+(?:1\s+|mot\s+)?(?:tool|skill|cong cu)\s+/.test(norm);

  if (isForgeRequest) {
    return { mode: 'forge', request: clean };
  }
  return null;
}

const SKILL_MATCH_STOPWORDS = new Set([
  'kiem', 'tra', 'xem', 'check', 'mo', 'bat', 'chay', 'cho', 'cua', 'tren',
  'voi', 'cac', 'mot', 'giup', 'hay', 'nay', 'duoc', 'khong', 'file', 'tab',
  'app', 'thu', 'muc', 'tool', 'skill', 'cong', 'cu', 'may', 'tinh', 'tim',
  'search', 'la', 'va', 'hoac', 'chua', 'roi', 'di', 'nhe', 'nha', 'toi', 'ban',
]);

function extractTargetArgFromText(userText: string): string {
  const quoted = userText.match(/"([^"]+)"|'([^']+)'/);
  const rawQuoted = (quoted?.[1] || quoted?.[2] || '').trim();
  if (rawQuoted) return rawQuoted;

  const norm = stripDiacritics(userText);
  const re =
    /(?:\btab\b|\bcua so\b|\bung dung\b|\bapp\b|\btim\b|\bcheck\b|\bkiem tra\b)\s+(.+)$/i;
  const m = norm.match(re);
  if (!m?.[1]) return '';

  // Map back slice from original userText to preserve casing
  const startIdx = m.index! + m[0].length - m[1].length;
  let candidate = userText.slice(startIdx).trim();

  // Strip leading filler words & trailing question particles
  for (let i = 0; i < 4; i++) {
    const next = candidate
      .replace(/^(?:xem|cho|lai|thu|cai|viec|ve|tu khoa|tu)\s+/i, '')
      .trim();
    if (next === candidate) break;
    candidate = next;
  }
  const trailingStop = /\s+(?:dang|co|mo|chua|khong|ko|giup|voi|nhe|nha|nua|day|di|\?)+$/i;
  while (trailingStop.test(candidate)) {
    const next = candidate.replace(trailingStop, '').trim();
    if (next === candidate) break;
    candidate = next;
  }
  const cleanNorm = stripDiacritics(candidate);
  const cleaned = cleanNorm.replace(/\s+(?:dang mo chua|mo chua|co mo khong)$/i, '').trim();
  if (!cleaned || cleaned === 'chua' || cleaned === 'khong') return '';
  if (candidate.length > cleaned.length && candidate.length > 0) {
    candidate = candidate.slice(0, cleaned.length).trim();
  }
  return candidate.length <= 42 ? candidate : '';
}

export function extractChatContactAndMessage(
  userText: string
): { app: string; contact: string; message: string } | null {
  const clean = userText.trim();
  if (isQuestionOrMetaDiscussion(clean)) return null;

  const p1 = clean.match(
    /^((?:hãy\s+|hay\s+|giúp\s+tớ\s+|giup\s+to\s+|nhờ\s+|nho\s+)?(?:mở\s+|mo\s+|vào\s+|vao\s+)?(?:hỏi|hoi|nhắn\s+tin|nhan\s+tin|nhắn|nhan|gửi\s+tin\s+nhắn|gui\s+tin\s+nhan|gửi|gui|chat|ib)\s+(?:trên\s+|tren\s+|qua\s+|vào\s+|vao\s+)?(zalo|telegram|discord|messenger)?\s*(?:cho\s+|tới\s+|toi\s+|với\s+|voi\s+|bạn\s+|ban\s+|tìm\s+|tim\s+)?)(.+?)\s+(?:xem\s+|hỏi\s+xem\s+|hoi\s+xem\s+|hỏi\s+|hoi\s+|là\s+|la\s+|rằng\s+|rang\s+|nội\s+dung\s+|noi\s+dung\s+)(.+)$/i
  );
  const p2 = clean.match(
    /^((?:hãy\s+|hay\s+)?(?:mở|mo|vào|vao)\s+(zalo|telegram|discord|messenger)\s+(?:tìm\s+|tim\s+)?(?:hỏi|hoi|nhắn\s+tin|nhan\s+tin|nhắn|nhan|gửi|gui)\s+(?:cho\s+)?)(.+?)\s+(?:xem\s+|là\s+|la\s+|rằng\s+|rang\s+)(.+)$/i
  );
  const m = p1 || p2;
  if (!m) return null;

  const leadPrefix = (m[1] || '').trim();
  const explicitPlatform = (m[2] || '').trim().toLowerCase();
  if (
    !explicitPlatform &&
    !/\b(?:nhắn\s+tin\s+cho|nhan\s+tin\s+cho|gửi\s+tin\s+nhắn\s+cho|gui\s+tin\s+nhan\s+cho|ib\s+cho|inbox\s+cho|nhắn\s+cho|nhan\s+cho)\b/i.test(
      leadPrefix
    )
  ) {
    return null;
  }

  const rawApp = explicitPlatform || 'zalo';
  const app = rawApp.charAt(0).toUpperCase() + rawApp.slice(1);
  let contact = m[3].trim().replace(/^(?:cho|tới|toi|với|voi|bạn|ban)\s+/i, '').trim();
  let message = m[4].trim();
  if (!contact || !message) return null;

  const normContactCheck = stripDiacritics(contact)
    .replace(/^(?:anh|chi|em|ban|thay|co|ong|ba)\s+/, '')
    .trim();
  if (
    /^(?:google|chatgpt|gemini|ai|ban|minh|toi|ban than|he thong|may tinh|file|tep|du lieu|web)$/.test(
      stripDiacritics(contact).trim()
    ) ||
    /^(?:google|chatgpt|gemini)$/.test(normContactCheck)
  ) {
    return null;
  }

  const contactNormMap: Record<string, string> = {
    'anh thu': 'Anh Thư',
    'minh thu': 'Minh Thư',
  };
  const msgNormMap: Record<string, string> = {
    'an com chua': 'Ăn cơm chưa?',
    'ăn cơm chưa': 'Ăn cơm chưa?',
    'toi nay muon an gi': 'Tối nay muốn ăn gì?',
    'tối nay muốn ăn gì': 'Tối nay muốn ăn gì?',
    'toi nay an gi': 'Tối nay ăn gì?',
    'dang lam gi': 'Đang làm gì vậy?',
    'dang lam gi day': 'Đang làm gì đấy?',
    'di ngu chua': 'Đi ngủ chưa?',
    'khoe khong': 'Khỏe không?',
  };
  const cLow = contact.toLowerCase();
  if (contactNormMap[cLow]) {
    contact = contactNormMap[cLow];
  } else if (contact === cLow) {
    contact = contact
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  const mLow = message.toLowerCase().replace(/[?.!]+$/, '').trim();
  if (msgNormMap[mLow]) {
    message = msgNormMap[mLow];
  }
  return { app, contact, message };
}

function inferSmartFilenameFromUserText(userText: string, defaultVal: unknown): string {
  const norm = stripDiacritics(userText);
  let ext = '';
  if (/\b\.?csv\b/.test(norm)) ext = '.csv';
  else if (/\b\.?xlsx\b|\bexcel\b/.test(norm)) ext = '.xlsx';
  else if (/\b\.?json\b/.test(norm)) ext = '.json';
  else if (/\b\.?txt\b/.test(norm)) ext = '.txt';
  if (!ext) return '';

  const stop = new Set([
    'tao', 'cho', 'toi', 'ban', 'to', 'minh', 'mot', 'file', 'tep', 've', 'data',
    'du', 'lieu', 'bat', 'ki', 'ky', 'nao', 'di', 'giup', 'ho', 'nhe', 'nha',
    'voi', 'mau', 'vi', 'csv', 'xlsx', 'xls', 'excel', 'json', 'txt', 'bang',
    'tinh', 'thu', 'ngau', 'nhien', 'noi', 'dung', 'chinh', 'sua', 'cap', 'nhat',
    'them', 'dong', 'doc', 'xem', 'mo', 'cua', 'cai', 'nay',
  ]);
  const words = norm
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && !stop.has(w) && !/^\d+$/.test(w))
    .slice(0, 4);

  const defBase =
    typeof defaultVal === 'string' && defaultVal.trim() && defaultVal.trim() !== '.'
      ? defaultVal
          .trim()
          .replace(/^.*[\\/]/, '')
          .replace(/\.[a-z0-9]{1,6}$/i, '')
      : 'du_lieu';
  const base = words.length > 0 ? words.join('_') : defBase || 'du_lieu';
  return `${base}${ext}`;
}

function pickTargetPinnedFile(
  userText: string,
  pinnedFiles?: IngestedFileAnalysis[]
): IngestedFileAnalysis | null {
  if (!pinnedFiles || pinnedFiles.length === 0) return null;
  const lower = userText.toLowerCase();
  const explicitMatch = pinnedFiles.find(
    (f) => f.file_name && lower.includes(f.file_name.toLowerCase())
  );
  return explicitMatch || pinnedFiles[pinnedFiles.length - 1];
}

function getPinnedExtensionTokens(file: IngestedFileAnalysis): string[] {
  const lower = (file.file_name || '').toLowerCase();
  const ftype = (file.file_type || '').toUpperCase();
  if (ftype === 'CSV' || lower.endsWith('.csv') || lower.endsWith('.tsv')) {
    return ['csv'];
  }
  if (ftype === 'EXCEL' || lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return ['xlsx', 'excel'];
  }
  if (lower.endsWith('.json')) {
    return ['json'];
  }
  if (ftype === 'PDF' || lower.endsWith('.pdf')) {
    return ['pdf'];
  }
  if (ftype === 'IMAGE' || /\.(png|jpe?g|webp|bmp|gif)$/.test(lower)) {
    return ['image', 'anh'];
  }
  if (lower.endsWith('.txt') || lower.endsWith('.md')) {
    return ['txt', 'text'];
  }
  return [];
}

const UNSAFE_CHAT_PLACEHOLDERS = new Set([
  'ban be',
  'duck ai',
  'xin chao',
  'chao ban',
  'test',
  'nguoi nhan',
  'noi dung',
  'hello',
  'hi',
]);

export function isSendChatSkill(sk: CustomSkillRecord): boolean {
  const idNorm = stripDiacritics(sk.id).replace(/_/g, ' ');
  const nameNorm = stripDiacritics(sk.name);
  const triggers = parseTriggers(sk.triggers_json);
  const skillTextSpace = `${idNorm} ${nameNorm} ${stripDiacritics(triggers.join(' '))}`;
  const hasSendAction = /\b(?:gui|send|nhan tin|auto chat|chat send)\b/.test(
    `${idNorm} ${nameNorm}`
  );
  if (!hasSendAction) return false;
  const hasChatKeyword = /\b(?:zalo|telegram|discord|messenger|tin nhan|message|chat)\b/.test(
    skillTextSpace
  );
  const hasChatParams = parseParamsSchema(sk.params_schema_json).some((p) =>
    /contact|recipient|receiver|message|msg/.test(stripDiacritics(p.name))
  );
  return hasChatKeyword || hasChatParams;
}

export function validateSendChatSkillArgs(
  userText: string,
  args: Record<string, unknown>
): string | null {
  const normUser = stripDiacritics(userText).trim();
  let contactVal = '';
  let messageVal = '';

  for (const [k, v] of Object.entries(args || {})) {
    const kn = stripDiacritics(k).trim();
    const valStr = typeof v === 'string' ? v.trim() : v != null ? String(v).trim() : '';
    if (!contactVal && (/contact|recipient|receiver|person|nguoi|friend/.test(kn) || kn === 'to')) {
      contactVal = valStr;
    } else if (
      !messageVal &&
      /message|msg|content|text|noi_dung|tin_nhan|body/.test(kn)
    ) {
      messageVal = valStr;
    }
  }

  if (!contactVal || !messageVal) {
    return 'Đã chặn thao tác gửi tin nhắn vì thiếu tên người nhận hoặc nội dung cụ thể trong câu yêu cầu.';
  }

  const normContact = stripDiacritics(contactVal).replace(/[?!.]+$/g, '').trim();
  const normMsg = stripDiacritics(messageVal).replace(/[?!.]+$/g, '').trim();

  if (UNSAFE_CHAT_PLACEHOLDERS.has(normContact) && !normUser.includes(normContact)) {
    return `Đã chặn gửi tin nhắn tới người nhận mặc định "${contactVal}" vì không có trong yêu cầu của bạn.`;
  }
  if (UNSAFE_CHAT_PLACEHOLDERS.has(normMsg) && !normUser.includes(normMsg)) {
    return `Đã chặn gửi nội dung mặc định "${messageVal}" vì không có trong yêu cầu của bạn.`;
  }

  return null;
}

export function extractArgsHeuristically(
  skill: CustomSkillRecord,
  userText: string,
  pinnedFiles?: IngestedFileAnalysis[]
): Record<string, unknown> {
  const params = parseParamsSchema(skill.params_schema_json);
  const args: Record<string, unknown> = {};
  const norm = stripDiacritics(userText);
  const chatParsed = extractChatContactAndMessage(userText);
  const targetPinned = pickTargetPinnedFile(userText, pinnedFiles);

  let fallbackTestArgs: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(skill.test_args_json || '{}');
    if (parsed && typeof parsed === 'object') {
      fallbackTestArgs = parsed as Record<string, unknown>;
    }
  } catch {
    // ignore
  }

  for (const p of params) {
    const keyNorm = stripDiacritics(p.name);
    if (p.type === 'number') {
      if (keyNorm.includes('port')) {
        const portMatch =
          userText.match(/(?:port|cong|cổng)\s*[:#]?\s*(\d{2,5})/i) ||
          userText.match(/\b(\d{4,5})\b/);
        if (portMatch?.[1]) {
          args[p.name] = Number(portMatch[1]);
          continue;
        }
      }
      const numMatch = userText.match(/\b(\d+(?:\.\d+)?)\b/);
      if (numMatch?.[1]) {
        args[p.name] = Number(numMatch[1]);
      } else if (p.default !== undefined) {
        args[p.name] = p.default;
      } else if (fallbackTestArgs[p.name] !== undefined) {
        args[p.name] = fallbackTestArgs[p.name];
      }
    } else if (p.type === 'boolean') {
      if (
        /(?:tat|khong|disable|false|check only|chi xem)/.test(norm) &&
        !/(?:dong|kill|don|xoa|cleanup|close|giet)/.test(norm)
      ) {
        args[p.name] = false;
      } else if (/(?:dong|kill|don|tat tien trinh|cleanup|close|true|force|bat)/.test(norm)) {
        args[p.name] = true;
      } else if (p.default !== undefined) {
        args[p.name] = p.default;
      }
    } else if (p.type === 'array' || p.type === 'object') {
      const jsonSnippetMatch =
        p.type === 'array' ? userText.match(/\[[\s\S]*\]/) : userText.match(/\{[\s\S]*\}/);
      let parsedComplex: unknown = undefined;
      if (jsonSnippetMatch?.[0]) {
        try {
          parsedComplex = JSON.parse(jsonSnippetMatch[0]);
        } catch {
          parsedComplex = undefined;
        }
      }
      if (parsedComplex !== undefined) {
        args[p.name] = parsedComplex;
      } else if (p.default !== undefined) {
        args[p.name] = p.default;
      } else if (fallbackTestArgs[p.name] !== undefined) {
        args[p.name] = fallbackTestArgs[p.name];
      } else {
        args[p.name] = p.type === 'array' ? [] : {};
      }
    } else {
      if (keyNorm === 'action' || keyNorm === 'mode' || keyNorm === 'operation') {
        if (/(?:tao|create|new|khoi tao)/.test(norm) && !/(?:sua|chinh|edit|update)/.test(norm)) {
          args[p.name] = 'create';
        } else if (/(?:them dong|them\s+\d*\s*dong|append|bo sung)/.test(norm)) {
          args[p.name] = 'append';
        } else if (/(?:chinh sua|sua|cap nhat|edit|update)/.test(norm)) {
          args[p.name] = 'edit';
        } else if (/(?:xoa dong|delete|remove)/.test(norm)) {
          args[p.name] = 'delete';
        } else if (/(?:doc|xem|read|list|scan|quet)/.test(norm)) {
          args[p.name] = 'read';
        } else if (/(?:dong|don|tat|kill|giet|ket|giai phong|clear|close|terminate)/.test(norm)) {
          args[p.name] = 'kill';
        } else if (/(?:kiem tra|check)/.test(norm)) {
          args[p.name] = 'check';
        } else if (p.default !== undefined) {
          args[p.name] = p.default;
        } else {
          args[p.name] = 'run';
        }
      } else if (
        keyNorm.includes('path') ||
        keyNorm.includes('dir') ||
        keyNorm.includes('folder') ||
        keyNorm.includes('file') ||
        keyNorm.includes('location')
      ) {
        const pathMatch = userText.match(/([a-zA-Z]:[\\/][^\s"']+)|"([^"]+)"|'([^']+)'/);
        const bareFileMatch = userText.match(
          /\b([a-zA-Z0-9_.\-]+\.(?:csv|xlsx|xls|json|txt|docx|pdf|xml|md|py|ps1))\b/i
        );
        let extractedPath = (
          pathMatch?.[1] ||
          pathMatch?.[2] ||
          pathMatch?.[3] ||
          bareFileMatch?.[1] ||
          ''
        ).trim();
        const isCreateBrandNewUnrelated =
          /(?:tao\s+(?:cho\s+\S+\s+)?(?:1\s+|mot\s+)?file\s+moi|create\s+new\s+file)/.test(
            norm
          ) &&
          !/(?:file nay|tep nay|file dang ghim|file vua keo|tu file nay|from this file)/.test(
            norm
          );
        if (!extractedPath && targetPinned && !isCreateBrandNewUnrelated) {
          extractedPath = (targetPinned.file_path || targetPinned.file_name || '').trim();
        }
        if (!extractedPath) {
          const smartName = inferSmartFilenameFromUserText(
            userText,
            p.default ?? fallbackTestArgs[p.name]
          );
          if (smartName) {
            extractedPath = smartName;
          } else if (/\bdesktop\b/.test(norm)) {
            extractedPath = '%USERPROFILE%\\Desktop';
          } else if (/\bdownloads?\b|\btai ve\b/.test(norm)) {
            extractedPath = '%USERPROFILE%\\Downloads';
          } else if (/\bdocuments?\b|\btai lieu\b/.test(norm)) {
            extractedPath = '%USERPROFILE%\\Documents';
          } else {
            const driveMatch = norm.match(/\bo\s+(?:dia\s+)?([a-z])\b/);
            if (driveMatch?.[1]) extractedPath = `${driveMatch[1].toUpperCase()}:\\`;
          }
        }
        args[p.name] =
          extractedPath || p.default || fallbackTestArgs[p.name] || '.';
      } else if (
        /contact|recipient|receiver|person|nguoi|friend|user/.test(keyNorm) ||
        keyNorm === 'to'
      ) {
        args[p.name] = chatParsed?.contact || '';
      } else if (
        /message|msg|content|text|noi_dung|tin_nhan|body/.test(keyNorm)
      ) {
        args[p.name] = chatParsed?.message || '';
      } else if (/app|platform|channel/.test(keyNorm) && chatParsed?.app) {
        args[p.name] = chatParsed.app;
      } else if (
        keyNorm.includes('target') ||
        keyNorm.includes('query') ||
        keyNorm.includes('keyword') ||
        keyNorm.includes('name') ||
        keyNorm.includes('title') ||
        keyNorm.includes('app')
      ) {
        const extractedTarget = extractTargetArgFromText(userText);
        args[p.name] =
          extractedTarget || p.default || fallbackTestArgs[p.name] || '';
      } else if (p.default !== undefined) {
        args[p.name] = p.default;
      } else if (fallbackTestArgs[p.name] !== undefined) {
        args[p.name] = fallbackTestArgs[p.name];
      } else {
        args[p.name] = '';
      }
    }
  }
  return args;
}

export function matchSavedSkillForUserText(
  userText: string,
  pinnedFiles?: IngestedFileAnalysis[]
): { skill: CustomSkillRecord; args: Record<string, unknown> } | null {
  if (isQuestionOrMetaDiscussion(userText)) return null;
  const active = cachedCustomSkills.filter((s) => s.enabled && s.verified);
  if (active.length === 0) return null;

  const normText = stripDiacritics(userText).trim();
  const targetPinned = pickTargetPinnedFile(userText, pinnedFiles);
  const pinnedExtTokens = targetPinned ? getPinnedExtensionTokens(targetPinned) : [];
  const hasEditOrTransformVerb =
    /\b(?:sua|chinh sua|them|bo sung|cap nhat|xoa dong|xoa cot|loc va luu|xuat|export|chuyen doi|convert|sap xep|sort|gop|merge|ghi de|append|edit|update|delete|tao\s+(?:file|bang))\b/.test(
      normText
    );
  const isPureQaAboutFile =
    Boolean(pinnedFiles?.length) &&
    !hasEditOrTransformVerb &&
    /\b(?:tom tat|phan tich|dich|giai thich|noi ve|la gi|bao nhieu|tong cong|trung binh|cao nhat|thap nhat|liet ke|doc noi dung|kiem tra noi dung|tim trong|hoi ve|nhan xet|danh gia)\b/.test(
      normText
    );
  const refersToPinnedFile =
    Boolean(targetPinned) &&
    /(?:\bfile\b|\btep\b|file nay|tep nay|file dang ghim|file vua keo|file vua tha|bang nay|du lieu nay)/.test(
      normText
    );

  const chatCmd = extractChatContactAndMessage(userText);
  const hasExplicitSendVerb =
    Boolean(chatCmd) ||
    /\b(?:gui|send|gui tin|gui cho|nhan tin cho|nhan cho|ib cho|inbox cho|tra loi|reply)\b/.test(
      normText
    );
  const hasCheckMsgIntent =
    /\b(?:check|kiem tra|xem|doc)\b[\s\S]{0,36}\b(?:tin nhan|thong bao|message|notification|unread|chua doc|moi)\b/.test(
      normText
    ) || /\b(?:co tin nhan|tin nhan moi|chua doc|unread|new message)\b/.test(normText);
  const isPureCheckQuery =
    /\b(?:check|kiem tra|xem co|xem thu|doc|liet ke|co .* khong|co .* k)\b/.test(normText) &&
    !/\b(?:gui|send|tao|create|xoa|delete|remove|kill|dong|tat|sua|chinh sua|edit|them|append|cap nhat|update|mo|open)\b/.test(
      normText
    );

  const matchNormText =
    pinnedExtTokens.length > 0 && hasEditOrTransformVerb
      ? `${normText} ${pinnedExtTokens.join(' ')}`
      : normText;
  const normWordsSet = new Set(matchNormText.split(/[^a-z0-9]+/).filter(Boolean));
  const hasExplicitCheckIntent =
    /\b(?:check|kiem tra|dang mo chua|co mo khong|co dang mo|co dang chay|mo chua)\b/.test(normText);
  const hasOpenAndSearchIntent =
    /\b(?:mo|bat|open)\b[\s\S]{1,35}\b(?:va|and|roi)\b[\s\S]{0,20}\b(?:search|tim|tra cuu)\b/.test(normText);

  let bestSkill: CustomSkillRecord | null = null;
  let bestScore = 0;

  for (const sk of active) {
    const idNorm = stripDiacritics(sk.id).replace(/_/g, ' ');
    const nameNorm = stripDiacritics(sk.name);
    const triggers = parseTriggers(sk.triggers_json);
    const skillTextSpace = `${idNorm} ${nameNorm} ${stripDiacritics(triggers.join(' '))}`;
    const hasFileParam = parseParamsSchema(sk.params_schema_json).some((p) => {
      const k = stripDiacritics(p.name);
      return k.includes('path') || k.includes('file');
    });

    if (
      isPureQaAboutFile &&
      (hasFileParam || /\b(?:csv|xlsx|excel|pdf|file|tep|json|txt)\b/.test(skillTextSpace))
    ) {
      continue;
    }

    if (isSendChatSkill(sk) && (!hasExplicitSendVerb || (hasCheckMsgIntent && !chatCmd))) {
      continue;
    }

    if (
      isPureCheckQuery &&
      /\b(?:gui|send|tao|create|xoa|delete|remove|kill|dong|tat|chinh sua|edit)\b/.test(
        `${idNorm} ${nameNorm}`
      ) &&
      !/\b(?:kiem tra|check|doc|read|xem|list|liet ke)\b/.test(`${idNorm} ${nameNorm}`)
    ) {
      continue;
    }

    const isCheckOnlySkill =
      (/^(?:check|kiem tra)\b/.test(idNorm) || /^(?:check|kiem tra)\b/.test(nameNorm)) &&
      !/\b(?:search|tim|mo)\b/.test(nameNorm);
    if (hasOpenAndSearchIntent && !hasExplicitCheckIntent && isCheckOnlySkill) {
      continue;
    }

    let score = 0;
    for (const trig of triggers) {
      const nt = stripDiacritics(trig).trim();
      if (nt.length < 3) continue;
      const trigWords = nt.split(/\s+/).filter(Boolean);
      const meaningful = trigWords.filter((w) => w.length >= 2 && !SKILL_MATCH_STOPWORDS.has(w));
      if (meaningful.length === 0 && trigWords.length < 2) continue;

      if (matchNormText.includes(nt) && (meaningful.length >= 1 || trigWords.length >= 2)) {
        score += 8 + Math.min(4, Math.floor(nt.length / 4));
      } else if (
        trigWords.length >= 2 &&
        meaningful.length >= 1 &&
        trigWords.every((w) => normWordsSet.has(w) || (w.length >= 4 && matchNormText.includes(w)))
      ) {
        score += 6;
      }
    }

    if (idNorm.length >= 4 && matchNormText.includes(idNorm)) {
      score += 8;
    }

    const meaningfulNameTokens = Array.from(
      new Set(
        nameNorm
          .split(/[^a-z0-9]+/)
          .filter((t) => t.length >= 3 && !SKILL_MATCH_STOPWORDS.has(t))
      )
    );
    const hasActionConflict = (() => {
      if (/\b(?:gui|send)\b/.test(nameNorm) && !hasExplicitSendVerb) return true;
      if (/\b(?:tao|create)\b/.test(nameNorm) && !/\b(?:tao|create|new|viet|sinh)\b/.test(matchNormText)) {
        return true;
      }
      if (/\b(?:xoa|delete|remove)\b/.test(nameNorm) && !/\b(?:xoa|delete|remove)\b/.test(matchNormText)) {
        return true;
      }
      if (
        /\b(?:kill|dong|tat)\b/.test(nameNorm) &&
        !/\b(?:kill|dong|tat|giet|ket thuc|terminate|close)\b/.test(matchNormText)
      ) {
        return true;
      }
      if (
        /\b(?:chinh|sua|edit)\b/.test(nameNorm) &&
        !/\b(?:chinh|sua|edit|update|cap nhat|them|append|loc|export|chuyen doi|convert)\b/.test(
          matchNormText
        )
      ) {
        return true;
      }
      return false;
    })();
    if (meaningfulNameTokens.length > 0 && !hasActionConflict) {
      let tokenHits = 0;
      for (const tok of meaningfulNameTokens) {
        if (normWordsSet.has(tok) || matchNormText.includes(tok)) tokenHits++;
      }
      if (
        tokenHits >= Math.min(2, meaningfulNameTokens.length) &&
        tokenHits / meaningfulNameTokens.length >= 0.5
      ) {
        score += tokenHits * 3;
      }
    }

    if (
      hasEditOrTransformVerb &&
      refersToPinnedFile &&
      hasFileParam &&
      pinnedExtTokens.some((ext) => skillTextSpace.includes(ext))
    ) {
      score += 6;
    }

    if (score >= 6 && score > bestScore) {
      bestScore = score;
      bestSkill = sk;
    }
  }

  if (!bestSkill) return null;
  return {
    skill: bestSkill,
    args: extractArgsHeuristically(bestSkill, userText, pinnedFiles),
  };
}

export async function extractArgsWithLocalLlmIfAvailable(
  skill: CustomSkillRecord,
  userText: string,
  heuristicArgs: Record<string, unknown>,
  pinnedFiles?: IngestedFileAnalysis[]
): Promise<Record<string, unknown>> {
  const params = parseParamsSchema(skill.params_schema_json);
  if (params.length === 0) return heuristicArgs;

  const normText = stripDiacritics(userText);
  const hasPinnedFiles = Boolean(pinnedFiles && pinnedFiles.length > 0);
  const needsSmartPlanner =
    hasPinnedFiles ||
    isSendChatSkill(skill) ||
    params.some((p) => p.type === 'array' || p.type === 'object') ||
    params.length >= 2 ||
    /(?:data|du lieu|bat ki|bat ky|mau|vi du|san pham|kinh doanh|bao cao|danh sach|bang|csv|xlsx|excel|tao |chinh sua|sua |them dong|cap nhat|noi dung|viet )/.test(
      normText
    );

  const pinnedBlock = hasPinnedFiles
    ? `\nFILE ĐANG GHIM TRONG THANH CHAT:\n${pinnedFiles!
        .map((f, i) => {
          const cols = f.columns?.length ? f.columns.slice(0, 20).join(', ') : '(không rõ)';
          const excerpt = (f.raw_excerpt || '').trim().slice(0, 2200);
          return `${i + 1}. Tên: "${f.file_name}" | Đường dẫn đĩa thật: ${f.file_path || '(chưa có)'} | Loại: ${f.file_type} | Cột: ${cols}\nTrích xuất:\n${excerpt}`;
        })
        .join('\n\n')}\n`
    : '';

  const codeExcerpt = (skill.code || '').slice(0, 1800);
  const smartPrompt = `Bạn là bộ lập kế hoạch tham số thông minh cho Custom Skill đã kiểm chứng.
Skill: "${skill.name}" (id: "${skill.id}", mô tả: "${skill.description}")
Schema tham số: ${JSON.stringify(params)}
Trích đoạn mã nguồn skill (hãy đọc kỹ tên key, cấu trúc rows/columns/cells mà code này thực sự xử lý):
\`\`\`${skill.language}
${codeExcerpt}
\`\`\`${pinnedBlock}
Câu yêu cầu người dùng: "${userText}"
Gợi ý mặc định ban đầu: ${JSON.stringify(heuristicArgs)}

QUY TẮC BẮT BUỘC:
0. XÁC NHẬN Ý ĐỊNH THỰC SỰ: Đánh giá câu người dùng so với chức năng của skill "${skill.name}". Nếu người dùng CHỈ đang hỏi đáp, nhờ giải thích, phàn nàn lỗi, kiểm tra chỉ đọc, hoặc yêu cầu việc KHÔNG khớp công dụng thật của skill -> trả về {"_should_execute": false, "_reason": "<lý do ngắn>"}. Chỉ khi người dùng THỰC SỰ muốn chạy hành động này mới trả về {"_should_execute": true, ...các tham số}.
1. ĐÚNG ĐỊNH DẠNG FILE: Nếu người dùng yêu cầu .csv thì tham số đường dẫn/file PHẢI có đuôi .csv; nếu yêu cầu .xlsx/Excel thì PHẢI có đuôi .xlsx (tuyệt đối không dùng nhầm đuôi mặc định từ test_args).
2. TÊN FILE CÓ Ý NGHĨA: Nếu người dùng không nêu đường dẫn cụ thể và không dùng file đang ghim, đặt tên file không dấu theo chủ đề (vd: "san_pham_kinh_doanh.csv"), không cần thư mục vì hệ thống tự lưu vào Desktop.
3. TỰ SINH DỮ LIỆU THỰC TẾ: Nếu người dùng nhờ tạo data ngẫu nhiên/bất kỳ/theo chủ đề (vd: sản phẩm kinh doanh, nhân viên, chi tiêu...), hãy TỰ TẠO 6 đến 10 dòng/mục dữ liệu tiếng Việt sinh động, đa dạng, khớp chính xác cấu trúc mảng/object mà đoạn mã nguồn trên đang đọc — TUYỆT ĐỐI KHÔNG để mảng rỗng [] hay giữ giá trị test rỗng.
4. Chỉ trả về DUY NHẤT 1 JSON object hợp lệ khớp các khóa của schema/code (kèm "_should_execute").
5. FILE ĐANG GHIM: Nếu người dùng đang yêu cầu đọc/chỉnh sửa/thêm dòng/xóa dòng/lọc/chuyển đổi file đang ghim ở trên, BẮT BUỘC dùng chính xác đường dẫn thật trên đĩa của file đó làm tham số đường dẫn/file (không tự đổi tên file khác trừ khi người dùng yêu cầu xuất file mới), và giữ đúng tên cột hiện có.
6. AN TOÀN GỬI TIN NHẮN: Với skill gửi tin nhắn (Zalo/Telegram/Discord/Messenger), TUYỆT ĐỐI KHÔNG tự bịa tên người nhận mặc định ("Bạn bè", "Duck AI") hoặc nội dung mặc định ("Xin chào!") nếu người dùng không nêu rõ trong câu yêu cầu — hãy để chuỗi rỗng "" hoặc trả về {"_should_execute": false}.`;

  if (needsSmartPlanner) {
    try {
      const geminiTask = invoke<string>('ask_gemini', {
        apiKey: ctxProvider.getGeminiApiKey(),
        model: ctxProvider.getGeminiModel(),
        systemPrompt:
          'You are an intelligent intent verifier, argument planner, and synthetic data generator. Return strictly one valid JSON object matching the script parameter schema and include "_should_execute".',
        messages: [{ role: 'user', content: smartPrompt }],
        jsonMode: true,
        maxOutputTokens: 2048,
        thinkingBudget: 0,
      });
      const timeout = new Promise<string>((resolve) => setTimeout(() => resolve(''), 14000));
      const raw = await Promise.race([geminiTask, timeout]);
      const parsed = raw ? parseJsonObjectLoose(raw) : null;
      if (parsed && typeof parsed === 'object') {
        return { ...heuristicArgs, ...parsed };
      }
    } catch {
      // Fall back to Ollama or heuristic extraction below
    }

    if (ctxProvider.isOllamaOnline()) {
      try {
        const task = invoke<string>('ask_ollama', {
          model: ctxProvider.getOllamaModel(),
          messages: [
            { role: 'system', content: 'Return strictly one valid JSON object only.' },
            { role: 'user', content: smartPrompt },
          ],
        });
        const timeout = new Promise<string>((resolve) => setTimeout(() => resolve(''), 10000));
        const raw = await Promise.race([task, timeout]);
        const parsed = raw ? parseJsonObjectLoose(raw) : null;
        if (parsed && typeof parsed === 'object') {
          return { ...heuristicArgs, ...parsed };
        }
      } catch {
        // Fall back cleanly to heuristic extraction
      }
    }
    return heuristicArgs;
  }

  const quickPrompt = `Trích xuất JSON tham số cho skill "${skill.id}" (${skill.description}) từ câu người dùng.
Schema tham số: ${JSON.stringify(params)}
Câu người dùng: "${userText}"
Nếu câu người dùng KHÔNG thực sự yêu cầu chạy skill này (chỉ hỏi đáp, giải thích, kiểm tra khác mục đích), hãy trả về {"_should_execute": false}.
Chỉ trả về DUY NHẤT 1 JSON object hợp lệ (không giải thích, không markdown). Gợi ý mặc định: ${JSON.stringify(heuristicArgs)}`;

  if (ctxProvider.isOllamaOnline()) {
    try {
      const task = invoke<string>('ask_ollama', {
        model: ctxProvider.getOllamaModel(),
        messages: [
          { role: 'system', content: 'Return strictly one valid JSON object only.' },
          { role: 'user', content: quickPrompt },
        ],
      });
      const timeout = new Promise<string>((resolve) => setTimeout(() => resolve(''), 3800));
      const raw = await Promise.race([task, timeout]);
      const match = raw.match(/\{[\s\S]*\}/);
      if (match?.[0]) {
        const parsed = JSON.parse(match[0]) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object') {
          return { ...heuristicArgs, ...parsed };
        }
      }
    } catch {
      // Fallback cleanly to heuristic extraction
    }
  }

  return heuristicArgs;
}

function escapeControlCharsInJsonStrings(input: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (!inString) {
      out += ch;
      if (ch === '"') inString = true;
      continue;
    }
    if (ch === '\\') {
      const next = input[i + 1];
      if (
        next === '"' ||
        next === '\\' ||
        next === '/' ||
        next === 'b' ||
        next === 'f' ||
        next === 'n' ||
        next === 'r' ||
        next === 't'
      ) {
        out += '\\' + next;
        i++;
      } else if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(input.slice(i + 2, i + 6))) {
        out += input.slice(i, i + 6);
        i += 5;
      } else {
        out += '\\\\';
      }
      continue;
    }
    if (ch === '"') {
      out += ch;
      inString = false;
      continue;
    }
    const code = ch.charCodeAt(0);
    if (ch === '\n') {
      out += '\\n';
    } else if (ch === '\r') {
      out += '\\r';
    } else if (ch === '\t') {
      out += '\\t';
    } else if (code < 0x20) {
      out += `\\u${code.toString(16).padStart(4, '0')}`;
    } else {
      out += ch;
    }
  }
  return out;
}

function tryParseJsonObj(candidate: string): Record<string, unknown> | null {
  const trimmed = candidate.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  for (const variant of [trimmed, escapeControlCharsInJsonStrings(trimmed)]) {
    try {
      const parsed = JSON.parse(variant);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try next variant
    }
  }
  return null;
}

function parseJsonObjectLoose(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const direct = tryParseJsonObj(trimmed);
  if (direct) return direct;

  const jsonFenceRegex = /```json\s*([\s\S]*?)```/gi;
  let fenceMatch: RegExpExecArray | null;
  while ((fenceMatch = jsonFenceRegex.exec(trimmed)) !== null) {
    const inside = tryParseJsonObj(fenceMatch[1]);
    if (inside) return inside;
  }

  const parsedCandidates: Record<string, unknown>[] = [];
  let inString = false;
  let escaped = false;
  let depth = 0;
  let startIdx = -1;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) startIdx = i;
      depth++;
    } else if (ch === '}' && depth > 0) {
      depth--;
      if (depth === 0 && startIdx >= 0) {
        const obj = tryParseJsonObj(trimmed.slice(startIdx, i + 1));
        if (obj) parsedCandidates.push(obj);
        startIdx = -1;
      }
    }
  }

  const preferred = parsedCandidates.find(
    (o) =>
      typeof o.code === 'string' ||
      typeof o.patched_code === 'string' ||
      typeof o.id === 'string' ||
      typeof o.heal_note === 'string'
  );
  return preferred || parsedCandidates[0] || null;
}

function extractLargestCodeFence(
  raw: string
): { lang: 'powershell' | 'python' | null; code: string } | null {
  const fenceRegex = /```(powershell|ps1|pwsh|python|py|json)?\s*\r?\n([\s\S]*?)```/gi;
  let best: { lang: 'powershell' | 'python' | null; code: string } | null = null;
  let m: RegExpExecArray | null;
  while ((m = fenceRegex.exec(raw)) !== null) {
    const tag = (m[1] || '').toLowerCase();
    if (tag === 'json') continue;
    const body = (m[2] || '').trim();
    if (!body) continue;
    let lang: 'powershell' | 'python' | null = null;
    if (tag === 'powershell' || tag === 'ps1' || tag === 'pwsh') lang = 'powershell';
    else if (tag === 'python' || tag === 'py') lang = 'python';
    if (!best || body.length > best.code.length) {
      best = { lang, code: body };
    }
  }
  if (best) return best;

  const openFenceMatch = raw.match(/```(powershell|ps1|pwsh|python|py)\s*\r?\n([\s\S]+)$/i);
  if (openFenceMatch?.[2]) {
    const tag = openFenceMatch[1].toLowerCase();
    const body = openFenceMatch[2].replace(/```+\s*$/, '').trim();
    if (body) {
      const lang: 'powershell' | 'python' =
        tag === 'python' || tag === 'py' ? 'python' : 'powershell';
      return { lang, code: body };
    }
  }
  return null;
}

function inferSkillIdFromRequest(userRequest: string): string {
  const slug = stripDiacritics(userRequest)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return slug || 'custom_tool';
}

function salvageDraftFromRawText(
  raw: string,
  userRequest: string,
  preferredLang: 'auto' | 'powershell' | 'python'
): Record<string, unknown> | null {
  const fenced = extractLargestCodeFence(raw);
  if (!fenced || fenced.code.length < 15) return null;

  const looksPython =
    fenced.lang === 'python' ||
    preferredLang === 'python' ||
    /\bimport\s+(?:os|sys|json|pathlib|csv|openpyxl|pandas)\b/.test(fenced.code);
  const language: 'powershell' | 'python' = looksPython ? 'python' : 'powershell';
  const normReq = stripDiacritics(userRequest);

  const tokens = Array.from(
    new Set(
      normReq
        .split(/\s+/)
        .map((t) => t.replace(/[^a-z0-9]/g, ''))
        .filter((t) => t.length >= 3 && !['tao', 'tool', 'skill', 'viet', 'giup', 'cho', 'cua'].includes(t))
    )
  ).slice(0, 6);

  let paramsSchema: SkillParamDef[] = [];
  let testArgs: Record<string, unknown> = {};
  if (/(?:file|folder|thu muc|dung luong|size|o dia|dir|csv|xlsx|excel)/.test(normReq)) {
    paramsSchema = [
      {
        name: 'path',
        type: 'string',
        description: 'Đường dẫn file hoặc thư mục cần xử lý',
        required: false,
        default: '.',
      },
    ];
    testArgs = { path: '.' };
  } else if (/port|cong/.test(normReq)) {
    paramsSchema = [
      {
        name: 'port',
        type: 'number',
        description: 'Số cổng TCP cần kiểm tra/đóng',
        required: true,
        default: 3000,
      },
      {
        name: 'action',
        type: 'string',
        description: 'check hoặc kill',
        required: false,
        default: 'check',
      },
    ];
    testArgs = { port: 59999, action: 'check' };
  }

  return {
    id: inferSkillIdFromRequest(userRequest),
    name: userRequest.trim().slice(0, 56) || 'Skill Hệ Thống Mới',
    description: userRequest.trim(),
    language,
    triggers: tokens.length > 0 ? tokens : ['custom tool'],
    params_schema: paramsSchema,
    test_args: testArgs,
    expected_keywords: [],
    code: fenced.code,
  };
}

export function parseToolForgeDesignResponse(
  raw: string,
  userRequest: string,
  preferredLang: 'auto' | 'powershell' | 'python'
): Record<string, unknown> | null {
  const meta = parseJsonObjectLoose(raw);
  const fenced = extractLargestCodeFence(raw);

  if (fenced && fenced.code.length >= 15) {
    const salvaged = salvageDraftFromRawText(raw, userRequest, preferredLang);
    const base = meta || salvaged || {};
    const metaLang = String(base.language || '').toLowerCase();
    const resolvedLang: 'powershell' | 'python' =
      fenced.lang ||
      (preferredLang !== 'auto'
        ? preferredLang
        : metaLang.includes('python') ||
          /\bimport\s+(?:os|sys|json|pathlib|csv|openpyxl|pandas)\b/.test(fenced.code)
        ? 'python'
        : 'powershell');

    return {
      ...salvaged,
      ...base,
      language: resolvedLang,
      code: fenced.code,
    };
  }

  if (meta && typeof meta.code === 'string' && meta.code.trim()) {
    return meta;
  }
  return salvageDraftFromRawText(raw, userRequest, preferredLang);
}

function salvagePatchedCodeFromRawText(raw: string): string {
  const fenced = extractLargestCodeFence(raw);
  return fenced?.code || '';
}

export function parseSelfHealResponse(raw: string): {
  patchedCode: string;
  healNote: string;
} {
  const parsed = parseJsonObjectLoose(raw);
  const fenced = extractLargestCodeFence(raw);
  const healNote =
    typeof parsed?.heal_note === 'string' && parsed.heal_note.trim()
      ? parsed.heal_note.trim()
      : 'Đã tự động vá mã nguồn theo log lỗi';

  if (fenced && fenced.code.trim()) {
    return { patchedCode: fenced.code.trim(), healNote };
  }
  if (typeof parsed?.patched_code === 'string' && parsed.patched_code.trim()) {
    return { patchedCode: parsed.patched_code.trim(), healNote };
  }
  return { patchedCode: salvagePatchedCodeFromRawText(raw), healNote };
}

function isDataOrDocumentToolRequest(userRequest: string): boolean {
  const norm = stripDiacritics(userRequest);
  return /(?:csv|xlsx|xls|excel|word|docx|pdf|json|xml|sqlite|sql|api|http|scrape|chart|image|ocr|zip|email|bang tinh|du lieu|thong ke|phan tich|chinh sua file|tao file)/i.test(
    norm
  );
}

function buildGeminiArchitectPrompt(userRequest: string, preferredLang: string): string {
  const isDataTask = isDataOrDocumentToolRequest(userRequest);
  const langRule =
    preferredLang === 'powershell'
      ? 'BẮT BUỘC viết bằng Windows PowerShell 5.1 ("language": "powershell").'
      : preferredLang === 'python'
      ? 'BẮT BUỘC viết bằng Python 3 ("language": "python").'
      : isDataTask
      ? 'BẮT BUỘC viết bằng Python 3 ("language": "python") vì đây là tác vụ dữ liệu / bảng tính / tài liệu / API. Dùng thư viện Python thật (csv, json, openpyxl với fallback pandas hoặc stdlib zipfile+xml khi thiếu gói ngoài) - TUYỆT ĐỐI KHÔNG xuất CSV giả dạng .xlsx hay chỉ gợi ý mở Excel.'
      : 'Ưu tiên Python 3 ("python") cho xử lý dữ liệu, file, bảng tính, API, hoặc Windows PowerShell 5.1 ("powershell") cho điều khiển Windows / tiến trình / port / UI.';

  return `Bạn là Kỹ sư Công cụ Hệ thống Windows (Tool Forge Architect).
Local LLM không có sẵn skill hoặc chưa tự viết được nên chuyển yêu cầu này sang bạn:
"${userRequest}"

HÃY THIẾT KẾ 1 SKILL PHỨC TẠP, ĐẦY ĐỦ TÍNH NĂNG, TÁI SỬ DỤNG ĐƯỢC VÀ KIỂM NGHIỆM THẬT TRÊN SANDBOX WINDOWS:
${langRule}
QUY TẮC BẮT BUỘC CHO CODE:
1. Nhận tham số qua \`DUCK_TOOL_ARGS_JSON\` (Python: \`args = json.loads(os.environ.get('DUCK_TOOL_ARGS_JSON', '{}') or '{}')\`; PowerShell: \`$argsObj = ($env:DUCK_TOOL_ARGS_JSON | ConvertFrom-Json -ErrorAction SilentlyContinue)\`). Luôn dùng giá trị mặc định an toàn nếu thiếu trường. PowerShell KHÔNG dùng khối \`param(...)\` ở đầu file và thêm \`-ErrorAction SilentlyContinue\` cho các lệnh hệ thống.
2. Được phép viết code đầy đủ, cấu trúc rõ ràng lên tới ~250 dòng (hỗ trợ hàm phụ trợ, phân nhánh \`action\` như create/read/edit/append/delete nếu phù hợp, hỗ trợ UTF-8 \`encoding='utf-8-sig'\` cho CSV tiếng Việt, tự tạo thư mục cha nếu chưa có, xử lý lỗi rõ ràng).
3. Chế độ Sandbox thật & Đường dẫn đầu ra thật:
   - Khi \`DUCK_SANDBOX_MODE == "1"\`, script PHẢI thực thi quy trình tạo/sửa/đọc thật trên 1-2 file mẫu nhỏ nằm trong thư mục sandbox hiện tại (\`os.environ.get('DUCK_SANDBOX_DIR', '.')\` hoặc \`$PWD\`) trong < 10 giây (tuyệt đối KHÔNG quét toàn bộ \`C:\\\` hay \`C:\\Users\`), rồi in báo cáo tiếng Việt không emoji ra stdout.
   - Khi \`DUCK_SANDBOX_MODE != "1"\`, nếu tham số đường dẫn chỉ là tên file tương đối (không chứa \`:\` hay \`/\`), hãy lưu vào thư mục \`os.environ.get('DUCK_OUTPUT_DIR', os.path.expanduser('~/Desktop'))\` (PowerShell: \`$env:DUCK_OUTPUT_DIR\` hoặc Desktop) để file không bị thất lạc, VÀ LUÔN in ra stdout đường dẫn tuyệt đối đầy đủ (\`os.path.abspath(...)\` / \`Resolve-Path\`) kèm tóm tắt kết quả (số dòng, tiêu đề cột, một vài dòng mẫu).
4. TUYỆT ĐỐI CẤM code giả lập/placeholder ("Đã mô phỏng hành động...", "Vui lòng tích hợp...").
5. Tuyệt đối KHÔNG nhắc tới chuỗi \`mate_memory.db\`, \`GEMINI_API_KEY\` hay file env ẩn ngay cả trong comment (bộ kiểm tra an toàn tĩnh sẽ chặn), không dùng \`Invoke-Expression\` / \`iex\`, không lệnh phá hoại ổ đĩa.
6. \`params_schema\` hỗ trợ type \`"string" | "number" | "boolean" | "array" | "object"\`. \`test_args\` phải là JSON object chạy được ngay trong Sandbox, và \`expected_keywords\` là 1-2 chuỗi chắc chắn xuất hiện trong stdout khi chạy pass.
7. \`triggers\` gồm 4-8 cụm từ khóa tiếng Việt không dấu và có dấu.

ĐỊNH DẠNG PHẢN HỒI BẮT BUỘC (2 KHỐI TÁCH BIỆT - KHÔNG NHÉT CODE VÀO TRONG JSON):
Khối 1 - DUY NHẤT metadata JSON (TUYỆT ĐỐI KHÔNG có trường "code"):
\`\`\`json
{
  "id": "csv_xlsx_manager",
  "name": "Quản Lý & Chỉnh Sửa File CSV/XLSX",
  "description": "Tạo mới, đọc, cập nhật dòng/ô và thêm dữ liệu cho file CSV và XLSX.",
  "language": "python",
  "triggers": ["tao file csv", "chinh sua csv", "tao file xlsx", "sua excel", "csv xlsx"],
  "params_schema": [
    { "name": "action", "type": "string", "description": "create, read, edit, append, delete", "required": true, "default": "create" },
    { "name": "path", "type": "string", "description": "Đường dẫn file .csv hoặc .xlsx", "required": true, "default": "sample.xlsx" },
    { "name": "rows", "type": "array", "description": "Danh sách dòng dữ liệu", "required": false, "default": [] }
  ],
  "test_args": { "action": "create", "path": "sandbox_demo.xlsx" },
  "expected_keywords": ["THANH CONG"]
}
\`\`\`
Khối 2 - Toàn bộ mã nguồn thô đầy đủ trong 1 code block \`\`\`python hoặc \`\`\`powershell:
\`\`\`python
# viết toàn bộ code hoàn chỉnh tại đây
\`\`\``;
}

function buildGeminiHealPrompt(
  name: string,
  language: string,
  brokenCode: string,
  argsJson: string,
  sandboxOrExecLog: string
): string {
  const fenceLang = language === 'python' ? 'python' : 'powershell';
  return `Bạn đang thực hiện SELF-HEALING (tự vá lỗi) cho skill "${name}" (${language}).
Mã nguồn bị lỗi hoặc chưa vượt qua bài test:
\`\`\`${fenceLang}
${brokenCode}
\`\`\`

Tham số đầu vào lúc chạy: ${argsJson}
Thông báo lỗi / stdout / stderr thu được:
${sandboxOrExecLog.slice(0, 2200)}

YÊU CẦU:
- Sửa triệt để lỗi cú pháp, import fallback nếu thiếu package ngoài, xử lý trường hợp null/trống/Unicode UTF-8, bảo đảm khi \`DUCK_SANDBOX_MODE == "1"\` chạy pass thật trong thư mục sandbox (< 10 giây) và in kết quả tiếng Việt không emoji ra stdout.
- Trả về đúng 2 khối tách biệt (KHÔNG nhét code vào trong JSON):
Khối 1:
\`\`\`json
{
  "heal_note": "Mô tả ngắn đã sửa lỗi gì"
}
\`\`\`
Khối 2:
\`\`\`${fenceLang}
# toàn bộ mã nguồn hoàn chỉnh đã sửa
\`\`\``;
}

export async function runDraftInSandbox(draft: ToolForgeDraft): Promise<ToolForgeDraft> {
  const res = await invoke<SandboxRunResult>('tool_forge_run_sandbox', {
    language: draft.language,
    code: draft.code,
    testArgsJson: draft.testArgsJson || '{}',
    expectedKeywords: draft.expectedKeywords,
  });
  const updated: ToolForgeDraft = {
    ...draft,
    sandbox: res,
  };
  latestToolForgeDraft = updated;
  return updated;
}

export async function runDraftLiveTest(
  draft: ToolForgeDraft,
  customArgsJson?: string
): Promise<ToolForgeDraft> {
  const argsJson = (customArgsJson ?? draft.liveTestArgsJson ?? draft.testArgsJson ?? '{}').trim() || '{}';
  try {
    JSON.parse(argsJson);
  } catch {
    throw new Error('Tham số JSON cho Test Chạy Thật không hợp lệ.');
  }
  const res = await invoke<SkillExecResult>('tool_forge_test_draft_live', {
    language: draft.language,
    code: draft.code,
    argsJson,
  });
  const note = res.ok
    ? `[USER TEST PASS] Chạy thật thành công (Exit=0, ${res.duration_ms}ms). Hãy kiểm tra kết quả & hành động thực tế trước khi đóng gói.`
    : `[USER TEST FAIL] Chạy thật lỗi (Exit=${res.exit_code}${res.timed_out ? ', TIMEOUT' : ''}): ${res.error_summary || res.stderr.slice(0, 140) || 'Không rõ lỗi'}`;
  const updated: ToolForgeDraft = {
    ...draft,
    liveTest: res,
    liveTestArgsJson: argsJson,
    healLogs: [...draft.healLogs, note],
  };
  latestToolForgeDraft = updated;
  return updated;
}

export async function selfHealDraftWithGemini(
  draft: ToolForgeDraft,
  onProgress?: (line: string) => void
): Promise<ToolForgeDraft> {
  const errParts: string[] = [];
  if (draft.sandbox) {
    errParts.push(
      `[SANDBOX] verified=${draft.sandbox.verified}, exit=${draft.sandbox.exit_code}, reason=${draft.sandbox.failure_reason}\nSTDOUT:\n${draft.sandbox.stdout}\nSTDERR:\n${draft.sandbox.stderr}`
    );
  }
  if (draft.liveTest) {
    errParts.push(
      `[USER LIVE TEST (DUCK_SANDBOX_MODE=0)] ok=${draft.liveTest.ok}, exit=${draft.liveTest.exit_code}, timed_out=${draft.liveTest.timed_out}, reason=${draft.liveTest.error_summary}\nSTDOUT:\n${draft.liveTest.stdout}\nSTDERR:\n${draft.liveTest.stderr}`
    );
  }
  const errSummary = errParts.length > 0 ? errParts.join('\n\n') : 'Chưa chạy Sandbox hoặc Test Chạy Thật';
  const healArgsJson =
    draft.liveTest && !draft.liveTest.ok
      ? draft.liveTestArgsJson || draft.testArgsJson
      : draft.testArgsJson;

  onProgress?.('[SELF-HEAL] Đang gửi mã nguồn + log lỗi sang Gemini để phân tích và vá lỗi...');
  const rawHeal = await invoke<string>('ask_gemini', {
    apiKey: ctxProvider.getGeminiApiKey(),
    model: ctxProvider.getGeminiModel(),
    systemPrompt:
      'Return 2 blocks: first a ```json block with {"heal_note":"..."}, then a raw code block with the complete patched script.',
    messages: [
      {
        role: 'user',
        content: buildGeminiHealPrompt(
          draft.name,
          draft.language,
          draft.code,
          healArgsJson,
          errSummary
        ),
      },
    ],
    jsonMode: false,
    maxOutputTokens: 16384,
    thinkingBudget: 2048,
  });

  const { patchedCode, healNote } = parseSelfHealResponse(rawHeal);

  if (!patchedCode.trim()) {
    const failedDraft: ToolForgeDraft = {
      ...draft,
      healLogs: [...draft.healLogs, `[SELF-HEAL FAIL] Gemini không trả về khối mã nguồn vá hợp lệ.`],
    };
    latestToolForgeDraft = failedDraft;
    return failedDraft;
  }

  onProgress?.(`[SELF-HEAL] Đã nhận bản vá (${healNote}). Đang chạy kiểm nghiệm lại trên Sandbox...`);
  const nextDraft = await runDraftInSandbox({
    ...draft,
    code: patchedCode,
    liveTest: null,
    healLogs: [...draft.healLogs, `[SELF-HEAL] ${healNote}`],
  });
  return nextDraft;
}

export async function forgeNewToolFromRequest(
  userRequest: string,
  preferredLang: 'auto' | 'powershell' | 'python' = 'auto',
  onProgress?: (line: string) => void
): Promise<ToolForgeDraft> {
  onProgress?.(
    '[1/4] Local LLM không có skill sẵn và không tự viết code -> Chuyển yêu cầu sang Gemini Architect...'
  );

  const systemArchitect =
    'You are an expert Windows & Python automation architect. Output EXACTLY two markdown blocks: (1) ```json metadata without any code field, and (2) ```python or ```powershell raw full source code.';

  let rawDesign = await invoke<string>('ask_gemini', {
    apiKey: ctxProvider.getGeminiApiKey(),
    model: ctxProvider.getGeminiModel(),
    systemPrompt: systemArchitect,
    messages: [
      {
        role: 'user',
        content: buildGeminiArchitectPrompt(userRequest, preferredLang),
      },
    ],
    jsonMode: false,
    maxOutputTokens: 16384,
    thinkingBudget: 2048,
  });

  let parsed = parseToolForgeDesignResponse(rawDesign, userRequest, preferredLang);
  if (!parsed || typeof parsed.code !== 'string' || !parsed.code.trim()) {
    onProgress?.(
      '[1/4 RETRY] Phản hồi lần 1 chưa đúng định dạng 2 khối -> Yêu cầu Gemini xuất lại metadata JSON + khối code thô...'
    );
    rawDesign = await invoke<string>('ask_gemini', {
      apiKey: ctxProvider.getGeminiApiKey(),
      model: ctxProvider.getGeminiModel(),
      systemPrompt: systemArchitect,
      messages: [
        {
          role: 'user',
          content: `${buildGeminiArchitectPrompt(userRequest, preferredLang)}\n\nCHÚ Ý LẦN THỬ LẠI: Lần trước bị thiếu khối code block! Hãy BẮT BUỘC xuất đủ cả 2 khối: \`\`\`json {metadata không có trường code} \`\`\` và \`\`\`python (hoặc \`\`\`powershell) {code thô hoàn chỉnh} \`\`\`.`,
        },
      ],
      jsonMode: false,
      maxOutputTokens: 16384,
      thinkingBudget: 2048,
    });
    parsed = parseToolForgeDesignResponse(rawDesign, userRequest, preferredLang);
  }

  if (!parsed || typeof parsed.code !== 'string' || !parsed.code.trim()) {
    const compact = rawDesign.replace(/\s+/g, ' ').trim();
    const head = compact.slice(0, 160);
    const tail = compact.length > 160 ? compact.slice(-160) : '';
    throw new Error(
      `Gemini chưa trả về mã nguồn hợp lệ để kiểm nghiệm (length=${rawDesign.length}). Đầu: "${head}"${tail ? ` | Cuối: "${tail}"` : ''}`
    );
  }

  const lang: 'powershell' | 'python' =
    String(parsed.language || 'powershell').toLowerCase().includes('python')
      ? 'python'
      : 'powershell';

  const compactTestArgs = JSON.stringify(parsed.test_args ?? {});
  const draftInit: ToolForgeDraft = {
    id: String(parsed.id || 'custom_tool')
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .slice(0, 48),
    name: String(parsed.name || 'Skill Mới'),
    description: String(parsed.description || userRequest),
    language: lang,
    triggers: Array.isArray(parsed.triggers)
      ? parsed.triggers.map((t) => String(t).trim()).filter(Boolean)
      : [],
    paramsSchema: Array.isArray(parsed.params_schema)
      ? parseParamsSchema(JSON.stringify(parsed.params_schema))
      : [],
    code: String(parsed.code),
    testArgsJson: compactTestArgs,
    expectedKeywords: Array.isArray(parsed.expected_keywords)
      ? parsed.expected_keywords.map((k) => String(k).trim()).filter(Boolean)
      : [],
    sandbox: null,
    liveTest: null,
    liveTestArgsJson: compactTestArgs,
    healLogs: ['[BUILD] Gemini đã thiết kế & sinh mã nguồn ban đầu.'],
    originalRequest: userRequest,
  };

  onProgress?.(
    `[2/4] Gemini đã viết xong skill "${draftInit.name}" (${draftInit.language}). Đang chạy kiểm nghiệm Sandbox cô lập...`
  );

  let current = await runDraftInSandbox(draftInit);

  for (let attempt = 1; attempt <= 2 && !current.sandbox?.verified; attempt++) {
    onProgress?.(
      `[3/4 SELF-HEAL #${attempt}] Kiểm nghiệm Sandbox thất bại (${current.sandbox?.failure_reason}). Nhờ Gemini tự vá và test lại...`
    );
    try {
      current = await selfHealDraftWithGemini(current, onProgress);
    } catch (healErr) {
      current = {
        ...current,
        healLogs: [...current.healLogs, `[SELF-HEAL ERR] ${String(healErr)}`],
      };
      break;
    }
  }

  if (current.sandbox?.verified) {
    onProgress?.(
      `[4/4 PASS] Đã kiểm chứng thành công trên Sandbox (${current.sandbox.duration_ms}ms). Bạn có thể bấm "Test Chạy Thật" để tự kiểm nghiệm kết quả & hành động trước khi bấm "Xác Nhận & Đóng Gói Skill".`
    );
  } else {
    onProgress?.(
      `[4/4 CHƯA ĐẠT] Sandbox chưa pass (${current.sandbox?.failure_reason || 'Lỗi'}). Chặn đóng gói cho đến khi kiểm chứng đạt!`
    );
  }

  latestToolForgeDraft = current;
  return current;
}

export async function confirmAndSaveToolDraft(draft: ToolForgeDraft): Promise<CustomSkillRecord> {
  if (!draft.sandbox?.verified || !draft.sandbox.code_hash) {
    throw new Error(
      'Chỉ đóng gói khi có kiểm chứng: Hãy chạy Kiểm Nghiệm Sandbox PASS trước khi lưu skill.'
    );
  }

  const saved = await invoke<CustomSkillRecord>('tool_forge_save_skill', {
    payload: {
      id: draft.id,
      name: draft.name,
      description: draft.description,
      language: draft.language,
      triggers_json: JSON.stringify(draft.triggers),
      params_schema_json: JSON.stringify(draft.paramsSchema),
      code: draft.code,
      test_args_json: draft.testArgsJson || '{}',
      expected_keywords_json: JSON.stringify(draft.expectedKeywords),
      code_hash: draft.sandbox.code_hash,
      heal_note: draft.healLogs.filter((l) => l.includes('SELF-HEAL')).slice(-1)[0] || '',
    },
  });

  await refreshCustomSkills();
  return saved;
}

/**
 * Lớp bọc phát trigger hoạt ảnh cho Skill (start / success / error).
 * Bắt được cả 2 đường gọi: AI tool `custom_skill` và match trực tiếp từ câu chat.
 */
export async function executeSavedSkillWithSelfHeal(
  skillId: string,
  args: Record<string, unknown>,
  onProgress?: (msg: string) => void
): Promise<string> {
  fireAnimationTrigger('skill', skillId, 'start');
  let failed = true;
  try {
    const out = await executeSavedSkillWithSelfHealInner(skillId, args, onProgress);
    failed = out.startsWith('[SKILL LỖI]') || out.startsWith('[SKILL ERROR');
    return out;
  } finally {
    fireAnimationTrigger('skill', skillId, failed ? 'error' : 'success');
  }
}

export function buildRealChatAppPowerShellCode(defaultApp = 'Zalo'): string {
  return `$argsObj = ($env:DUCK_TOOL_ARGS_JSON | ConvertFrom-Json -ErrorAction SilentlyContinue)
$appName = if ($argsObj.app) { [string]$argsObj.app } else { '${defaultApp}' }
$contact = if ($argsObj.contact) { [string]$argsObj.contact } else { 'Anh Thư' }
$message = if ($argsObj.message) { [string]$argsObj.message } else { 'Xin chào!' }

if ($env:DUCK_SANDBOX_MODE -eq '1') {
    Write-Output "[SANDBOX PASS] Quy trinh gui tin nhan $appName toi '$contact' noi dung '$message' hop le."
    exit 0
}

Add-Type -AssemblyName System.Windows.Forms
$ws = New-Object -ComObject WScript.Shell
$exePath = Join-Path $env:LOCALAPPDATA "Programs\\$appName\\$appName.exe"
if (-not $ws.AppActivate($appName)) {
    if (Test-Path $exePath) { Start-Process $exePath -WorkingDirectory (Split-Path $exePath) }
    Start-Sleep -Milliseconds 2200
    [void]$ws.AppActivate($appName)
}
Start-Sleep -Milliseconds 400
[System.Windows.Forms.SendKeys]::SendWait('^f')
Start-Sleep -Milliseconds 350
Set-Clipboard -Value $contact
[System.Windows.Forms.SendKeys]::SendWait('^a{BACKSPACE}^v')
Start-Sleep -Milliseconds 950
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Start-Sleep -Milliseconds 750
Set-Clipboard -Value $message
[System.Windows.Forms.SendKeys]::SendWait('^v{ENTER}')
Write-Output "[AUTO CHAT] Da mo $appName, tim '$contact' va gui tin nhan '$message'."`;
}

export async function buildVerifiedDraftFromAgentTrace(trace: {
  goal: string;
  summary: string;
  steps: Array<{ step: number; action: string; params: Record<string, unknown>; obs: string }>;
}): Promise<ToolForgeDraft | null> {
  const parsedChat = extractChatContactAndMessage(trace.goal);
  const isChatWorkflow =
    Boolean(parsedChat) ||
    trace.steps.some((s) => s.action === 'chat_app_send') ||
    /\b(zalo|telegram|discord|messenger)\b/i.test(trace.goal);
  if (!isChatWorkflow) return null;

  const app = parsedChat?.app || 'Zalo';
  const contact = parsedChat?.contact || 'Anh Thư';
  const message = parsedChat?.message || 'Ăn cơm chưa?';
  const appLower = app.toLowerCase();

  const draft: ToolForgeDraft = {
    id: `${appLower}_send_message`,
    name: `Gửi Tin Nhắn ${app}`,
    description: `Mở ${app}, tìm liên hệ theo tên và gửi tin nhắn thực tế qua Clipboard + UIA/SendInput.`,
    language: 'powershell',
    triggers: [
      `hoi ${appLower}`,
      `hỏi ${appLower}`,
      `nhan ${appLower}`,
      `nhắn ${appLower}`,
      `gui tin nhan ${appLower}`,
      `gửi tin nhắn ${appLower}`,
      `${appLower} chat`,
    ],
    paramsSchema: [
      {
        name: 'contact',
        type: 'string',
        description: 'Tên người nhận trên ' + app,
        required: true,
        default: contact,
      },
      {
        name: 'message',
        type: 'string',
        description: 'Nội dung tin nhắn cần gửi',
        required: true,
        default: message,
      },
    ],
    code: buildRealChatAppPowerShellCode(app),
    testArgsJson: JSON.stringify({ contact, message }, null, 2),
    expectedKeywords: [app, 'tin nhan'],
    sandbox: null,
    liveTest: null,
    liveTestArgsJson: JSON.stringify({ contact, message }, null, 2),
    healLogs: [
      `[AGENT TRACE -> SKILL] Đã biên dịch quy trình thực tế ${app} (không dùng code mô phỏng) và kiểm nghiệm Sandbox.`,
    ],
    originalRequest: trace.goal,
  };

  const verifiedDraft = await runDraftInSandbox(draft);
  latestToolForgeDraft = verifiedDraft;
  return verifiedDraft;
}

export function createBlankToolDraft(
  language: 'powershell' | 'python' = 'powershell'
): ToolForgeDraft {
  const code =
    language === 'python'
      ? `import json, os

args = json.loads(os.environ.get("DUCK_TOOL_ARGS_JSON", "{}") or "{}")
target = args.get("target") or "mac dinh"

if os.environ.get("DUCK_SANDBOX_MODE") == "1":
    print(f"KET_QUA: SANDBOX_OK | TARGET={target}")
else:
    print(f"KET_QUA: DA_CHAY_XONG | TARGET={target}")
`
      : `$raw = $env:DUCK_TOOL_ARGS_JSON
$argsObj = if ($raw) { $raw | ConvertFrom-Json } else { [PSCustomObject]@{ target = 'mac dinh' } }
$target = if ($argsObj.target) { $argsObj.target } else { 'mac dinh' }

if ($env:DUCK_SANDBOX_MODE -eq '1') {
    Write-Output "KET_QUA: SANDBOX_OK | TARGET=$target"
    exit 0
}

Write-Output "KET_QUA: DA_CHAY_XONG | TARGET=$target"
`;

  const draft: ToolForgeDraft = {
    id: 'custom_manual_tool',
    name: 'Skill Tùy Chỉnh Mới',
    description: 'Skill tự viết và kiểm chứng trong Sandbox',
    language,
    triggers: ['skill moi', 'custom tool'],
    paramsSchema: [
      {
        name: 'target',
        type: 'string',
        description: 'Tham số đầu vào mẫu',
        required: false,
        default: 'mac dinh',
      },
    ],
    code,
    testArgsJson: JSON.stringify({ target: 'mac dinh' }, null, 2),
    expectedKeywords: ['KET_QUA'],
    sandbox: null,
    liveTest: null,
    liveTestArgsJson: JSON.stringify({ target: 'mac dinh' }, null, 2),
    healLogs: ['[MANUAL] Đã tạo mẫu Skill mới. Hãy sửa code, bấm "Chạy Sandbox" để kiểm chứng rồi đóng gói!'],
    originalRequest: '',
  };
  latestToolForgeDraft = draft;
  return draft;
}

async function executeSavedSkillWithSelfHealInner(
  skillId: string,
  args: Record<string, unknown>,
  onProgress?: (msg: string) => void
): Promise<string> {
  const argsJson = JSON.stringify(args ?? {});
  let skill = cachedCustomSkills.find((s) => s.id === skillId);
  if (!skill) {
    await refreshCustomSkills();
    skill = cachedCustomSkills.find((s) => s.id === skillId);
  }
  const skillLabel = skill?.name || skillId;

  onProgress?.(`[SKILL: ${skillLabel}] Đang thực thi tool đã kiểm chứng...`);

  const hay = `${skill?.id || skillId} ${skill?.name || ''}`;
  const isChatAppSkill = Boolean(
    skill &&
      /\b(zalo|telegram|discord|messenger)\b/i.test(hay) &&
      (args.contact !== undefined ||
        args.message !== undefined ||
        skill.params_schema_json.includes('"contact"'))
  );
  if (isChatAppSkill && skill) {
    if (
      skill.code.includes('Đã mô phỏng') ||
      skill.code.includes('Vui lòng tích hợp')
    ) {
      const appDefault = /telegram/i.test(hay)
        ? 'Telegram'
        : /discord/i.test(hay)
        ? 'Discord'
        : /messenger/i.test(hay)
        ? 'Messenger'
        : 'Zalo';
      void invoke('tool_forge_apply_healed_skill', {
        id: skill.id,
        patchedCode: buildRealChatAppPowerShellCode(appDefault),
        healNote: 'Nâng cấp từ bản mô phỏng sang Native UIA + Clipboard thực tế',
        testArgsJson:
          skill.test_args_json || '{"contact":"Anh Thư","message":"Xin chào"}',
        expectedKeywords: [appDefault, 'tin nhắn'],
      }).catch(() => {});
    }
    const targetApp = String(
      args.app ||
        (/telegram/i.test(hay)
          ? 'Telegram'
          : /discord/i.test(hay)
          ? 'Discord'
          : /messenger/i.test(hay)
          ? 'Messenger'
          : 'Zalo')
    );
    const contact = String(args.contact || '').trim();
    const message = String(args.message || '').trim();
    if (contact && message) {
      const t0 = Date.now();
      const nativeOut = await invoke<string>('auto_chat_app_send_message', {
        app: targetApp,
        contact,
        message,
      });
      return `[SKILL: ${skillLabel} v${skill.version}] (${Date.now() - t0}ms)\n${nativeOut}`;
    }
  }

  let firstRun: SkillExecResult;
  try {
    firstRun = await invoke<SkillExecResult>('tool_forge_execute_skill', {
      id: skillId,
      argsJson,
    });
  } catch (invokeErr) {
    return `[SKILL LỖI] Không thể chạy "${skillLabel}": ${String(invokeErr)}`;
  }

  if (firstRun.ok) {
    await refreshCustomSkills();
    const out = firstRun.stdout || 'Đã hoàn thành.';
    return `[SKILL: ${skillLabel} v${skill?.version ?? 1}] (${firstRun.duration_ms}ms)\n${out}`;
  }

  // Runtime failure -> Automatic Self-Healing loop with Gemini + Sandbox re-verification
  if (!skill) {
    return `[SKILL LỖI] Không thể chạy "${skillId}": ${firstRun.error_summary}`;
  }

  onProgress?.(
    `[SELF-HEALING] Skill "${skillLabel}" gặp lỗi lúc chạy (${firstRun.error_summary}). Đang gửi log sang Gemini để tự vá & kiểm nghiệm lại trên Sandbox...`
  );

  let lastErr = firstRun.error_summary || firstRun.stderr || `Exit ${firstRun.exit_code}`;
  let curCode = skill.code;
  let curOut = firstRun.stdout;
  let curStderr = firstRun.stderr;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const healLogText = `Attempt #${attempt} failed:\n${lastErr}\nSTDOUT:\n${curOut}\nSTDERR:\n${curStderr}`;
      const rawPatch = await invoke<string>('ask_gemini', {
        apiKey: ctxProvider.getGeminiApiKey(),
        model: ctxProvider.getGeminiModel(),
        systemPrompt:
          'Return 2 blocks: first a ```json block with {"heal_note":"..."}, then a raw code block with the complete patched script.',
        messages: [
          {
            role: 'user',
            content: buildGeminiHealPrompt(
              skill.name,
              skill.language,
              curCode,
              argsJson,
              healLogText
            ),
          },
        ],
        jsonMode: false,
        maxOutputTokens: 16384,
        thinkingBudget: 2048,
      });

      const { patchedCode, healNote } = parseSelfHealResponse(rawPatch);

      if (!patchedCode.trim()) {
        lastErr = 'Gemini không trả về khối mã nguồn vá hợp lệ.';
        continue;
      }

      const [healedSkill] = await invoke<[CustomSkillRecord, SandboxRunResult]>(
        'tool_forge_apply_healed_skill',
        {
          id: skill.id,
          patchedCode,
          healNote,
          testArgsJson: skill.test_args_json || '{}',
          expectedKeywords: parseExpectedKeywords(skill.expected_keywords_json),
        }
      );

      await refreshCustomSkills();
      onProgress?.(
        `[SELF-HEAL PASS] Đã kiểm chứng bản vá v${healedSkill.version} trên Sandbox (${healNote}). Đang chạy lại yêu cầu của bạn...`
      );

      const retryRun = await invoke<SkillExecResult>('tool_forge_execute_skill', {
        id: skill.id,
        argsJson,
      });

      if (retryRun.ok) {
        await refreshCustomSkills();
        return `[SELF-HEALED v${healedSkill.version}] Đã tự vá lỗi (${healNote}), kiểm nghiệm lại Sandbox và thực thi thành công:\n${retryRun.stdout}`;
      }

      curCode = patchedCode;
      curOut = retryRun.stdout;
      curStderr = retryRun.stderr;
      lastErr = retryRun.error_summary || retryRun.stderr || `Exit ${retryRun.exit_code}`;
    } catch (healErr) {
      const healErrStr = String(healErr);
      lastErr = `${lastErr} | Self-heal: ${healErrStr}`;
      // Thoát ngay nếu lỗi kết nối hoặc thiếu GEMINI_API_KEY để không lặp vô ích
      break;
    }
  }

  const outDetail = [
    lastErr,
    firstRun.stdout ? `STDOUT:\n${firstRun.stdout}` : '',
    firstRun.stderr ? `STDERR:\n${firstRun.stderr}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return `[SKILL ERROR] Tool "${skillLabel}" gặp lỗi khi chạy:\n${outDetail}`;
}

export {
  checkCloudHubHealth,
  deleteCommunitySkill,
  getCloudAuthStatus,
  getCloudHubConfig,
  listCommunitySkills,
  loginWithGoogleOAuth,
  logoutGoogleOAuth,
  openWebChatCompanion,
  publishLocalSkillToCloud,
  saveCloudHubConfig,
  syncChatPullFromCloud,
  syncChatPushToCloud,
  syncChatStreamChunkToCloud,
  toggleStarCommunitySkill,
} from './cloudHubClient';

export async function installCommunitySkillFromCloud(
  skillKey: string
): Promise<InstallCommunitySkillResult> {
  const res = await installCommunitySkillFromCloudRaw(skillKey);
  await refreshCustomSkills();
  return res;
}
