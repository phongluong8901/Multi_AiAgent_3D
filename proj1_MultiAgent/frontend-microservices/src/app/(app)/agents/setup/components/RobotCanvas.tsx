'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, RoundedBox, Text, Float } from '@react-three/drei'
import { useMemo } from 'react'

type Props = {
    promptId: string | null
    toolCount: number
    modelId: string | null
}

function Robot({ promptId, toolCount, modelId }: Props) {
    const hasPrompt = Boolean(promptId)
    const hasTools = toolCount > 0
    const hasModel = Boolean(modelId)

    const headColor = hasPrompt ? '#60a5fa' : '#3f3f46'
    const bodyColor = hasModel ? '#34d399' : '#3f3f46'
    const armColor = hasTools ? '#f472b6' : '#3f3f46'

    return (
        <Float speed={1.4} rotationIntensity={0.15} floatIntensity={0.35}>
            <group position={[0, -0.6, 0]}>
                {/* ===== HEAD ===== */}
                <RoundedBox args={[0.95, 0.75, 0.75]} radius={0.1} position={[0, 1.65, 0]}>
                    <meshStandardMaterial
                        color={headColor}
                        metalness={0.45}
                        roughness={0.25}
                        emissive={hasPrompt ? '#1e3a8a' : '#000000'}
                        emissiveIntensity={hasPrompt ? 0.35 : 0}
                    />
                </RoundedBox>

                {/* Eyes */}
                <mesh position={[-0.23, 1.75, 0.38]}>
                    <sphereGeometry args={[0.09, 16, 16]} />
                    <meshStandardMaterial
                        color="#e0f2fe"
                        emissive="#38bdf8"
                        emissiveIntensity={hasPrompt ? 1.2 : 0.3}
                    />
                </mesh>
                <mesh position={[0.23, 1.75, 0.38]}>
                    <sphereGeometry args={[0.09, 16, 16]} />
                    <meshStandardMaterial
                        color="#e0f2fe"
                        emissive="#38bdf8"
                        emissiveIntensity={hasPrompt ? 1.2 : 0.3}
                    />
                </mesh>

                {/* Antenna */}
                <mesh position={[0, 2.15, 0]}>
                    <cylinderGeometry args={[0.03, 0.03, 0.25]} />
                    <meshStandardMaterial color="#71717a" />
                </mesh>
                <mesh position={[0, 2.32, 0]}>
                    <sphereGeometry args={[0.07]} />
                    <meshStandardMaterial
                        color={hasPrompt ? '#60a5fa' : '#52525b'}
                        emissive={hasPrompt ? '#3b82f6' : '#000'}
                        emissiveIntensity={hasPrompt ? 0.8 : 0}
                    />
                </mesh>

                {/* ===== BODY ===== */}
                <RoundedBox args={[1.25, 1.45, 0.75]} radius={0.12} position={[0, 0.55, 0]}>
                    <meshStandardMaterial
                        color={bodyColor}
                        metalness={0.35}
                        roughness={0.35}
                        emissive={hasModel ? '#064e3b' : '#000000'}
                        emissiveIntensity={hasModel ? 0.3 : 0}
                    />
                </RoundedBox>

                {/* Core glow */}
                {hasModel && (
                    <mesh position={[0, 0.55, 0.4]}>
                        <circleGeometry args={[0.22, 32]} />
                        <meshStandardMaterial
                            color="#34d399"
                            emissive="#10b981"
                            emissiveIntensity={1.5}
                            transparent
                            opacity={0.85}
                        />
                    </mesh>
                )}

                {/* ===== ARMS ===== */}
                <RoundedBox args={[0.38, 1.15, 0.38]} radius={0.08} position={[-0.95, 0.65, 0]}>
                    <meshStandardMaterial
                        color={armColor}
                        metalness={0.35}
                        roughness={0.35}
                        emissive={hasTools ? '#831843' : '#000'}
                        emissiveIntensity={hasTools ? 0.35 : 0}
                    />
                </RoundedBox>
                <RoundedBox args={[0.38, 1.15, 0.38]} radius={0.08} position={[0.95, 0.65, 0]}>
                    <meshStandardMaterial
                        color={armColor}
                        metalness={0.35}
                        roughness={0.35}
                        emissive={hasTools ? '#831843' : '#000'}
                        emissiveIntensity={hasTools ? 0.35 : 0}
                    />
                </RoundedBox>

                {/* Hands */}
                <mesh position={[-0.95, 0.0, 0]}>
                    <sphereGeometry args={[0.2]} />
                    <meshStandardMaterial color={armColor} metalness={0.4} roughness={0.3} />
                </mesh>
                <mesh position={[0.95, 0.0, 0]}>
                    <sphereGeometry args={[0.2]} />
                    <meshStandardMaterial color={armColor} metalness={0.4} roughness={0.3} />
                </mesh>

                {/* ===== LEGS ===== */}
                <RoundedBox args={[0.42, 0.95, 0.42]} radius={0.08} position={[-0.38, -0.75, 0]}>
                    <meshStandardMaterial color="#27272a" metalness={0.2} roughness={0.5} />
                </RoundedBox>
                <RoundedBox args={[0.42, 0.95, 0.42]} radius={0.08} position={[0.38, -0.75, 0]}>
                    <meshStandardMaterial color="#27272a" metalness={0.2} roughness={0.5} />
                </RoundedBox>

                {/* Label */}
                <Text
                    position={[0, 2.55, 0]}
                    fontSize={0.2}
                    color="#a1a1aa"
                    anchorX="center"
                    anchorY="middle"
                >
                    AGENT CORE
                </Text>
            </group>
        </Float>
    )
}

export default function RobotCanvas({ promptId, toolCount, modelId }: Props) {
    return (
        <div className="relative h-[400px] w-full rounded-2xl overflow-hidden border border-zinc-800 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black">
            {/* Status badges */}
            <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1.5">
                {promptId && (
                    <span className="rounded-full bg-blue-500/20 text-blue-300 text-[10px] px-2 py-0.5 border border-blue-500/30">
                        Prompt
                    </span>
                )}
                {toolCount > 0 && (
                    <span className="rounded-full bg-pink-500/20 text-pink-300 text-[10px] px-2 py-0.5 border border-pink-500/30">
                        {toolCount} Tool{toolCount > 1 ? 's' : ''}
                    </span>
                )}
                {modelId && (
                    <span className="rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 border border-emerald-500/30">
                        Model
                    </span>
                )}
            </div>

            <Canvas camera={{ position: [0, 1.4, 4.5], fov: 40 }} dpr={[1, 1.5]}>
                <color attach="background" args={['#09090b']} />
                <ambientLight intensity={0.4} />
                <directionalLight position={[6, 10, 4]} intensity={1.2} castShadow />
                <pointLight position={[-5, 4, 3]} intensity={0.5} color="#60a5fa" />
                <pointLight position={[4, 2, -2]} intensity={0.3} color="#34d399" />

                <Robot promptId={promptId} toolCount={toolCount} modelId={modelId} />

                <OrbitControls
                    enablePan={false}
                    minDistance={3.2}
                    maxDistance={7}
                    maxPolarAngle={Math.PI / 1.7}
                    minPolarAngle={Math.PI / 4}
                />
            </Canvas>
        </div>
    )
}