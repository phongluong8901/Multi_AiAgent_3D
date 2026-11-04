import { useState, useEffect } from 'react';
import {
    ShieldAlert,
    Camera,
    RefreshCw,
    Search,
    CheckCircle2,
    Clock,
    FileSpreadsheet,
    FileCode,
} from 'lucide-react';
import { httpClient } from '../../services/httpClient';
import { useTelemetryStore } from '../../stores/useTelemetryStore';

export function IncidentAuditLogView() {
    const [incidents, setIncidents] = useState<any[]>([]);
    const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [isCapturing, setIsCapturing] = useState<boolean>(false);

    const addLog = useTelemetryStore((s) => s.addLog);

    const fetchIncidents = async () => {
        setLoading(true);
        try {
            const data = await httpClient.getIncidents(100, filterSeverity === 'ALL' ? undefined : filterSeverity);
            setIncidents(data.incidents || []);
        } catch (err: any) {
            addLog('ALERT', `Failed to fetch incidents: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchIncidents();
        const timer = setInterval(fetchIncidents, 4000);
        return () => clearInterval(timer);
    }, [filterSeverity]);

    const handleManualCapture = async () => {
        setIsCapturing(true);
        try {
            const res = await httpClient.captureScreen();
            if (res.status === 'captured') {
                addLog('ACTION', `[INCIDENT CAPTURE] Desktop screenshot saved: ${res.filename} (${(res.size / 1024).toFixed(1)} KB)`);
                fetchIncidents();
            } else {
                addLog('ALERT', `Screenshot capture failed: ${res.reason}`);
            }
        } catch (err: any) {
            addLog('ALERT', `Screenshot error: ${err.message}`);
        } finally {
            setTimeout(() => setIsCapturing(false), 500);
        }
    };

    const handleExportCSV = () => {
        window.open(httpClient.exportIncidentsUrl('csv'), '_blank');
        addLog('INFO', '[INCIDENT AUDIT] Exported audit trail CSV report.');
    };

    const handleExportJSON = () => {
        window.open(httpClient.exportIncidentsUrl('json'), '_blank');
        addLog('INFO', '[INCIDENT AUDIT] Exported audit trail JSON report.');
    };

    const filtered = incidents.filter((inc) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            (inc.proc_name && inc.proc_name.toLowerCase().includes(q)) ||
            (inc.metric && inc.metric.toLowerCase().includes(q)) ||
            (inc.action_taken && inc.action_taken.toLowerCase().includes(q)) ||
            String(inc.pid || '').includes(q)
        );
    });

    const criticalCount = incidents.filter((i) => i.severity === 'CRITICAL').length;
    const warningCount = incidents.filter((i) => i.severity === 'WARNING').length;

    return (
        <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 select-none overflow-hidden">
            {/* Header Control Toolbar */}
            <div className="h-12 bg-zinc-900/90 border-b border-zinc-800 px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-100">
                            Incident Audit Trail &amp; Post-Mortem Logs
                        </span>
                    </div>

                    <div className="h-4 w-px bg-zinc-800" />

                    {/* Stats Badges */}
                    <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                            Total: {incidents.length}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Critical: {criticalCount}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Warning: {warningCount}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Manual Desktop Screenshot */}
                    <button
                        onClick={handleManualCapture}
                        disabled={isCapturing}
                        className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Chụp ảnh màn hình Desktop ngay lập tức lưu vào dumps/"
                    >
                        <Camera className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{isCapturing ? 'Capturing...' : 'Capture Screen'}</span>
                    </button>

                    {/* Export CSV */}
                    <button
                        onClick={handleExportCSV}
                        className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Xuất file báo cáo CSV"
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Export CSV</span>
                    </button>

                    {/* Export JSON */}
                    <button
                        onClick={handleExportJSON}
                        className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Xuất file báo cáo JSON"
                    >
                        <FileCode className="w-3.5 h-3.5 text-purple-400" />
                        <span>Export JSON</span>
                    </button>

                    <button
                        onClick={fetchIncidents}
                        className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
                        title="Làm mới danh sách"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Filter Sub-bar */}
            <div className="px-4 py-2 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between shrink-0 text-xs">
                <div className="flex items-center gap-2">
                    <span className="text-zinc-500 font-semibold uppercase text-[10px]">Severity Filter:</span>
                    <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded border border-zinc-800">
                        {['ALL', 'CRITICAL', 'WARNING'].map((s) => (
                            <button
                                key={s}
                                onClick={() => setFilterSeverity(s)}
                                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                                    filterSeverity === s
                                        ? 'bg-zinc-800 text-zinc-100 font-bold'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter by process, metric, action..."
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1 text-xs text-zinc-200 focus:outline-none focus:border-rose-500"
                    />
                </div>
            </div>

            {/* Incident Table */}
            <div className="flex-1 overflow-auto p-4">
                {filtered.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-zinc-500 space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500/50" />
                        <div className="text-sm font-medium">No Incidents Recorded</div>
                        <div className="text-xs text-zinc-600">
                            Auto-Guard is watching your system. Any critical breaches or interventions will be logged here.
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-zinc-800 bg-zinc-950/80 text-zinc-400 font-mono text-[11px]">
                                    <th className="py-2.5 px-3">TIMESTAMP</th>
                                    <th className="py-2.5 px-3">SEVERITY</th>
                                    <th className="py-2.5 px-3">TARGET PROCESS</th>
                                    <th className="py-2.5 px-3">PID</th>
                                    <th className="py-2.5 px-3">VIOLATION METRIC</th>
                                    <th className="py-2.5 px-3">INTERVENTION ACTION</th>
                                    <th className="py-2.5 px-3">STATUS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                                {filtered.map((inc) => (
                                    <tr key={inc.id} className="hover:bg-zinc-800/50 transition-colors">
                                        <td className="py-2.5 px-3 text-zinc-400 whitespace-nowrap flex items-center gap-1.5">
                                            <Clock className="w-3 h-3 text-zinc-500" />
                                            {inc.time_str}
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <span
                                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                                    inc.severity === 'CRITICAL'
                                                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                                }`}
                                            >
                                                {inc.severity}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-zinc-200 font-medium">
                                            {inc.proc_name}
                                        </td>
                                        <td className="py-2.5 px-3 text-zinc-400">
                                            {inc.pid ? `PID ${inc.pid}` : 'SYSTEM'}
                                        </td>
                                        <td className="py-2.5 px-3 text-rose-300">
                                            {inc.metric} {inc.threshold ? `(>= ${inc.threshold})` : ''}
                                        </td>
                                        <td className="py-2.5 px-3 text-amber-300">
                                            {inc.action_taken}
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <span className="text-emerald-400 flex items-center gap-1 text-[10px]">
                                                <CheckCircle2 className="w-3 h-3" /> {inc.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
