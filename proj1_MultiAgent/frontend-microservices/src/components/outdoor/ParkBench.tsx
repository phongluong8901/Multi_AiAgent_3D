import { RigidBody } from '@react-three/rapier'

type BenchProps = {
    position: [number, number, number]
    rotation?: [number, number, number]
    onInteract?: () => void
}

export default function ParkBench({ position, rotation = [0, 0, 0], onInteract }: BenchProps) {
    return (
        <group position={position} rotation={rotation} onClick={(e) => { e.stopPropagation(); onInteract?.(); }}>
            <RigidBody type="fixed" colliders="cuboid">
                {/* Mặt ghế gỗ */}
                <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
                    <boxGeometry args={[1.6, 0.08, 0.45]} />
                    <meshStandardMaterial color="#b7791f" roughness={0.7} />
                </mesh>

                {/* Tựa lưng ghế */}
                <mesh position={[0, 0.75, -0.2]} rotation={[0.1, 0, 0]} castShadow>
                    <boxGeometry args={[1.6, 0.4, 0.06]} />
                    <meshStandardMaterial color="#b7791f" roughness={0.7} />
                </mesh>

                {/* Chân ghế sắt đen */}
                <mesh position={[-0.65, 0.22, 0]} castShadow>
                    <boxGeometry args={[0.08, 0.44, 0.42]} />
                    <meshStandardMaterial color="#1a202c" metalness={0.8} roughness={0.3} />
                </mesh>
                <mesh position={[0.65, 0.22, 0]} castShadow>
                    <boxGeometry args={[0.08, 0.44, 0.42]} />
                    <meshStandardMaterial color="#1a202c" metalness={0.8} roughness={0.3} />
                </mesh>

                {/* Tay vịn ghế */}
                <mesh position={[-0.7, 0.58, 0]} castShadow>
                    <boxGeometry args={[0.06, 0.06, 0.44]} />
                    <meshStandardMaterial color="#1a202c" metalness={0.8} roughness={0.3} />
                </mesh>
                <mesh position={[0.7, 0.58, 0]} castShadow>
                    <boxGeometry args={[0.06, 0.06, 0.44]} />
                    <meshStandardMaterial color="#1a202c" metalness={0.8} roughness={0.3} />
                </mesh>
            </RigidBody>
        </group>
    )
}
