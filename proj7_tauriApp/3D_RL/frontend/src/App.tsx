import Scene3D from "./components/Scene3D";
import ControlPanel from "./components/ControlPanel";
import InternalMonitor from "./components/InternalMonitor";
import TeacherConsole from "./components/TeacherConsole";
import StatusBar from "./components/StatusBar";
import LogPanel from "./components/LogPanel";
import { useWebSocket } from "./hooks/useWebSocket";
import { useTeacherInput } from "./hooks/useTeacherInput";

function App() {
    useWebSocket();
    useTeacherInput();

    return (
        <div className="h-screen bg-slate-950 text-white p-3 flex flex-col gap-3 overflow-hidden select-none">
            {/* Thanh tiêu đề chính */}
            <header className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                        Mô Phỏng AI Trẻ Em (AI Child Simulation)
                    </h1>
                    <span className="px-2.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300">
                        BẢN ĐỒ MỞ RỘNG 20m x 20m • NỘI TẠI & HƯỚNG DẪN
                    </span>
                </div>
                <StatusBar />
            </header>

            {/* Khung chia 2 cột: Thế giới 3D & Bảng điều khiển */}
            <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
                {/* Khung nhìn thế giới 3D */}
                <div className="col-span-7 lg:col-span-8 min-h-0 h-full">
                    <Scene3D />
                </div>

                {/* Cột thông số nội tại và bảng hướng dẫn bên phải */}
                <div className="col-span-5 lg:col-span-4 flex flex-col gap-3 min-h-0 h-full overflow-y-auto pr-1">
                    <InternalMonitor />
                    <TeacherConsole />
                    <ControlPanel />
                    <LogPanel />
                </div>
            </div>
        </div>
    );
}

export default App;
