'use client'

import React, { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, Float } from '@react-three/drei'
import * as THREE from 'three'

export type SoccerPlayer = {
    id: string
    name: string
    team: 'blue' | 'red'
    role: 'striker' | 'keeper'
    x: number
    z: number
    vx: number
    vz: number
    heading: number
    color: string
    isControlled?: boolean
}

export type SoccerBall = {
    x: number
    z: number
    vx: number
    vz: number
    radius: number
}

type SoccerArena3DProps = {
    players: SoccerPlayer[]
    ball: SoccerBall
    score: { blue: number; red: number }
    isSimulating: boolean
    gameSpeed: number
    onGoal?: (team: 'blue' | 'red') => void
    onPlayerMove?: (move: { x: number; z: number; kick: boolean }) => void
    isPlayerMode?: boolean
}

const FIELD_WIDTH = 26  // X-axis (-13 to +13)
const FIELD_DEPTH = 16  // Z-axis (-8 to +8)
const GOAL_WIDTH = 4.4
const GOAL_DEPTH = 1.6
const GOAL_HEIGHT = 1.8

/** Mô hình Robot Cầu thủ 3D */
function RobotPlayerMesh({
    player
}: {
    player: SoccerPlayer
}) {
    const groupRef = useRef<THREE.Group>(null)
    const ringRef = useRef<THREE.Mesh>(null)

    useFrame((_, delta) => {
        if (!groupRef.current) return
        groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, player.x, delta * 15)
        groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, player.z, delta * 15)

        const targetRotY = -player.heading
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, delta * 18)

        if (ringRef.current) {
            ringRef.current.rotation.z += delta * 2.0
        }
    })

    const isBlue = player.team === 'blue'
    const teamColor = isBlue ? '#3b82f6' : '#ef4444'

    return (
        <group ref={groupRef} position={[player.x, 0.4, player.z]}>
            {/* Vòng hào quang sáng chân cầu thủ */}
            <mesh ref={ringRef} position={[0, -0.38, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.45, 0.62, 28]} />
                <meshBasicMaterial
                    color={player.isControlled ? '#a855f7' : teamColor}
                    side={THREE.DoubleSide}
                    transparent
                    opacity={player.isControlled ? 0.95 : 0.75}
                />
            </mesh>

            {/* Thân Robot Cầu thủ */}
            <mesh castShadow position={[0, 0, 0]}>
                <cylinderGeometry args={[0.36, 0.42, 0.52, 20]} />
                <meshStandardMaterial
                    color={player.isControlled ? '#4c1d95' : isBlue ? '#1e3a8a' : '#7f1d1d'}
                    metalness={0.7}
                    roughness={0.25}
                />
            </mesh>

            {/* Đầu vòm Robot */}
            <mesh position={[0, 0.36, 0]}>
                <sphereGeometry args={[0.28, 20, 20]} />
                <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} />
            </mesh>

            {/* Kính ngắm visor cầu thủ phát quang */}
            <mesh position={[0.2, 0.36, 0]}>
                <boxGeometry args={[0.15, 0.09, 0.3]} />
                <meshStandardMaterial
                    color={player.isControlled ? '#c084fc' : teamColor}
                    emissive={player.isControlled ? '#c084fc' : teamColor}
                    emissiveIntensity={2.5}
                />
            </mesh>

            {/* Mũi khoan đá bóng phía trước chân */}
            <mesh position={[0.42, -0.22, 0]}>
                <boxGeometry args={[0.18, 0.12, 0.28]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
            </mesh>

            {/* Tên & Vai trò cầu thủ lơ lửng trên đầu */}
            <Text
                position={[0, 0.88, 0]}
                fontSize={0.2}
                color={player.isControlled ? '#e9d5ff' : '#ffffff'}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.03}
                outlineColor="#020617"
            >
                {player.isControlled ? `★ ${player.name} (BẠN)` : player.name}
            </Text>
            <Text
                position={[0, 0.68, 0]}
                fontSize={0.13}
                color={isBlue ? '#93c5fd' : '#fca5a5'}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.02}
                outlineColor="#020617"
            >
                {player.role === 'keeper' ? 'THỦ MÔN' : 'TIỀN ĐẠO'}
            </Text>
        </group>
    )
}

/** Quả bóng đá 3D với hiệu ứng hào quang phát quang */
function SoccerBallMesh({ ball }: { ball: SoccerBall }) {
    const ballRef = useRef<THREE.Mesh>(null)

    useFrame((_, delta) => {
        if (!ballRef.current) return
        ballRef.current.position.x = THREE.MathUtils.lerp(ballRef.current.position.x, ball.x, delta * 20)
        ballRef.current.position.z = THREE.MathUtils.lerp(ballRef.current.position.z, ball.z, delta * 20)

        // Lăn bóng theo vận tốc
        ballRef.current.rotation.z -= ball.vx * delta * 5.0
        ballRef.current.rotation.x += ball.vz * delta * 5.0
    })

    return (
        <group>
            {/* Bóng đổ quả bóng trên mặt cỏ */}
            <mesh position={[ball.x, 0.02, ball.z]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[ball.radius * 1.2, 24]} />
                <meshBasicMaterial color="#000000" transparent opacity={0.4} />
            </mesh>

            {/* Quả bóng 3D */}
            <mesh ref={ballRef} position={[ball.x, ball.radius, ball.z]} castShadow>
                <sphereGeometry args={[ball.radius, 24, 24]} />
                <meshStandardMaterial
                    color="#f8fafc"
                    emissive="#38bdf8"
                    emissiveIntensity={0.35}
                    metalness={0.2}
                    roughness={0.4}
                />
            </mesh>
        </group>
    )
}

/** Sân bóng đá Cyber Stadium 3D */
function SoccerStadium() {
    return (
        <group>
            {/* Thảm cỏ Cyber Grass */}
            <mesh receiveShadow position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[FIELD_WIDTH + 4, FIELD_DEPTH + 4]} />
                <meshStandardMaterial color="#064e3b" metalness={0.1} roughness={0.9} />
            </mesh>

            {/* Vạch kẻ sân bóng đá (Field lines) */}
            {/* 1. Viền ngoài sân */}
            <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[FIELD_WIDTH, FIELD_DEPTH]} />
                <meshBasicMaterial color="#10b981" wireframe />
            </mesh>

            {/* 2. Đường giữa sân */}
            <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.08, FIELD_DEPTH]} />
                <meshBasicMaterial color="#ecfdf5" opacity={0.8} transparent />
            </mesh>

            {/* 3. Vòng tròn trung tâm */}
            <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[2.4, 2.48, 48]} />
                <meshBasicMaterial color="#ecfdf5" opacity={0.8} transparent side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.2, 20]} />
                <meshBasicMaterial color="#ecfdf5" />
            </mesh>

            {/* 4. Vòng cấm địa Đội Xanh (Bên trái X = -FIELD_WIDTH/2) */}
            <mesh position={[-FIELD_WIDTH / 2 + 2.5, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[5.0, 8.0]} />
                <meshBasicMaterial color="#34d399" wireframe />
            </mesh>

            {/* 5. Vòng cấm địa Đội Đỏ (Bên phải X = +FIELD_WIDTH/2) */}
            <mesh position={[FIELD_WIDTH / 2 - 2.5, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[5.0, 8.0]} />
                <meshBasicMaterial color="#34d399" wireframe />
            </mesh>

            {/* Tường biên kính bao quanh sân để bóng không văng ra ngoài */}
            <mesh position={[0, 0.6, -FIELD_DEPTH / 2 - 0.2]}>
                <boxGeometry args={[FIELD_WIDTH + 2, 1.2, 0.2]} />
                <meshStandardMaterial color="#0284c7" transparent opacity={0.3} metalness={0.9} roughness={0.1} />
            </mesh>
            <mesh position={[0, 0.6, FIELD_DEPTH / 2 + 0.2]}>
                <boxGeometry args={[FIELD_WIDTH + 2, 1.2, 0.2]} />
                <meshStandardMaterial color="#0284c7" transparent opacity={0.3} metalness={0.9} roughness={0.1} />
            </mesh>

            {/* Tường biên 2 đầu sân (chừa khe khung thành) */}
            {/* Đầu sân Đội Xanh (X = -FIELD_WIDTH / 2) */}
            <mesh position={[-FIELD_WIDTH / 2 - 0.2, 0.6, -FIELD_DEPTH / 4 - GOAL_WIDTH / 4]}>
                <boxGeometry args={[0.2, 1.2, FIELD_DEPTH / 2 - GOAL_WIDTH / 2]} />
                <meshStandardMaterial color="#0284c7" transparent opacity={0.3} metalness={0.9} roughness={0.1} />
            </mesh>
            <mesh position={[-FIELD_WIDTH / 2 - 0.2, 0.6, FIELD_DEPTH / 4 + GOAL_WIDTH / 4]}>
                <boxGeometry args={[0.2, 1.2, FIELD_DEPTH / 2 - GOAL_WIDTH / 2]} />
                <meshStandardMaterial color="#0284c7" transparent opacity={0.3} metalness={0.9} roughness={0.1} />
            </mesh>

            {/* Đầu sân Đội Đỏ (X = +FIELD_WIDTH / 2) */}
            <mesh position={[FIELD_WIDTH / 2 + 0.2, 0.6, -FIELD_DEPTH / 4 - GOAL_WIDTH / 4]}>
                <boxGeometry args={[0.2, 1.2, FIELD_DEPTH / 2 - GOAL_WIDTH / 2]} />
                <meshStandardMaterial color="#0284c7" transparent opacity={0.3} metalness={0.9} roughness={0.1} />
            </mesh>
            <mesh position={[FIELD_WIDTH / 2 + 0.2, 0.6, FIELD_DEPTH / 4 + GOAL_WIDTH / 4]}>
                <boxGeometry args={[0.2, 1.2, FIELD_DEPTH / 2 - GOAL_WIDTH / 2]} />
                <meshStandardMaterial color="#0284c7" transparent opacity={0.3} metalness={0.9} roughness={0.1} />
            </mesh>

            {/* Khung thành Đội Xanh (Bên Trái) */}
            <group position={[-FIELD_WIDTH / 2 - GOAL_DEPTH / 2, 0, 0]}>
                {/* Khung xà ngang */}
                <mesh position={[GOAL_DEPTH / 2, GOAL_HEIGHT, 0]}>
                    <boxGeometry args={[0.12, 0.12, GOAL_WIDTH]} />
                    <meshStandardMaterial color="#ffffff" metalness={0.8} />
                </mesh>
                {/* 2 Cột dọc */}
                <mesh position={[GOAL_DEPTH / 2, GOAL_HEIGHT / 2, -GOAL_WIDTH / 2]}>
                    <cylinderGeometry args={[0.07, 0.07, GOAL_HEIGHT, 16]} />
                    <meshStandardMaterial color="#ffffff" metalness={0.8} />
                </mesh>
                <mesh position={[GOAL_DEPTH / 2, GOAL_HEIGHT / 2, GOAL_WIDTH / 2]}>
                    <cylinderGeometry args={[0.07, 0.07, GOAL_HEIGHT, 16]} />
                    <meshStandardMaterial color="#ffffff" metalness={0.8} />
                </mesh>
                {/* Lưới khung thành Blue */}
                <mesh position={[0, GOAL_HEIGHT / 2, 0]}>
                    <boxGeometry args={[GOAL_DEPTH, GOAL_HEIGHT, GOAL_WIDTH]} />
                    <meshBasicMaterial color="#3b82f6" wireframe transparent opacity={0.35} />
                </mesh>
            </group>

            {/* Khung thành Đội Đỏ (Bên Phải) */}
            <group position={[FIELD_WIDTH / 2 + GOAL_DEPTH / 2, 0, 0]}>
                {/* Khung xà ngang */}
                <mesh position={[-GOAL_DEPTH / 2, GOAL_HEIGHT, 0]}>
                    <boxGeometry args={[0.12, 0.12, GOAL_WIDTH]} />
                    <meshStandardMaterial color="#ffffff" metalness={0.8} />
                </mesh>
                {/* 2 Cột dọc */}
                <mesh position={[-GOAL_DEPTH / 2, GOAL_HEIGHT / 2, -GOAL_WIDTH / 2]}>
                    <cylinderGeometry args={[0.07, 0.07, GOAL_HEIGHT, 16]} />
                    <meshStandardMaterial color="#ffffff" metalness={0.8} />
                </mesh>
                <mesh position={[-GOAL_DEPTH / 2, GOAL_HEIGHT / 2, GOAL_WIDTH / 2]}>
                    <cylinderGeometry args={[0.07, 0.07, GOAL_HEIGHT, 16]} />
                    <meshStandardMaterial color="#ffffff" metalness={0.8} />
                </mesh>
                {/* Lưới khung thành Red */}
                <mesh position={[0, GOAL_HEIGHT / 2, 0]}>
                    <boxGeometry args={[GOAL_DEPTH, GOAL_HEIGHT, GOAL_WIDTH]} />
                    <meshBasicMaterial color="#ef4444" wireframe transparent opacity={0.35} />
                </mesh>
            </group>
        </group>
    )
}

export default function SoccerArena3D({
    players,
    ball,
    score,
    isSimulating,
    gameSpeed,
    onGoal,
    onPlayerMove,
    isPlayerMode
}: SoccerArena3DProps) {
    // Keyboard controls for Player Mode
    useEffect(() => {
        if (!isPlayerMode || !onPlayerMove) return

        const activeKeys: Record<string, boolean> = {}

        const handleKeyDown = (e: KeyboardEvent) => {
            activeKeys[e.key.toLowerCase()] = true

            let dx = 0
            let dz = 0
            const kick = activeKeys[' '] || activeKeys['enter']

            if (activeKeys['arrowup'] || activeKeys['w']) dz -= 1
            if (activeKeys['arrowdown'] || activeKeys['s']) dz += 1
            if (activeKeys['arrowleft'] || activeKeys['a']) dx -= 1
            if (activeKeys['arrowright'] || activeKeys['d']) dx += 1

            if (dx !== 0 || dz !== 0 || kick) {
                onPlayerMove({ x: dx, z: dz, kick: !!kick })
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
            {/* Top Scoreboard HUD trực quan trên sàn đấu */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 bg-zinc-950/85 backdrop-blur-md px-6 py-2 rounded-2xl border border-zinc-800 shadow-xl pointer-events-none">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500 shadow-sm" />
                    <span className="text-sm font-bold text-blue-400">BLUE TEAM</span>
                </div>
                <div className="text-2xl font-black text-white px-3 py-0.5 rounded-xl bg-zinc-900 border border-zinc-700/60 font-mono tracking-wider">
                    {score.blue} : {score.red}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-rose-400">RED TEAM</span>
                    <span className="w-3 h-3 rounded-full bg-rose-500 shadow-sm" />
                </div>
            </div>

            {/* Player Mode Guide Badge */}
            {isPlayerMode && (
                <div className="absolute bottom-4 left-4 z-10 px-3 py-1.5 rounded-xl bg-purple-950/85 backdrop-blur-md border border-purple-500/40 text-xs text-purple-200 pointer-events-none">
                    🎮 <strong>Điều khiển:</strong> Phím mũi tên / WASD để chạy, Phím Space để sút bóng mạnh!
                </div>
            )}

            <Canvas
                shadows
                camera={{ position: [0, 20, 18], fov: 42 }}
                style={{ width: '100%', height: '100%' }}
            >
                <ambientLight intensity={0.7} />
                <directionalLight
                    castShadow
                    position={[10, 25, 10]}
                    intensity={1.2}
                    shadow-mapSize={[1024, 1024]}
                />
                <pointLight position={[-10, 8, -5]} intensity={0.5} color="#3b82f6" />
                <pointLight position={[10, 8, 5]} intensity={0.5} color="#ef4444" />

                <SoccerStadium />

                {players.map((p) => (
                    <RobotPlayerMesh key={p.id} player={p} />
                ))}

                <SoccerBallMesh ball={ball} />

                <OrbitControls
                    maxPolarAngle={Math.PI / 2.15}
                    minDistance={8}
                    maxDistance={35}
                    target={[0, 0, 0]}
                />
            </Canvas>
        </div>
    )
}
