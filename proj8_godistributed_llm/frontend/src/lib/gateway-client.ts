import type {
  ChatMessage,
  NodesResponse,
  QueuesResponse,
  StreamErrorEvent,
  StreamTokenEvent,
} from "@/types/api";

export const GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://127.0.0.1:8088";

const GATEWAY_API_KEY = process.env.NEXT_PUBLIC_GATEWAY_API_KEY ?? "";

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  if (GATEWAY_API_KEY) {
    headers["X-API-Key"] = GATEWAY_API_KEY;
  }
  return headers;
}

export async function checkGatewayHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${GATEWAY_URL}/healthz`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listWorkerNodes(): Promise<NodesResponse> {
  const res = await fetch(`${GATEWAY_URL}/api/v1/admin/nodes`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch nodes: HTTP ${res.status}`);
  }
  const data = (await res.json()) as Partial<NodesResponse>;
  return {
    total_nodes: data.total_nodes ?? 0,
    nodes: data.nodes ?? [],
  };
}

export async function getQueueStats(models: string[]): Promise<QueuesResponse> {
  const query = models.length > 0 ? `?models=${encodeURIComponent(models.join(","))}` : "";
  const res = await fetch(`${GATEWAY_URL}/api/v1/admin/queues${query}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch queues: HTTP ${res.status}`);
  }
  const data = (await res.json()) as Partial<QueuesResponse>;
  return { queues: data.queues ?? {} };
}

export async function setWorkerDraining(workerId: string, draining: boolean): Promise<void> {
  const action = draining ? "drain" : "resume";
  const res = await fetch(
    `${GATEWAY_URL}/api/v1/admin/nodes/${encodeURIComponent(workerId)}/${action}`,
    {
      method: "POST",
      headers: authHeaders(),
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to ${action} worker ${workerId}: HTTP ${res.status}`);
  }
}

export async function getChatHistory(conversationId: string): Promise<ChatMessage[]> {
  const res = await fetch(
    `${GATEWAY_URL}/api/v1/chat/${encodeURIComponent(conversationId)}/history`,
    {
      headers: authHeaders(),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to load history: HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    messages?: Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      model: string;
      job_id?: string;
      created_at?: string;
    }>;
  };
  return (data.messages ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    model: m.model,
    jobId: m.job_id,
    createdAt: m.created_at ? Date.parse(m.created_at) : Date.now(),
  }));
}

export async function stopJob(jobId: string): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/api/v1/chat/${encodeURIComponent(jobId)}/stop`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Failed to stop job ${jobId}: HTTP ${res.status}`);
  }
}

export interface StreamChatParams {
  userId: string;
  conversationId: string;
  model: string;
  prompt: string;
  signal: AbortSignal;
  onJobStarted?: (jobId: string, conversationId: string) => void;
  onToken: (event: StreamTokenEvent) => void;
  onError: (message: string) => void;
  onComplete: () => void;
}

export async function streamChat(params: StreamChatParams): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/api/v1/chat/stream`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      user_id: params.userId,
      conversation_id: params.conversationId,
      model: params.model,
      prompt: params.prompt,
    }),
    signal: params.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Gateway HTTP ${res.status}`);
  }

  const headerJobId = res.headers.get("X-Job-Id") ?? "";
  const headerConvId = res.headers.get("X-Conversation-Id") ?? params.conversationId;
  if (headerJobId && params.onJobStarted) {
    params.onJobStarted(headerJobId, headerConvId);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let currentEvent = "message";
  let completed = false;

  const processBlock = (block: string) => {
    const lines = block.split(/\r?\n/);
    let eventName = currentEvent;
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (dataLines.length === 0) return;
    const rawData = dataLines.join("\n");

    if (eventName === "error") {
      try {
        const parsed = JSON.parse(rawData) as StreamErrorEvent;
        params.onError(parsed.error || rawData);
      } catch {
        params.onError(rawData);
      }
      completed = true;
      return;
    }

    try {
      const parsed = JSON.parse(rawData) as StreamTokenEvent;
      if (parsed.job_id && params.onJobStarted) {
        params.onJobStarted(parsed.job_id, parsed.conversation_id || headerConvId);
      }
      params.onToken(parsed);
      if (parsed.done) {
        completed = true;
        params.onComplete();
      }
    } catch {
      // Ignore malformed non-JSON heartbeat lines
    }
    currentEvent = "message";
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() ?? "";

    for (const block of parts) {
      if (block.trim()) {
        processBlock(block);
      }
    }
  }

  if (buffer.trim()) {
    processBlock(buffer);
  }

  if (!completed) {
    params.onComplete();
  }
}

