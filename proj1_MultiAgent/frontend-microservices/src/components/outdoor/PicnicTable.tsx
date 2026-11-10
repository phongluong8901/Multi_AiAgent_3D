import { RigidBody } from '@react-three/rapier'

type PicnicTableProps = {
    position: [number, number, number]
    rotation?: [number, number, number]
    umbrellaColor?: string
    onInteract?: () => void
}

export default function PicnicTable({
    position,
    rotation = [0, 0, 0],
    umbrellaColor = '#e53e3e',
    onInteract,
}: PicnicTableProps) {
    return (
        <group position={position} rotation={rotation} onClick={(e) => { e.stopPropagation(); onInteract?.(); }}>
            <RigidBody type="fixed" colliders="cuboid">
                {/* Mặt bàn gỗ dã ngoại */}
                <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
                    <boxGeometry args={[2.0, 0.08, 0.9]} />
                    <meshStandardMaterial color="#975a16" roughness={0.7} />
                </mesh>

                {/* Chân bàn chéo chữ A */}
                <mesh position={[-0.75, 0.38, 0]} castShadow>
                    <boxGeometry args={[0.08, 0.76, 0.7]} />
                    <meshStandardMaterial color="#744210" roughness={0.8} />
                </mesh>
                <mesh position={[0.75, 0.38, 0]} castShadow>
                    <boxGeometry args={[0.08, 0.76, 0.7]} />
                    <meshStandardMaterial color="#744210" roughness={0.8} />
                </mesh>

                {/* Ghế băng bên trái */}
                <mesh position={[0, 0.45, -0.75]} castShadow receiveShadow>
                    <boxGeometry args={[2.0, 0.07, 0.35]} />
                    <meshStandardMaterial color="#975a16" roughness={0.7} />
                </mesh>

                {/* Ghế băng bên phải */}
                <mesh position={[0, 0.45, 0.75]} castShadow receiveShadow>
                    <boxGeometry args={[2.0, 0.07, 0.35]} />
                    <meshStandardMaterial color="#975a16" roughness={0.7} />
                </mesh>

                {/* Laptop ngoài trời trên bàn */}
                <mesh position={[0, 0.81, 0]} castShadow>
                    <boxGeometry args={[0.35, 0.02, 0.25]} />
                    <meshStandardMaterial color="#718096" metalness={0.7} roughness={0.3} />
                </mesh>
                <mesh position={[0, 0.92, -0.12]} rotation={[-0.3, 0, 0]} castShadow>
                    <boxGeometry args={[0.35, 0.22, 0.02]} />
                    <meshStandardMaterial color="#2d3748" metalness={0.8} roughness={0.2} />
                </mesh>

                {/* Cán dù che nắng */}
                <mesh position={[0, 1.4, 0]} castShadow>
                    <cylinderGeometry args={[0.03, 0.03, 1.4, 8]} />
                    <meshStandardMaterial color="#e2e8f0" metalness={0.8} />
                </mesh>

                {/* Tán dù che nắng sắc màu */}
                <mesh position={[0, 2.3, 0]} castShadow>
                    <coneGeometry args={[1.5, 0.6, 8]} />
                    <meshStandardMaterial color={umbrellaColor} roughness={0.5} />
                </mesh>
            </RigidBody>
        </group>
    )
}
