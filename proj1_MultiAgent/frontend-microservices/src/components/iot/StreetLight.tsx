'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

type Props = {
    position: [number, number, number]
    height?: number
    intensity?: number
}

export default function StreetLight({
    position,
    height = 5.5,
    intensity = 1.2,
}: Props) {
    const lightRef = useRef<THREE.PointLight>(null)

    // Nhấp nháy nhẹ cho sinh động (optional)
    useFrame((state) => {
        if (lightRef.current) {
            lightRef.current.intensity = intensity + Math.sin(state.clock.elapsedTime * 2) * 0.08
        }
    })

    return (
        <group position={position}>
            {/* Cột đèn */}
            <mesh position={[0, height / 2, 0]} castShadow>
                <cylinderGeometry args={[0.08, 0.12, height, 8]} />
                <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.3} />
            </mesh>

            {/* Cánh tay ngang */}
            <mesh position={[0.6, height - 0.3, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.05, 0.05, 1.2, 8]} />
                <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.3} />
            </mesh>

            {/* Đầu đèn */}
            <mesh position={[1.15, height - 0.35, 0]} castShadow>
                <boxGeometry args={[0.5, 0.2, 0.35]} />
                <meshStandardMaterial color="#0f172a" />
            </mesh>

            {/* Ánh sáng */}
            <pointLight
                ref={lightRef}
                position={[1.15, height - 0.6, 0]}
                intensity={intensity}
                distance={18}
                decay={2}
                color="#fef3c7"
                castShadow
            />

            {/* Vùng sáng giả (glow) */}
            <mesh position={[1.15, height - 0.55, 0]}>
                <sphereGeometry args={[0.15, 12, 12]} />
                <meshStandardMaterial
                    color="#fef3c7"
                    emissive="#fde68a"
                    emissiveIntensity={1.5}
                    transparent
                    opacity={0.9}
                />
            </mesh>
        </group>
    )
}