/**
 * ==============================================================================
 * COMPONENT MÔ HÌNH 3D CỦA BÉ (ROBOT / CHILD 3D AVATAR)
 * ==============================================================================
 * Thể hiện nhân vật Bé Bo (agentId="bo", màu xanh dương) hoặc Bé Bi (agentId="bi", màu hồng):
 * 1. Nội suy tọa độ chuyển động 60 FPS mượt mà:
 *    - Sử dụng THREE.MathUtils.damp() để di chuyển liên tục từ vị trí hiện tại tới đích đến.
 *    - Tránh hiện tượng giật giật (jitter) khi nhận gói tin WebSocket theo từng nhịp 22-25 Hz.
 * 2. Động lực học bước đi (Procedural Walking Animation):
 *    - Nhún nhảy cơ thể theo nhịp bước chân (Bobbing effect).
 *    - Xoay hướng mặt (Yaw rotation) theo góc vector vận tốc đang di chuyển.
 * 3. Hiệu ứng trạng thái cảm xúc:
 *    - Màu đỏ nhấp nháy khi bị va chạm đau (collided).
 *    - Nằm ngang thư giãn trên giường khi nghỉ ngơi (isResting).
 *    - Bật đèn pin nhỏ soi đường khi đêm xuống (isNight).
 * 4. Thẻ thông tin HTML 3D nổi trên đầu (Billboard Badge):
 *    - Hiển thị tên bé, mục tiêu hiện tại và bong bóng suy nghĩ (thought bubble).
 */

import { useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useTrainingStore } from "../stores/useTrainingStore";
import type { AgentId } from "../types";

interface RobotProps {
    agentId?: AgentId;
}

export default function Robot({ agentId = "bo" }: RobotProps) {
    const isBo = agentId === "bo";

    // Chọn dữ liệu theo Agent
    const pos = useTrainingStore((s) => (isBo ? s.robot : s.robot2));
    const collided = useTrainingStore((s) => (isBo ? s.collided : s.collided2));
    const isResting = useTrainingStore((s) => (isBo ? s.isResting : s.isResting2));
    const currentThought = useTrainingStore((s) => (isBo ? s.currentThought : s.currentThought2));
    const currentGoalName = useTrainingStore((s) => (isBo ? s.currentGoalName : s.currentGoalName2));
    const drives = useTrainingStore((s) => (isBo ? s.drivesState.drives : s.drivesState2.drives));
    const energyRatio = useTrainingStore((s) =>
        isBo ? s.energyState.energy_ratio : s.energyState2.energy_ratio
    );
    const cognitiveState = useTrainingStore((s) => (isBo ? s.cognitiveState : s.cognitiveState2));
    const isNight = useTrainingStore((s) => s.isNight);

    const name = isBo ? "Bé Bo" : "Bé Bi";
    const defaultColor = isBo ? "#3b82f6" : "#ec4899"; // Xanh dương cho Bo, Hồng san hô cho Bi
    const hairColor = isBo ? "#451a03" : "#78350f";

    // Three.js References cho chuyển động mượt mà 60 FPS
    const groupRef = useRef<THREE.Group>(null);
    const bodyRef = useRef<THREE.Group>(null);

    const initX = (pos && pos[0]) || (isBo ? 2.5 : 4.0);
    const initZ = (pos && pos[1]) || (isBo ? 2.5 : 4.0);
    const targetPos = useRef(new THREE.Vector3(initX, 0, initZ));
    const previousPos = useRef(new THREE.Vector3(initX, 0, initZ));
    const isMoving = useRef(false);

    // Cập nhật tọa độ mục tiêu mỗi khi có gói tin WebSocket mà KHÔNG làm Fiber snap tọa độ
    useEffect(() => {
        if (pos && pos.length >= 2) {
            targetPos.current.set(pos[0], 0, pos[1]);
        }
    }, [pos && pos[0], pos && pos[1]]);

    // Đặt vị trí ban đầu một lần khi mount
    useEffect(() => {
        if (groupRef.current) {
            groupRef.current.position.set(initX, 0, initZ);
            previousPos.current.set(initX, 0, initZ);
        }
    }, []);

    // Vòng lặp Render 60 FPS - Nội suy chuyển động liên tục không phụ thuộc FPS (Exponential Decay)
    useFrame((state, delta) => {
        if (!groupRef.current) return;

        const current = groupRef.current.position;
        const target = targetPos.current;

        // Tính khoảng cách cần dịch chuyển
        const dist = Math.hypot(target.x - current.x, target.z - current.z);

        // Nếu khoảng cách quá lớn (vừa Reset màn chơi), nhảy tức thì
        if (dist > 6.0) {
            current.x = target.x;
            current.z = target.z;
            previousPos.current.copy(current);
            isMoving.current = false;
        } else {
            isMoving.current = dist > 0.015 && !isResting;
            const decay = 1.0 - Math.exp(-delta * 14);
            current.x = THREE.MathUtils.lerp(current.x, target.x, decay);
            current.z = THREE.MathUtils.lerp(current.z, target.z, decay);
        }

        // Xoay hướng mặt mượt mà theo hướng di chuyển thực tế
        const dx = current.x - previousPos.current.x;
        const dz = current.z - previousPos.current.z;
        if (Math.hypot(dx, dz) > 0.001 && !isResting) {
            const targetAngle = Math.atan2(dx, dz);
            let diff = targetAngle - groupRef.current.rotation.y;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            const rotDecay = 1.0 - Math.exp(-delta * 16);
            groupRef.current.rotation.y += diff * rotDecay;
        }
        previousPos.current.copy(current);

        // Hiệu ứng nhấp nhô bước chân khi đi (Bobbing animation)
        if (bodyRef.current) {
            if (isMoving.current) {
                const stepCycle = state.clock.elapsedTime * (isBo ? 14 : 15);
                bodyRef.current.position.y = Math.abs(Math.sin(stepCycle)) * 0.07;
                bodyRef.current.rotation.z = Math.sin(stepCycle * 0.5) * 0.05;
            } else if (isResting) {
                bodyRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.02 - 0.15;
                bodyRef.current.rotation.z = 0;
            } else {
                bodyRef.current.position.y = 0;
                bodyRef.current.rotation.z = 0;
            }
        }
    });

    // Màu sắc trang phục phản chiếu cảm xúc sinh học & Nhận thức
    let shirtColor = defaultColor;
    let emotionBadge = isBo ? "BO • VUI VẺ" : "BI • TƯƠI TẮN";
    let emotionBg = isBo ? "bg-blue-600" : "bg-pink-600";
    const thoughtStr = currentThought || "";
    const isReflecting = thoughtStr.includes("[ĐÚC KẾT");

    if (isReflecting) {
        shirtColor = "#10b981";
        emotionBadge = `${name.toUpperCase()} • ĐÚC KẾT BÀI HỌC`;
        emotionBg = "bg-emerald-600";
    } else if (collided || (drives?.pain ?? 0) > 0.3) {
        shirtColor = "#f43f5e";
        emotionBadge = `${name.toUpperCase()} • ĐANG ĐAU!`;
        emotionBg = "bg-rose-600";
    } else if (isResting) {
        shirtColor = "#818cf8";
        emotionBadge = isNight
            ? `${name.toUpperCase()} • NGỦ ĐÊM`
            : `${name.toUpperCase()} • ĐANG NGỦ`;
        emotionBg = "bg-violet-600";
    } else if ((drives?.hunger ?? 0) > 0.6 || (energyRatio ?? 1.0) < 0.25) {
        shirtColor = "#f59e0b";
        emotionBadge = `${name.toUpperCase()} • ĐÓI BỤNG`;
        emotionBg = "bg-amber-600";
    } else if ((drives?.thirst ?? 0) > 0.6) {
        shirtColor = "#06b6d4";
        emotionBadge = `${name.toUpperCase()} • KHÁT NƯỚC`;
        emotionBg = "bg-cyan-600";
    } else if ((drives?.social ?? 0) > 0.6) {
        shirtColor = "#a855f7";
        emotionBadge = `${name.toUpperCase()} • CÔ ĐƠN`;
        emotionBg = "bg-purple-600";
    }

    const stageBadge = cognitiveState?.stage_info?.stage_badge ?? "[GIAI ĐOẠN 1: CHẬP CHỮNG]";
    const competencePct = Math.round((cognitiveState?.competence ?? 0.2) * 100);

    return (
        <group ref={groupRef}>
            {/* 1. Bong Bóng Thoại 3D (Floating 3D Speech Bubble) */}
            <Html
                position={[0, 2.25, 0]}
                center
                distanceFactor={18}
                zIndexRange={[100, 0]}
            >
                <div className="pointer-events-none flex flex-col items-center select-none w-80 text-center transition-all duration-200">
                    <div
                        className={`bg-slate-950/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-2xl space-y-1.5 border-2 ${
                            isReflecting
                                ? "border-emerald-400 shadow-emerald-500/40"
                                : isBo
                                ? "border-blue-500/80 shadow-blue-500/25"
                                : "border-pink-500/80 shadow-pink-500/25"
                        }`}
                    >
                        {/* Thanh tiêu đề bóng thoại & Giai đoạn nhận thức */}
                        <div className="flex items-center justify-between gap-1 text-[10px] font-bold border-b border-slate-800/80 pb-1">
                            <span
                                className={`px-2 py-0.5 rounded-full text-white font-mono flex items-center gap-1.5 ${emotionBg}`}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                {emotionBadge}
                            </span>
                            <div className="flex items-center gap-1.5 overflow-hidden">
                                <span className="text-slate-400 font-sans truncate max-w-[80px]">
                                    {currentGoalName}
                                </span>
                                <span className="text-emerald-400 font-mono text-[9px] tracking-tight">
                                    {stageBadge} (RRL: {competencePct}%)
                                </span>
                            </div>
                        </div>
                        {/* Lời thoại / Tư duy trực tiếp */}
                        <p className={`text-xs font-medium leading-snug italic text-left pt-0.5 ${isReflecting ? "text-emerald-200 font-semibold" : "text-slate-100"}`}>
                            "{currentThought}"
                        </p>
                    </div>
                    {/* Đuôi bóng thoại chỉ xuống đỉnh đầu bé */}
                    <div
                        className={`w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[8px] -mt-[1px] ${
                            isReflecting
                                ? "border-t-emerald-400"
                                : isBo
                                ? "border-t-blue-500/80"
                                : "border-t-pink-500/80"
                        }`}
                    />
                </div>
            </Html>

            {/* Khung thân thể có hoạt ảnh cử động (Bobbing Group) */}
            <group ref={bodyRef}>
                {/* Đôi chân và giày */}
                <mesh position={[-0.14, 0.14, 0]} castShadow>
                    <cylinderGeometry args={[0.08, 0.09, 0.28, 12]} />
                    <meshStandardMaterial color="#1e293b" />
                </mesh>
                <mesh position={[0.14, 0.14, 0]} castShadow>
                    <cylinderGeometry args={[0.08, 0.09, 0.28, 12]} />
                    <meshStandardMaterial color="#1e293b" />
                </mesh>
                <mesh position={[-0.14, 0.03, 0.04]} castShadow>
                    <boxGeometry args={[0.14, 0.08, 0.2]} />
                    <meshStandardMaterial color="#0f172a" />
                </mesh>
                <mesh position={[0.14, 0.03, 0.04]} castShadow>
                    <boxGeometry args={[0.14, 0.08, 0.2]} />
                    <meshStandardMaterial color="#0f172a" />
                </mesh>

                {/* Thân người (Áo của bé) */}
                <mesh position={[0, 0.52, 0]} castShadow>
                    <cylinderGeometry args={[0.26, 0.3, 0.55, 18]} />
                    <meshStandardMaterial color={shirtColor} roughness={0.4} />
                </mesh>

                {/* Hai cánh tay nhỏ */}
                <mesh position={[-0.34, 0.52, 0]} rotation={[0, 0, 0.2]} castShadow>
                    <cylinderGeometry args={[0.07, 0.07, 0.42, 10]} />
                    <meshStandardMaterial color={shirtColor} />
                </mesh>
                <mesh position={[0.34, 0.52, 0]} rotation={[0, 0, -0.2]} castShadow>
                    <cylinderGeometry args={[0.07, 0.07, 0.42, 10]} />
                    <meshStandardMaterial color={shirtColor} />
                </mesh>

                {/* Đầu và Khuôn mặt */}
                <mesh position={[0, 0.98, 0]} castShadow>
                    <sphereGeometry args={[0.24, 24, 24]} />
                    <meshStandardMaterial color="#fed7aa" roughness={0.3} />
                </mesh>

                {/* Mái tóc */}
                <mesh position={[0, 1.08, -0.02]} castShadow>
                    <sphereGeometry args={[0.25, 20, 20]} />
                    <meshStandardMaterial color={hairColor} roughness={0.6} />
                </mesh>

                {/* Chiếc nơ xinh xắn nếu là Bé Bi */}
                {!isBo && (
                    <mesh position={[0.16, 1.2, 0.05]} rotation={[0, 0, 0.3]}>
                        <boxGeometry args={[0.12, 0.07, 0.07]} />
                        <meshStandardMaterial color="#f43f5e" />
                    </mesh>
                )}

                {/* Đôi mắt sáng ngời */}
                <mesh position={[-0.08, 0.99, 0.21]}>
                    <sphereGeometry args={[0.035, 12, 12]} />
                    <meshStandardMaterial color="#020617" roughness={0.1} />
                </mesh>
                <mesh position={[0.08, 0.99, 0.21]}>
                    <sphereGeometry args={[0.035, 12, 12]} />
                    <meshStandardMaterial color="#020617" roughness={0.1} />
                </mesh>

                {/* Má hồng hào */}
                <mesh position={[-0.13, 0.93, 0.19]}>
                    <sphereGeometry args={[0.03, 10, 10]} />
                    <meshBasicMaterial color="#f472b6" transparent opacity={0.6} />
                </mesh>
                <mesh position={[0.13, 0.93, 0.19]}>
                    <sphereGeometry args={[0.03, 10, 10]} />
                    <meshBasicMaterial color="#f472b6" transparent opacity={0.6} />
                </mesh>
            </group>

            {/* Vòng hào quang cảm xúc dưới chân */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
                <ringGeometry args={[0.42, 0.55, 28]} />
                <meshBasicMaterial color={shirtColor} transparent opacity={0.4} />
            </mesh>

            {/* Mũi tên chỉ hướng trước mặt */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0.65]}>
                <coneGeometry args={[0.12, 0.3, 3]} />
                <meshBasicMaterial color={isBo ? "#38bdf8" : "#f472b6"} transparent opacity={0.7} />
            </mesh>
        </group>
    );
}
