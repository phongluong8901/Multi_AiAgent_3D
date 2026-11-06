/**
 * Màn hình Khảo sát Lưu lượng Mạng & Các Điểm cuối API (API & Network Traffic Inspector):
 * - Giám sát các socket mạng đang mở (ESTABLISHED, LISTEN, TIME_WAIT) của các tiến trình hệ điều hành.
 * - Phân giải tên miền (DNS Hostname Resolution) và phân loại lưu lượng: AI / Cloud API / Database / Local IPC.
 * - Modal chi tiết khảo sát socket (Inspect Sockets) xem từng URL, IP từ xa, cổng dịch vụ và trạng thái kết nối.
 */

import { useState, useEffect, useCallback } from 'react';
import {
    Globe,
    Activity,
    RefreshCw,
    Search,
    Server,
    Radio,
    Shield,
    ExternalLink,
    Layers,
    Cpu,
    X,
} from 'lucide-react';
import { httpClient } from '../../services/httpClient';
import type { SystemNetworkSummary, ProcessNetworkProfile } from '../../types/compute';
import { useTelemetryStore } from '../../stores/useTelemetryStore';

export function NetworkTrafficView() {
    const [summary, setSummary] = useState<SystemNetworkSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [inspectProc, setInspectProc] = useState<ProcessNetworkProfile | null>(null);

    const addLog = useTelemetryStore((s) => s.addLog);

    /**
     * Tải dữ liệu tóm tắt mạng toàn hệ thống từ backend.
     */
    const loadSummary = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await httpClient.getNetworkSummary();
            setSummary(data);
        } catch (e: any) {
            addLog('ALERT', `Failed to load network traffic summary: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [addLog]);

    // Chu kỳ làm mới dữ liệu mạng mỗi 4 giây
    useEffect(() => {
        void loadSummary();
        const timer = setInterval(() => {
            void loadSummary();
        }, 4000);
        return () => clearInterval(timer);
    }, [loadSummary]);

    /**
     * Xem chi tiết các kết nối socket mạng của một tiến trình cụ thể theo PID.
     */
    const handleInspectProcess = async (pid: number) => {
        try {
            const data = await httpClient.getProcessNetwork(pid);
            setInspectProc(data);
        } catch (e: any) {
            addLog('ALERT', `Failed to inspect network for PID ${pid}: ${e.message}`);
        }
    };

    const topProcesses = summary?.top_processes || [];
    const topDomains = summary?.top_domains || [];

    // Lọc tiến trình theo chuỗi tìm kiếm
    const filteredProcesses = topProcesses.filter((p) => {
        const matchesSearch =
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.pid.toString().includes(searchQuery);
        return matchesSearch;
    });

    return (
        <div className="h-full bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden select-none font-sans">
            {/* Thanh công cụ Header */}
            <div className="h-12 border-b border-zinc-800 bg-zinc-900/80 px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-blue-950/60 border border-blue-500/30 text-blue-400">
                        <Globe className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-zinc-200">API &amp; Network Traffic Inspector</h2>
                        <p className="text-[10px] text-zinc-400">
                            Realtime Outbound Sockets, Remote API Endpoints &amp; DNS Hostname Resolution
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={loadSummary}
                        disabled={isLoading}
                        className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Thẻ KPI tổng quan mạng */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 shrink-0 bg-zinc-950">
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between">
                    <div>
                        <div className="text-[11px] text-zinc-400 font-medium">Total Sockets</div>
                        <div className="text-xl font-bold font-mono text-zinc-100 mt-0.5">
                            {summary?.total_active_connections ?? 0}
                        </div>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-800/60 text-zinc-400 border border-zinc-700/50">
                        <Activity className="w-4 h-4" />
                    </div>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between">
                    <div>
                        <div className="text-[11px] text-zinc-400 font-medium">Processes in Network</div>
                        <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                            {summary?.monitored_processes_count ?? 0}
                        </div>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-950/40 text-emerald-400 border border-emerald-500/30">
                        <Cpu className="w-4 h-4" />
                    </div>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between">
                    <div>
                        <div className="text-[11px] text-zinc-400 font-medium">Remote API Domains</div>
                        <div className="text-xl font-bold font-mono text-blue-400 mt-0.5">
                            {topDomains.length}
                        </div>
                    </div>
                    <div className="p-2 rounded-lg bg-blue-950/40 text-blue-400 border border-blue-500/30">
                        <Globe className="w-4 h-4" />
                    </div>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between">
                    <div>
                        <div className="text-[11px] text-zinc-400 font-medium">Active Watchdog</div>
                        <div className="text-xs font-semibold text-cyan-400 mt-1 flex items-center gap-1 font-mono">
                            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" /> SCANNING
                        </div>
                    </div>
                    <div className="p-2 rounded-lg bg-cyan-950/40 text-cyan-400 border border-cyan-500/30">
                        <Shield className="w-4 h-4" />
                    </div>
                </div>
            </div>

            {/* Khung nội dung chính: Chia 2 cột (Top Domains bên trái, Table Process bên phải) */}
            <div className="flex-1 px-4 pb-4 overflow-hidden grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Cột 1: Danh sách các Tên Miền / API Mục Tiêu Hàng Đầu */}
                <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl flex flex-col overflow-hidden">
                    <div className="px-3 py-2.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                            <Server className="w-3.5 h-3.5 text-blue-400" />
                            <span>Top Contacted Endpoints</span>
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400">DNS Resolved</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1.5 font-mono text-xs">
                        {topDomains.length === 0 ? (
                            <div className="text-center py-10 text-zinc-500 font-sans text-xs">
                                No remote network traffic detected
                            </div>
                        ) : (
                            topDomains.map((d, idx) => (
                                <div
                                    key={idx}
                                    className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-between hover:border-zinc-700 transition-colors"
                                >
                                    <div className="truncate max-w-[180px]" title={d.domain}>
                                        <div className="text-zinc-200 font-medium text-[11px] truncate">{d.domain}</div>
                                        <div className="text-[10px] text-zinc-500 font-sans">
                                            {d.domain.includes('openai') || d.domain.includes('anthropic')
                                                ? 'AI Provider'
                                                : d.domain.includes('github') || d.domain.includes('google')
                                                ? 'Cloud API'
                                                : d.domain.includes('localhost')
                                                ? 'Local IPC'
                                                : 'Remote Host'}
                                        </div>
                                    </div>
                                    <div className="px-2 py-0.5 rounded bg-blue-950/60 border border-blue-500/30 text-blue-300 font-bold text-[11px]">
                                        {d.connections} {d.connections > 1 ? 'conns' : 'conn'}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Cột 2 & 3: Bảng danh sách Process và các đường truyền API */}
                <div className="lg:col-span-2 bg-zinc-900/70 border border-zinc-800 rounded-xl flex flex-col overflow-hidden">
                    <div className="px-3 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Processes Generating Network &amp; API Traffic</span>
                            </span>
                        </div>

                        {/* Ô tìm kiếm tiến trình */}
                        <div className="relative w-56">
                            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2" />
                            <input
                                type="text"
                                placeholder="Search PID or name..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-700 rounded-md pl-8 pr-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-zinc-950/80 sticky top-0 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
                                <tr>
                                    <th className="py-2 px-3">PID</th>
                                    <th className="py-2 px-3">PROCESS NAME</th>
                                    <th className="py-2 px-3 text-center">OUTBOUND APIS</th>
                                    <th className="py-2 px-3 text-center">LISTEN PORTS</th>
                                    <th className="py-2 px-3 text-center">TOTAL SOCKETS</th>
                                    <th className="py-2 px-4 text-right">ACTION</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60 font-mono text-zinc-300">
                                {filteredProcesses.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-10 text-center text-zinc-500 font-sans">
                                            No active network processes matching filter
                                        </td>
                                    </tr>
                                ) : (
                                    filteredProcesses.map((p) => (
                                        <tr
                                            key={p.pid}
                                            className="hover:bg-zinc-800/40 transition-colors group border-y border-transparent hover:border-zinc-800"
                                        >
                                            <td className="py-2.5 px-3 text-emerald-400 font-semibold">{p.pid}</td>
                                            <td className="py-2.5 px-3 font-sans text-zinc-200 font-medium">
                                                <div className="truncate max-w-[200px]" title={p.name}>
                                                    {p.name}
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-3 text-center">
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                                    p.outbound_apis > 0
                                                        ? 'bg-blue-950 text-blue-300 border border-blue-800/50'
                                                        : 'bg-zinc-950 text-zinc-500'
                                                }`}>
                                                    {p.outbound_apis}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-center">
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                                    p.listening > 0
                                                        ? 'bg-amber-950 text-amber-300 border border-amber-800/50'
                                                        : 'bg-zinc-950 text-zinc-500'
                                                }`}>
                                                    {p.listening}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-center font-bold text-zinc-200">
                                                {p.total_sockets}
                                            </td>
                                            <td className="py-2.5 px-4 text-right">
                                                <button
                                                    onClick={() => handleInspectProcess(p.pid)}
                                                    className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-blue-950 text-zinc-300 hover:text-blue-300 border border-zinc-700 hover:border-blue-500/50 text-[11px] font-sans flex items-center gap-1 transition-all ml-auto cursor-pointer"
                                                >
                                                    <ExternalLink className="w-3 h-3 text-blue-400" />
                                                    <span>Inspect Sockets</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal Chi Tiết Điểm Cuối Socket & API Của Process Được Chọn */}
            {inspectProc && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden text-xs text-zinc-300">
                        {/* Modal Header */}
                        <div className="px-4 py-3 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4 text-blue-400" />
                                <span className="font-semibold text-sm text-zinc-100">
                                    Network Sockets &amp; API Calls: {inspectProc.name} [PID {inspectProc.pid}]
                                </span>
                            </div>
                            <button
                                onClick={() => setInspectProc(null)}
                                className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-4 space-y-3 overflow-y-auto flex-1">
                            {/* Danh sách tên miền đã gọi */}
                            <div className="space-y-1">
                                <span className="text-zinc-400 font-medium text-[11px]">Contacted Domains &amp; Endpoints:</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {inspectProc.domains_contacted.length === 0 ? (
                                        <span className="text-zinc-500 italic text-[11px]">No active external domain calls.</span>
                                    ) : (
                                        inspectProc.domains_contacted.map((domain, i) => (
                                            <span
                                                key={i}
                                                className="px-2 py-0.5 rounded-full bg-blue-950/60 border border-blue-500/40 text-blue-300 font-mono text-[11px]"
                                            >
                                                {domain}
                                            </span>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Bảng chi tiết từng socket */}
                            <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 font-mono text-[10px]">
                                        <tr>
                                            <th className="py-2 px-3">PROTO</th>
                                            <th className="py-2 px-3">TARGET URL / ENDPOINT</th>
                                            <th className="py-2 px-3">REMOTE HOST / IP:PORT</th>
                                            <th className="py-2 px-3">CATEGORY</th>
                                            <th className="py-2 px-3">STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                                        {inspectProc.outbound_connections.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-6 text-center text-zinc-500 font-sans">
                                                    No outbound socket connections recorded for this process.
                                                </td>
                                            </tr>
                                        ) : (
                                            inspectProc.outbound_connections.map((c, idx) => (
                                                <tr key={idx} className="hover:bg-zinc-900/60">
                                                    <td className="py-2 px-3 text-cyan-400 font-semibold">{c.protocol}</td>
                                                    <td className="py-2 px-3 font-mono">
                                                        {c.url && c.url !== 'N/A' ? (
                                                            <a
                                                                href={c.url.startsWith('http') ? c.url : undefined}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 font-semibold group/link max-w-[240px] truncate"
                                                                title={c.url}
                                                            >
                                                                <span className="truncate">{c.url}</span>
                                                                <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 shrink-0" />
                                                            </a>
                                                        ) : (
                                                            <span className="text-zinc-500 font-mono text-[11px]">-</span>
                                                        )}
                                                        {c.description && (
                                                            <div className="text-[10px] text-zinc-500 font-sans truncate max-w-[240px]" title={c.description}>
                                                                {c.description}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <div className="text-zinc-200 font-medium truncate max-w-[160px]" title={c.remote_host || ''}>
                                                            {c.remote_host}
                                                        </div>
                                                        <div className="text-zinc-500 text-[10px]">
                                                            {c.remote_ip}:{c.remote_port}
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium ${
                                                            c.category === 'AI_LLM'
                                                                ? 'bg-purple-950 text-purple-300 border border-purple-800/40'
                                                                : c.category === 'CLOUD_API'
                                                                ? 'bg-blue-950 text-blue-300 border border-blue-800/40'
                                                                : c.category === 'DATABASE'
                                                                ? 'bg-amber-950 text-amber-300 border border-amber-800/40'
                                                                : c.category === 'LOCAL_SERVICE'
                                                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                                                                : 'bg-zinc-800 text-zinc-400'
                                                        }`}>
                                                            {c.category}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3">
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                                            c.status === 'ESTABLISHED'
                                                                ? 'text-emerald-400 font-semibold'
                                                                : 'text-zinc-500'
                                                        }`}>
                                                            {c.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-4 py-2.5 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
                            <span className="text-[11px] text-zinc-500">
                                Total Sockets: {inspectProc.total_connections} | Listening Ports: {inspectProc.listening_ports.join(', ') || 'None'}
                            </span>
                            <button
                                onClick={() => setInspectProc(null)}
                                className="px-3.5 py-1.5 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
