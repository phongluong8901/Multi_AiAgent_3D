"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare, Server, Terminal } from "lucide-react";
import { AdminDashboard } from "@/components/AdminDashboard";
import { ChatWorkspace } from "@/components/ChatWorkspace";
import {
  GATEWAY_URL,
  checkGatewayHealth,
  getQueueStats,
  listWorkerNodes,
} from "@/lib/gateway-client";
import type { WorkerNodeInfo } from "@/types/api";

type TabKey = "chat" | "admin";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabKey>("chat");
  const [gatewayOnline, setGatewayOnline] = useState(false);
  const [nodes, setNodes] = useState<WorkerNodeInfo[]>([]);
  const [queues, setQueues] = useState<Record<string, number>>({});
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const availableModels = useMemo(() => {
    const modelSet = new Set<string>();
    for (const node of nodes) {
      for (const m of node.supported_models) {
        modelSet.add(m);
      }
    }
    return Array.from(modelSet);
  }, [nodes]);

  const refreshTelemetry = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const ok = await checkGatewayHealth();
      setGatewayOnline(ok);
      if (!ok) {
        setNodes([]);
        setQueues({});
        return;
      }

      const nodesRes = await listWorkerNodes();
      setNodes(nodesRes.nodes);

      const modelsToQuery = Array.from(
        new Set([
          "qwen2.5:1.5b",
          "qwen2.5:7b",
          "llama3.2:3b",
          ...nodesRes.nodes.flatMap((n) => n.supported_models),
        ])
      );
      const queuesRes = await getQueueStats(modelsToQuery);
      setQueues(queuesRes.queues);
      setLastUpdated(Date.now());
    } catch {
      setGatewayOnline(false);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshTelemetry();
    const timer = setInterval(() => {
      void refreshTelemetry();
    }, 5000);
    return () => clearInterval(timer);
  }, [refreshTelemetry]);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-4 sm:px-6">
      {/* Top Navbar */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/15 text-indigo-400">
            <Terminal className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-zinc-100">
              Go Distributed LLM
            </h1>
            <p className="font-mono text-[11px] text-zinc-400">{GATEWAY_URL}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
              gatewayOnline
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-rose-500/30 bg-rose-500/10 text-rose-400"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                gatewayOnline ? "bg-emerald-400" : "bg-rose-400"
              }`}
            />
            {gatewayOnline ? `${nodes.length} Worker(s)` : "Gateway Offline"}
          </span>

          <nav className="flex rounded-lg border border-zinc-800 bg-zinc-950 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                activeTab === "chat"
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Chat Console
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("admin")}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                activeTab === "admin"
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Server className="h-3.5 w-3.5" />
              Cluster Monitor
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {activeTab === "chat" ? (
          <ChatWorkspace
            availableModels={availableModels}
            gatewayOnline={gatewayOnline}
          />
        ) : (
          <AdminDashboard
            nodes={nodes}
            queues={queues}
            gatewayOnline={gatewayOnline}
            lastUpdated={lastUpdated}
            onRefresh={() => void refreshTelemetry()}
            isRefreshing={isRefreshing}
          />
        )}
      </main>
    </div>
  );
}

