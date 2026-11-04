import { useEffect, useState } from 'react';
import { Cpu, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { useTelemetryStore } from '../../stores/useTelemetryStore';

export function AppSplashScreen({ onReady }: { onReady: () => void }) {
    const isConnected = useTelemetryStore((s) => s.connected);
    const [step, setStep] = useState(1);

    useEffect(() => {
        const timer1 = setTimeout(() => setStep(2), 250);
        const timer2 = setTimeout(() => setStep(3), 550);
        const timer3 = setTimeout(() => {
            onReady();
        }, 850);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
        };
    }, [onReady]);

    // If socket connects faster, ready up smoothly
    useEffect(() => {
        if (isConnected && step >= 2) {
            const t = setTimeout(() => onReady(), 200);
            return () => clearTimeout(t);
        }
    }, [isConnected, step, onReady]);

    return (
        <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center select-none z-[99999]">
            {/* Ambient background glow */}
            <div className="absolute w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="relative flex flex-col items-center max-w-sm w-full px-6">
                {/* Logo with pulsing ring */}
                <div className="relative mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-xl shadow-black/60">
                        <Cpu className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div className="absolute -inset-1 rounded-2xl bg-emerald-500/20 blur-sm -z-10 animate-pulse" />
                </div>

                <h1 className="text-lg font-bold text-zinc-100 tracking-wide mb-1">Compute Studio</h1>
                <p className="text-xs text-zinc-500 mb-6 font-mono">v0.1.0 // Local Compute & Workflow Orchestrator</p>

                {/* Status checklist */}
                <div className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3.5 space-y-2.5 backdrop-blur-sm shadow-lg mb-6">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400 flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-zinc-500" /> UI Engine Mounted
                        </span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>

                    <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400 flex items-center gap-2">
                            <Cpu className="w-3.5 h-3.5 text-zinc-500" /> Local Python Sidecar
                        </span>
                        {step >= 2 ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                            <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" />
                        )}
                    </div>

                    <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1 mr-1" /> Telemetry Stream
                        </span>
                        {step >= 3 || isConnected ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                            <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" />
                        )}
                    </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                    <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
                        style={{ width: `${(step / 3) * 100}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

