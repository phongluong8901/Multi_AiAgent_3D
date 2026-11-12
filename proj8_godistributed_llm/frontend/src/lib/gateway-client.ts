import type {
  ChatMessage,
  ConversationSummary,
  NodesResponse,
  QueuesResponse,
  StreamErrorEvent,
  StreamTokenEvent,
} from "@/types/api";

// --- Cụm cấu hình địa chỉ Gateway & Authentication Header ---

/** Địa chỉ API Gateway mặc định (có thể ghi đè bằng NEXT_PUBLIC_GATEWAY_URL). */
export const GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://127.0.0.1:8088";

const GATEWAY_API_KEY = process.env.NEXT_PUBLIC_GATEWAY_API_KEY ?? "";

/** Tự động gắn header X-API-Key nếu biến môi trường NEXT_PUBLIC_GATEWAY_API_KEY được cấu hình. */
function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  if (GATEWAY_API_KEY) {
    headers["X-API-Key"] = GATEWAY_API_KEY;
  }
  return headers;
}

// --- Cụm Admin & Health Check APIs (/healthz, /api/v1/admin/*) ---

/** Kiểm tra Gateway có đang phản hồi tại /healthz hay không. */
export async function checkGatewayHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${GATEWAY_URL}/healthz`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

/** Lấy danh sách toàn bộ Worker Nodes đang gửi heartbeat lên cụm. */
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

/** Truy vấn độ sâu hàng đợi (backlog) hiện tại theo danh sách tên model. */
export async function getQueueStats(models: string[]): Promise<QueuesResponse> {
  const query =
    models.length > 0 ? `?models=${encodeURIComponent(models.join(","))}` : "";
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

/** Gửi lệnh Drain hoặc Resume để điều khiển Worker Node từ Cluster Monitor. */
export async function setWorkerDraining(
  workerId: string,
  draining: boolean
): Promise<void> {
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

// --- Cụm Chat History, Cancel Job & SSE Token Streaming ---

/** Lấy danh sách các cuộc hội thoại gần đây từ PostgreSQL/Memory repository của Gateway. */
export async function listConversations(): Promise<ConversationSummary[]> {
  const res = await fetch(`${GATEWAY_URL}/api/v1/chat/conversations`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    return [];
  }
  const data = (await res.json()) as {
    conversations?: ConversationSummary[];
  };
  return data.conversations ?? [];
}

/** Tải lịch sử tin nhắn của một phiên hội thoại và chuẩn hóa sang kiểu ChatMessage của UI. */
export async function getChatHistory(
  conversationId: string
): Promise<ChatMessage[]> {
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
      role: "user" | "assistant" | "system";
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

/** Gửi yêu cầu hủy job đang sinh token lên Gateway để ngắt GPU ở Worker. */
export async function stopJob(jobId: string): Promise<void> {
  const res = await fetch(
    `${GATEWAY_URL}/api/v1/chat/${encodeURIComponent(jobId)}/stop`,
    {
      method: "POST",
      headers: authHeaders(),
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to stop job ${jobId}: HTTP ${res.status}`);
  }
}

/** Tham số đầu vào và các callback xử lý sự kiện SSE khi gọi streamChat. */
export interface StreamChatParams {
  userId: string;
  conversationId: string;
  model: string;
  systemPrompt?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  signal: AbortSignal;
  onJobStarted?: (jobId: string, conversationId: string) => void;
  onToken: (event: StreamTokenEvent) => void;
  onError: (message: string) => void;
  onComplete: () => void;
}

/** Gửi prompt tới /api/v1/chat/stream, đọc ReadableStream SSE từng chunk và kích hoạt callback onToken/onError/onComplete. */
export async function streamChat(params: StreamChatParams): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/api/v1/chat/stream`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      user_id: params.userId,
      conversation_id: params.conversationId,
      model: params.model,
      system_prompt: params.systemPrompt || undefined,
      prompt: params.prompt,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
    }),
    signal: params.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Gateway HTTP ${res.status}`);
  }

  const headerJobId = res.headers.get("X-Job-Id") ?? "";
  const headerConvId =
    res.headers.get("X-Conversation-Id") ?? params.conversationId;
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
        params.onJobStarted(
          parsed.job_id,
          parsed.conversation_id || headerConvId
        );
      }
      params.onToken(parsed);
      if (parsed.done) {
        completed = true;
        params.onComplete();
      }
    } catch {
      // Ignore non-JSON lines
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
