"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Check,
  Copy,
  Cpu,
  History,
  Plus,
  Send,
  Square,
  User,
} from "lucide-react";
import { getChatHistory, stopJob, streamChat } from "@/lib/gateway-client";
import type { ChatMessage } from "@/types/api";

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
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("qwen2.5:1.5b");
  const [conversationId, setConversationId] = useState(() => makeId("conv"));
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

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

  const handleLoadHistory = async () => {
    if (isStreaming || !conversationId.trim()) return;
    setIsLoadingHistory(true);
    try {
      const history = await getChatHistory(conversationId.trim());
      setMessages(history);
    } finally {
      setIsLoadingHistory(false);
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
        prompt: trimmed,
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
        },
      });
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (!isAbort) {
        const message = err instanceof Error ? err.message : "Unknown stream error";
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
    <div className="flex h-[calc(100vh-8.5rem)] flex-col rounded-xl border border-zinc-800 bg-zinc-900/60">
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
          <input
            type="text"
            value={conversationId}
            onChange={(e) => setConversationId(e.target.value)}
            disabled={isStreaming}
            aria-label="Conversation ID"
            className="hidden w-40 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-300 focus:border-indigo-500 focus:outline-none sm:inline-block"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleLoadHistory()}
            disabled={isStreaming || isLoadingHistory || !gatewayOnline}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            <History className="h-3.5 w-3.5" />
            {isLoadingHistory ? "Loading..." : "Load History"}
          </button>
          <button
            type="button"
            onClick={handleNewChat}
            disabled={isStreaming}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
            <Bot className="mb-3 h-10 w-10 text-zinc-600" />
            <p className="text-sm font-medium text-zinc-300">
              Distributed Local LLM SSE Console
            </p>
            <p className="mt-1 max-w-md text-xs text-zinc-500">
              Requests are queued in Redis Streams, pulled by idle Worker nodes via
              Semaphore slots, and streamed back over gRPC or HTTP NDJSON.
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
              className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
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
              ) : (
                <div className="whitespace-pre-wrap leading-relaxed">
                  {msg.content || (isStreaming && msg.role === "assistant" ? "..." : "")}
                </div>
              )}

              {msg.role === "assistant" && (msg.workerId || msg.content) && (
                <div className="mt-2 flex items-center justify-between gap-4 border-t border-zinc-800/80 pt-2 text-[11px] text-zinc-500">
                  <span className="font-mono">
                    {msg.workerId ? `${msg.workerId} | ${msg.model}` : msg.model}
                  </span>
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
  );
}

