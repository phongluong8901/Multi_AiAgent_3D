export interface ColabChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ColabProbeResult {
  online: boolean;
  url: string;
  models: string[];
  error?: string;
}

export interface ColabNdjsonChunk {
  token: string;
  done: boolean;
  evalCount?: number;
  evalDurationNs?: number;
}

export function normalizeTunnelUrl(rawUrl: string): string {
  return String(rawUrl || '').trim().replace(/\/+$/, '');
}

export function applySlidingWindowContext(
  messages: ColabChatMessage[],
  maxNonSystem = 8
): ColabChatMessage[] {
  if (messages.length <= maxNonSystem + 1) return messages;
  const sys = messages[0]?.role === 'system' ? [messages[0]] : [];
  const rest = messages[0]?.role === 'system' ? messages.slice(1) : messages;
  return [...sys, ...rest.slice(-maxNonSystem)];
}

export function buildColabChatPayload(params: {
  model: string;
  messages: ColabChatMessage[];
  stream?: boolean;
  temperature?: number;
  numCtx?: number;
}) {
  return {
    model: params.model || 'qwen2.5-coder:14b',
    messages: applySlidingWindowContext(params.messages, 8),
    stream: params.stream ?? true,
    keep_alive: -1,
    options: {
      temperature: params.temperature ?? 0.2,
      num_ctx: params.numCtx ?? 8192,
    },
  };
}

export function parseNdjsonLine(line: string): ColabNdjsonChunk | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const obj = JSON.parse(trimmed) as {
      message?: { content?: string };
      done?: boolean;
      eval_count?: number;
      eval_duration?: number;
    };
    return {
      token: String(obj.message?.content ?? ''),
      done: Boolean(obj.done),
      evalCount: typeof obj.eval_count === 'number' ? obj.eval_count : undefined,
      evalDurationNs: typeof obj.eval_duration === 'number' ? obj.eval_duration : undefined,
    };
  } catch {
    return null;
  }
}

export async function probeColabTunnel(
  rawUrl: string,
  timeoutMs = 3500
): Promise<ColabProbeResult> {
  const url = normalizeTunnelUrl(rawUrl);
  if (!url) {
    return { online: false, url: '', models: [], error: 'URL tunnel trống.' };
  }
  try {
    const resp = await fetch(`${url}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!resp.ok) {
      return {
        online: false,
        url,
        models: [],
        error: `HTTP ${resp.status}`,
      };
    }
    const data = (await resp.json()) as { models?: Array<{ name?: string }> };
    const models = (data.models ?? [])
      .map((m) => String(m.name ?? '').trim())
      .filter(Boolean);
    return {
      online: models.length > 0,
      url,
      models,
      error: models.length === 0 ? 'Tunnel mở nhưng chưa có model nào.' : undefined,
    };
  } catch (err) {
    return {
      online: false,
      url,
      models: [],
      error: String(err),
    };
  }
}
