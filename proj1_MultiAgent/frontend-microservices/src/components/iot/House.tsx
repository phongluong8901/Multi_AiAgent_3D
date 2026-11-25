'use client'

import { RoundedBox, Text } from '@react-three/drei'

type Props = {
    position: [number, number, number]
    color?: string
    roofColor?: string
    windowGlow?: boolean
    rotation?: [number, number, number]
    label?: string
}

export default function House({
    position,
    color = '#f8fafc',
    roofColor = '#b91c1c',
    windowGlow = true,
    rotation = [0, 0, 0],
    label,
}: Props) {
    return (
        <group position={position} rotation={rotation}>
            {/* Thân nhà */}
            <RoundedBox args={[3.5, 2.8, 3.5]} radius={0.06} position={[0, 1.4, 0]} castShadow receiveShadow>
                <meshStandardMaterial color={color} roughness={0.6} />
            </RoundedBox>

            {/* Mái nghiêng */}
            <mesh position={[0, 3.3, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                <coneGeometry args={[3.2, 1.6, 4]} />
                <meshStandardMaterial color={roofColor} />
            </mesh>

            {/* Cửa */}
            <mesh position={[0, 0.9, 1.76]}>
                <boxGeometry args={[0.9, 1.6, 0.1]} />
                <meshStandardMaterial color="#78350f" />
            </mesh>

            {/* Cửa sổ 1 */}
            <mesh position={[-1.1, 1.6, 1.76]}>
                <planeGeometry args={[0.7, 0.7]} />
                <meshStandardMaterial
                    color={windowGlow ? '#fef08a' : '#7dd3fc'}
                    emissive={windowGlow ? '#eab308' : '#0ea5e9'}
                    emissiveIntensity={windowGlow ? 0.7 : 0.25}
                />
            </mesh>
            {/* Cửa sổ 2 */}
            <mesh position={[1.1, 1.6, 1.76]}>
                <planeGeometry args={[0.7, 0.7]} />
                <meshStandardMaterial
                    color={windowGlow ? '#fef08a' : '#7dd3fc'}
                    emissive={windowGlow ? '#eab308' : '#0ea5e9'}
                    emissiveIntensity={windowGlow ? 0.7 : 0.25}
                />
            </mesh>

            {/* Cửa sổ bên hông */}
            <mesh position={[1.76, 1.6, 0]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[0.7, 0.7]} />
                <meshStandardMaterial
                    color={windowGlow ? '#fef08a' : '#7dd3fc'}
                    emissive={windowGlow ? '#eab308' : '#0ea5e9'}
                    emissiveIntensity={windowGlow ? 0.7 : 0.25}
                />
            </mesh>

            {/* Nhãn tên nhà (nếu có) */}
            {label && (
                <Text
                    position={[0, 4.4, 0]}
                    fontSize={0.28}
                    color="#f8fafc"
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.03}
                    outlineColor="#09090b"
                >
                    {label}
                </Text>
            )}
        </group>
    )
}
