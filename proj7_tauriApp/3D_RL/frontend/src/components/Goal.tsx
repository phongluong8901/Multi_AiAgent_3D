import { useTrainingStore } from "../stores/useTrainingStore";

export default function Goal() {
    const goal = useTrainingStore((s) => s.goal);
    const food = useTrainingStore((s) => s.food);
    const water = useTrainingStore((s) => s.water);
    const bed = useTrainingStore((s) => s.bed);

    return (
        <group>
            {/* 1. Điểm Mục Tiêu Khám Phá (Cột sáng & Khối ngọc phát sáng xanh lá) */}
            <group position={[goal[0], 0, goal[1]]}>
                <mesh position={[0, 0.7, 0]} castShadow>
                    <sphereGeometry args={[0.55, 28, 28]} />
                    <meshStandardMaterial
                        color="#22c55e"
                        emissive="#16a34a"
                        emissiveIntensity={0.5}
                        roughness={0.2}
                        metalness={0.3}
                    />
                </mesh>
                {/* Vòng hào quang mặt sàn */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
                    <ringGeometry args={[0.7, 0.95, 32]} />
                    <meshBasicMaterial color="#22c55e" transparent opacity={0.7} />
                </mesh>
            </group>

            {/* 2. Khu Vực Bếp & Thức Ăn (Bàn ăn & Đĩa đồ ăn thơm ngon) */}
            <group position={[food[0], 0, food[1]]}>
                {/* Thảm sàn khu bếp */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
                    <circleGeometry args={[1.5, 32]} />
                    <meshStandardMaterial color="#f59e0b" transparent opacity={0.25} />
                </mesh>
                {/* Bàn tròn */}
                <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.85, 0.85, 0.1, 28]} />
                    <meshStandardMaterial color="#78350f" roughness={0.6} />
                </mesh>
                {/* Chân bàn */}
                <mesh position={[0, 0.17, 0]} castShadow>
                    <cylinderGeometry args={[0.16, 0.22, 0.34, 16]} />
                    <meshStandardMaterial color="#451a03" />
                </mesh>
                {/* Đĩa đồ ăn vàng cam */}
                <mesh position={[0, 0.44, 0]} castShadow>
                    <dodecahedronGeometry args={[0.32, 0]} />
                    <meshStandardMaterial
                        color="#fbbf24"
                        emissive="#d97706"
                        emissiveIntensity={0.3}
                        roughness={0.3}
                    />
                </mesh>
            </group>

            {/* 3. Khu Vực Vòi Nước Giải Khát (Bồn nước & Trụ nước xanh ngọc) */}
            <group position={[water[0], 0, water[1]]}>
                {/* Thảm nước mát */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
                    <circleGeometry args={[1.5, 32]} />
                    <meshStandardMaterial color="#06b6d4" transparent opacity={0.28} />
                </mesh>
                {/* Thành bồn nước */}
                <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.85, 0.95, 0.35, 28]} />
                    <meshStandardMaterial color="#334155" roughness={0.5} />
                </mesh>
                {/* Mặt nước trong veo */}
                <mesh position={[0, 0.36, 0]}>
                    <cylinderGeometry args={[0.72, 0.72, 0.05, 24]} />
                    <meshStandardMaterial
                        color="#38bdf8"
                        emissive="#0284c7"
                        emissiveIntensity={0.4}
                        roughness={0.1}
                        metalness={0.2}
                    />
                </mesh>
                {/* Tinh thể nước lơ lửng */}
                <mesh position={[0, 0.7, 0]} castShadow>
                    <octahedronGeometry args={[0.3, 0]} />
                    <meshStandardMaterial
                        color="#0ea5e9"
                        emissive="#0284c7"
                        emissiveIntensity={0.5}
                        roughness={0.1}
                    />
                </mesh>
            </group>

            {/* 4. Khu Vực Giường Ngủ (Khung gỗ, Nệm êm, Chăn ấm & Gối) */}
            <group position={[bed[0], 0, bed[1]]}>
                {/* Khung giường gỗ */}
                <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
                    <boxGeometry args={[1.8, 0.2, 1.8]} />
                    <meshStandardMaterial color="#78350f" roughness={0.7} />
                </mesh>
                {/* Nệm giường mềm mại màu tím chàm */}
                <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
                    <boxGeometry args={[1.6, 0.18, 1.6]} />
                    <meshStandardMaterial color="#6366f1" roughness={0.5} />
                </mesh>
                {/* Gối êm màu trắng ngà */}
                <mesh position={[-0.45, 0.4, -0.45]} castShadow>
                    <boxGeometry args={[0.5, 0.12, 0.4]} />
                    <meshStandardMaterial color="#f8fafc" roughness={0.4} />
                </mesh>
            </group>
        </group>
    );
}
