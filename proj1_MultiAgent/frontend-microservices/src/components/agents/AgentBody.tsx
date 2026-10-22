'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'

type Props = {
    color?: string
    promptColor?: string | null
    toolsColor?: string | null
    modelColor?: string | null
    sitting?: boolean
    walking?: boolean
    working?: boolean
}

export default function AgentBody({
    color = '#4299e1',
    promptColor = null,
    toolsColor = null,
    modelColor = null,
    sitting = false,
    walking = false,
    working = false,
}: Props) {
    const leftArmRef = useRef<THREE.Group>(null)
    const rightArmRef = useRef<THREE.Group>(null)
    const leftLegRef = useRef<THREE.Group>(null)
    const rightLegRef = useRef<THREE.Group>(null)

    // Màu thực tế cho từng bộ phận
    const headColor = promptColor || '#3f3f46'
    const armColor = toolsColor || color
    const bodyColor = modelColor || color

    useFrame((state) => {
        if (sitting) return

        if (walking) {
            const t = state.clock.elapsedTime * 9
            const swing = Math.sin(t) * 0.42
            if (leftLegRef.current) leftLegRef.current.rotation.x = swing
            if (rightLegRef.current) rightLegRef.current.rotation.x = -swing
            if (leftArmRef.current) leftArmRef.current.rotation.x = -swing * 0.7
            if (rightArmRef.current) rightArmRef.current.rotation.x = swing * 0.7
        } else {
            const idle = Math.sin(state.clock.elapsedTime * 1.8) * 0.05
            if (leftArmRef.current) leftArmRef.current.rotation.x = working ? 0.65 : idle
            if (rightArmRef.current) rightArmRef.current.rotation.x = working ? 0.65 : -idle
            if (leftLegRef.current) leftLegRef.current.rotation.x = 0
            if (rightLegRef.current) rightLegRef.current.rotation.x = 0
        }
    })

    // ====================== SITTING ======================
    if (sitting) {
        return (
            <group position={[0, -0.15, 0]}>
                {/* Head */}
                <RoundedBox args={[0.52, 0.42, 0.42]} radius={0.08} position={[0, 1.35, 0]} castShadow>
                    <meshStandardMaterial
                        color={headColor}
                        metalness={0.4}
                        roughness={0.3}
                        emissive={promptColor ? headColor : '#000000'}
                        emissiveIntensity={promptColor ? 0.25 : 0}
                    />
                </RoundedBox>

                {/* Eyes */}
                <mesh position={[-0.12, 1.4, 0.22]}>
                    <sphereGeometry args={[0.05, 12, 12]} />
                    <meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={0.9} />
                </mesh>
                <mesh position={[0.12, 1.4, 0.22]}>
                    <sphereGeometry args={[0.05, 12, 12]} />
                    <meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={0.9} />
                </mesh>

                {/* Antenna */}
                <mesh position={[0, 1.62, 0]}>
                    <cylinderGeometry args={[0.02, 0.02, 0.14]} />
                    <meshStandardMaterial color="#71717a" />
                </mesh>
                <mesh position={[0, 1.72, 0]}>
                    <sphereGeometry args={[0.045]} />
                    <meshStandardMaterial
                        color={promptColor || color}
                        emissive={promptColor || color}
                        emissiveIntensity={0.6}
                    />
                </mesh>

                {/* Body */}
                <RoundedBox args={[0.68, 0.55, 0.38]} radius={0.08} position={[0, 0.85, 0]} castShadow>
                    <meshStandardMaterial
                        color={bodyColor}
                        metalness={0.35}
                        roughness={0.35}
                        emissive={modelColor ? bodyColor : '#000000'}
                        emissiveIntensity={modelColor ? 0.2 : 0}
                    />
                </RoundedBox>

                {/* Core */}
                <mesh position={[0, 0.85, 0.2]}>
                    <circleGeometry args={[0.11, 24]} />
                    <meshStandardMaterial
                        color={bodyColor}
                        emissive={bodyColor}
                        emissiveIntensity={modelColor ? 1.0 : 0.4}
                        transparent
                        opacity={0.8}
                    />
                </mesh>

                {/* Arms */}
                <RoundedBox args={[0.18, 0.38, 0.18]} radius={0.04} position={[-0.48, 0.82, 0.12]} rotation={[0.5, 0, 0]} castShadow>
                    <meshStandardMaterial color={armColor} metalness={0.3} roughness={0.4} />
                </RoundedBox>
                <RoundedBox args={[0.18, 0.38, 0.18]} radius={0.04} position={[0.48, 0.82, 0.12]} rotation={[0.5, 0, 0]} castShadow>
                    <meshStandardMaterial color={armColor} metalness={0.3} roughness={0.4} />
                </RoundedBox>

                {/* Legs */}
                <RoundedBox args={[0.2, 0.28, 0.2]} radius={0.04} position={[-0.18, 0.48, 0.22]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                    <meshStandardMaterial color="#27272a" />
                </RoundedBox>
                <RoundedBox args={[0.2, 0.28, 0.2]} radius={0.04} position={[0.18, 0.48, 0.22]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                    <meshStandardMaterial color="#27272a" />
                </RoundedBox>
                <RoundedBox args={[0.18, 0.28, 0.18]} radius={0.04} position={[-0.18, 0.28, 0.38]} castShadow>
                    <meshStandardMaterial color="#27272a" />
                </RoundedBox>
                <RoundedBox args={[0.18, 0.28, 0.18]} radius={0.04} position={[0.18, 0.28, 0.38]} castShadow>
                    <meshStandardMaterial color="#27272a" />
                </RoundedBox>
            </group>
        )
    }

    // ====================== STANDING / WALKING ======================
    return (
        <group>
            {/* Head */}
            <RoundedBox args={[0.55, 0.45, 0.45]} radius={0.09} position={[0, 1.72, 0]} castShadow>
                <meshStandardMaterial
                    color={headColor}
                    metalness={0.4}
                    roughness={0.3}
                    emissive={promptColor ? headColor : '#000000'}
                    emissiveIntensity={promptColor ? 0.3 : 0}
                />
            </RoundedBox>

            {/* Eyes */}
            <mesh position={[-0.13, 1.78, 0.24]}>
                <sphereGeometry args={[0.055, 12, 12]} />
                <meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={1} />
            </mesh>
            <mesh position={[0.13, 1.78, 0.24]}>
                <sphereGeometry args={[0.055, 12, 12]} />
                <meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={1} />
            </mesh>

            {/* Antenna */}
            <mesh position={[0, 2.02, 0]}>
                <cylinderGeometry args={[0.022, 0.022, 0.16]} />
                <meshStandardMaterial color="#71717a" />
            </mesh>
            <mesh position={[0, 2.14, 0]}>
                <sphereGeometry args={[0.05]} />
                <meshStandardMaterial
                    color={promptColor || color}
                    emissive={promptColor || color}
                    emissiveIntensity={0.7}
                />
            </mesh>

            {/* Body */}
            <RoundedBox args={[0.72, 0.85, 0.42]} radius={0.1} position={[0, 1.05, 0]} castShadow>
                <meshStandardMaterial
                    color={bodyColor}
                    metalness={0.35}
                    roughness={0.35}
                    emissive={modelColor ? bodyColor : '#000000'}
                    emissiveIntensity={modelColor ? 0.25 : 0}
                />
            </RoundedBox>

            {/* Core glow */}
            <mesh position={[0, 1.05, 0.22]}>
                <circleGeometry args={[0.13, 24]} />
                <meshStandardMaterial
                    color={bodyColor}
                    emissive={bodyColor}
                    emissiveIntensity={modelColor ? 1.2 : 0.5}
                    transparent
                    opacity={0.85}
                />
            </mesh>

            {/* Left Arm */}
            <group ref={leftArmRef} position={[-0.52, 1.15, 0]}>
                <RoundedBox args={[0.2, 0.65, 0.2]} radius={0.05} castShadow>
                    <meshStandardMaterial
                        color={armColor}
                        metalness={0.3}
                        roughness={0.4}
                        emissive={toolsColor ? armColor : '#000000'}
                        emissiveIntensity={toolsColor ? 0.2 : 0}
                    />
                </RoundedBox>
            </group>

            {/* Right Arm */}
            <group ref={rightArmRef} position={[0.52, 1.15, 0]}>
                <RoundedBox args={[0.2, 0.65, 0.2]} radius={0.05} castShadow>
                    <meshStandardMaterial
                        color={armColor}
                        metalness={0.3}
                        roughness={0.4}
                        emissive={toolsColor ? armColor : '#000000'}
                        emissiveIntensity={toolsColor ? 0.2 : 0}
                    />
                </RoundedBox>
            </group>

            {/* Legs */}
            <group ref={leftLegRef} position={[-0.2, 0.38, 0]}>
                <RoundedBox args={[0.22, 0.55, 0.22]} radius={0.05} castShadow>
                    <meshStandardMaterial color="#27272a" roughness={0.5} />
                </RoundedBox>
            </group>
            <group ref={rightLegRef} position={[0.2, 0.38, 0]}>
                <RoundedBox args={[0.22, 0.55, 0.22]} radius={0.05} castShadow>
                    <meshStandardMaterial color="#27272a" roughness={0.5} />
                </RoundedBox>
            </group>
        </group>
    )
}