'use client'

import React, { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, Float, Grid } from '@react-three/drei'
import * as THREE from 'three'
import { TrajectoryStep, Obstacle } from '@/lib/api'

type RLArena3DProps = {
    agentState: {
        x: number
        z: number
        heading: number
        heading_deg: number
    }
    goalState: {
        x: number
        z: number
        distance: number
    }
    lidar: number[]
    obstacles: Obstacle[]
    trajectory: TrajectoryStep[]
    isTraining: boolean
    lastReason?: string
    agentColor?: string
    agentName?: string
    arenaSize?: number
    mapName?: 'office' | 'grid'
}

/** 1. Mô hình Agent 3D với hướng di chuyển và vòng hào quang */
function Agent3D({
    agentState,
    color = '#3b82f6',
    name = 'Agent'
}: {
    agentState: { x: number; z: number; heading: number }
    color?: string
    name?: string
}) {
    const groupRef = useRef<THREE.Group>(null)
    const ringRef = useRef<THREE.Mesh>(null)

    useFrame((_, delta) => {
        if (!groupRef.current) return
        // Nội suy mượt mà toạ độ và góc xoay
        groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, agentState.x, delta * 12)
        groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, agentState.z, delta * 12)

        // Heading xoay quanh trục Y (quay mặt theo hướng di chuyển)
        // Trong Three.js, góc xoay quanh Y: heading = atan2(dz, dx)
        const targetRotY = -agentState.heading
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, delta * 15)

        if (ringRef.current) {
            ringRef.current.rotation.z += delta * 1.5
        }
    })

    return (
        <group ref={groupRef} position={[agentState.x, 0.4, agentState.z]}>
            {/* Vòng sáng LED dưới chân */}
            <mesh ref={ringRef} position={[0, -0.38, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.5, 0.65, 32]} />
                <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.8} />
            </mesh>

            {/* Thân robot (Cylindrical Cyber Chassis) */}
            <mesh castShadow position={[0, 0, 0]}>
                <cylinderGeometry args={[0.35, 0.42, 0.5, 24]} />
                <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
            </mesh>

            {/* Đầu vòm Robot */}
            <mesh position={[0, 0.35, 0]}>
                <sphereGeometry args={[0.3, 24, 24]} />
                <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} />
            </mesh>

            {/* Mắt quét Sensor Kính Neon (Kính visor phía trước) */}
            <mesh position={[0.22, 0.35, 0]}>
                <boxGeometry args={[0.15, 0.1, 0.32]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} />
            </mesh>

            {/* Mũi tên chỉ hướng di chuyển về phía trước (+X của local group) */}
            <mesh position={[0.55, -0.2, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <coneGeometry args={[0.12, 0.28, 16]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} />
            </mesh>

            {/* Tên Agent lơ lửng trên đầu */}
            <Text
                position={[0, 0.85, 0]}
                fontSize={0.22}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.03}
                outlineColor="#020617"
            >
                {name}
            </Text>
        </group>
    )
}

/** 2. Tia Lidar 8 hướng xuất phát từ Agent */
function LidarRays({
    agentState,
    lidar
}: {
    agentState: { x: number; z: number; heading: number }
    lidar: number[]
}) {
    const lines = useMemo(() => {
        if (!lidar || lidar.length === 0) return []
        const angleStep = (2 * Math.PI) / lidar.length
        return lidar.map((dist, i) => {
            const angle = agentState.heading + i * angleStep
            const ex = agentState.x + dist * Math.cos(angle)
            const ez = agentState.z + dist * Math.sin(angle)
            const points = [
                new THREE.Vector3(agentState.x, 0.35, agentState.z),
                new THREE.Vector3(ex, 0.35, ez)
            ]
            const lineGeo = new THREE.BufferGeometry().setFromPoints(points)

            // Màu tia: Đỏ khi < 1.8m (nguy hiểm), Vàng khi < 3.2m, Xanh lam khi an toàn
            let rayColor = '#06b6d4'
            if (dist < 1.8) rayColor = '#ef4444'
            else if (dist < 3.2) rayColor = '#f59e0b'

            return { geo: lineGeo, color: rayColor, hitPos: [ex, 0.35, ez] as [number, number, number] }
        })
    }, [agentState.x, agentState.z, agentState.heading, lidar])

    return (
        <group>
            {lines.map((line, idx) => (
                <group key={idx}>
                    {/* Tia laser */}
                    <primitive object={new THREE.Line(line.geo, new THREE.LineBasicMaterial({ color: line.color, transparent: true, opacity: 0.65 }))} />
                    {/* Điểm va chạm của tia */}
                    <mesh position={line.hitPos}>
                        <sphereGeometry args={[0.06, 12, 12]} />
                        <meshBasicMaterial color={line.color} />
                    </mesh>
                </group>
            ))}
        </group>
    )
}

/** 3. Mục tiêu Đích đến (Glowing Quantum Orb Target) */
function Goal3D({ goalState }: { goalState: { x: number; z: number } }) {
    const ringRef = useRef<THREE.Mesh>(null)

    useFrame((_, delta) => {
        if (ringRef.current) {
            ringRef.current.rotation.y += delta * 1.8
            ringRef.current.rotation.x += delta * 1.2
        }
    })

    return (
        <Float speed={2.5} rotationIntensity={0.6} floatIntensity={0.8}>
            <group position={[goalState.x, 0.8, goalState.z]}>
                {/* Khối cầu năng lượng trung tâm */}
                <mesh>
                    <sphereGeometry args={[0.42, 32, 32]} />
                    <meshStandardMaterial
                        color="#10b981"
                        emissive="#10b981"
                        emissiveIntensity={2.5}
                        roughness={0.1}
                    />
                </mesh>

                {/* Vòng hào quang xoay quanh đích */}
                <mesh ref={ringRef}>
                    <torusGeometry args={[0.65, 0.04, 16, 48]} />
                    <meshBasicMaterial color="#34d399" wireframe />
                </mesh>

                {/* Cột sáng chiếu xuống đất */}
                <mesh position={[0, -0.7, 0]}>
                    <cylinderGeometry args={[0.6, 0.8, 0.1, 32]} />
                    <meshBasicMaterial color="#10b981" transparent opacity={0.5} />
                </mesh>

                {/* Chữ "GOAL" */}
                <Text
                    position={[0, 0.75, 0]}
                    fontSize={0.28}
                    color="#34d399"
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.03}
                    outlineColor="#020617"
                >
                    GOAL
                </Text>
            </group>
        </Float>
    )
}

/** 4. Các chướng ngại vật trên sàn đấu (Hỗ trợ cả Nội thất Văn phòng 3D thật và Trụ Cyber) */
function Obstacles3D({ obstacles }: { obstacles: Obstacle[] }) {
    return (
        <group>
            {obstacles.map((obs: any, idx) => {
                const type = obs.type || 'pillar'

                if (type === 'desk') {
                    // Bàn làm việc văn phòng kèm Màn hình máy tính
                    return (
                        <group key={idx} position={[obs.x, 0, obs.z]}>
                            {/* Mặt bàn gỗ mun titan */}
                            <mesh castShadow receiveShadow position={[0, 0.65, 0]}>
                                <boxGeometry args={[2.0, 0.08, 1.2]} />
                                <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
                            </mesh>
                            {/* Chân bàn kim loại */}
                            <mesh position={[-0.9, 0.32, 0]}>
                                <boxGeometry args={[0.08, 0.64, 1.1]} />
                                <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} />
                            </mesh>
                            <mesh position={[0.9, 0.32, 0]}>
                                <boxGeometry args={[0.08, 0.64, 1.1]} />
                                <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.1} />
                            </mesh>
                            {/* Màn hình máy tính phát sáng */}
                            <mesh position={[0, 0.95, -0.2]}>
                                <boxGeometry args={[0.8, 0.45, 0.04]} />
                                <meshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={1.2} />
                            </mesh>
                            {/* Chân đế màn hình */}
                            <mesh position={[0, 0.72, -0.2]}>
                                <cylinderGeometry args={[0.04, 0.06, 0.12, 16]} />
                                <meshStandardMaterial color="#0f172a" />
                            </mesh>
                            {/* Ghế xoay văn phòng công thái học (Office Swivel Chair) */}
                            <group position={[0, 0, obs.z < 0 ? 1.2 : -1.2]} rotation={[0, obs.z < 0 ? 0 : Math.PI, 0]}>
                                {/* Đệm ngồi */}
                                <mesh castShadow position={[0, 0.44, 0]}>
                                    <boxGeometry args={[0.54, 0.08, 0.52]} />
                                    <meshStandardMaterial color="#334155" roughness={0.6} />
                                </mesh>
                                {/* Tựa lưng ghế */}
                                <mesh castShadow position={[0, 0.76, 0.23]}>
                                    <boxGeometry args={[0.5, 0.56, 0.06]} />
                                    <meshStandardMaterial color="#1e293b" roughness={0.7} />
                                </mesh>
                                {/* Tay vịn hai bên */}
                                <mesh position={[-0.26, 0.56, 0.05]}>
                                    <boxGeometry args={[0.04, 0.22, 0.32]} />
                                    <meshStandardMaterial color="#0f172a" />
                                </mesh>
                                <mesh position={[0.26, 0.56, 0.05]}>
                                    <boxGeometry args={[0.04, 0.22, 0.32]} />
                                    <meshStandardMaterial color="#0f172a" />
                                </mesh>
                                {/* Trục kim loại xoay */}
                                <mesh position={[0, 0.22, 0]}>
                                    <cylinderGeometry args={[0.04, 0.04, 0.44, 12]} />
                                    <meshStandardMaterial color="#0f172a" metalness={0.8} />
                                </mesh>
                                {/* Chân sao 5 cánh và bánh xe */}
                                {[0, 72, 144, 216, 288].map((deg, k) => {
                                    const rad = (deg * Math.PI) / 180
                                    return (
                                        <mesh key={k} position={[Math.cos(rad) * 0.22, 0.04, Math.sin(rad) * 0.22]}>
                                            <cylinderGeometry args={[0.025, 0.025, 0.06, 8]} />
                                            <meshStandardMaterial color="#0f172a" />
                                        </mesh>
                                    )
                                })}
                            </group>

                            {/* Vòng an toàn phát sáng nhẹ quanh bàn */}
                            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                                <ringGeometry args={[obs.radius * 0.85, obs.radius, 32]} />
                                <meshBasicMaterial color="#38bdf8" transparent opacity={0.25} />
                            </mesh>
                        </group>
                    )
                }

                if (type === 'sofa') {
                    // Ghế sofa khu nghỉ ngơi
                    return (
                        <group key={idx} position={[obs.x, 0, obs.z]}>
                            <mesh castShadow position={[0, 0.35, 0]}>
                                <boxGeometry args={[2.2, 0.4, 1.1]} />
                                <meshStandardMaterial color="#065f46" roughness={0.7} />
                            </mesh>
                            <mesh position={[0, 0.7, -0.45]}>
                                <boxGeometry args={[2.2, 0.6, 0.25]} />
                                <meshStandardMaterial color="#047857" roughness={0.7} />
                            </mesh>
                            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                                <ringGeometry args={[obs.radius * 0.85, obs.radius, 32]} />
                                <meshBasicMaterial color="#10b981" transparent opacity={0.3} />
                            </mesh>
                        </group>
                    )
                }

                if (type === 'roundtable') {
                    // Bàn tròn họp bàn
                    return (
                        <group key={idx} position={[obs.x, 0, obs.z]}>
                            <mesh castShadow position={[0, 0.68, 0]}>
                                <cylinderGeometry args={[1.1, 1.1, 0.08, 32]} />
                                <meshStandardMaterial color="#3b82f6" metalness={0.6} roughness={0.2} />
                            </mesh>
                            <mesh position={[0, 0.34, 0]}>
                                <cylinderGeometry args={[0.15, 0.25, 0.68, 16]} />
                                <meshStandardMaterial color="#0f172a" metalness={0.9} />
                            </mesh>
                            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                                <ringGeometry args={[obs.radius * 0.88, obs.radius, 32]} />
                                <meshBasicMaterial color="#60a5fa" transparent opacity={0.3} />
                            </mesh>
                        </group>
                    )
                }

                if (type === 'pingpong') {
                    // Bàn bóng bàn giải trí
                    return (
                        <group key={idx} position={[obs.x, 0, obs.z]}>
                            {/* Mặt bàn xanh */}
                            <mesh castShadow receiveShadow position={[0, 0.76, 0]}>
                                <boxGeometry args={[2.8, 0.06, 1.6]} />
                                <meshStandardMaterial color="#047857" roughness={0.4} />
                            </mesh>
                            {/* Lưới giữa */}
                            <mesh position={[0, 0.85, 0]}>
                                <boxGeometry args={[0.04, 0.16, 1.6]} />
                                <meshBasicMaterial color="#ffffff" wireframe />
                            </mesh>
                            {/* 4 Chân bàn */}
                            <mesh position={[-1.2, 0.38, -0.6]}>
                                <cylinderGeometry args={[0.04, 0.04, 0.76, 8]} />
                                <meshStandardMaterial color="#1e293b" />
                            </mesh>
                            <mesh position={[1.2, 0.38, -0.6]}>
                                <cylinderGeometry args={[0.04, 0.04, 0.76, 8]} />
                                <meshStandardMaterial color="#1e293b" />
                            </mesh>
                            <mesh position={[-1.2, 0.38, 0.6]}>
                                <cylinderGeometry args={[0.04, 0.04, 0.76, 8]} />
                                <meshStandardMaterial color="#1e293b" />
                            </mesh>
                            <mesh position={[1.2, 0.38, 0.6]}>
                                <cylinderGeometry args={[0.04, 0.04, 0.76, 8]} />
                                <meshStandardMaterial color="#1e293b" />
                            </mesh>
                            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                                <ringGeometry args={[obs.radius * 0.9, obs.radius, 32]} />
                                <meshBasicMaterial color="#10b981" transparent opacity={0.25} />
                            </mesh>
                        </group>
                    )
                }

                if (type === 'coffee') {
                    // Bàn trà cafe phòng khách
                    return (
                        <group key={idx} position={[obs.x, 0, obs.z]}>
                            <mesh castShadow position={[0, 0.35, 0]}>
                                <boxGeometry args={[1.4, 0.05, 0.8]} />
                                <meshStandardMaterial color="#d97706" roughness={0.3} />
                            </mesh>
                            <mesh position={[0, 0.17, 0]}>
                                <boxGeometry args={[1.2, 0.34, 0.6]} />
                                <meshStandardMaterial color="#18181b" />
                            </mesh>
                            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                                <ringGeometry args={[obs.radius * 0.85, obs.radius, 32]} />
                                <meshBasicMaterial color="#f59e0b" transparent opacity={0.25} />
                            </mesh>
                        </group>
                    )
                }

                if (type === 'plant') {
                    // Chậu cây cảnh văn phòng
                    return (
                        <group key={idx} position={[obs.x, 0, obs.z]}>
                            <mesh castShadow position={[0, 0.4, 0]}>
                                <cylinderGeometry args={[0.35, 0.25, 0.8, 16]} />
                                <meshStandardMaterial color="#78716c" roughness={0.6} />
                            </mesh>
                            <mesh position={[0, 1.0, 0]}>
                                <sphereGeometry args={[0.55, 16, 16]} />
                                <meshStandardMaterial color="#15803d" roughness={0.9} />
                            </mesh>
                            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                                <ringGeometry args={[obs.radius * 0.8, obs.radius, 24]} />
                                <meshBasicMaterial color="#22c55e" transparent opacity={0.25} />
                            </mesh>
                        </group>
                    )
                }

                if (type === 'server' || type === 'cabinet') {
                    // Tủ Server / Tủ Cabinet tài liệu
                    return (
                        <group key={idx} position={[obs.x, 0, obs.z]}>
                            <mesh castShadow position={[0, 1.1, 0]}>
                                <boxGeometry args={[0.9, 2.2, 0.9]} />
                                <meshStandardMaterial color="#1e1e24" metalness={0.8} roughness={0.2} />
                            </mesh>
                            {/* Đèn led server */}
                            <mesh position={[0, 1.5, 0.46]}>
                                <boxGeometry args={[0.6, 0.04, 0.02]} />
                                <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={2.0} />
                            </mesh>
                            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                                <ringGeometry args={[obs.radius * 0.85, obs.radius, 32]} />
                                <meshBasicMaterial color="#06b6d4" transparent opacity={0.25} />
                            </mesh>
                        </group>
                    )
                }

                if (type === 'wall') {
                    // Tường ngăn phòng chia đông tây (chạy ngang dọc theo trục X)
                    return (
                        <group key={idx} position={[obs.x, 0, obs.z]}>
                            <mesh castShadow position={[0, 0.9, 0]}>
                                <boxGeometry args={[3.4, 1.8, 0.25]} />
                                <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.3} />
                            </mesh>
                            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                                <ringGeometry args={[obs.radius * 0.85, obs.radius, 32]} />
                                <meshBasicMaterial color="#ef4444" transparent opacity={0.25} />
                            </mesh>
                        </group>
                    )
                }

                if (type === 'partition') {
                    // Vách kính ngăn hành lang (chạy dọc theo trục Z)
                    return (
                        <group key={idx} position={[obs.x, 0, obs.z]}>
                            <mesh castShadow position={[0, 0.9, 0]}>
                                <boxGeometry args={[0.16, 1.8, 2.4]} />
                                <meshPhysicalMaterial
                                    color="#bae6fd"
                                    transparent
                                    opacity={0.35}
                                    transmission={0.65}
                                    roughness={0.1}
                                />
                            </mesh>
                            <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                                <ringGeometry args={[obs.radius * 0.85, obs.radius, 32]} />
                                <meshBasicMaterial color="#38bdf8" transparent opacity={0.25} />
                            </mesh>
                        </group>
                    )
                }

                // Mặc định: Trụ chướng ngại vật Cyber
                return (
                    <group key={idx} position={[obs.x, 0, obs.z]}>
                        <mesh castShadow receiveShadow position={[0, 0.75, 0]}>
                            <cylinderGeometry args={[obs.radius * 0.9, obs.radius, 1.5, 32]} />
                            <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
                        </mesh>
                        <mesh position={[0, 1.45, 0]}>
                            <torusGeometry args={[obs.radius * 0.92, 0.04, 16, 32]} />
                            <meshBasicMaterial color="#f43f5e" />
                        </mesh>
                        <mesh position={[0, 0.1, 0]}>
                            <torusGeometry args={[obs.radius * 0.98, 0.05, 16, 32]} />
                            <meshBasicMaterial color="#e11d48" />
                        </mesh>
                    </group>
                )
            })}
        </group>
    )
}

/** 5. Vết tích quỹ đạo di chuyển (Breadcrumb Trajectory Trail) */
function TrajectoryTrail({ trajectory }: { trajectory: TrajectoryStep[] }) {
    const points = useMemo(() => {
        if (!trajectory || trajectory.length < 2) return null
        const pts = trajectory.map(t => new THREE.Vector3(t.agent.x, 0.15, t.agent.z))
        const geo = new THREE.BufferGeometry().setFromPoints(pts)
        return geo
    }, [trajectory])

    if (!points) return null

    return (
        <primitive
            object={new THREE.Line(points, new THREE.LineBasicMaterial({
                color: '#8b5cf6',
                transparent: true,
                opacity: 0.75,
                linewidth: 2
            }))}
        />
    )
}

/** 6. Component Sàn đấu chính (RL Arena Canvas) */
export default function RLArena3D({
    agentState,
    goalState,
    lidar,
    obstacles,
    trajectory,
    agentColor = '#3b82f6',
    agentName = 'Agent RL',
    arenaSize = 20,
    mapName = 'office'
}: RLArena3DProps) {
    const size = arenaSize || (mapName === 'office' ? 28 : 20)
    const isOffice = mapName === 'office'

    return (
        <div className="relative w-full h-[520px] rounded-2xl overflow-hidden bg-gradient-to-b from-zinc-950 via-slate-950 to-zinc-900 border border-zinc-800 shadow-2xl">
            {/* HUD Status Overlay */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-700/60 text-xs text-zinc-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-white">
                    {isOffice ? '[OFFICE] 3D Office Arena' : '[TARGET] Cyber Grid Arena'}
                </span>
                <span className="text-zinc-500">|</span>
                <span>Toạ độ Agent: [{agentState.x}, {agentState.z}]</span>
                <span className="text-zinc-500">|</span>
                <span>Khoảng cách đích: <strong className="text-emerald-400">{goalState.distance}m</strong></span>
                <span className="text-zinc-500">|</span>
                <span className="text-cyan-400 font-medium">{obstacles.length} Vật cản</span>
            </div>

            {/* Three.js Canvas */}
            <Canvas
                shadows
                camera={{
                    position: isOffice ? [0, 24, 18] : [0, 18, 14],
                    fov: isOffice ? 50 : 45
                }}
                className="w-full h-full"
            >
                <color attach="background" args={['#030712']} />
                <fog attach="fog" args={['#030712', 25, 55]} />

                <ambientLight intensity={0.7} />
                <directionalLight
                    position={[15, 25, 15]}
                    intensity={1.4}
                    castShadow
                    shadow-mapSize={[1024, 1024]}
                />
                <pointLight position={[goalState.x, 3, goalState.z]} color="#10b981" intensity={2} distance={8} />

                {/* Lưới sàn đấu Cyber Grid / Office Floor */}
                <Grid
                    position={[0, 0, 0]}
                    args={isOffice ? [28, 22] : [size, size]}
                    cellSize={1}
                    cellThickness={0.8}
                    cellColor={isOffice ? '#334155' : '#1e293b'}
                    sectionSize={isOffice ? 4 : 5}
                    sectionThickness={1.5}
                    sectionColor={isOffice ? '#0284c7' : '#3b82f6'}
                    fadeDistance={40}
                    fadeStrength={1.2}
                />

                {/* Đường viền thành bao quanh sàn đấu */}
                <mesh position={[0, 0.25, 0]}>
                    <boxGeometry args={isOffice ? [28.2, 0.5, 22.2] : [size + 0.2, 0.5, size + 0.2]} />
                    <meshStandardMaterial color={isOffice ? '#0284c7' : '#0f172a'} wireframe />
                </mesh>

                {/* Chướng ngại vật */}
                <Obstacles3D obstacles={obstacles} />

                {/* Đích đến */}
                <Goal3D goalState={goalState} />

                {/* Vết tích đường đi */}
                <TrajectoryTrail trajectory={trajectory} />

                {/* Tia LIDAR 8 hướng */}
                <LidarRays agentState={agentState} lidar={lidar} />

                {/* Robot Agent */}
                <Agent3D agentState={agentState} color={agentColor} name={agentName} />

                {/* Camera Orbit Controls */}
                <OrbitControls
                    enableDamping
                    dampingFactor={0.05}
                    maxPolarAngle={Math.PI / 2.1}
                    minDistance={5}
                    maxDistance={35}
                />
            </Canvas>
        </div>
    )
}
