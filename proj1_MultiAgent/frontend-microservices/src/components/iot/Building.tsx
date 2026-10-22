'use client'

import { RoundedBox } from '@react-three/drei'

type Props = {
    position: [number, number, number]
    width?: number
    height?: number
    depth?: number
    color?: string
}

export default function Building({
    position,
    width = 4,
    height = 8,
    depth = 4,
    color = '#64748b',
}: Props) {
    return (
        <group position={position}>
            {/* Thân nhà */}
            <RoundedBox args={[width, height, depth]} radius={0.08} position={[0, height / 2, 0]} castShadow receiveShadow>
                <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
            </RoundedBox>

            {/* Mái */}
            <mesh position={[0, height + 0.3, 0]} castShadow>
                <boxGeometry args={[width + 0.4, 0.4, depth + 0.4]} />
                <meshStandardMaterial color="#334155" />
            </mesh>

            {/* Cửa sổ */}
            {Array.from({ length: Math.floor(height / 2) }).map((_, i) => (
                <group key={i}>
                    <mesh position={[-width / 2 - 0.01, 1.5 + i * 2, 0]}>
                        <planeGeometry args={[0.6, 0.8]} />
                        <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.4} />
                    </mesh>
                    <mesh position={[width / 2 + 0.01, 1.5 + i * 2, 0]} rotation={[0, Math.PI, 0]}>
                        <planeGeometry args={[0.6, 0.8]} />
                        <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={0.4} />
                    </mesh>
                </group>
            ))}
        </group>
    )
}