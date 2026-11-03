import { Workflow, Cpu, PlusCircle } from 'lucide-react';
import { useWorkbenchStore } from '../../stores/useWorkbenchStore';

export function ActivityBar() {
    const { activeSection, setActiveSection, openTab } = useWorkbenchStore();

    return (
        <aside className="w-12 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-3 justify-between select-none shrink-0">
            <div className="flex flex-col gap-3">
                <button
                    onClick={() => {
                        setActiveSection('workflows');
                        openTab({ id: 'tab-canvas-1', title: 'Auto-Guard GPU Pipeline', type: 'n8n-canvas' });
                    }}
                    title="n8n Compute Workflows"
                    className={`p-2.5 rounded-lg transition-colors ${activeSection === 'workflows'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                        }`}
                >
                    <Workflow className="w-5 h-5" />
                </button>

                <button
                    onClick={() => {
                        setActiveSection('processes');
                        openTab({ id: 'tab-proc-1', title: 'OS Process & Port Inspector', type: 'service-inspector' });
                    }}
                    title="Postman Service & Process Inspector"
                    className={`p-2.5 rounded-lg transition-colors ${activeSection === 'processes'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                        }`}
                >
                    <Cpu className="w-5 h-5" />
                </button>
            </div>

            <button
                onClick={() =>
                    openTab({
                        id: `canvas-${Date.now()}`,
                        title: `Workflow #${Math.floor(Math.random() * 90 + 10)}`,
                        type: 'n8n-canvas',
                    })
                }
                title="New Workflow Tab"
                className="p-2 text-zinc-500 hover:text-emerald-400 transition-colors"
            >
                <PlusCircle className="w-5 h-5" />
            </button>
        </aside>
    );
}