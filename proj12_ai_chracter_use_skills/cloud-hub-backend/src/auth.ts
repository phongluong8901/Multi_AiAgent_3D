export interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

export interface CleanSkillInput {
  id: string;
  name: string;
  description: string;
  language: 'powershell' | 'python';
  triggers_json: string;
  params_schema_json: string;
  code: string;
  test_args_json: string;
  expected_keywords_json: string;
  version: number;
  code_hash: string;
  skill_kind?: 'sandbox_script' | 'python_pack_skill';
  pack_name?: string;
  module_name?: string;
  test_code?: string;
  tool_schema_json?: string;
}

export interface CleanCognitiveFact {
  key: string;
  value: string;
  category: string;
  importance: number;
  access_count: number;
  effective_score: number;
  last_accessed_at: number;
  updated_at: number;
}

export interface CleanCognitiveRule {
  id: number;
  rule_key: string;
  rule_text: string;
  source: string;
  active: boolean;
  hit_count: number;
  updated_at: number;
}

export interface CleanToolPlaybook {
  playbook_id: string;
  trigger_keywords: string;
  tools_csv: string;
  strategy_hint: string;
  success_count: number;
  updated_at: number;
}

export interface CleanCognitiveMemoryInput {
  facts: CleanCognitiveFact[];
  rules: CleanCognitiveRule[];
  playbooks: CleanToolPlaybook[];
}

export type CognitiveMemoryValidationResult =
  | { ok: true; clean: CleanCognitiveMemoryInput }
  | { ok: false; error: string };

export type SkillValidationResult =
  | { ok: true; clean: CleanSkillInput }
  | { ok: false; error: string };

export interface CleanChatInput {
  msg_id: string;
  role: 'user' | 'assistant';
  content: string;
  source: 'desktop' | 'web';
  created_at_ms: number;
}

export type ChatValidationResult =
  | { ok: true; clean: CleanChatInput }
  | { ok: false; error: string };

export function isSkillOwner(
  doc: { author_sub?: string; author_email?: string },
  user: { sub?: string; email?: string }
): boolean {
  if (doc.author_sub && user.sub && doc.author_sub === user.sub) return true;
  if (
    doc.author_email &&
    user.email &&
    doc.author_email.toLowerCase() === user.email.toLowerCase()
  ) {
    return true;
  }
  return false;
}

export function validateChatPayload(body: unknown): ChatValidationResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Payload chat không hợp lệ.' };
  }
  const obj = body as Record<string, unknown>;
  const role = obj.role === 'assistant' ? 'assistant' : 'user';
  const source = obj.source === 'web' ? 'web' : 'desktop';
  const content = String(obj.content ?? '').trim();
  if (!content) {
    return { ok: false, error: 'Nội dung tin nhắn đang trống.' };
  }
  const msgId =
    String(obj.msg_id ?? '').trim().slice(0, 80) ||
    `${source}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = Number(obj.created_at_ms || Date.now()) || Date.now();
  return {
    ok: true,
    clean: {
      msg_id: msgId,
      role,
      content: content.slice(0, 8000),
      source,
      created_at_ms: createdAt,
    },
  };
}

export function extractBearerToken(authHeader: string | undefined): string {
  if (typeof authHeader !== 'string') return '';
  const trimmed = authHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return '';
  return trimmed.slice(7).trim();
}

export function sanitizeSkillId(raw: unknown): string {
  const cleaned = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return cleaned || 'custom_skill';
}

export function validateSkillPayload(body: unknown): SkillValidationResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Payload JSON không hợp lệ.' };
  }
  const obj = body as Record<string, unknown>;
  const id = sanitizeSkillId(obj.id);
  const name = String(obj.name ?? '').trim();
  const languageRaw = String(obj.language ?? '').trim().toLowerCase();
  const code = String(obj.code ?? '');

  if (!name) {
    return { ok: false, error: 'Thiếu tên Skill (name).' };
  }
  if (languageRaw !== 'powershell' && languageRaw !== 'python') {
    return { ok: false, error: 'Ngôn ngữ chỉ hỗ trợ powershell hoặc python.' };
  }
  if (!code.trim()) {
    return { ok: false, error: 'Mã nguồn Skill (code) đang trống.' };
  }
  if (Buffer.byteLength(code, 'utf8') > 262144) {
    return { ok: false, error: 'Mã nguồn Skill vượt quá giới hạn 256 KB.' };
  }

  const rawKind = String(obj.skill_kind ?? '').trim().toLowerCase();
  const hasPackName = typeof obj.pack_name === 'string' && obj.pack_name.trim().length > 0;
  const skillKind: 'sandbox_script' | 'python_pack_skill' =
    rawKind === 'python_pack_skill' || (languageRaw === 'python' && hasPackName)
      ? 'python_pack_skill'
      : 'sandbox_script';

  const clean: CleanSkillInput = {
    id,
    name: name.slice(0, 120),
    description: String(obj.description ?? '').trim().slice(0, 600),
    language: languageRaw,
    triggers_json: String(obj.triggers_json ?? '[]'),
    params_schema_json: String(obj.params_schema_json ?? '[]'),
    code,
    test_args_json: String(obj.test_args_json ?? '{}'),
    expected_keywords_json: String(obj.expected_keywords_json ?? '[]'),
    version: Math.max(1, Number(obj.version ?? 1) || 1),
    code_hash: String(obj.code_hash ?? '').trim().slice(0, 128),
    skill_kind: skillKind,
  };
  if (hasPackName) {
    clean.pack_name = String(obj.pack_name).trim().slice(0, 64);
  }
  if (typeof obj.module_name === 'string' && obj.module_name.trim()) {
    clean.module_name = sanitizeSkillId(obj.module_name).slice(0, 80);
  }
  if (typeof obj.test_code === 'string' && obj.test_code.trim()) {
    clean.test_code = obj.test_code.slice(0, 131072);
  }
  if (typeof obj.tool_schema_json === 'string' && obj.tool_schema_json.trim()) {
    clean.tool_schema_json = obj.tool_schema_json.trim().slice(0, 16384);
  }

  return { ok: true, clean };
}

function isSensitiveSecretKeyOrValue(k: string, v: string): boolean {
  const kl = k.toLowerCase();
  const vl = v.toLowerCase();
  if (
    kl.includes('api_key') ||
    kl.includes('apikey') ||
    kl.includes('password') ||
    kl.includes('secret') ||
    kl.includes('access_token') ||
    kl.includes('refresh_token')
  ) {
    return true;
  }
  if (vl.startsWith('dpapi:') || vl.startsWith('aizasy') || vl.startsWith('gsk_')) {
    return true;
  }
  return false;
}

export function validateCognitiveMemoryPayload(body: unknown): CognitiveMemoryValidationResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Payload Cognitive Memory không hợp lệ.' };
  }
  const obj = body as Record<string, unknown>;
  const rawFacts = Array.isArray(obj.facts) ? obj.facts : [];
  const rawRules = Array.isArray(obj.rules) ? obj.rules : [];
  const rawPlaybooks = Array.isArray(obj.playbooks) ? obj.playbooks : [];

  const nowSec = Math.floor(Date.now() / 1000);
  const facts: CleanCognitiveFact[] = [];
  for (const item of rawFacts.slice(0, 150)) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const key = String(r.key ?? '').trim().slice(0, 80);
    const value = String(r.value ?? '').trim().slice(0, 600);
    if (!key || !value || isSensitiveSecretKeyOrValue(key, value)) continue;
    facts.push({
      key,
      value,
      category: String(r.category ?? 'general').trim().slice(0, 40) || 'general',
      importance: Math.max(10, Math.min(300, Number(r.importance ?? 100) || 100)),
      access_count: Math.max(1, Number(r.access_count ?? 1) || 1),
      effective_score: Number(r.effective_score ?? 1) || 1,
      last_accessed_at: Number(r.last_accessed_at ?? nowSec) || nowSec,
      updated_at: Number(r.updated_at ?? nowSec) || nowSec,
    });
  }

  const rules: CleanCognitiveRule[] = [];
  for (const item of rawRules.slice(0, 80)) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const rule_key = String(r.rule_key ?? '').trim().slice(0, 80);
    const rule_text = String(r.rule_text ?? '').trim().slice(0, 400);
    if (!rule_key || !rule_text || isSensitiveSecretKeyOrValue(rule_key, rule_text)) continue;
    rules.push({
      id: Number(r.id ?? 0) || 0,
      rule_key,
      rule_text,
      source: String(r.source ?? 'manual').trim().slice(0, 32) || 'manual',
      active: r.active !== false,
      hit_count: Math.max(1, Number(r.hit_count ?? 1) || 1),
      updated_at: Number(r.updated_at ?? nowSec) || nowSec,
    });
  }

  const playbooks: CleanToolPlaybook[] = [];
  for (const item of rawPlaybooks.slice(0, 80)) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const playbook_id = String(r.playbook_id ?? '').trim().slice(0, 80);
    const tools_csv = String(r.tools_csv ?? '').trim().slice(0, 240);
    if (!playbook_id || !tools_csv) continue;
    playbooks.push({
      playbook_id,
      trigger_keywords: String(r.trigger_keywords ?? '').trim().slice(0, 200),
      tools_csv,
      strategy_hint: String(r.strategy_hint ?? '').trim().slice(0, 300),
      success_count: Math.max(1, Number(r.success_count ?? 1) || 1),
      updated_at: Number(r.updated_at ?? nowSec) || nowSec,
    });
  }

  return { ok: true, clean: { facts, rules, playbooks } };
}

export async function verifyGoogleBearerToken(
  authHeader: string | undefined,
  expectedClientId = ''
): Promise<GoogleUserInfo> {
  const token = extractBearerToken(authHeader);
  if (!token) {
    throw new Error('AUTH_REQUIRED: Thiếu Google Bearer token.');
  }

  if (token.split('.').length === 3) {
    const resp = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`
    );
    if (!resp.ok) {
      let detail = '';
      try {
        const errObj = (await resp.json()) as Record<string, unknown>;
        detail = String(errObj.error_description || errObj.error || '');
      } catch {
        detail = '';
      }
      throw new Error(
        `Phiên Google id_token không hợp lệ hoặc đã hết hạn (HTTP ${resp.status}${detail ? `: ${detail}` : ''}). Hãy bấm "Mở Web Chat" lại từ Desktop hoặc đăng nhập lại.`
      );
    }
    const info = (await resp.json()) as Record<string, unknown>;
    if (expectedClientId && info.aud && String(info.aud) !== expectedClientId) {
      throw new Error('Google id_token không khớp GOOGLE_CLIENT_ID của hệ thống.');
    }
    if (!info.email || info.email_verified === 'false') {
      throw new Error('Tài khoản Google chưa xác minh email.');
    }
    return {
      sub: String(info.sub ?? ''),
      email: String(info.email ?? ''),
      name: String(info.name ?? info.email ?? 'Google User'),
      picture: String(info.picture ?? ''),
    };
  }

  const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new Error(`Google từ chối access_token (HTTP ${resp.status}).`);
  }
  const prof = (await resp.json()) as Record<string, unknown>;
  if (!prof.email) {
    throw new Error('Không lấy được email từ Google UserInfo.');
  }
  return {
    sub: String(prof.sub ?? ''),
    email: String(prof.email ?? ''),
    name: String(prof.name ?? prof.email ?? 'Google User'),
    picture: String(prof.picture ?? ''),
  };
}
