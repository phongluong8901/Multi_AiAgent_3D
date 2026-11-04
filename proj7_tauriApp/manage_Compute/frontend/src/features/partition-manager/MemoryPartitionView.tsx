import { useState, useEffect, useCallback } from 'react';
import {
    HardDrive,
    Cpu,
    Layers,
    Trash2,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    Zap,
    Sparkles,
    Server,
    X,
} from 'lucide-react';
import { httpClient } from '../../services/httpClient';
import type { SystemPartitionsOverview, MemoryPartitionItem } from '../../types/compute';
import { useTelemetryStore } from '../../stores/useTelemetryStore';

export function MemoryPartitionView() {
    const [overview, setOverview] = useState<SystemPartitionsOverview | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTab, setSelectedTab] = useState<'ALL' | 'RAM' | 'STORAGE' | 'CACHE'>('ALL');
    const [purgeTarget, setPurgeTarget] = useState<MemoryPartitionItem | null>(null);
    const [isPurging, setIsPurging] = useState(false);
    const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'alert'; text: string } | null>(null);

    const addLog = useTelemetryStore((s) => s.addLog);

    const loadPartitions = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await httpClient.getPartitions();
            setOverview(data);
        } catch (e: any) {
            addLog('ALERT', `Failed to load memory partitions: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [addLog]);

    useEffect(() => {
        void loadPartitions();
        const timer = setInterval(() => {
            void loadPartitions();
        }, 5000);
        return () => clearInterval(timer);
    }, [loadPartitions]);

    const handleConfirmPurge = async () => {
        if (!purgeTarget) return;
        setIsPurging(true);
        try {
            const res = await httpClient.purgePartition(purgeTarget.id, 'safe');
            setActionMsg({
                type: 'success',
                text: `${res.message} [Freed ${res.freed_mb} MB]`,
            });
            addLog('ACTION', `[PARTITION PURGE] ${res.message}`);
            setPurgeTarget(null);
            void loadPartitions();
        } catch (e: any) {
            setActionMsg({ type: 'alert', text: `Purge failed: ${e.message}` });
            addLog('ALERT', `Failed to purge ${purgeTarget.name}: ${e.message}`);
        } finally {
            setIsPurging(false);
            setTimeout(() => setActionMsg(null), 5000);
        }
    };

    const handleQuickFlushAll = async () => {
        setIsPurging(true);
        try {
            const res = await httpClient.purgePartition('ram_standby_cache', 'safe');
            setActionMsg({
                type: 'success',
                text: `Deep memory flush completed: ${res.message}`,
            });
            addLog('ACTION', `[SYSTEM OPTIMIZER] Deep memory flush executed: ${res.message}`);
            void loadPartitions();
        } catch (e: any) {
            setActionMsg({ type: 'alert', text: `Deep flush error: ${e.message}` });
        } finally {
            setIsPurging(false);
            setTimeout(() => setActionMsg(null), 5000);
        }
    };

    const partitions = overview?.partitions || [];
    const filteredPartitions = partitions.filter((p) => {
        if (selectedTab === 'RAM') return p.storage_type === 'RAM' || p.storage_type === 'SWAP';
        if (selectedTab === 'STORAGE') return p.storage_type === 'SSD' || p.storage_type === 'HDD';
        if (selectedTab === 'CACHE') return p.category === 'CACHE_TEMP';
        return true;
    });

    return (
        <div className="h-full bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden select-none font-sans">
            {/* Header Toolbar */}
            <div className="h-12 border-b border-zinc-800 bg-zinc-900/80 px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
                        <HardDrive className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-zinc-200">Memory &amp; Storage Partition Manager</h2>
                        <p className="text-[10px] text-zinc-400">
                            OS RAM Pools, Standby Cache, Swap Pages, Storage Volumes &amp; Safe Purging
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleQuickFlushAll}
                        disabled={isPurging}
                        className="px-3 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md disabled:opacity-50"
                        title="Flush Windows Standby Cache & Trim Inactive Working Sets"
                    >
                        <Zap className="w-3.5 h-3.5" />
                        <span>1-Click Deep Memory Flush</span>
                    </button>

                    <button
                        onClick={loadPartitions}
                        disabled={isLoading}
                        className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors cursor-pointer disabled:opacity-50"
                        title="Refresh Partitions"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Quick KPI Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 shrink-0 bg-zinc-950">
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between">
                    <div>
                        <div className="text-[11px] text-zinc-400 font-medium">Physical RAM Used</div>
                        <div className="text-xl font-bold font-mono text-zinc-100 mt-0.5">
                            {overview ? `${(overview.ram_used_mb / 1024).toFixed(1)} GB` : '0 GB'}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                            Total: {overview ? `${(overview.ram_total_mb / 1024).toFixed(1)} GB` : '0 GB'}
                        </div>
                    </div>
                    <div className="p-2 rounded-lg bg-blue-950/40 text-blue-400 border border-blue-500/30">
                        <Cpu className="w-4 h-4" />
                    </div>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between">
                    <div>
                        <div className="text-[11px] text-zinc-400 font-medium">Standby Cache (Reclaimable)</div>
                        <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                            {overview ? `${(overview.standby_reclaimable_mb / 1024).toFixed(1)} GB` : '0 GB'}
                        </div>
                        <div className="text-[10px] text-emerald-500 font-mono mt-0.5">
                            Ready to flush into Free RAM
                        </div>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">
                        <Sparkles className="w-4 h-4" />
                    </div>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between">
                    <div>
                        <div className="text-[11px] text-zinc-400 font-medium">Storage Drives Free</div>
                        <div className="text-xl font-bold font-mono text-cyan-400 mt-0.5">
                            {overview ? `${overview.disks_free_gb.toFixed(0)} GB` : '0 GB'}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                            Across SSD &amp; HDD Volumes
                        </div>
                    </div>
                    <div className="p-2 rounded-lg bg-cyan-950/40 text-cyan-400 border border-cyan-500/30">
                        <Server className="w-4 h-4" />
                    </div>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between">
                    <div>
                        <div className="text-[11px] text-zinc-400 font-medium">Temp Cache (Purgeable)</div>
                        <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">
                            {overview ? `${(overview.temp_cache_purgeable_mb / 1024).toFixed(1)} GB` : '0 GB'}
                        </div>
                        <div className="text-[10px] text-amber-500 font-mono mt-0.5">
                            %TEMP% &amp; Crash Frames
                        </div>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-950/40 text-amber-400 border border-amber-500/30">
                        <Trash2 className="w-4 h-4" />
                    </div>
                </div>
            </div>

            {/* Notification Banner */}
            {actionMsg && (
                <div
                    className={`mx-4 mb-2 p-2.5 rounded-lg border text-xs flex items-center justify-between animate-in fade-in ${
                        actionMsg.type === 'success'
                            ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                            : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        {actionMsg.type === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span>{actionMsg.text}</span>
                    </div>
                    <button
                        onClick={() => setActionMsg(null)}
                        className="text-zinc-400 hover:text-zinc-200 p-0.5 cursor-pointer"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Filter Tabs */}
            <div className="px-4 py-1.5 flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/40 text-xs shrink-0">
                <span className="text-zinc-500 font-medium mr-1">Partition Role:</span>
                {[
                    { id: 'ALL', label: 'All Regions (8)' },
                    { id: 'RAM', label: 'RAM & Swap Pools (Low/High)' },
                    { id: 'STORAGE', label: 'Storage Disks (SSD / HDD)' },
                    { id: 'CACHE', label: 'Temporary Caches & Dumps' },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setSelectedTab(tab.id as any)}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                            selectedTab === tab.id
                                ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/40 shadow-sm'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Partition Cards Grid */}
            <div className="flex-1 p-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {filteredPartitions.map((p) => {
                        const isHighUsage = p.usage_percent > 85;
                        const isMidUsage = p.usage_percent > 65;

                        return (
                            <div
                                key={p.id}
                                className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3.5 flex flex-col justify-between hover:border-zinc-700 transition-all shadow-md group"
                            >
                                <div className="space-y-2.5">
                                    {/* Header: Name & Priority Badge */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="font-semibold text-zinc-100 text-xs flex items-center gap-1.5">
                                                {p.storage_type === 'RAM' ? (
                                                    <Cpu className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                                ) : p.storage_type === 'SWAP' ? (
                                                    <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                                ) : p.storage_type === 'SSD' ? (
                                                    <Server className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                ) : p.category === 'CACHE_TEMP' ? (
                                                    <Trash2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                                ) : (
                                                    <HardDrive className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                                )}
                                                <span className="truncate">{p.name}</span>
                                            </div>
                                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate" title={p.location || ''}>
                                                {p.location || p.storage_type}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            <span
                                                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold uppercase ${
                                                    p.priority === 'CRITICAL'
                                                        ? 'bg-rose-950/80 text-rose-300 border border-rose-500/40'
                                                        : p.priority === 'HIGH'
                                                        ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                                                        : p.priority === 'LOW'
                                                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                                                        : 'bg-zinc-800 text-zinc-400'
                                                }`}
                                            >
                                                {p.priority}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Usage Metric & Progress Bar */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs font-mono">
                                            <span className="text-zinc-400">
                                                {p.used_mb > 1024
                                                    ? `${(p.used_mb / 1024).toFixed(1)} GB`
                                                    : `${p.used_mb.toFixed(0)} MB`}{' '}
                                                used
                                            </span>
                                            <span
                                                className={`font-bold ${
                                                    isHighUsage
                                                        ? 'text-rose-400'
                                                        : isMidUsage
                                                        ? 'text-amber-400'
                                                        : 'text-emerald-400'
                                                }`}
                                            >
                                                {p.usage_percent}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
                                            <div
                                                className={`h-full transition-all duration-300 ${
                                                    isHighUsage
                                                        ? 'bg-rose-500'
                                                        : isMidUsage
                                                        ? 'bg-amber-400'
                                                        : 'bg-emerald-400'
                                                }`}
                                                style={{ width: `${Math.min(100, p.usage_percent)}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                                            <span>
                                                Free:{' '}
                                                {p.free_mb > 1024
                                                    ? `${(p.free_mb / 1024).toFixed(1)} GB`
                                                    : `${p.free_mb.toFixed(0)} MB`}
                                            </span>
                                            <span>
                                                Total:{' '}
                                                {p.total_mb > 1024
                                                    ? `${(p.total_mb / 1024).toFixed(1)} GB`
                                                    : `${p.total_mb.toFixed(0)} MB`}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <p className="text-[11px] text-zinc-400 leading-relaxed font-sans line-clamp-2">
                                        {p.description}
                                    </p>
                                </div>

                                {/* Footer Action */}
                                <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between">
                                    <span className="text-[10px] font-mono text-zinc-500">
                                        {p.is_purgeable ? 'Purgeable Region' : 'Kernel Protected'}
                                    </span>

                                    {p.is_purgeable ? (
                                        <button
                                            onClick={() => setPurgeTarget(p)}
                                            className="px-2.5 py-1 rounded bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/40 text-[11px] font-sans flex items-center gap-1 transition-all cursor-pointer shadow-sm hover:shadow-rose-950/50"
                                        >
                                            <Trash2 className="w-3 h-3 text-rose-400" />
                                            <span>Purge / Clean</span>
                                        </button>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-950 text-zinc-500 border border-zinc-800">
                                            LOCKED
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Modal Xác Nhận Xóa / Giải Phóng Phân Vùng */}
            {purgeTarget && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-zinc-900 border border-amber-500/50 rounded-xl shadow-2xl max-w-md w-full overflow-hidden text-xs text-zinc-300">
                        {/* Header */}
                        <div className="px-4 py-3 bg-amber-950/40 border-b border-amber-500/30 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
                                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                                <span>Confirm Partition Purge</span>
                            </div>
                            <button
                                onClick={() => setPurgeTarget(null)}
                                className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-amber-950/60 transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-3">
                            <p className="text-zinc-300 text-xs leading-relaxed">
                                Are you sure you want to clean and release memory from this partition?
                            </p>

                            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-1.5 font-mono">
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Region:</span>
                                    <span className="text-zinc-100 font-semibold">{purgeTarget.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Type &amp; Priority:</span>
                                    <span className="text-amber-400 font-semibold">
                                        {purgeTarget.storage_type} ({purgeTarget.priority})
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Current Used:</span>
                                    <span className="text-emerald-400 font-bold">{purgeTarget.used_mb} MB</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-zinc-500">Path / Pages:</span>
                                    <span className="text-zinc-400 text-[10px] truncate max-w-[200px]" title={purgeTarget.location || ''}>
                                        {purgeTarget.location}
                                    </span>
                                </div>
                            </div>

                            <p className="text-[11px] text-zinc-400 italic">
                                Action: Safely flushes inactive memory pages or purges temporary unlocked cache files back to OS.
                            </p>
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-3 bg-zinc-950/80 border-t border-zinc-800 flex justify-end gap-2">
                            <button
                                onClick={() => setPurgeTarget(null)}
                                disabled={isPurging}
                                className="px-3.5 py-1.5 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmPurge}
                                disabled={isPurging}
                                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-700 hover:bg-rose-600 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-rose-950/60 disabled:opacity-50"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{isPurging ? 'Purging Region...' : 'Confirm Purge'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
