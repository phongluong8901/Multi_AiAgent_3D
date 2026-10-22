'use client'

import { RoundedBox } from '@react-three/drei'

type Props = {
    position: [number, number, number]
    color?: string
}

export default function House({ position, color = '#f8fafc' }: Props) {
    return (
        <group position={position}>
            {/* Thân nhà */}
            <RoundedBox args={[3.5, 2.8, 3.5]} radius={0.06} position={[0, 1.4, 0]} castShadow receiveShadow>
                <meshStandardMaterial color={color} roughness={0.6} />
            </RoundedBox>

            {/* Mái nghiêng */}
            <mesh position={[0, 3.3, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                <coneGeometry args={[3.2, 1.6, 4]} />
                <meshStandardMaterial color="#b91c1c" />
            </mesh>

            {/* Cửa */}
            <mesh position={[0, 0.9, 1.76]}>
                <boxGeometry args={[0.9, 1.6, 0.1]} />
                <meshStandardMaterial color="#78350f" />
            </mesh>

            {/* Cửa sổ */}
            <mesh position={[-1.1, 1.6, 1.76]}>
                <planeGeometry args={[0.7, 0.7]} />
                <meshStandardMaterial color="#7dd3fc" emissive="#0ea5e9" emissiveIntensity={0.3} />
            </mesh>
            <mesh position={[1.1, 1.6, 1.76]}>
                <planeGeometry args={[0.7, 0.7]} />
                <meshStandardMaterial color="#7dd3fc" emissive="#0ea5e9" emissiveIntensity={0.3} />
            </mesh>
        </group>
    )
}