"use client";

import { useState } from "react";
import {
  Activity,
  Cpu,
  Layers,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Server,
  ShieldCheck,
} from "lucide-react";
import { setWorkerDraining } from "@/lib/gateway-client";
import type { WorkerNodeInfo } from "@/types/api";

interface AdminDashboardProps {
  nodes: WorkerNodeInfo[];
  queues: Record<string, number>;
  gatewayOnline: boolean;
  lastUpdated: number | null;
  onRefresh: () => void;
  isRefreshing: boolean;
}

/**
 * Bảng điều khiển giám sát toàn cụm (Cluster Monitor):
 * - Tổng hợp KPI: trạng thái Gateway, số Worker, Active Slots và tổng Queue Backlog.
 * - Bảng chi tiết từng Worker Node (CPU/RAM/VRAM, models) kèm nút điều khiển Drain/Resume.
 */
export function AdminDashboard({
  nodes,
  queues,
  gatewayOnline,
  lastUpdated,
  onRefresh,
  isRefreshing,
}: AdminDashboardProps) {
  const [busyWorkerId, setBusyWorkerId] = useState<string | null>(null);

  const totalSlots = nodes.reduce((acc, n) => acc + n.max_slots, 0);
  const activeJobs = nodes.reduce((acc, n) => acc + n.active_jobs, 0);
  const totalQueued = Object.values(queues).reduce((acc, count) => acc + count, 0);

  const handleToggleDrain = async (node: WorkerNodeInfo) => {
    setBusyWorkerId(node.worker_id);
    try {
      const shouldDrain = node.status !== "DRAINING";
      await setWorkerDraining(node.worker_id, shouldDrain);
      onRefresh();
    } finally {
      setBusyWorkerId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">
            Cluster Telemetry & Queue Backlog
          </h2>
          <p className="text-xs text-zinc-400">
            {lastUpdated
              ? `Last polled at ${new Date(lastUpdated).toLocaleTimeString()}`
              : "Waiting for telemetry..."}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Summary metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Gateway Status</span>
            <ShieldCheck
              className={`h-4 w-4 ${gatewayOnline ? "text-emerald-400" : "text-rose-400"}`}
            />
          </div>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">
            {gatewayOnline ? "ONLINE" : "OFFLINE"}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Worker Nodes</span>
            <Server className="h-4 w-4 text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{nodes.length}</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Active Jobs / Slots</span>
            <Activity className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">
            {activeJobs} / {totalSlots}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Redis Stream Entries</span>
            <Layers className="h-4 w-4 text-cyan-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{totalQueued}</p>
        </div>
      </div>

      {/* Worker Nodes Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-200">
            <Cpu className="h-4 w-4 text-indigo-400" />
            Online Worker Nodes (TTL 12s)
          </h3>
        </div>
        {nodes.length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-500">
            No active workers reporting heartbeat. Start a worker via{" "}
            <code className="rounded bg-zinc-950 px-1.5 py-0.5 font-mono text-zinc-300">
              go run cmd/worker/main.go -config configs/worker.yaml
            </code>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Worker ID</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Supported Models</th>
                  <th className="px-4 py-3 font-medium">Slots</th>
                  <th className="px-4 py-3 font-medium">CPU</th>
                  <th className="px-4 py-3 font-medium">RAM</th>
                  <th className="px-4 py-3 font-medium">VRAM</th>
                  <th className="px-4 py-3 text-right font-medium">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {nodes.map((node) => {
                  const isDraining = node.status === "DRAINING";
                  return (
                    <tr key={node.worker_id} className="hover:bg-zinc-900/80">
                      <td className="px-4 py-3 font-mono text-zinc-100">{node.worker_id}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] ${
                            isDraining
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          }`}
                        >
                          {node.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {node.supported_models.map((m) => (
                            <span
                              key={m}
                              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-0.5 font-mono text-[11px] text-zinc-300"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-200">
                        {node.active_jobs} / {node.max_slots}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-200">
                        {node.cpu_usage_percent.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-200">
                        {node.ram_usage_percent.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-200">
                        {node.gpu_vram_percent > 0
                          ? `${node.gpu_vram_percent.toFixed(1)}%`
                          : "N/A"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void handleToggleDrain(node)}
                          disabled={busyWorkerId === node.worker_id}
                          className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
                            isDraining
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                              : "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                          }`}
                        >
                          {isDraining ? (
                            <>
                              <PlayCircle className="h-3.5 w-3.5" />
                              Resume
                            </>
                          ) : (
                            <>
                              <PauseCircle className="h-3.5 w-3.5" />
                              Drain
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Queue Backlog */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-200">
            <Layers className="h-4 w-4 text-cyan-400" />
            Redis Stream Length by Model (jobs:model:*)
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          {Object.entries(queues).map(([model, count]) => (
            <div
              key={model}
              className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5"
            >
              <span className="font-mono text-xs text-zinc-300">{model}</span>
              <span className="font-mono text-sm font-semibold text-cyan-400">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
