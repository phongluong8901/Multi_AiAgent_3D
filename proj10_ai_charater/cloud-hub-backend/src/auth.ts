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
}

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
  if (Buffer.byteLength(code, 'utf8') > 65536) {
    return { ok: false, error: 'Mã nguồn Skill vượt quá giới hạn 64 KB.' };
  }

  return {
    ok: true,
    clean: {
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
    },
  };
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
