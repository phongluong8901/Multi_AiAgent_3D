'use client'

import React, { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Text } from '@react-three/drei'
import * as THREE from 'three'

interface RobotState {
    x: number
    z: number
    rotation: number // radians (quay quanh trục Y)
    isMoving: boolean
    speed: number
    ledColor: string
    obstacleDistance: number
}

// ─── 3D ESP32 ROBOT MODEL ───────────────────────────────────────────
function ESP32Robot({
    state,
    onDistanceUpdate,
    obstacles,
}: {
    state: RobotState
    onDistanceUpdate: (dist: number) => void
    obstacles: [number, number, number][]
}) {
    const groupRef = useRef<THREE.Group>(null)
    const leftWheelRef = useRef<THREE.Mesh>(null)
    const rightWheelRef = useRef<THREE.Mesh>(null)
    const [wheelAngle, setWheelAngle] = useState(0)

    useFrame((_, delta) => {
        if (!groupRef.current) return

        // Mượt mà nội suy vị trí và góc quay
        groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, state.x, 0.1)
        groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, state.z, 0.1)
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, state.rotation, 0.1)

        // Quay bánh xe khi di chuyển
        if (state.isMoving) {
            setWheelAngle((prev) => prev + delta * 12)
        }

        // Tính khoảng cách Raycast siêu âm tới các vật cản phía trước
        const forwardDir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), groupRef.current.rotation.y)
        const currentPos = groupRef.current.position

        let minDistance = 250 // max 250cm
        obstacles.forEach(([ox, _, oz]) => {
            const toObstacle = new THREE.Vector3(ox - currentPos.x, 0, oz - currentPos.z)
            const dist = toObstacle.length()
            const angle = forwardDir.angleTo(toObstacle)

            // Góc quét cảm biến ~ 45 độ
            if (angle < Math.PI / 6 && dist < minDistance) {
                minDistance = Math.max(15, Math.round(dist * 20)) // scale sang cm
            }
        })

        onDistanceUpdate(minDistance)
    })

    return (
        <group ref={groupRef} position={[state.x, 0, state.z]} rotation={[0, state.rotation, 0]}>
            {/* --- 1. KHUNG GẦM PCB CHÍNH (Xanh dương đậm ESP32) --- */}
            <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.4, 0.08, 1.8]} />
                <meshStandardMaterial color="#0f2b48" roughness={0.3} metalness={0.4} />
            </mesh>

            {/* Viền mạ vàng trên PCB */}
            <mesh position={[0, 0.295, 0]}>
                <boxGeometry args={[1.32, 0.005, 1.72]} />
                <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
            </mesh>

            {/* --- 2. MODULE CHIP ESP32-WROOM-32 (Kim loại bạc + Anten PCB vàng) --- */}
            <group position={[0, 0.35, -0.2]}>
                {/* Vỏ chắn kim loại RF Shield */}
                <mesh castShadow>
                    <boxGeometry args={[0.7, 0.06, 0.7]} />
                    <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.15} />
                </mesh>
                {/* Anten uốn lượn màu vàng */}
                <mesh position={[0, 0.035, -0.4]}>
                    <boxGeometry args={[0.55, 0.01, 0.15]} />
                    <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.1} />
                </mesh>
                <Text
                    position={[0, 0.035, 0]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    fontSize={0.09}
                    color="#1e293b"
                    anchorX="center"
                    anchorY="middle"
                >
                    ESP-32
                </Text>
            </group>

            {/* --- 3. CẢM BIẾN SIÊU ÂM HC-SR04 (ĐÔI MẮT ROBOT) PHÍA TRƯỚC --- */}
            <group position={[0, 0.45, 0.9]}>
                {/* Bảng mạch sensor xanh */}
                <mesh castShadow>
                    <boxGeometry args={[0.9, 0.3, 0.05]} />
                    <meshStandardMaterial color="#0284c7" />
                </mesh>
                {/* Mắt phát Trig (trụ nhôm) */}
                <mesh position={[-0.25, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                    <cylinderGeometry args={[0.13, 0.13, 0.2, 24]} />
                    <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
                </mesh>
                {/* Mắt thu Echo (trụ nhôm) */}
                <mesh position={[0.25, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                    <cylinderGeometry args={[0.13, 0.13, 0.2, 24]} />
                    <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
                </mesh>

                {/* --- CHÙM TIA CẢM BIẾN RAYCAST HÌNH NÓN TRỰC QUAN --- */}
                <group position={[0, 0, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
                    <mesh>
                        <coneGeometry args={[0.8, 2.5, 16, 1, true]} />
                        <meshBasicMaterial
                            color={state.obstacleDistance < 50 ? '#ef4444' : state.obstacleDistance < 100 ? '#eab308' : '#06b6d4'}
                            transparent
                            opacity={0.25}
                            side={THREE.DoubleSide}
                            wireframe
                        />
                    </mesh>
                </group>
            </group>

            {/* --- 4. ĐÈN LED RGB NEOPIXEL TRÊN ĐỈNH ROBOT --- */}
            <mesh position={[0, 0.45, 0.2]}>
                <sphereGeometry args={[0.08, 16, 16]} />
                <meshStandardMaterial
                    color={state.ledColor}
                    emissive={state.ledColor}
                    emissiveIntensity={2.5}
                    toneMapped={false}
                />
            </mesh>
            <pointLight position={[0, 0.5, 0.2]} color={state.ledColor} intensity={1.5} distance={2} />

            {/* --- 5. BÁNH XE TRÁI VÀ PHẢI --- */}
            {/* Bánh trái */}
            <mesh
                ref={leftWheelRef}
                position={[-0.8, 0.25, 0]}
                rotation={[wheelAngle, 0, Math.PI / 2]}
                castShadow
            >
                <cylinderGeometry args={[0.28, 0.28, 0.16, 24]} />
                <meshStandardMaterial color="#18181b" roughness={0.8} />
            </mesh>
            {/* Mâm vàng bánh trái */}
            <mesh position={[-0.88, 0.25, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.16, 0.16, 0.02, 16]} />
                <meshStandardMaterial color="#f59e0b" metalness={0.8} />
            </mesh>

            {/* Bánh phải */}
            <mesh
                ref={rightWheelRef}
                position={[0.8, 0.25, 0]}
                rotation={[wheelAngle, 0, Math.PI / 2]}
                castShadow
            >
                <cylinderGeometry args={[0.28, 0.28, 0.16, 24]} />
                <meshStandardMaterial color="#18181b" roughness={0.8} />
            </mesh>
            {/* Mâm vàng bánh phải */}
            <mesh position={[0.88, 0.25, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.16, 0.16, 0.02, 16]} />
                <meshStandardMaterial color="#f59e0b" metalness={0.8} />
            </mesh>

            {/* Bánh xe xoay tự do phía sau (Caster Wheel) */}
            <mesh position={[0, 0.12, -0.7]} castShadow>
                <sphereGeometry args={[0.12, 16, 16]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
            </mesh>

            {/* Pin LiPo 2S phía dưới */}
            <mesh position={[0, 0.12, 0.1]} castShadow>
                <boxGeometry args={[0.8, 0.15, 0.8]} />
                <meshStandardMaterial color="#334155" roughness={0.5} />
            </mesh>
        </group>
    )
}

// ─── CHƯỚNG NGẠI VẬT 3D TRÊN SÀN (OBSTACLES) ─────────────────────────
function ObstacleBlock({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
                <boxGeometry args={[0.9, 1.0, 0.9]} />
                <meshStandardMaterial color="#e11d48" roughness={0.4} metalness={0.2} />
            </mesh>
            {/* Viền cảnh báo vàng */}
            <mesh position={[0, 0.5, 0]}>
                <boxGeometry args={[0.92, 0.15, 0.92]} />
                <meshStandardMaterial color="#facc15" roughness={0.3} />
            </mesh>
        </group>
    )
}

// ─── CANVAS MÔ PHỎNG CHÍNH ───────────────────────────────────────────
export default function ESP32RobotCanvas({
    robotState,
    onDistanceUpdate,
    obstacles,
}: {
    robotState: RobotState
    onDistanceUpdate: (dist: number) => void
    obstacles: [number, number, number][]
}) {
    return (
        <div className="w-full h-full relative bg-zinc-950 overflow-hidden select-none">
            {/* Header overlay hiển thị thông số nhanh */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-zinc-800 text-xs">
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-semibold text-zinc-200">ESP32-WROOM Node</span>
                </div>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-400">
                    X: <strong className="text-white">{robotState.x.toFixed(1)}</strong> Z:{' '}
                    <strong className="text-white">{robotState.z.toFixed(1)}</strong>
                </span>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-400">
                    Yaw: <strong className="text-amber-400">{((robotState.rotation * 180) / Math.PI).toFixed(0)}°</strong>
                </span>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-400">
                    Sonar:{' '}
                    <strong
                        className={
                            robotState.obstacleDistance < 50
                                ? 'text-rose-400'
                                : robotState.obstacleDistance < 100
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                        }
                    >
                        {robotState.obstacleDistance}cm
                    </strong>
                </span>
            </div>

            {/* Canvas 3D */}
            <Canvas shadows camera={{ position: [4, 4.5, 5], fov: 45 }}>
                <ambientLight intensity={0.6} />
                <directionalLight position={[6, 10, 6]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
                <pointLight position={[-6, 6, -6]} intensity={0.4} color="#38bdf8" />

                {/* Sàn Grid công nghệ cao */}
                <Grid
                    position={[0, -0.01, 0]}
                    args={[20, 20]}
                    cellSize={0.5}
                    cellThickness={1}
                    cellColor="#27272a"
                    sectionSize={2}
                    sectionThickness={1.5}
                    sectionColor="#3b82f6"
                    fadeDistance={18}
                />

                {/* Sàn bóng tối */}
                <mesh position={[0, -0.05, 0]} receiveShadow>
                    <planeGeometry args={[30, 30]} />
                    <meshStandardMaterial color="#09090b" roughness={0.8} />
                </mesh>

                {/* Robot 3D */}
                <ESP32Robot state={robotState} onDistanceUpdate={onDistanceUpdate} obstacles={obstacles} />

                {/* Các chướng ngại vật */}
                {obstacles.map((pos, idx) => (
                    <ObstacleBlock key={idx} position={pos} />
                ))}

                <OrbitControls makeDefault minDistance={2} maxDistance={15} maxPolarAngle={Math.PI / 2.05} />
            </Canvas>
        </div>
    )
}
