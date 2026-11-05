import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Environment } from "@react-three/drei";
import Robot from "./Robot";
import Goal from "./Goal";
import Obstacles from "./Obstacles";
import { useTrainingStore } from "../stores/useTrainingStore";

// Component Cây xanh trang trí
function Tree({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            {/* Thân cây gỗ */}
            <mesh position={[0, 0.7, 0]} castShadow>
                <cylinderGeometry args={[0.22, 0.28, 1.4, 12]} />
                <meshStandardMaterial color="#5c3a21" roughness={0.8} />
            </mesh>
            {/* Tán lá xanh hình cầu tầng dưới */}
            <mesh position={[0, 1.7, 0]} castShadow>
                <sphereGeometry args={[0.9, 16, 16]} />
                <meshStandardMaterial color="#15803d" roughness={0.6} />
            </mesh>
            {/* Tán lá tầng trên */}
            <mesh position={[0, 2.3, 0]} castShadow>
                <sphereGeometry args={[0.65, 14, 14]} />
                <meshStandardMaterial color="#22c55e" roughness={0.5} />
            </mesh>
        </group>
    );
}

// Component Khối đồ chơi trẻ em (Toy Blocks) ở khu chơi trung tâm
function PlayArea() {
    return (
        <group position={[10, 0, 10]}>
            {/* Thảm chơi trẻ em tròn */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
                <circleGeometry args={[2.5, 36]} />
                <meshStandardMaterial color="#0284c7" transparent opacity={0.25} />
            </mesh>

            {/* Khối xếp hình rubik đỏ */}
            <mesh position={[-0.8, 0.25, -0.6]} rotation={[0, 0.3, 0]} castShadow>
                <boxGeometry args={[0.5, 0.5, 0.5]} />
                <meshStandardMaterial color="#ef4444" roughness={0.3} />
            </mesh>

            {/* Khối kim tự tháp vàng */}
            <mesh position={[0.6, 0.35, -0.3]} rotation={[0, 0.8, 0]} castShadow>
                <coneGeometry args={[0.35, 0.65, 4]} />
                <meshStandardMaterial color="#eab308" roughness={0.3} />
            </mesh>

            {/* Quả bóng đồ chơi xanh lá */}
            <mesh position={[-0.2, 0.28, 0.8]} castShadow>
                <sphereGeometry args={[0.28, 20, 20]} />
                <meshStandardMaterial color="#10b981" roughness={0.2} metalness={0.1} />
            </mesh>
        </group>
    );
}

// Component Tường rào bao quanh khuôn viên 20x20
function BoundaryWalls() {
    const wallColor = "#334155";
    return (
        <group>
            {/* Tường phía Bắc (z = 0) */}
            <mesh position={[10, 0.5, 0]} castShadow receiveShadow>
                <boxGeometry args={[20.4, 1.0, 0.4]} />
                <meshStandardMaterial color={wallColor} roughness={0.6} />
            </mesh>
            {/* Tường phía Nam (z = 20) */}
            <mesh position={[10, 0.5, 20]} castShadow receiveShadow>
                <boxGeometry args={[20.4, 1.0, 0.4]} />
                <meshStandardMaterial color={wallColor} roughness={0.6} />
            </mesh>
            {/* Tường phía Tây (x = 0) */}
            <mesh position={[0, 0.5, 10]} castShadow receiveShadow>
                <boxGeometry args={[0.4, 1.0, 20.4]} />
                <meshStandardMaterial color={wallColor} roughness={0.6} />
            </mesh>
            {/* Tường phía Đông (x = 20) */}
            <mesh position={[20, 0.5, 10]} castShadow receiveShadow>
                <boxGeometry args={[0.4, 1.0, 20.4]} />
                <meshStandardMaterial color={wallColor} roughness={0.6} />
            </mesh>
        </group>
    );
}

export default function Scene3D() {
    const isTeacherMode = useTrainingStore((s) => s.isTeacherMode);
    const ateFood = useTrainingStore((s) => s.ateFood);
    const drankWater = useTrainingStore((s) => s.drankWater);
    const isResting = useTrainingStore((s) => s.isResting);
    const collided = useTrainingStore((s) => s.collided);

    return (
        <div className="relative w-full h-full rounded-xl overflow-hidden bg-slate-900 border border-slate-700">
            {/* Chú thích các khu vực (Tiếng Việt rõ ràng) */}
            <div className="absolute top-3 left-3 z-10 bg-slate-950/85 backdrop-blur px-3.5 py-2.5 rounded-lg border border-slate-800 text-xs space-y-1.5 pointer-events-none shadow-lg">
                <div className="font-semibold text-slate-200 tracking-wide flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    BẢN ĐỒ THẾ GIỚI 3D (20m x 20m)
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-300">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                        Bé (AI Agent)
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                        Đích Khám Phá [17, 17]
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                        Bếp & Thức Ăn [3, 17]
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
                        Vòi Nước Uống [17, 3]
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                        Giường Ngủ [2.5, 2.5]
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                        Vật Cản & Lò Lửa
                    </span>
                    <span className="flex items-center gap-1.5 col-span-2 text-slate-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-500/70 inline-block" />
                        Khu Vực Thảm Chơi [10, 10]
                    </span>
                </div>
            </div>

            {/* Huy hiệu thông báo trạng thái tức thời */}
            <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5 pointer-events-none">
                {isTeacherMode && (
                    <div className="px-3 py-1.5 rounded-lg bg-indigo-600/95 border border-indigo-300 text-white text-xs font-mono font-bold shadow-md">
                        [ĐANG LÁI: DÙNG PHÍM W, A, S, D HOẶC MŨI TÊN]
                    </div>
                )}
                {collided && (
                    <div className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-mono font-bold shadow-md animate-pulse">
                        [CẢNH BÁO] VA CHẠM! BÉ BỊ ĐAU & SỢ HÃI!
                    </div>
                )}
                {ateFood && (
                    <div className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 text-xs font-mono font-semibold shadow">
                        [SỰ KIỆN] ĐANG ĂN THỨC ĂN (+KCAL GIẢM ĐÓI)
                    </div>
                )}
                {drankWater && (
                    <div className="px-2.5 py-1 rounded bg-cyan-400 text-slate-950 text-xs font-mono font-semibold shadow">
                        [SỰ KIỆN] ĐANG UỐNG NƯỚC (GIẢM KHÁT)
                    </div>
                )}
                {isResting && (
                    <div className="px-2.5 py-1 rounded bg-indigo-500 text-white text-xs font-mono font-semibold shadow">
                        [SỰ KIỆN] ĐANG NGHỈ NGƠI TRÊN GIƯỜNG (HỒI PHỤC)
                    </div>
                )}
            </div>

            <Canvas shadows camera={{ position: [24, 22, 24], fov: 45 }}>
                <ambientLight intensity={0.55} />
                <directionalLight
                    position={[15, 25, 12]}
                    intensity={1.4}
                    castShadow
                    shadow-mapSize={[2048, 2048]}
                />

                {/* Lưới tọa độ toàn bản đồ 20x20 */}
                <Grid
                    infiniteGrid={false}
                    position={[10, 0.01, 10]}
                    args={[20, 20]}
                    cellSize={1}
                    sectionSize={5}
                    fadeDistance={45}
                    cellColor="#334155"
                    sectionColor="#64748b"
                />

                {/* Mặt sàn nhà 20x20 */}
                <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[10, 0, 10]}
                    receiveShadow
                >
                    <planeGeometry args={[20, 20]} />
                    <meshStandardMaterial color="#0f172a" roughness={0.7} />
                </mesh>

                {/* Tường bao quanh */}
                <BoundaryWalls />

                {/* Khu chơi trung tâm */}
                <PlayArea />

                {/* Cây xanh trang trí ở các khoảng sân */}
                <Tree position={[2.0, 0, 10.0]} />
                <Tree position={[18.0, 0, 10.0]} />
                <Tree position={[10.0, 0, 2.0]} />
                <Tree position={[10.0, 0, 18.0]} />
                <Tree position={[17.5, 0, 8.5]} />
                <Tree position={[8.5, 0, 17.5]} />

                {/* Các thực thể chính */}
                <Robot />
                <Goal />
                <Obstacles />

                <OrbitControls
                    makeDefault
                    target={[10, 0, 10]}
                    maxPolarAngle={Math.PI / 2.05}
                    maxDistance={45}
                    minDistance={5}
                />
                <Environment preset="city" />
            </Canvas>
        </div>
    );
}
