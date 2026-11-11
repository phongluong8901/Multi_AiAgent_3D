"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  Clock,
  Copy,
  Cpu,
  Gauge,
  MessageSquare,
  Plus,
  Send,
  Sliders,
  Square,
  User,
} from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import {
  getChatHistory,
  listConversations,
  stopJob,
  streamChat,
} from "@/lib/gateway-client";
import type { ChatMessage, ConversationSummary } from "@/types/api";

interface ChatWorkspaceProps {
  availableModels: string[];
  gatewayOnline: boolean;
}

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now()}`;
}

export function ChatWorkspace({
  availableModels,
  gatewayOnline,
}: ChatWorkspaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("qwen2.5:1.5b");
  const [conversationId, setConversationId] = useState(() => makeId("conv"));
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Generation parameters
  const [showParams, setShowParams] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState<string>("0.7");
  const [maxTokens, setMaxTokens] = useState<string>("512");

  const abortRef = useRef<AbortController | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  const refreshConversations = useCallback(async () => {
    if (!gatewayOnline) return;
    const list = await listConversations();
    setConversations(list);
  }, [gatewayOnline]);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    if (availableModels.length > 0 && !availableModels.includes(selectedModel)) {
      setSelectedModel(availableModels[0]);
    }
  }, [availableModels, selectedModel]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1500);
  };

  const handleNewChat = () => {
    if (isStreaming) return;
    setMessages([]);
    setConversationId(makeId("conv"));
  };

  const handleSelectConversation = async (convId: string) => {
    if (isStreaming) return;
    setConversationId(convId);
    try {
      const history = await getChatHistory(convId);
      setMessages(history);
    } catch {
      setMessages([]);
    }
  };

  const handleStop = async () => {
    if (activeJobId) {
      try {
        await stopJob(activeJobId);
      } catch {
        // Abort local stream even if stop endpoint fails
      }
    }
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setActiveJobId(null);
  };

  const handleSubmit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || isStreaming) return;

    const parsedTemp = Number.parseFloat(temperature);
    const parsedMaxTok = Number.parseInt(maxTokens, 10);

    const userMsg: ChatMessage = {
      id: makeId("msg"),
      role: "user",
      content: trimmed,
      model: selectedModel,
      createdAt: Date.now(),
    };

    const assistantMsgId = makeId("msg");
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      model: selectedModel,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setPrompt("");
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat({
        userId: "web-console-user",
        conversationId,
        model: selectedModel,
        systemPrompt: systemPrompt.trim() || undefined,
        prompt: trimmed,
        temperature: Number.isFinite(parsedTemp) ? parsedTemp : undefined,
        maxTokens:
          Number.isFinite(parsedMaxTok) && parsedMaxTok > 0
            ? parsedMaxTok
            : undefined,
        signal: controller.signal,
        onJobStarted: (jobId, convId) => {
          setActiveJobId(jobId);
          if (convId) setConversationId(convId);
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, jobId } : m))
          );
        },
        onToken: (evt) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    jobId: evt.job_id || m.jobId,
                    workerId: evt.worker_id || m.workerId,
                    content: m.content + (evt.token ?? ""),
                    ttftMs: evt.ttft_ms ?? m.ttftMs,
                    durationMs: evt.duration_ms ?? m.durationMs,
                    tokenCount: evt.token_count ?? m.tokenCount,
                    tokensPerSec: evt.tokens_per_sec ?? m.tokensPerSec,
                  }
                : m
            )
          );
        },
        onError: (errMsg) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, error: errMsg } : m
            )
          );
          setIsStreaming(false);
          setActiveJobId(null);
        },
        onComplete: () => {
          setIsStreaming(false);
          setActiveJobId(null);
          abortRef.current = null;
          void refreshConversations();
        },
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (!isAbort) {
        const message =
          err instanceof Error ? err.message : "Unknown stream error";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, error: message } : m
          )
        );
      }
      setIsStreaming(false);
      setActiveJobId(null);
      abortRef.current = null;
    }
  };

  const modelOptions =
    availableModels.length > 0
      ? availableModels
      : ["qwen2.5:1.5b", "qwen2.5:7b", "llama3.2:3b"];

  return (
    <div className="grid h-[calc(100vh-8.5rem)] grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
      {/* Left Conversation Sidebar */}
      <aside className="hidden flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 lg:flex">
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Conversations
          </span>
          <button
            type="button"
            onClick={handleNewChat}
            disabled={isStreaming}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            New
          </button>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-zinc-500">
              No saved conversations yet. Send a message to begin.
            </p>
          ) : (
            conversations.map((conv) => {
              const active = conv.id === conversationId;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => void handleSelectConversation(conv.id)}
                  disabled={isStreaming}
                  className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                    active
                      ? "border border-indigo-500/40 bg-indigo-500/15 text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200"
                  }`}
                >
                  <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {conv.title || conv.id}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">
                      {conv.id}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Chat Panel */}
      <div className="flex min-h-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900/60">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-zinc-400">
              <Cpu className="h-4 w-4 text-indigo-400" />
              <span>Model</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={isStreaming}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
              >
                {modelOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <span className="hidden rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-400 sm:inline-block">
              {conversationId}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowParams((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                showParams
                  ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-300"
                  : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              Parameters
            </button>
            <button
              type="button"
              onClick={handleNewChat}
              disabled={isStreaming}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50 lg:hidden"
            >
              <Plus className="h-3.5 w-3.5" />
              New Chat
            </button>
          </div>
        </div>

        {/* Generation Parameters Drawer */}
        {showParams && (
          <div className="grid grid-cols-1 gap-3 border-b border-zinc-800 bg-zinc-950/70 px-4 py-3 sm:grid-cols-[1fr_130px_130px]">
            <label className="flex flex-col gap-1 text-[11px] text-zinc-400">
              <span>System Prompt</span>
              <input
                type="text"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Optional system instruction (e.g. Answer concisely in Vietnamese)"
                className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-zinc-400">
              <span>Temperature</span>
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 font-mono text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-zinc-400">
              <span>Max Tokens</span>
              <input
                type="number"
                step="64"
                min="16"
                max="8192"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 font-mono text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
              />
            </label>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
              <Bot className="mb-3 h-10 w-10 text-zinc-600" />
              <p className="text-sm font-medium text-zinc-300">
                Distributed Local LLM Console
              </p>
              <p className="mt-1 max-w-md text-xs text-zinc-500">
                Supports multi-turn memory, custom temperature/max_tokens, Markdown
                code blocks, and real-time TTFT / tokens-per-second telemetry.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "border border-zinc-800 bg-zinc-950 text-zinc-100"
                }`}
              >
                {msg.error ? (
                  <div className="flex items-start gap-2 text-rose-400">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="font-mono text-xs">{msg.error}</span>
                  </div>
                ) : msg.role === "assistant" ? (
                  msg.content ? (
                    <MarkdownRenderer content={msg.content} />
                  ) : (
                    <span className="font-mono text-xs text-zinc-500">
                      {isStreaming ? "Generating..." : ""}
                    </span>
                  )
                ) : (
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </div>
                )}

                {msg.role === "assistant" && (msg.workerId || msg.content) && (
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800/80 pt-2 text-[11px] text-zinc-500">
                    <div className="flex flex-wrap items-center gap-3 font-mono">
                      <span>
                        {msg.workerId ? `${msg.workerId} | ${msg.model}` : msg.model}
                      </span>
                      {typeof msg.ttftMs === "number" && (
                        <span className="inline-flex items-center gap-1 text-zinc-400">
                          <Clock className="h-3 w-3 text-cyan-400" />
                          TTFT {msg.ttftMs}ms
                        </span>
                      )}
                      {typeof msg.tokensPerSec === "number" && msg.tokensPerSec > 0 && (
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <Gauge className="h-3 w-3" />
                          {msg.tokensPerSec.toFixed(1)} tok/s
                        </span>
                      )}
                    </div>

                    {msg.content && (
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          <div ref={scrollEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-zinc-800 p-3">
          <div className="flex items-end gap-2">
            <textarea
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder={
                gatewayOnline
                  ? "Enter prompt (Enter to send, Shift+Enter for newline)..."
                  : "Gateway offline - start backend on :8088 first..."
              }
              className="flex-1 resize-none rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={() => void handleStop()}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-rose-600 px-4 text-sm font-medium text-white transition hover:bg-rose-500"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!prompt.trim() || !gatewayOnline}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
