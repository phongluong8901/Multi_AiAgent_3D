import { useTrainingStore } from "../stores/useTrainingStore";

export default function Obstacles() {
    const obstacles = useTrainingStore((s) => s.obstacles);

    return (
        <group>
            {obstacles.map((obs, i) => {
                const isFirePit = i === 0;
                const isSpikeHazard = i === 1;

                if (isFirePit) {
                    // Hazard 1: Lò nhiệt / Bếp sưởi lửa nguy hiểm
                    return (
                        <group key={i} position={[obs[0], 0, obs[1]]}>
                            <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
                                <cylinderGeometry args={[0.7, 0.8, 0.5, 16]} />
                                <meshStandardMaterial color="#334155" roughness={0.8} />
                            </mesh>
                            {/* Ngọn lửa cảnh báo màu cam đỏ */}
                            <mesh position={[0, 0.65, 0]}>
                                <coneGeometry args={[0.42, 0.7, 12]} />
                                <meshStandardMaterial
                                    color="#ef4444"
                                    emissive="#f97316"
                                    emissiveIntensity={0.8}
                                    roughness={0.2}
                                />
                            </mesh>
                            {/* Vòng viền cảnh báo */}
                            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                                <ringGeometry args={[0.85, 1.05, 24]} />
                                <meshBasicMaterial color="#ef4444" transparent opacity={0.4} />
                            </mesh>
                        </group>
                    );
                }

                if (isSpikeHazard) {
                    // Hazard 2: Khu vực chông nhọn / góc nguy hiểm
                    return (
                        <group key={i} position={[obs[0], 0, obs[1]]}>
                            <mesh position={[0, 0.15, 0]} castShadow>
                                <boxGeometry args={[1.3, 0.3, 1.3]} />
                                <meshStandardMaterial color="#475569" roughness={0.7} />
                            </mesh>
                            {/* Các cọc nhọn */}
                            <mesh position={[-0.3, 0.6, -0.3]} castShadow>
                                <coneGeometry args={[0.2, 0.65, 8]} />
                                <meshStandardMaterial color="#f43f5e" metalness={0.4} roughness={0.3} />
                            </mesh>
                            <mesh position={[0.3, 0.6, 0.3]} castShadow>
                                <coneGeometry args={[0.2, 0.65, 8]} />
                                <meshStandardMaterial color="#f43f5e" metalness={0.4} roughness={0.3} />
                            </mesh>
                            <mesh position={[0.3, 0.55, -0.3]} castShadow>
                                <coneGeometry args={[0.18, 0.55, 8]} />
                                <meshStandardMaterial color="#f43f5e" metalness={0.4} roughness={0.3} />
                            </mesh>
                        </group>
                    );
                }

                // Hazard 3, 4, 5, 6: Các khối chướng ngại vật (Thùng gỗ, Tủ cao, Vách ngăn)
                return (
                    <group key={i} position={[obs[0], 0, obs[1]]}>
                        <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
                            <boxGeometry args={[1.3, 1.2, 1.3]} />
                            <meshStandardMaterial
                                color={i % 2 === 0 ? "#78350f" : "#b45309"}
                                roughness={0.65}
                            />
                        </mesh>
                        {/* Viền cảnh báo trên nóc thùng */}
                        <mesh position={[0, 1.22, 0]}>
                            <boxGeometry args={[1.1, 0.04, 1.1]} />
                            <meshStandardMaterial
                                color="#ef4444"
                                emissive="#b91c1c"
                                emissiveIntensity={0.3}
                            />
                        </mesh>
                    </group>
                );
            })}
        </group>
    );
}
