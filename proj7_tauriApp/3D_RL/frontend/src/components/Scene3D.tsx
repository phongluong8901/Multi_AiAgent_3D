/**
 * ==============================================================================
 * KHUNG NHÌN 3D CHÍNH CỦA ĐẠI ĐÔ THỊ (SCENE 3D VIEWPORT)
 * ==============================================================================
 * Sử dụng Three.js / @react-three/fiber và @react-three/drei:
 * 1. FollowCamera: Điều khiển camera POV theo góc nhìn thứ ba theo chân Bé Bo hoặc Bé Bi,
 *    hoặc chuyển sang chế độ Toàn cảnh (Overview) tự do xoay OrbitControls.
 * 2. DayNightAtmosphere: Mô phỏng ánh sáng mặt trời theo chu kỳ ngày/đêm (dawn, day, sunset, night),
 *    đèn đường đô thị rực rỡ và bầu trời động.
 * 3. NavigationGuide & WaypointGuide: Vẽ đường ray dẫn hướng tới mục tiêu và lộ trình Waypoints A*.
 * 4. FloorClickTarget: Bắt sự kiện click chuột trên mặt sàn 100x100 để Người Hướng Dẫn
 *    chỉ định tọa độ di chuyển tức thì cho bé.
 * 5. Các mô hình 3D thực thể: Robot (Bé Bo & Bé Bi), Goal, Obstacles, CityMap.
 */

import { useRef, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Grid, Environment } from "@react-three/drei";
import Robot from "./Robot";
import Goal from "./Goal";
import Obstacles from "./Obstacles";
import { useTrainingStore } from "../stores/useTrainingStore";
import type { CameraMode } from "../types";

// ==========================================
// 1. CAMERA THEO CHÂN (Follow Camera POV)
// ==========================================
function FollowCamera({
    cameraMode,
    robot,
    robot2,
}: {
    cameraMode: CameraMode;
    robot: number[];
    robot2: number[];
}) {
    const targetRef = useRef(new THREE.Vector3(30, 1.0, 30));

    useFrame((state, delta) => {
        if (cameraMode === "overview") return;

        const targetAgent = cameraMode === "follow_bo" ? robot : robot2;
        if (!targetAgent || targetAgent.length < 2) return;

        const tx = targetAgent[0];
        const tz = targetAgent[1];

        // Tâm điểm nhìn của camera: hướng vào phần thân của bé
        targetRef.current.x = THREE.MathUtils.damp(targetRef.current.x, tx, 8, delta);
        targetRef.current.y = THREE.MathUtils.damp(targetRef.current.y, 1.1, 8, delta);
        targetRef.current.z = THREE.MathUtils.damp(targetRef.current.z, tz, 8, delta);

        // Vị trí camera: Đặt lùi lại 4.8m và nâng cao 3.2m tạo góc nhìn Third-Person POV mượt mà
        const desiredCamX = targetRef.current.x - 4.5;
        const desiredCamY = 3.4;
        const desiredCamZ = targetRef.current.z - 4.5;

        state.camera.position.x = THREE.MathUtils.damp(state.camera.position.x, desiredCamX, 6, delta);
        state.camera.position.y = THREE.MathUtils.damp(state.camera.position.y, desiredCamY, 6, delta);
        state.camera.position.z = THREE.MathUtils.damp(state.camera.position.z, desiredCamZ, 6, delta);

        state.camera.lookAt(targetRef.current);
    });

    return null;
}

// ==========================================
// 2. TIA SÁNG VÀ LIÊN KẾT BẢN ĐỒ
// ==========================================
function NavigationGuide({ start, end }: { start: number[]; end: number[] }) {
    if (!start || !end || start.length < 2 || end.length < 2) return null;
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const dist = Math.hypot(dx, dz);
    if (dist < 0.4) return null;

    const midX = (start[0] + end[0]) / 2;
    const midZ = (start[1] + end[1]) / 2;
    const angle = Math.atan2(dx, dz);

    return (
        <group position={[midX, 0.03, midZ]} rotation={[0, angle, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.07, dist]} />
                <meshBasicMaterial color="#38bdf8" transparent opacity={0.35} />
            </mesh>
        </group>
    );
}

function PeerLink({ start, end, active }: { start: number[]; end: number[]; active: boolean }) {
    if (!active || !start || !end || start.length < 2 || end.length < 2) return null;
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const dist = Math.hypot(dx, dz);
    if (dist > 3.0 || dist < 0.1) return null;

    const midX = (start[0] + end[0]) / 2;
    const midZ = (start[1] + end[1]) / 2;
    const angle = Math.atan2(dx, dz);

    return (
        <group position={[midX, 0.05, midZ]} rotation={[0, angle, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.12, dist]} />
                <meshBasicMaterial color="#ec4899" transparent opacity={0.5} />
            </mesh>
        </group>
    );
}

function TargetBeacon({ position }: { position: [number, number] }) {
    return (
        <group position={[position[0], 0, position[1]]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
                <ringGeometry args={[0.6, 0.8, 32]} />
                <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} />
            </mesh>
            <mesh position={[0, 1.2, 0]}>
                <cylinderGeometry args={[0.06, 0.06, 2.4, 16]} />
                <meshBasicMaterial color="#38bdf8" transparent opacity={0.7} />
            </mesh>
            <mesh position={[0, 2.4, 0]}>
                <octahedronGeometry args={[0.25, 0]} />
                <meshStandardMaterial
                    color="#38bdf8"
                    emissive="#0284c7"
                    emissiveIntensity={0.8}
                />
            </mesh>
        </group>
    );
}

function BoundaryWalls() {
    const wallColor = "#334155";
    return (
        <group>
            <mesh position={[50, 0.6, 0]} castShadow receiveShadow>
                <boxGeometry args={[100.4, 1.2, 0.4]} />
                <meshStandardMaterial color={wallColor} roughness={0.6} />
            </mesh>
            <mesh position={[50, 0.6, 100]} castShadow receiveShadow>
                <boxGeometry args={[100.4, 1.2, 0.4]} />
                <meshStandardMaterial color={wallColor} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.6, 50]} castShadow receiveShadow>
                <boxGeometry args={[0.4, 1.2, 100.4]} />
                <meshStandardMaterial color={wallColor} roughness={0.6} />
            </mesh>
            <mesh position={[100, 0.6, 50]} castShadow receiveShadow>
                <boxGeometry args={[0.4, 1.2, 100.4]} />
                <meshStandardMaterial color={wallColor} roughness={0.6} />
            </mesh>
        </group>
    );
}

// ==========================================
// 3. MAIN SCENE 3D COMPONENT
// ==========================================
export default function Scene3D() {
    const robot = useTrainingStore((s) => s.robot);
    const robot2 = useTrainingStore((s) => s.robot2);
    const peerDist = useTrainingStore((s) => s.peerDist);
    const nearPeer = useTrainingStore((s) => s.nearPeer);
    const currentGoalPos = useTrainingStore((s) => s.currentGoalPos);
    const isTeacherMode = useTrainingStore((s) => s.isTeacherMode);
    const isAutonomousLife = useTrainingStore((s) => s.isAutonomousLife);
    const customMarkerPos = useTrainingStore((s) => s.customMarkerPos);
    const currentGoalName = useTrainingStore((s) => s.currentGoalName);
    const sendClickTarget = useTrainingStore((s) => s.sendClickTarget);
    const ateFood = useTrainingStore((s) => s.ateFood);
    const drankWater = useTrainingStore((s) => s.drankWater);
    const isResting = useTrainingStore((s) => s.isResting);
    const collided = useTrainingStore((s) => s.collided);
    const collided2 = useTrainingStore((s) => s.collided2);

    const foodTimeLeft = useTrainingStore((s) => s.foodTimeLeft);
    const waterTimeLeft = useTrainingStore((s) => s.waterTimeLeft);
    const food = useTrainingStore((s) => s.food);
    const water = useTrainingStore((s) => s.water);
    const goal = useTrainingStore((s) => s.goal);

    // Tiến trình phát triển nhận thức & Não bộ RL
    const cognitiveState = useTrainingStore((s) => s.cognitiveState);
    const cognitiveState2 = useTrainingStore((s) => s.cognitiveState2);
    const currentThought = useTrainingStore((s) => s.currentThought);
    const currentThought2 = useTrainingStore((s) => s.currentThought2);

    // Chu kỳ Ngày / Đêm & Chế độ Camera
    const timeOfDay = useTrainingStore((s) => s.timeOfDay);
    const dayPhase = useTrainingStore((s) => s.dayPhase);
    const cameraMode = useTrainingStore((s) => s.cameraMode);
    const setCameraMode = useTrainingStore((s) => s.setCameraMode);

    const isDragging = useRef(false);

    // Phím tắt bàn phím: 1 (Toàn cảnh), 2 (Theo chân Bo), 3 (Theo chân Bi)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === "1") setCameraMode("overview");
            else if (e.key === "2") setCameraMode("follow_bo");
            else if (e.key === "3") setCameraMode("follow_bi");
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [setCameraMode]);

    const handleFloorClick = (e: ThreeEvent<MouseEvent>) => {
        if (isDragging.current) return;
        const x = Math.min(58.5, Math.max(1.5, e.point.x));
        const z = Math.min(58.5, Math.max(1.5, e.point.z));
        sendClickTarget(x, z, "Điểm chỉ định trong thành phố 60x60");
    };

    // Định dạng đồng hồ đô thị
    const hours = Math.floor(timeOfDay);
    const minutes = Math.floor((timeOfDay - hours) * 60);
    const formattedClock = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;

    // Quỹ đạo ánh sáng Mặt Trời & Mặt Trăng
    const cycleAngle = ((timeOfDay - 6.0) / 24.0) * Math.PI * 2;
    const sunX = 30 + Math.cos(cycleAngle) * 45;
    const sunY = Math.max(8, Math.sin(cycleAngle) * 52);
    const sunZ = 30 + Math.sin(cycleAngle) * 20;

    let dirLightColor = "#fff8eb";
    let dirLightIntensity = 1.6;
    let ambientIntensity = 0.65;
    let phaseLabel = "BAN NGÀY";
    let phaseBadgeBg = "bg-amber-500/20 text-amber-300 border-amber-500/40";

    if (dayPhase === "dawn") {
        dirLightColor = "#fed7aa";
        dirLightIntensity = 1.1;
        ambientIntensity = 0.48;
        phaseLabel = "BÌNH MINH";
        phaseBadgeBg = "bg-orange-500/20 text-orange-300 border-orange-500/40";
    } else if (dayPhase === "sunset") {
        dirLightColor = "#f97316";
        dirLightIntensity = 1.35;
        ambientIntensity = 0.42;
        phaseLabel = "HOÀNG HÔN";
        phaseBadgeBg = "bg-rose-500/20 text-rose-300 border-rose-500/40";
    } else if (dayPhase === "night") {
        dirLightColor = "#60a5fa";
        dirLightIntensity = 0.55;
        ambientIntensity = 0.22;
        phaseLabel = "BAN ĐÊM";
        phaseBadgeBg = "bg-blue-500/20 text-blue-300 border-blue-500/40";
    }

    const stageBo = cognitiveState?.stage_info;
    const stageBi = cognitiveState2?.stage_info;
    const competenceBo = Math.round((cognitiveState?.competence ?? 0.2) * 100);
    const competenceBi = Math.round((cognitiveState2?.competence ?? 0.2) * 100);
    const synapticUpdatesBo = cognitiveState?.online_learner?.total_online_updates ?? 0;
    const thought1 = currentThought || "";
    const thought2 = currentThought2 || "";
    const isReflecting = thought1.includes("[ĐÚC KẾT") || thought2.includes("[ĐÚC KẾT");
    const reflectionMsg = thought1.includes("[ĐÚC KẾT") ? thought1 : thought2;

    return (
        <div className="relative w-full h-full rounded-xl overflow-hidden bg-slate-900 border border-slate-700">
            {/* Chú thích bản đồ thành phố ở góc trên bên trái */}
            <div className="absolute top-3 left-3 z-10 bg-slate-950/90 backdrop-blur px-3.5 py-2 rounded-lg border border-slate-800 text-xs space-y-1 pointer-events-none shadow-xl">
                <div className="font-bold text-slate-100 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                        BẢN ĐỒ ĐẠI ĐÔ THỊ ĐA TÁC TỬ (100m x 100m)
                    </span>
                    <span className="text-[10px] text-sky-400 bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-800 font-mono">
                        CLICK ĐƯỜNG ĐỂ CHỈ HƯỚNG
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-slate-300 text-[11px]">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                        Bé Bo (Áo xanh)
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-pink-500 inline-block" />
                        Bé Bi (Áo hồng)
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                        Bếp Ăn [{food?.[0] != null ? food[0].toFixed(0) : "46"}, {food?.[1] != null ? food[1].toFixed(0) : "44"}] ({(foodTimeLeft ?? 60).toFixed(0)}s)
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                        Vòi Nước [{water?.[0] != null ? water[0].toFixed(0) : "39"}, {water?.[1] != null ? water[1].toFixed(0) : "8"}] ({(waterTimeLeft ?? 75).toFixed(0)}s)
                    </span>
                    <span className="flex items-center gap-1.5 col-span-2">
                        <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
                        Mục tiêu [{goal?.[0] != null ? goal[0].toFixed(0) : "10"}, {goal?.[1] != null ? goal[1].toFixed(0) : "52"}]
                    </span>
                </div>
            </div>

            {/* Khối Trung Tâm: Đồng Hồ Chu Kỳ Ngày/Đêm & Bảng Tiến Trình Phát Triển Trí Tuệ */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5 pointer-events-none">
                {/* Đồng hồ đô thị sinh học */}
                <div className="bg-slate-950/92 backdrop-blur px-3.5 py-1 rounded-full border border-slate-700/80 shadow-2xl flex items-center gap-2.5 text-xs font-mono font-bold">
                    <span
                        className={`px-2 py-0.5 rounded-full text-[10px] border flex items-center gap-1.5 ${phaseBadgeBg}`}
                    >
                        {dayPhase === "night" ? (
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
                            </svg>
                        ) : dayPhase === "sunset" ? (
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 10V2" />
                                <path d="m4.93 10.93 1.41-1.41" />
                                <path d="M2 18h20" />
                                <path d="M20 10h2" />
                                <path d="m19.07 10.93-1.41-1.41" />
                                <path d="M22 22H2" />
                            </svg>
                        ) : (
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="4" />
                                <path d="M12 2v2" />
                                <path d="M12 20v2" />
                                <path d="m4.93 4.93 1.41 1.41" />
                                <path d="m17.66 17.66 1.41 1.41" />
                                <path d="M2 12h2" />
                                <path d="M20 12h2" />
                            </svg>
                        )}
                        [{phaseLabel}]
                    </span>
                    <span className="text-slate-100 tracking-wider text-[13px]">{formattedClock}</span>
                </div>

                {/* Bảng Tiến Trình Phát Triển Trí Tuệ & Nơ-ron Residual RL */}
                <div className="bg-slate-950/92 backdrop-blur px-4 py-1.5 rounded-full border border-slate-700/80 shadow-2xl flex items-center gap-3.5 text-xs font-mono font-bold">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-blue-400">BO: {stageBo?.stage_name ?? "Chập Chững"}</span>
                        <span className="text-[10px] text-sky-400 bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-800 font-mono">
                            RRL: {competenceBo}% ({synapticUpdatesBo} Synapses)
                        </span>
                    </div>
                    <span className="text-slate-600">|</span>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-pink-500" />
                        <span className="text-pink-400">BI: {stageBi?.stage_name ?? "Chập Chững"}</span>
                        <span className="text-[10px] text-pink-400 bg-pink-950/80 px-1.5 py-0.5 rounded border border-pink-800 font-mono">
                            RRL: {competenceBi}%
                        </span>
                    </div>
                </div>

                {/* Banner Tự Đúc Kết Bài Học Cuộc Sống khi có khoảnh khắc thức tỉnh */}
                {isReflecting && (
                    <div className="px-4 py-1.5 rounded-full bg-emerald-950/95 border border-emerald-400 text-emerald-200 text-xs font-mono font-semibold shadow-2xl flex items-center gap-2 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping" />
                        {reflectionMsg}
                    </div>
                )}
            </div>

            {/* Trạng thái hoạt động thời gian thực ở góc trên bên phải */}
            <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5 pointer-events-none">
                {nearPeer && (
                    <div className="px-3 py-1.5 rounded-lg bg-pink-600/90 border border-pink-400 text-white text-xs font-mono font-bold shadow-lg flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                        [GIAO TIẾP XÃ HỘI: BO & BI ĐANG Ở CẠNH NHAU ({peerDist}m)]
                    </div>
                )}
                {isAutonomousLife && (
                    <div className="px-3 py-1.5 rounded-lg bg-emerald-600/90 border border-emerald-400 text-white text-xs font-mono font-bold shadow-lg flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                        [TỰ HÀNH ĐÔ THỊ: {currentGoalName.toUpperCase()}]
                    </div>
                )}
                {isTeacherMode && (
                    <div className="px-3 py-1.5 rounded-lg bg-indigo-600/95 border border-indigo-300 text-white text-xs font-mono font-bold shadow-md">
                        [ĐANG LÁI: DÙNG PHÍM W, A, S, D]
                    </div>
                )}
                {(collided || collided2) && (
                    <div className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-mono font-bold shadow-md animate-pulse">
                        [CẢNH BÁO VA CHẠM] BÉ VỪA VA ĐỤNG TÒA NHÀ / XE CỘ ĐÔ THỊ!
                    </div>
                )}
                {ateFood && (
                    <div className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 text-xs font-mono font-semibold shadow">
                        [SỰ KIỆN] BÉ ĐANG DÙNG BỮA TẠI NHÀ HÀNG (+KCAL GIẢM ĐÓI)
                    </div>
                )}
                {drankWater && (
                    <div className="px-2.5 py-1 rounded bg-cyan-400 text-slate-950 text-xs font-mono font-semibold shadow">
                        [SỰ KIỆN] BÉ ĐANG UỐNG NƯỚC GIẢI KHÁT BÊN HỒ BƠI
                    </div>
                )}
                {isResting && (
                    <div className="px-2.5 py-1 rounded bg-indigo-500 text-white text-xs font-mono font-semibold shadow">
                        [SỰ KIỆN] BÉ ĐANG NGHỈ NGƠI TRONG PHÒNG NGỦ VILLA (HỒI PHỤC)
                    </div>
                )}
            </div>

            {/* THANH ĐIỀU KHIỂN CHẾ ĐỘ CAMERA (Follow Cam POV Toolbar) */}
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 bg-slate-950/92 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700/80 shadow-2xl">
                <button
                    onClick={() => setCameraMode("overview")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                        cameraMode === "overview"
                            ? "bg-slate-700 text-white shadow-md border border-slate-500"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                    }`}
                >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                        <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                        <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                        <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                    </svg>
                    [TOÀN CẢNH] (1)
                </button>

                <button
                    onClick={() => setCameraMode("follow_bo")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                        cameraMode === "follow_bo"
                            ? "bg-blue-600 text-white shadow-md border border-blue-400"
                            : "text-slate-400 hover:text-blue-300 hover:bg-slate-800/60"
                    }`}
                >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                    [THEO CHÂN BO] (2)
                </button>

                <button
                    onClick={() => setCameraMode("follow_bi")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                        cameraMode === "follow_bi"
                            ? "bg-pink-600 text-white shadow-md border border-pink-400"
                            : "text-slate-400 hover:text-pink-300 hover:bg-slate-800/60"
                    }`}
                >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                    [THEO CHÂN BI] (3)
                </button>
            </div>

            {/* Banner hướng dẫn nhanh ở đáy màn hình 3D */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 bg-slate-950/80 backdrop-blur px-4 py-1 rounded-full border border-slate-700/80 text-[11px] text-slate-300 font-medium pointer-events-none shadow-lg">
                Phím 1/2/3 để đổi góc Camera • Click chuột lên đường phố để cắm cờ • R Khen • P Nhắc nhở
            </div>

            <Canvas
                shadows
                camera={{ position: [115, 95, 115], fov: 46 }}
                onPointerDown={() => {
                    isDragging.current = false;
                }}
                onPointerMove={() => {
                    isDragging.current = true;
                }}
            >
                {/* Chiếu sáng mô phỏng ngày / đêm động học */}
                <ambientLight intensity={ambientIntensity} />
                <directionalLight
                    position={[sunX, sunY, sunZ]}
                    color={dirLightColor}
                    intensity={dirLightIntensity}
                    castShadow
                    shadow-mapSize={[2048, 2048]}
                />

                <Grid
                    infiniteGrid={false}
                    position={[50, 0.01, 50]}
                    args={[100, 100]}
                    cellSize={1}
                    sectionSize={10}
                    fadeDistance={180}
                    cellColor="#334155"
                    sectionColor="#64748b"
                />

                {/* Mặt nền đại đô thị 100x100 */}
                <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[50, 0, 50]}
                    receiveShadow
                    onClick={handleFloorClick}
                >
                    <planeGeometry args={[100, 100]} />
                    <meshStandardMaterial color="#0f172a" roughness={0.7} />
                </mesh>

                {/* Tường bao quanh đô thị 100x100 */}
                <BoundaryWalls />

                {/* Toàn bộ kiến trúc đô thị, nhà cửa, xe cộ, công viên, hồ bơi */}
                <Obstacles />

                {/* Cọc tiêu điểm chỉ định mục tiêu của Teacher nếu có */}
                {customMarkerPos && <TargetBeacon position={customMarkerPos} />}

                {/* Tia dẫn hướng tới mục tiêu */}
                <NavigationGuide start={robot} end={currentGoalPos} />

                {/* Liên kết xã hội khi hai bé ở gần nhau */}
                <PeerLink start={robot} end={robot2} active={nearPeer} />

                {/* Cả hai bé cùng sinh sống trong thế giới thành phố 3D */}
                <Robot agentId="bo" />
                <Robot agentId="bi" />

                <Goal />

                {/* Bộ điều khiển góc nhìn tự do khi ở chế độ Toàn Cảnh */}
                <OrbitControls
                    enabled={cameraMode === "overview"}
                    makeDefault
                    target={[50, 0, 50]}
                    maxPolarAngle={Math.PI / 2.05}
                    maxDistance={220}
                    minDistance={6}
                />

                {/* Bộ điều khiển bám theo nhân vật người thứ ba khi ở chế độ Theo Chân */}
                <FollowCamera cameraMode={cameraMode} robot={robot} robot2={robot2} />

                <Environment preset="city" />
            </Canvas>
        </div>
    );
}
