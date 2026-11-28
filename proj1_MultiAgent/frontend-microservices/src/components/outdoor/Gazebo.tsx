import { RigidBody } from '@react-three/rapier'

type GazeboProps = {
    position: [number, number, number]
    onInteract?: () => void
}

export default function Gazebo({ position, onInteract }: GazeboProps) {
    return (
        <group position={position} onClick={(e) => { e.stopPropagation(); onInteract?.(); }}>
            <RigidBody type="fixed" colliders="hull">
                {/* Sàn gỗ nâng lục giác */}
                <mesh position={[0, 0.15, 0]} receiveShadow>
                    <cylinderGeometry args={[2.8, 2.9, 0.3, 6]} />
                    <meshStandardMaterial color="#b7791f" roughness={0.7} />
                </mesh>

                {/* 6 Cột trụ gỗ chống mái */}
                {[0, 1, 2, 3, 4, 5].map((i) => {
                    const angle = (i * Math.PI) / 3
                    const x = Math.cos(angle) * 2.4
                    const z = Math.sin(angle) * 2.4
                    return (
                        <mesh key={i} position={[x, 1.45, z]} castShadow>
                            <cylinderGeometry args={[0.08, 0.08, 2.3, 8]} />
                            <meshStandardMaterial color="#744210" roughness={0.8} />
                        </mesh>
                    )
                })}

                {/* Mái chòi lục giác phong cách hiện đại */}
                <mesh position={[0, 2.9, 0]} castShadow>
                    <coneGeometry args={[3.2, 1.1, 6]} />
                    <meshStandardMaterial color="#2d3748" roughness={0.5} />
                </mesh>

                {/* Bàn tròn họp ngoài trời bên trong chòi */}
                <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[0.8, 0.8, 0.08, 16]} />
                    <meshStandardMaterial color="#975a16" roughness={0.6} />
                </mesh>
                <mesh position={[0, 0.35, 0]} castShadow>
                    <cylinderGeometry args={[0.12, 0.18, 0.6, 8]} />
                    <meshStandardMaterial color="#744210" roughness={0.8} />
                </mesh>

                {/* Ghế ngồi quanh bàn họp chòi */}
                {[0, 1, 2, 3].map((idx) => {
                    const a = (idx * Math.PI) / 2
                    const cx = Math.cos(a) * 1.3
                    const cz = Math.sin(a) * 1.3
                    return (
                        <mesh key={idx} position={[cx, 0.42, cz]} castShadow>
                            <cylinderGeometry args={[0.26, 0.26, 0.28, 12]} />
                            <meshStandardMaterial color="#4a5568" roughness={0.7} />
                        </mesh>
                    )
                })}
            </RigidBody>
        </group>
    )
}
