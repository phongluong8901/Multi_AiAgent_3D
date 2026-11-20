import { invoke } from '@tauri-apps/api/core';
import {
  CustomSkillRecord,
  SandboxRunResult,
  SkillExecResult,
  SkillParamDef,
  ToolForgeDraft,
} from '../core/types';

export interface ToolForgeRuntimeCtx {
  getGeminiModel: () => string;
  getOllamaModel: () => string;
  isOllamaOnline: () => boolean;
  hasGeminiKey: () => boolean;
}

let ctxProvider: ToolForgeRuntimeCtx = {
  getGeminiModel: () => localStorage.getItem('mate_gemini_model') || 'gemini-3.5-flash',
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
        .map((x) => ({
          name: String(x.name).trim(),
          type:
            x.type === 'number' || x.type === 'boolean' ? x.type : ('string' as const),
          description: String(x.description || ''),
          required: Boolean(x.required),
          default: x.default,
        }));
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

export function extractArgsHeuristically(
  skill: CustomSkillRecord,
  userText: string
): Record<string, unknown> {
  const params = parseParamsSchema(skill.params_schema_json);
  const args: Record<string, unknown> = {};
  const norm = stripDiacritics(userText);

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
    } else {
      if (keyNorm === 'action' || keyNorm === 'mode') {
        if (/(?:dong|don|tat|kill|giet|ket|giai phong|clear|close|xoa|terminate)/.test(norm)) {
          args[p.name] = 'kill';
        } else if (/(?:kiem tra|check|xem|list|scan|quet)/.test(norm)) {
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
        keyNorm.includes('target') ||
        keyNorm.includes('file') ||
        keyNorm.includes('location')
      ) {
        const pathMatch = userText.match(/([a-zA-Z]:[\\/][^\s"']+)|"([^"]+)"/);
        const extractedPath = (pathMatch?.[1] || pathMatch?.[2] || '').trim();
        args[p.name] =
          extractedPath || p.default || fallbackTestArgs[p.name] || '.';
      } else if (p.default !== undefined) {
        args[p.name] = p.default;
      } else if (fallbackTestArgs[p.name] !== undefined) {
        args[p.name] = fallbackTestArgs[p.name];
      } else {
        args[p.name] = userText;
      }
    }
  }
  return args;
}

export function matchSavedSkillForUserText(
  userText: string
): { skill: CustomSkillRecord; args: Record<string, unknown> } | null {
  const active = cachedCustomSkills.filter((s) => s.enabled && s.verified);
  if (active.length === 0) return null;

  const normText = stripDiacritics(userText);
  let bestSkill: CustomSkillRecord | null = null;
  let bestScore = 0;

  for (const sk of active) {
    let score = 0;
    const triggers = parseTriggers(sk.triggers_json);
    for (const trig of triggers) {
      const nt = stripDiacritics(trig);
      if (nt.length >= 2 && normText.includes(nt)) {
        score += 4 + Math.min(4, Math.floor(nt.length / 4));
      }
    }
    const idNorm = stripDiacritics(sk.id).replace(/_/g, ' ');
    if (normText.includes(idNorm)) score += 6;
    const nameTokens = stripDiacritics(sk.name)
      .split(/\s+/)
      .filter((t) => t.length >= 3);
    let tokenHits = 0;
    for (const tok of nameTokens) {
      if (normText.includes(tok)) tokenHits++;
    }
    score += tokenHits * 2;

    if (score >= 4 && score > bestScore) {
      bestScore = score;
      bestSkill = sk;
    }
  }

  if (!bestSkill) return null;
  return {
    skill: bestSkill,
    args: extractArgsHeuristically(bestSkill, userText),
  };
}

export async function extractArgsWithLocalLlmIfAvailable(
  skill: CustomSkillRecord,
  userText: string,
  heuristicArgs: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!ctxProvider.isOllamaOnline()) {
    return heuristicArgs;
  }
  const params = parseParamsSchema(skill.params_schema_json);
  if (params.length === 0) return heuristicArgs;

  const prompt = `Trích xuất JSON tham số cho skill "${skill.id}" (${skill.description}) từ câu người dùng.
Schema tham số: ${JSON.stringify(params)}
Câu người dùng: "${userText}"
Chỉ trả về DUY NHẤT 1 JSON object hợp lệ (không giải thích, không markdown). Gợi ý mặc định: ${JSON.stringify(heuristicArgs)}`;

  try {
    const task = invoke<string>('ask_ollama', {
      model: ctxProvider.getOllamaModel(),
      messages: [
        { role: 'system', content: 'Return strictly one valid JSON object only.' },
        { role: 'user', content: prompt },
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
  return heuristicArgs;
}

function escapeControlCharsInJsonStrings(input: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (!inString) {
      out += ch;
      if (ch === '"') inString = true;
      continue;
    }
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      out += ch;
      inString = false;
      continue;
    }
    if (ch === '\n') {
      out += '\\n';
    } else if (ch === '\r') {
      out += '\\r';
    } else if (ch === '\t') {
      out += '\\t';
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
    (o) => typeof o.code === 'string' || typeof o.patched_code === 'string'
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
  return best;
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
    /\bimport\s+(?:os|sys|json|pathlib)\b/.test(fenced.code);
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
  if (/(?:file|folder|thu muc|dung luong|size|o dia|dir)/.test(normReq)) {
    paramsSchema = [
      {
        name: 'path',
        type: 'string',
        description: 'Đường dẫn file hoặc thư mục cần thống kê',
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

function salvagePatchedCodeFromRawText(raw: string): string {
  const fenced = extractLargestCodeFence(raw);
  return fenced?.code || '';
}

function buildGeminiArchitectPrompt(userRequest: string, preferredLang: string): string {
  const langRule =
    preferredLang === 'powershell'
      ? 'BẮT BUỘC viết bằng Windows PowerShell 5.1 ("language": "powershell").'
      : preferredLang === 'python'
      ? 'BẮT BUỘC viết bằng Python 3 ("language": "python").'
      : 'Ưu tiên Windows PowerShell 5.1 ("powershell") cho tác vụ Windows (port, tiến trình, mạng, file), hoặc "python" nếu xử lý dữ liệu.';

  return `Bạn là Kỹ sư Công cụ Hệ thống Windows (Tool Forge Architect).
Local LLM không tự viết được script nên đã chuyển yêu cầu này sang bạn:
"${userRequest}"

HÃY THIẾT KẾ 1 SKILL TÁI SỬ DỤNG ĐƯỢC VÀ KIỂM NGHIỆM AN TOÀN TRÊN SANDBOX WINDOWS:
${langRule}
QUY TẮC BẮT BUỘC CHO CODE:
1. Script nhận tham số qua biến môi trường \`DUCK_TOOL_ARGS_JSON\` (chuỗi JSON, ví dụ \`$argsObj = ($env:DUCK_TOOL_ARGS_JSON | ConvertFrom-Json)\` trong PowerShell hoặc \`json.loads(os.environ.get('DUCK_TOOL_ARGS_JSON', '{}'))\` trong Python). Luôn dùng giá trị mặc định an toàn nếu thiếu trường. Trong PowerShell KHÔNG dùng khối \`param(...)\` ở đầu file. Luôn thêm \`-ErrorAction SilentlyContinue\` cho \`Get-ChildItem\`, \`Get-Process\`, \`Get-NetTCPConnection\`.
2. Giữ script gọn nhẹ (< 65 dòng) và chạy nhanh (< 5 giây trong Sandbox). Khi biến môi trường \`DUCK_SANDBOX_MODE\` bằng \`"1"\`, script CHỈ chạy kiểm tra an toàn (tuyệt đối KHÔNG quét đệ quy toàn bộ \`C:\\\` hay \`C:\\Users\` gây timeout; với tool file/folder hãy tạo 1-2 file mẫu nhỏ trong thư mục hiện tại \`$PWD\` rồi thống kê chúng hoặc kiểm tra đường dẫn thử nghiệm nhỏ; với tool port hãy dùng port thử nghiệm \`59999\` hoặc mô phỏng an toàn không làm sập \`Duck ai Manager\`) và PHẢI in kết quả tiếng Việt không emoji ra stdout.
3. Tuyệt đối KHÔNG nhắc tới chuỗi \`mate_memory.db\`, \`GEMINI_API_KEY\` hay file env ẩn ngay cả trong comment (bộ kiểm tra an toàn tĩnh sẽ chặn), không dùng \`Invoke-Expression\` / \`iex\`, không dùng lệnh phá hoại ổ đĩa.
4. \`test_args\` phải là JSON object an toàn để chạy Sandbox ngay (ví dụ \`{ "path": "." }\` hoặc \`{ "port": 59999, "action": "check" }\`), và \`expected_keywords\` là 1-2 chuỗi ngắn chắc chắn xuất hiện trong stdout khi chạy thành công.
5. \`triggers\` gồm 4-8 cụm từ khóa tiếng Việt không dấu và có dấu để Local LLM lần sau tự nhận ra skill này.
6. TRẢ VỀ DUY NHẤT 1 JSON OBJECT hợp lệ (không kèm markdown thừa) đúng schema sau:
{
  "id": "disk_usage_stats",
  "name": "Thống Kê Dung Lượng File & Thư Mục",
  "description": "Thống kê tổng dung lượng, số lượng file/folder và top mục lớn nhất theo tham số path.",
  "language": "powershell",
  "triggers": ["dung luong", "dung lượng", "thong ke dung luong", "kich thuoc thu muc", "file folder"],
  "params_schema": [
    { "name": "path", "type": "string", "description": "Đường dẫn file hoặc thư mục cần thống kê", "required": false, "default": "." }
  ],
  "test_args": { "path": "." },
  "expected_keywords": ["TONG", "MB"],
  "code": "...mã nguồn đã escape \\n đúng chuẩn JSON..."
}`;
}

function buildGeminiHealPrompt(
  name: string,
  language: string,
  brokenCode: string,
  argsJson: string,
  sandboxOrExecLog: string
): string {
  return `Bạn đang thực hiện SELF-HEALING (tự vá lỗi) cho skill "${name}" (${language}).
Mã nguồn bị lỗi hoặc chưa vượt qua bài test:
\`\`\`${language}
${brokenCode}
\`\`\`

Tham số đầu vào lúc chạy: ${argsJson}
Thông báo lỗi / stdout / stderr thu được:
${sandboxOrExecLog.slice(0, 1800)}

YÊU CẦU:
- Sửa triệt để lỗi cú pháp, xử lý trường hợp null/trống trong PowerShell/Python, bảo đảm khi \`$env:DUCK_SANDBOX_MODE -eq '1'\` chạy pass an toàn (< 5 giây) và luôn in kết quả tiếng Việt không emoji ra stdout.
- Trả về DUY NHẤT 1 JSON object hợp lệ:
{
  "heal_note": "Mô tả ngắn đã sửa lỗi gì",
  "patched_code": "...toàn bộ mã nguồn hoàn chỉnh đã sửa..."
}`;
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

export async function selfHealDraftWithGemini(
  draft: ToolForgeDraft,
  onProgress?: (line: string) => void
): Promise<ToolForgeDraft> {
  const errSummary = draft.sandbox
    ? `verified=${draft.sandbox.verified}, exit=${draft.sandbox.exit_code}, reason=${draft.sandbox.failure_reason}\nSTDOUT:\n${draft.sandbox.stdout}\nSTDERR:\n${draft.sandbox.stderr}`
    : 'Chưa chạy Sandbox';

  onProgress?.('[SELF-HEAL] Đang gửi mã nguồn + log lỗi sang Gemini để phân tích và vá lỗi...');
  const rawHeal = await invoke<string>('ask_gemini', {
    apiKey: '',
    model: ctxProvider.getGeminiModel(),
    systemPrompt: 'Return strictly one valid JSON object containing heal_note and patched_code.',
    messages: [
      {
        role: 'user',
        content: buildGeminiHealPrompt(
          draft.name,
          draft.language,
          draft.code,
          draft.testArgsJson,
          errSummary
        ),
      },
    ],
    jsonMode: true,
  });

  const parsed = parseJsonObjectLoose(rawHeal);
  let patchedCode = typeof parsed?.patched_code === 'string' ? parsed.patched_code : '';
  if (!patchedCode.trim()) {
    patchedCode = salvagePatchedCodeFromRawText(rawHeal);
  }
  const healNote =
    typeof parsed?.heal_note === 'string' && parsed.heal_note.trim()
      ? parsed.heal_note.trim()
      : 'Đã tự động vá mã nguồn theo log lỗi';

  if (!patchedCode.trim()) {
    const failedDraft: ToolForgeDraft = {
      ...draft,
      healLogs: [...draft.healLogs, `[SELF-HEAL FAIL] Gemini không trả về patched_code hợp lệ.`],
    };
    latestToolForgeDraft = failedDraft;
    return failedDraft;
  }

  onProgress?.(`[SELF-HEAL] Đã nhận bản vá (${healNote}). Đang chạy kiểm nghiệm lại trên Sandbox...`);
  const nextDraft = await runDraftInSandbox({
    ...draft,
    code: patchedCode,
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

  const rawDesign = await invoke<string>('ask_gemini', {
    apiKey: '',
    model: ctxProvider.getGeminiModel(),
    systemPrompt:
      'You are an expert Windows automation engineer. Output strictly one valid JSON object.',
    messages: [
      {
        role: 'user',
        content: buildGeminiArchitectPrompt(userRequest, preferredLang),
      },
    ],
    jsonMode: true,
  });

  let parsed = parseJsonObjectLoose(rawDesign);
  if (!parsed || typeof parsed.code !== 'string' || !parsed.code.trim()) {
    parsed = salvageDraftFromRawText(rawDesign, userRequest, preferredLang);
  }
  if (!parsed || typeof parsed.code !== 'string' || !parsed.code.trim()) {
    const preview = rawDesign.replace(/\s+/g, ' ').trim().slice(0, 240);
    throw new Error(
      `Gemini chưa trả về mã nguồn JSON hợp lệ để kiểm nghiệm. Phản hồi thô: "${preview}"`
    );
  }

  const lang: 'powershell' | 'python' =
    String(parsed.language || 'powershell').toLowerCase().includes('python')
      ? 'python'
      : 'powershell';

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
      ? (parsed.params_schema as SkillParamDef[])
      : [],
    code: String(parsed.code),
    testArgsJson: JSON.stringify(parsed.test_args ?? {}, null, 2),
    expectedKeywords: Array.isArray(parsed.expected_keywords)
      ? parsed.expected_keywords.map((k) => String(k).trim()).filter(Boolean)
      : [],
    sandbox: null,
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
      `[4/4 PASS] Đã kiểm chứng thành công trên Sandbox (${current.sandbox.duration_ms}ms). Sẵn sàng chờ bạn Xác Nhận để đóng gói skill!`
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

export async function executeSavedSkillWithSelfHeal(
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
  const firstRun = await invoke<SkillExecResult>('tool_forge_execute_skill', {
    id: skillId,
    argsJson,
  });

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
        apiKey: '',
        model: ctxProvider.getGeminiModel(),
        systemPrompt: 'Return strictly one valid JSON object containing heal_note and patched_code.',
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
        jsonMode: true,
      });

      const parsed = parseJsonObjectLoose(rawPatch);
      let patchedCode = typeof parsed?.patched_code === 'string' ? parsed.patched_code : '';
      if (!patchedCode.trim()) {
        patchedCode = salvagePatchedCodeFromRawText(rawPatch);
      }
      const healNote =
        typeof parsed?.heal_note === 'string' && parsed.heal_note.trim()
          ? parsed.heal_note.trim()
          : `Self-heal #${attempt}`;

      if (!patchedCode.trim()) {
        lastErr = 'Gemini không trả về patched_code hợp lệ.';
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
      lastErr = String(healErr);
    }
  }

  return `[SKILL ERROR - SELF-HEAL CHƯA ĐẠT] Tool "${skillLabel}" vẫn gặp lỗi sau khi tự vá: ${lastErr}`;
}
