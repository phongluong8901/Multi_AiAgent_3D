import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody } from '@react-three/rapier'
import * as THREE from 'three'

type FountainProps = {
    position: [number, number, number]
    onInteract?: () => void
}

export default function Fountain({ position, onInteract }: FountainProps) {
    const sprayRef = useRef<THREE.Mesh>(null)

    useFrame((state) => {
        if (sprayRef.current) {
            sprayRef.current.scale.y = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.15
            sprayRef.current.rotation.y += 0.01
        }
    })

    return (
        <group position={position} onClick={(e) => { e.stopPropagation(); onInteract?.(); }}>
            <RigidBody type="fixed" colliders="hull">
                {/* Thành bể đá vòng tròn lớn */}
                <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[2.4, 2.6, 0.5, 24]} />
                    <meshStandardMaterial color="#718096" roughness={0.8} />
                </mesh>

                {/* Mặt nước hồ phun trong xanh */}
                <mesh position={[0, 0.38, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[2.25, 24]} />
                    <meshStandardMaterial
                        color="#38bdf8"
                        roughness={0.1}
                        metalness={0.1}
                        transparent
                        opacity={0.85}
                    />
                </mesh>

                {/* Cột trụ đá trung tâm */}
                <mesh position={[0, 0.8, 0]} castShadow>
                    <cylinderGeometry args={[0.4, 0.6, 1.1, 16]} />
                    <meshStandardMaterial color="#4a5568" roughness={0.7} />
                </mesh>

                {/* Chậu đá tầng 2 */}
                <mesh position={[0, 1.25, 0]} castShadow>
                    <cylinderGeometry args={[1.2, 0.9, 0.3, 16]} />
                    <meshStandardMaterial color="#718096" roughness={0.8} />
                </mesh>

                {/* Nước tầng 2 */}
                <mesh position={[0, 1.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[1.1, 16]} />
                    <meshStandardMaterial color="#38bdf8" roughness={0.1} transparent opacity={0.85} />
                </mesh>

                {/* Vòi phun nước động */}
                <mesh ref={sprayRef} position={[0, 1.75, 0]}>
                    <coneGeometry args={[0.25, 0.8, 12]} />
                    <meshStandardMaterial color="#e0f2fe" transparent opacity={0.7} roughness={0.1} />
                </mesh>
            </RigidBody>
        </group>
    )
}
