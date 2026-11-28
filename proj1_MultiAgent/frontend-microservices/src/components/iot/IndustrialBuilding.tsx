'use client'

import { RoundedBox } from '@react-three/drei'

type Props = {
    position: [number, number, number]
}

export default function IndustrialBuilding({ position }: Props) {
    return (
        <group position={position}>
            <RoundedBox args={[6, 4, 5]} radius={0.05} position={[0, 2, 0]} castShadow>
                <meshStandardMaterial color="#475569" metalness={0.4} roughness={0.5} />
            </RoundedBox>

            {/* Ống khói */}
            <mesh position={[2, 5.2, 0]}>
                <cylinderGeometry args={[0.35, 0.45, 2.5]} />
                <meshStandardMaterial color="#1e293b" />
            </mesh>
            <mesh position={[-1.8, 4.8, 1.2]}>
                <cylinderGeometry args={[0.25, 0.3, 1.8]} />
                <meshStandardMaterial color="#1e293b" />
            </mesh>

            {/* Cửa lớn */}
            <mesh position={[0, 1.2, 2.51]}>
                <boxGeometry args={[2.5, 2.4, 0.1]} />
                <meshStandardMaterial color="#0f172a" />
            </mesh>
        </group>
    )
}