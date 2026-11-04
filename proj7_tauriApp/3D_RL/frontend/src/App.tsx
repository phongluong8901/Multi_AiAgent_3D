import Scene3D from "./components/Scene3D";
import ControlPanel from "./components/ControlPanel";
import LogPanel from "./components/LogPanel";
import { useWebSocket } from "./hooks/useWebSocket";

function App() {
  useWebSocket();

  return (
    <div className="h-screen bg-slate-950 text-white p-4 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          RL Obstacle Avoidance — 3D Viewer
        </h1>
        <div className="text-sm text-slate-400">
          Local + Colab compatible
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">
        {/* 3D Scene */}
        <div className="col-span-8 min-h-0">
          <Scene3D />
        </div>

        {/* Right panel */}
        <div className="col-span-4 flex flex-col gap-4 min-h-0">
          <ControlPanel />
          <LogPanel />
        </div>
      </div>
    </div>
  );
}

export default App;