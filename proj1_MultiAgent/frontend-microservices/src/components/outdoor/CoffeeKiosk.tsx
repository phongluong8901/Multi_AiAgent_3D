import { RigidBody } from '@react-three/rapier'

type KioskProps = {
    position: [number, number, number]
    rotation?: [number, number, number]
    onInteract?: () => void
}

export default function CoffeeKiosk({ position, rotation = [0, 0, 0], onInteract }: KioskProps) {
    return (
        <group position={position} rotation={rotation} onClick={(e) => { e.stopPropagation(); onInteract?.(); }}>
            <RigidBody type="fixed" colliders="cuboid">
                {/* Thân quầy ki-ốt gỗ */}
                <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
                    <boxGeometry args={[3.0, 2.2, 1.8]} />
                    <meshStandardMaterial color="#3b2716" roughness={0.8} />
                </mesh>

                {/* Quầy bar phục vụ mở */}
                <mesh position={[0, 0.9, 0.95]} castShadow receiveShadow>
                    <boxGeometry args={[2.4, 0.1, 0.45]} />
                    <meshStandardMaterial color="#d69e2e" roughness={0.4} />
                </mesh>

                {/* Cửa sổ mở của quầy */}
                <mesh position={[0, 1.35, 0.88]}>
                    <boxGeometry args={[2.2, 0.8, 0.05]} />
                    <meshStandardMaterial color="#1a202c" roughness={0.2} />
                </mesh>

                {/* Mái che bạt sọc đỏ trắng vươn ra */}
                <mesh position={[0, 2.3, 0.5]} rotation={[0.2, 0, 0]} castShadow>
                    <boxGeometry args={[3.2, 0.1, 1.4]} />
                    <meshStandardMaterial color="#e53e3e" roughness={0.6} />
                </mesh>

                {/* Biển hiệu COFFEE & CHILL */}
                <mesh position={[0, 2.45, 0.9]} castShadow>
                    <boxGeometry args={[1.8, 0.35, 0.06]} />
                    <meshStandardMaterial color="#f6e05e" roughness={0.5} />
                </mesh>

                {/* Máy pha cà phê trên quầy */}
                <mesh position={[-0.6, 1.15, 0.95]} castShadow>
                    <boxGeometry args={[0.35, 0.4, 0.3]} />
                    <meshStandardMaterial color="#cbd5e0" metalness={0.8} roughness={0.2} />
                </mesh>

                {/* Ly cà phê takeaway */}
                <mesh position={[0.4, 1.0, 0.95]} castShadow>
                    <cylinderGeometry args={[0.05, 0.04, 0.12, 12]} />
                    <meshStandardMaterial color="#fff" />
                </mesh>
                <mesh position={[0.6, 1.0, 0.95]} castShadow>
                    <cylinderGeometry args={[0.05, 0.04, 0.12, 12]} />
                    <meshStandardMaterial color="#fff" />
                </mesh>
            </RigidBody>
        </group>
    )
}
