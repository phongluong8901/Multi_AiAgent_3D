import { useState } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { BellRing, Send, ShieldAlert, Cpu } from 'lucide-react';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { useTelemetryStore } from '../../../stores/useTelemetryStore';
import { httpClient } from '../../../services/httpClient';
import { findConnectedProcess } from '../utils/flowGraphUtils';
import { NodeExecutionHeader, getNodeCardBorderClass } from '../components/NodeExecutionHeader';

export function WebhookNotificationNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
    const deleteNode = useWorkflowStore((s) => s.deleteNode);
    const nodes = useWorkflowStore((s) => s.nodes);
    const edges = useWorkflowStore((s) => s.edges);
    const activeExecutingNodeId = useWorkflowStore((s) => s.activeExecutingNodeId);
    const executionStatus = useWorkflowStore((s) => s.executionStatusMap[id]);
    const addLog = useTelemetryStore((s) => s.addLog);

    const isExecuting = activeExecutingNodeId === id;

    const connectedProc = findConnectedProcess(id, nodes, edges);
    const targetName = connectedProc?.name || 'Target Process';

    const [platform, setPlatform] = useState<string>(data.platform || 'discord');
    const [webhookUrl, setWebhookUrl] = useState<string>(data.webhook_url || '');
    const [telegramToken, setTelegramToken] = useState<string>(data.telegram_token || '');
    const [telegramChatId, setTelegramChatId] = useState<string>(data.telegram_chat_id || '');
    const [msgTemplate, setMsgTemplate] = useState<string>(
        data.message_template || `Alert on ${targetName}: Resource threshold breached. Auto-Guard intervention executed.`
    );
    const [isSending, setIsSending] = useState(false);

    // Đồng bộ lại data prop
    data.action_type = 'send_notification';
    data.platform = platform;
    data.webhook_url = webhookUrl;
    data.telegram_token = telegramToken;
    data.telegram_chat_id = telegramChatId;
    data.message_template = msgTemplate;
    if (connectedProc) {
        data.pid = connectedProc.pid;
        data.proc_name = connectedProc.name;
    }

    const handleTestNotification = async () => {
        setIsSending(true);
        try {
            const payload = {
                action_type: 'send_notification',
                platform,
                webhook_url: webhookUrl,
                telegram_token: telegramToken,
                telegram_chat_id: telegramChatId,
                message_template: msgTemplate,
                proc_name: targetName,
                pid: connectedProc?.pid,
            };
            const res = await httpClient.testNotification(payload);
            if (res.result?.status === 'sent') {
                addLog('ACTION', `[WEBHOOK NOTIFIER] Test message successfully sent via ${platform.toUpperCase()}`);
            } else {
                addLog('ALERT', `[WEBHOOK NOTIFIER] Failed: ${res.result?.reason || 'Check token/webhook configuration'}`);
            }
        } catch (err: any) {
            addLog('ALERT', `[WEBHOOK NOTIFIER] Error sending: ${err.message}`);
        } finally {
            setTimeout(() => setIsSending(false), 500);
        }
    };

    return (
        <div className="relative h-full w-full min-w-[285px] min-h-[220px]">
            {/* Node Resizer */}
            <NodeResizer
                minWidth={275}
                minHeight={210}
                isVisible={selected}
                lineClassName="!border-indigo-500 !border-dashed"
                handleClassName="!w-2.5 !h-2.5 !bg-zinc-950 !border-2 !border-indigo-500 !rounded"
            />

            <div
                className={`h-full w-full rounded-xl bg-zinc-900 border-2 transition-all select-none flex flex-col justify-between overflow-hidden shadow-xl ${
                    getNodeCardBorderClass('END', isExecuting, executionStatus, !!connectedProc, 'border-indigo-500/50 shadow-indigo-950/20')
                }`}
            >
                {/* Input Handle (Left) */}
                <Handle
                    type="target"
                    position={Position.Left}
                    className="!w-3 !h-3 !bg-rose-400 !border-2 !border-zinc-900"
                />

                {/* Header tích hợp Live Tracer Progress & Tier END Badge */}
                <NodeExecutionHeader
                    id={id}
                    tier="END"
                    tierBadge="REMOTE"
                    title="Webhook Notifier"
                    subtitle="REMOTE PHONE ALERT"
                    icon={<BellRing className="w-4 h-4 text-rose-400" />}
                    extraRight={
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            {platform.toUpperCase()}
                        </span>
                    }
                    onDelete={() => deleteNode(id)}
                />

                {/* Target Process Indicator */}
                <div className="px-3 py-1 bg-zinc-950/60 border-b border-zinc-800/60 flex items-center justify-between text-[10px] shrink-0">
                    <span className="text-zinc-500 flex items-center gap-1">
                        <Cpu className="w-3 h-3 text-indigo-400" /> Đối tượng:
                    </span>
                    <span className="font-mono text-indigo-300 font-medium truncate max-w-[170px]">
                        {connectedProc ? `${connectedProc.name} [PID ${connectedProc.pid}]` : 'Toàn hệ thống'}
                    </span>
                </div>

                {/* Body Controls */}
                <div className="p-3 space-y-2 text-xs flex-1 flex flex-col justify-between">
                    {/* Platform Selector */}
                    <div>
                        <label className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
                            Kênh Báo Động:
                        </label>
                        <select
                            value={platform}
                            onChange={(e) => setPlatform(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                            <option value="discord">Discord Webhook</option>
                            <option value="telegram">Telegram Bot (Token &amp; Chat ID)</option>
                            <option value="slack">Slack Incoming Webhook</option>
                        </select>
                    </div>

                    {/* Form tương ứng từng nền tảng */}
                    <div className="space-y-1.5 flex-1 flex flex-col justify-center">
                        {platform === 'telegram' ? (
                            <>
                                <div>
                                    <label className="text-[9px] uppercase font-semibold text-zinc-500 block">
                                        Bot Token:
                                    </label>
                                    <input
                                        type="password"
                                        value={telegramToken}
                                        onChange={(e) => setTelegramToken(e.target.value)}
                                        placeholder="123456:ABC-DEF..."
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] uppercase font-semibold text-zinc-500 block">
                                        Chat ID:
                                    </label>
                                    <input
                                        type="text"
                                        value={telegramChatId}
                                        onChange={(e) => setTelegramChatId(e.target.value)}
                                        placeholder="e.g. 987654321"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </>
                        ) : (
                            <div>
                                <label className="text-[9px] uppercase font-semibold text-zinc-500 block">
                                    Webhook URL:
                                </label>
                                <input
                                    type="text"
                                    value={webhookUrl}
                                    onChange={(e) => setWebhookUrl(e.target.value)}
                                    placeholder="https://discord.com/api/webhooks/..."
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                        )}

                        <div>
                            <label className="text-[9px] uppercase font-semibold text-zinc-500 block">
                                Nội dung Cảnh báo:
                            </label>
                            <input
                                type="text"
                                value={msgTemplate}
                                onChange={(e) => setMsgTemplate(e.target.value)}
                                placeholder="Alert message template"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-zinc-200 text-[11px] focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Test Send Button */}
                    <div className="pt-1.5 border-t border-zinc-800 flex items-center justify-between shrink-0">
                        <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3 text-indigo-400" /> Active
                        </span>
                        <button
                            onClick={handleTestNotification}
                            disabled={isSending}
                            className="px-2.5 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
                        >
                            <Send className="w-3 h-3" /> {isSending ? 'Sending...' : 'Test Send'}
                        </button>
                    </div>
                </div>

                {/* Output Handle (Right) */}
                <Handle
                    type="source"
                    position={Position.Right}
                    className="!w-3 !h-3 !bg-indigo-400 !border-2 !border-zinc-900"
                />
            </div>
        </div>
    );
}

