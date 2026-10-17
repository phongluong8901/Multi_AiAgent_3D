'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

type Props = {
    color: string
    sitting?: boolean
    walking?: boolean
    working?: boolean
}

export default function AgentBody({ color, sitting = false, walking = false, working = false }: Props) {
    const leftArmRef = useRef<THREE.Mesh>(null)
    const rightArmRef = useRef<THREE.Mesh>(null)
    const leftLegRef = useRef<THREE.Mesh>(null)
    const rightLegRef = useRef<THREE.Mesh>(null)

    useFrame((state) => {
        if (sitting) return

        if (walking) {
            const t = state.clock.elapsedTime * 9
            const swing = Math.sin(t) * 0.45
            if (leftLegRef.current) leftLegRef.current.rotation.x = swing
            if (rightLegRef.current) rightLegRef.current.rotation.x = -swing
            if (leftArmRef.current) leftArmRef.current.rotation.x = -swing * 0.8
            if (rightArmRef.current) rightArmRef.current.rotation.x = swing * 0.8
        } else {
            // Idle breathing
            const idleSwing = Math.sin(state.clock.elapsedTime * 2) * 0.05
            if (leftArmRef.current) leftArmRef.current.rotation.x = working ? 0.8 : idleSwing
            if (rightArmRef.current) rightArmRef.current.rotation.x = working ? 0.8 : -idleSwing
            if (leftLegRef.current) leftLegRef.current.rotation.x = 0
            if (rightLegRef.current) rightLegRef.current.rotation.x = 0
        }
    })

    if (sitting) {
        // Ngồi: thân thấp, chân gập phía trước ghế/sofa/băng ghế
        return (
            <group>
                {/* Đầu */}
                <mesh position={[0, 1.15, 0]} castShadow>
                    <sphereGeometry args={[0.2, 16, 16]} />
                    <meshStandardMaterial color="#f6e05e" roughness={0.4} />
                </mesh>

                {/* Thân */}
                <mesh position={[0, 0.78, 0]} castShadow>
                    <boxGeometry args={[0.38, 0.4, 0.24]} />
                    <meshStandardMaterial color={color} roughness={0.5} />
                </mesh>

                {/* Tay đặt lên đùi hoặc bàn phím */}
                <mesh position={[-0.26, 0.72, 0.12]} rotation={[0.6, 0, 0]} castShadow>
                    <boxGeometry args={[0.1, 0.35, 0.1]} />
                    <meshStandardMaterial color={color} />
                </mesh>
                <mesh position={[0.26, 0.72, 0.12]} rotation={[0.6, 0, 0]} castShadow>
                    <boxGeometry args={[0.1, 0.35, 0.1]} />
                    <meshStandardMaterial color={color} />
                </mesh>

                {/* Đùi gập ngang */}
                <mesh position={[-0.1, 0.48, 0.18]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                    <boxGeometry args={[0.12, 0.28, 0.12]} />
                    <meshStandardMaterial color="#2d3748" />
                </mesh>
                <mesh position={[0.1, 0.48, 0.18]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                    <boxGeometry args={[0.12, 0.28, 0.12]} />
                    <meshStandardMaterial color="#2d3748" />
                </mesh>

                {/* Cẳng chân hạ xuống đất */}
                <mesh position={[-0.1, 0.28, 0.32]} castShadow>
                    <boxGeometry args={[0.11, 0.28, 0.11]} />
                    <meshStandardMaterial color="#2d3748" />
                </mesh>
                <mesh position={[0.1, 0.28, 0.32]} castShadow>
                    <boxGeometry args={[0.11, 0.28, 0.11]} />
                    <meshStandardMaterial color="#2d3748" />
                </mesh>
            </group>
        )
    }

    // Đứng / Đi bộ động (Walking animation)
    return (
        <group>
            {/* Đầu */}
            <mesh position={[0, 1.55, 0]} castShadow>
                <sphereGeometry args={[0.22, 16, 16]} />
                <meshStandardMaterial color="#f6e05e" roughness={0.4} />
            </mesh>

            {/* Thân áo */}
            <mesh position={[0, 1.05, 0]} castShadow>
                <boxGeometry args={[0.4, 0.55, 0.25]} />
                <meshStandardMaterial color={color} roughness={0.5} />
            </mesh>

            {/* Tay trái */}
            <mesh ref={leftArmRef} position={[-0.28, 1.05, 0]} castShadow>
                <boxGeometry args={[0.12, 0.45, 0.12]} />
                <meshStandardMaterial color={color} />
            </mesh>

            {/* Tay phải */}
            <mesh ref={rightArmRef} position={[0.28, 1.05, 0]} castShadow>
                <boxGeometry args={[0.12, 0.45, 0.12]} />
                <meshStandardMaterial color={color} />
            </mesh>

            {/* Chân trái */}
            <mesh ref={leftLegRef} position={[-0.12, 0.45, 0]} castShadow>
                <boxGeometry args={[0.14, 0.5, 0.14]} />
                <meshStandardMaterial color="#2d3748" />
            </mesh>

            {/* Chân phải */}
            <mesh ref={rightLegRef} position={[0.12, 0.45, 0]} castShadow>
                <boxGeometry args={[0.14, 0.5, 0.14]} />
                <meshStandardMaterial color="#2d3748" />
            </mesh>
        </group>
    )
}