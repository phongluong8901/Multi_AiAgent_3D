/**
 * ==============================================================================
 * COMPONENT GỐC GIAO DIỆN (APPLICATION ROOT COMPONENT)
 * ==============================================================================
 * Bố cục tổng thể của ứng dụng AI Child Simulation:
 * 1. Hooks Vòng Đời:
 *    - useWebSocket(): Duy trì kết nối thời gian thực 2 chiều với Backend Python.
 *    - useTeacherInput(): Lắng nghe sự kiện bàn phím WASD điều khiển trực tiếp.
 * 2. Header & StatusBar:
 *    - Tên hệ thống, thông số bản đồ và thanh trạng thái hoạt động.
 * 3. Bố Cục Chia 2 Cột Linh Hoạt (Grid 12 Cột):
 *    - Cột Trái (7-8 cột): Khung nhìn không gian 3D tương tác (Scene3D).
 *    - Cột Phải (4-5 cột): Hệ thống bảng điều khiển xếp dọc cuộn linh hoạt:
 *      + NeuralCircuitDashboard: Vi mạch nơ-ron, ICM, PER, Social RL & Giấc mộng.
 *      + InternalMonitor: Chỉ số sinh lý Kcal, mệt mỏi, 8 động lực nội tại, sương mù.
 *      + TeacherConsole: Bảng điều khiển Người Hướng Dẫn (Khen/Phạt, WASD, Chăm sóc).
 *      + ControlPanel: Quản lý mô hình PPO, Behavioral Cloning, Tabula Rasa.
 *      + LogPanel: Nhật ký hoạt động kỹ thuật thời gian thực.
 */

import Scene3D from "./components/Scene3D";
import ControlPanel from "./components/ControlPanel";
import InternalMonitor from "./components/InternalMonitor";
import NeuralCircuitDashboard from "./components/NeuralCircuitDashboard";
import TeacherConsole from "./components/TeacherConsole";
import StatusBar from "./components/StatusBar";
import LogPanel from "./components/LogPanel";
import { useWebSocket } from "./hooks/useWebSocket";
import { useTeacherInput } from "./hooks/useTeacherInput";

function App() {
    // Kích hoạt lắng nghe dữ liệu WebSocket và bàn phím WASD
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
                    <span className="px-2.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300">
                        BẢN ĐỒ THÀNH PHỐ 100m x 100m • VI MẠCH NƠ-RON & TỰ HỌC RL
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

                {/* Cột thông số nội tại, vi mạch nơ-ron và bảng hướng dẫn bên phải */}
                <div className="col-span-5 lg:col-span-4 flex flex-col gap-3 min-h-0 h-full overflow-y-auto pr-1">
                    <NeuralCircuitDashboard />
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
