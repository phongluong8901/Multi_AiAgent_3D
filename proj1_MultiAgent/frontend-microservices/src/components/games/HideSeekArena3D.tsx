'use client'

import React, { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import * as THREE from 'three'

export type HideSeekAgent = {
    id: string
    name: string
    role: 'seeker' | 'hider'
    x: number
    z: number
    heading: number
    color: string
    isTagged?: boolean
    isCovered?: boolean
    isSpotted?: boolean
    isControlled?: boolean
}

export type ArenaWall = {
    x: number
    z: number
    w: number
    d: number
    h: number
}

type HideSeekArena3DProps = {
    agents: HideSeekAgent[]
    walls: ArenaWall[]
    roundTimeRemaining: number
    hidersLeft: number
    totalHiders: number
    seekerScore: number
    hiderScore: number
    isPlayerMode?: boolean
    onPlayerMove?: (move: { x: number; z: number }) => void
}

/** Tường chắn và khối hộp che khuất trong mê cung */
function MazeObstacles({ walls }: { walls: ArenaWall[] }) {
    return (
        <group>
            {walls.map((w, idx) => (
                <mesh key={idx} position={[w.x, w.h / 2, w.z]} castShadow receiveShadow>
                    <boxGeometry args={[w.w, w.h, w.d]} />
                    <meshStandardMaterial
                        color="#1e293b"
                        metalness={0.7}
                        roughness={0.3}
                    />
                </mesh>
            ))}

            {/* Viền tường ngoài bao quanh toàn bộ đấu trường 24x24 */}
            <mesh position={[0, 1.0, -12.2]}>
                <boxGeometry args={[24.8, 2.0, 0.4]} />
                <meshStandardMaterial color="#0284c7" transparent opacity={0.35} metalness={0.9} roughness={0.1} />
            </mesh>
            <mesh position={[0, 1.0, 12.2]}>
                <boxGeometry args={[24.8, 2.0, 0.4]} />
                <meshStandardMaterial color="#0284c7" transparent opacity={0.35} metalness={0.9} roughness={0.1} />
            </mesh>
            <mesh position={[-12.2, 1.0, 0]}>
                <boxGeometry args={[0.4, 2.0, 24.8]} />
                <meshStandardMaterial color="#0284c7" transparent opacity={0.35} metalness={0.9} roughness={0.1} />
            </mesh>
            <mesh position={[12.2, 1.0, 0]}>
                <boxGeometry args={[0.4, 2.0, 24.8]} />
                <meshStandardMaterial color="#0284c7" transparent opacity={0.35} metalness={0.9} roughness={0.1} />
            </mesh>
        </group>
    )
}

/** Robot Agent (Seeker hoặc Hider) với nón tầm nhìn và trạng thái ẩn nấp */
function HideSeekAgentMesh({ agent }: { agent: HideSeekAgent }) {
    const groupRef = useRef<THREE.Group>(null)
    const visionConeRef = useRef<THREE.Mesh>(null)

    useFrame((_, delta) => {
        if (!groupRef.current) return
        groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, agent.x, delta * 15)
        groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, agent.z, delta * 15)

        const targetRotY = -agent.heading
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, delta * 18)
    })

    const isSeeker = agent.role === 'seeker'
    const color = isSeeker ? '#f97316' : '#10b981'

    return (
        <group ref={groupRef} position={[agent.x, 0.4, agent.z]}>
            {/* Nón tầm nhìn 3D (Vision Cone) rọi về phía trước (chỉ Seeker) */}
            {isSeeker && (
                <mesh
                    ref={visionConeRef}
                    position={[4.0, -0.38, 0]}
                    rotation={[-Math.PI / 2, 0, -Math.PI / 2]}
                >
                    <coneGeometry args={[4.2, 8.0, 32, 1, false, -Math.PI / 4, Math.PI / 2]} />
                    <meshBasicMaterial
                        color="#f97316"
                        side={THREE.DoubleSide}
                        transparent
                        opacity={0.18}
                    />
                </mesh>
            )}

            {/* Vòng sáng LED dưới chân */}
            <mesh position={[0, -0.38, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.45, 0.6, 28]} />
                <meshBasicMaterial
                    color={agent.isTagged ? '#64748b' : agent.isControlled ? '#a855f7' : color}
                    side={THREE.DoubleSide}
                    transparent
                    opacity={agent.isTagged ? 0.3 : 0.8}
                />
            </mesh>

            {/* Thân Robot */}
            <mesh castShadow position={[0, 0, 0]}>
                <cylinderGeometry args={[0.34, 0.4, 0.5, 20]} />
                <meshStandardMaterial
                    color={agent.isTagged ? '#334155' : isSeeker ? '#7c2d12' : '#064e3b'}
                    metalness={0.7}
                    roughness={0.25}
                    transparent={agent.isTagged}
                    opacity={agent.isTagged ? 0.4 : 1.0}
                />
            </mesh>

            {/* Đầu vòm Robot */}
            <mesh position={[0, 0.35, 0]}>
                <sphereGeometry args={[0.27, 20, 20]} />
                <meshStandardMaterial
                    color="#0f172a"
                    metalness={0.9}
                    roughness={0.1}
                    transparent={agent.isTagged}
                    opacity={agent.isTagged ? 0.4 : 1.0}
                />
            </mesh>

            {/* Mắt quét Sensor Kính Neon */}
            <mesh position={[0.2, 0.35, 0]}>
                <boxGeometry args={[0.14, 0.08, 0.28]} />
                <meshStandardMaterial
                    color={agent.isTagged ? '#64748b' : color}
                    emissive={agent.isTagged ? '#000000' : color}
                    emissiveIntensity={agent.isTagged ? 0 : 2.5}
                />
            </mesh>

            {/* Tên Agent & Trạng thái */}
            <Text
                position={[0, 0.85, 0]}
                fontSize={0.2}
                color={agent.isControlled ? '#e9d5ff' : '#ffffff'}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.03}
                outlineColor="#020617"
            >
                {agent.isControlled ? `★ ${agent.name} (BẠN)` : agent.name}
            </Text>

            <Text
                position={[0, 0.65, 0]}
                fontSize={0.13}
                color={
                    agent.isTagged
                        ? '#94a3b8'
                        : isSeeker
                        ? '#fdba74'
                        : agent.isSpotted
                        ? '#f87171'
                        : agent.isCovered
                        ? '#86efac'
                        : '#6ee7b7'
                }
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.02}
                outlineColor="#020617"
            >
                {agent.isTagged
                    ? 'BỊ BẮT ✘'
                    : isSeeker
                    ? 'THỢ SĂN 👁'
                    : agent.isSpotted
                    ? 'BỊ PHÁT HIỆN ⚠'
                    : agent.isCovered
                    ? 'ẨN NẤP KÍN ✓'
                    : 'ĐANG NẤP'}
            </Text>
        </group>
    )
}

export default function HideSeekArena3D({
    agents,
    walls,
    roundTimeRemaining,
    hidersLeft,
    totalHiders,
    seekerScore,
    hiderScore,
    isPlayerMode,
    onPlayerMove
}: HideSeekArena3DProps) {
    // Keyboard controls for Player Mode
    useEffect(() => {
        if (!isPlayerMode || !onPlayerMove) return

        const activeKeys: Record<string, boolean> = {}

        const handleKeyDown = (e: KeyboardEvent) => {
            activeKeys[e.key.toLowerCase()] = true

            let dx = 0
            let dz = 0

            if (activeKeys['arrowup'] || activeKeys['w']) dz -= 1
            if (activeKeys['arrowdown'] || activeKeys['s']) dz += 1
            if (activeKeys['arrowleft'] || activeKeys['a']) dx -= 1
            if (activeKeys['arrowright'] || activeKeys['d']) dx += 1

            if (dx !== 0 || dz !== 0) {
                onPlayerMove({ x: dx, z: dz })
            }
        }

        const handleKeyUp = (e: KeyboardEvent) => {
            activeKeys[e.key.toLowerCase()] = false
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
        }
    }, [isPlayerMode, onPlayerMove])

    return (
        <div className="w-full h-[520px] bg-zinc-950 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl relative">
            {/* Top HUD: Đếm ngược ván đấu & Số hider còn lại */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 bg-zinc-950/85 backdrop-blur-md px-6 py-2 rounded-2xl border border-zinc-800 shadow-xl pointer-events-none">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-semibold text-emerald-400">
                        Hiders còn sống: <strong className="text-white text-sm">{hidersLeft} / {totalHiders}</strong>
                    </span>
                </div>

                <div className="text-xl font-black text-amber-400 px-3 py-0.5 rounded-xl bg-zinc-900 border border-zinc-700/60 font-mono">
                    ⏱ {Math.max(0, Math.floor(roundTimeRemaining))}s
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-orange-400">
                        Seeker thắng: <strong className="text-white text-sm">{seekerScore}</strong> - Hider thắng: <strong className="text-white text-sm">{hiderScore}</strong>
                    </span>
                    <span className="w-3 h-3 rounded-full bg-orange-500" />
                </div>
            </div>

            {/* Player Mode Guide Badge */}
            {isPlayerMode && (
                <div className="absolute bottom-4 left-4 z-10 px-3 py-1.5 rounded-xl bg-purple-950/85 backdrop-blur-md border border-purple-500/40 text-xs text-purple-200 pointer-events-none">
                    🎮 <strong>Điều khiển:</strong> Phím mũi tên / WASD để điều khiển Robot né tránh nón tầm nhìn của Seeker!
                </div>
            )}

            <Canvas
                shadows
                camera={{ position: [0, 22, 16], fov: 44 }}
                style={{ width: '100%', height: '100%' }}
            >
                <ambientLight intensity={0.65} />
                <directionalLight
                    castShadow
                    position={[12, 28, 12]}
                    intensity={1.1}
                    shadow-mapSize={[1024, 1024]}
                />
                <pointLight position={[0, 8, 0]} intensity={0.4} color="#38bdf8" />

                {/* Sàn đấu Labyrinth Cyber */}
                <mesh receiveShadow position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[26, 26]} />
                    <meshStandardMaterial color="#0b1120" metalness={0.3} roughness={0.7} />
                </mesh>

                {/* Lưới tọa độ sàn */}
                <gridHelper args={[24, 24, '#1e293b', '#0f172a']} position={[0, 0.002, 0]} />

                <MazeObstacles walls={walls} />

                {agents.map((ag) => (
                    <HideSeekAgentMesh key={ag.id} agent={ag} />
                ))}

                <OrbitControls
                    maxPolarAngle={Math.PI / 2.15}
                    minDistance={8}
                    maxDistance={38}
                    target={[0, 0, 0]}
                />
            </Canvas>
        </div>
    )
}
