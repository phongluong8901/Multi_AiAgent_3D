import { useMemo, useCallback } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    addEdge,
    type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Play, Rocket, Plus } from 'lucide-react';
import { MetricTriggerNode } from './custom-nodes/MetricTriggerNode';
import { ServiceActionNode } from './custom-nodes/ServiceActionNode';
import { httpClient } from '../../services/httpClient';
import { useTelemetryStore } from '../../stores/useTelemetryStore';

const initialNodes = [
    {
        id: 'trigger-1',
        type: 'metric_trigger',
        position: { x: 100, y: 120 },
        data: { metric: 'cpu_percent', operator: '>', threshold: 75 },
    },
    {
        id: 'action-1',
        type: 'service_action',
        position: { x: 460, y: 120 },
        data: { action_type: 'spawn_command', command: 'python -c "print(\'Auto-scaling worker started\')"' },
    },
];

const initialEdges = [
    { id: 'e1-2', source: 'trigger-1', target: 'action-1', animated: true },
];

export function CanvasEditor() {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const addLog = useTelemetryStore((s) => s.addLog);

    const nodeTypes = useMemo(
        () => ({
            metric_trigger: MetricTriggerNode,
            service_action: ServiceActionNode,
        }),
        []
    );

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
        [setEdges]
    );

    const buildPayload = () => ({
        workflow_id: 'wf-auto-guard',
        name: 'Auto-Guard Compute Pipeline',
        nodes: nodes.map((n) => ({ id: n.id, type: n.type || 'unknown', data: n.data })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
        interval_sec: 2.0,
    });

    const handleRunOnce = async () => {
        try {
            const res = await httpClient.runWorkflowOnce(buildPayload());
            addLog('ACTION', `Workflow Test Executed: ${JSON.stringify(res.triggered_events)}`);
        } catch (e: any) {
            addLog('ALERT', `Workflow Error: ${e.message}`);
        }
    };

    const handleDeployBackground = async () => {
        try {
            const res = await httpClient.deployWorkflow(buildPayload());
            addLog('INFO', `Deployed workflow '${res.workflow_id}' to Python DAG Background Runner`);
        } catch (e: any) {
            addLog('ALERT', `Deploy failed: ${e.message}`);
        }
    };

    const addTriggerNode = () => {
        const id = `trigger-${Date.now()}`;
        setNodes((nds) => [
            ...nds,
            {
                id,
                type: 'metric_trigger',
                position: { x: 120, y: 260 },
                data: { metric: 'ram_percent', operator: '>', threshold: 85 },
            },
        ]);
    };

    return (
        <div className="h-full flex flex-col">
            {/* Thanh điều khiển kiểu Postman Request Bar */}
            <div className="h-11 bg-zinc-900/90 border-b border-zinc-800 px-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                        DAG ENGINE
                    </span>
                    <span className="text-xs text-zinc-300 font-medium">
                        Drag & connect hardware triggers to automated OS service actions
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={addTriggerNode}
                        className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded flex items-center gap-1"
                    >
                        <Plus className="w-3.5 h-3.5" /> Add RAM Trigger
                    </button>
                    <button
                        onClick={handleRunOnce}
                        className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-500/30 text-xs rounded flex items-center gap-1.5"
                    >
                        <Play className="w-3.5 h-3.5" /> Test Run
                    </button>
                    <button
                        onClick={handleDeployBackground}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded flex items-center gap-1.5"
                    >
                        <Rocket className="w-3.5 h-3.5" /> Deploy Background Loop
                    </button>
                </div>
            </div>

            {/* Không gian kéo thả Node n8n */}
            <div className="flex-1 bg-zinc-950">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    fitView
                >
                    <Background color="#27272a" gap={18} />
                    <Controls className="!bg-zinc-900 !border-zinc-800 !fill-zinc-300" />
                </ReactFlow>
            </div>
        </div>
    );
}