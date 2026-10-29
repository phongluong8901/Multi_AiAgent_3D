'use client'

import React, { useRef, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Line, Float } from '@react-three/drei'
import * as THREE from 'three'
import { QuadrupedState, LocomotionTask } from '@/lib/rl/locomotionEngine'

interface LocomotionArena3DProps {
    state: QuadrupedState
    task: LocomotionTask
    targetHeight?: number
    trailPoints?: [number, number, number][]
    robotColor?: string
}

function QuadrupedMesh({
    state,
    robotColor = '#76b900',
}: {
    state: QuadrupedState
    robotColor?: string
}) {
    const thighLength = 0.22
    const shinLength = 0.22

    // 4 chân theo thứ tự: [Tên, posX_offset, posZ_offset, hipKey, kneeKey, contactIndex]
    const legs = useMemo(
        () => [
            {
                name: 'Front-Left',
                ox: 0.28,
                oz: 0.22,
                hip: state.joints.frontLeftHip.angle,
                knee: state.joints.frontLeftKnee.angle,
                contact: state.footContacts[0],
            },
            {
                name: 'Front-Right',
                ox: 0.28,
                oz: -0.22,
                hip: state.joints.frontRightHip.angle,
                knee: state.joints.frontRightKnee.angle,
                contact: state.footContacts[1],
            },
            {
                name: 'Rear-Left',
                ox: -0.28,
                oz: 0.22,
                hip: state.joints.rearLeftHip.angle,
                knee: state.joints.rearLeftKnee.angle,
                contact: state.footContacts[2],
            },
            {
                name: 'Rear-Right',
                ox: -0.28,
                oz: -0.22,
                hip: state.joints.rearRightHip.angle,
                knee: state.joints.rearRightKnee.angle,
                contact: state.footContacts[3],
            },
        ],
        [state]
    )

    return (
        <group
            position={[state.posX, state.posY, state.posZ]}
            rotation={[state.roll, state.yaw, state.pitch]}
        >
            {/* THÂN ROBOT (TORSO) */}
            <mesh castShadow receiveShadow position={[0, 0, 0]}>
                <boxGeometry args={[0.68, 0.14, 0.36]} />
                <meshStandardMaterial
                    color={state.isFallen ? '#ef4444' : robotColor}
                    roughness={0.35}
                    metalness={0.4}
                />
            </mesh>

            {/* Đầu cảm biến / Camera Visor phía trước */}
            <mesh position={[0.36, 0.04, 0]} castShadow>
                <boxGeometry args={[0.12, 0.1, 0.22]} />
                <meshStandardMaterial color="#090d16" roughness={0.2} metalness={0.8} />
            </mesh>
            <mesh position={[0.42, 0.05, 0]}>
                <boxGeometry args={[0.02, 0.04, 0.16]} />
                <meshBasicMaterial color="#06b6d4" />
            </mesh>

            {/* 4 CHÂN ĐỘNG HỌC (THIGH + KNEE + SHIN) */}
            {legs.map((leg, idx) => (
                <group key={idx} position={[leg.ox, -0.06, leg.oz]}>
                    {/* Khớp hông (Hip Joint sphere) */}
                    <mesh castShadow>
                        <sphereGeometry args={[0.045, 16, 16]} />
                        <meshStandardMaterial color="#27272a" metalness={0.8} />
                    </mesh>

                    {/* Khớp đùi xoay theo hip angle quanh trục Z */}
                    <group rotation={[0, 0, leg.hip]}>
                        <mesh position={[0, -thighLength / 2, 0]} castShadow>
                            <capsuleGeometry args={[0.032, thighLength - 0.064, 8, 16]} />
                            <meshStandardMaterial color="#3f3f46" roughness={0.4} metalness={0.6} />
                        </mesh>

                        {/* Khớp gối (Knee Joint) */}
                        <group position={[0, -thighLength, 0]} rotation={[0, 0, leg.knee]}>
                            <mesh castShadow>
                                <sphereGeometry args={[0.038, 16, 16]} />
                                <meshStandardMaterial color="#18181b" metalness={0.9} />
                            </mesh>

                            {/* Cẳng chân (Shin) */}
                            <mesh position={[0, -shinLength / 2, 0]} castShadow>
                                <capsuleGeometry args={[0.026, shinLength - 0.052, 8, 16]} />
                                <meshStandardMaterial color="#71717a" roughness={0.4} metalness={0.5} />
                            </mesh>

                            {/* Bàn chân tiếp xúc đất (Foot Sphere + Contact Sensor Light) */}
                            <mesh position={[0, -shinLength, 0]}>
                                <sphereGeometry args={[0.035, 16, 16]} />
                                <meshStandardMaterial
                                    color={leg.contact ? '#22c55e' : '#f97316'}
                                    emissive={leg.contact ? '#22c55e' : '#f97316'}
                                    emissiveIntensity={leg.contact ? 1.2 : 0.2}
                                />
                            </mesh>
                        </group>
                    </group>
                </group>
            ))}

            {/* Bóng đổ trọng tâm CoM chiếu xuống sàn */}
            <mesh position={[0, -state.posY + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.08, 0.12, 32]} />
                <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} />
            </mesh>
        </group>
    )
}

export default function LocomotionArena3D({
    state,
    task,
    targetHeight = 0.5,
    trailPoints = [],
    robotColor = '#76b900',
}: LocomotionArena3DProps) {
    const controlsRef = useRef<any>(null)

    return (
        <div className="relative w-full h-full bg-[#07090e] select-none overflow-hidden">
            {/* Top HUD Telemetry */}
            <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-black/85 border border-zinc-800 text-[11px] backdrop-blur font-mono text-zinc-300 shadow-2xl">
                <span className="w-2.5 h-2.5 rounded-full bg-[#76b900] shadow-[0_0_8px_#76b900]" />
                <span className="font-bold text-white tracking-wider">PHYSICS LOCOMOTION ENGINE</span>
                <span className="text-zinc-600">|</span>
                <span className="text-[#76b900]">MULTI-BODY DYNAMICS</span>
                <span className="text-zinc-600">|</span>
                <span className="text-cyan-400 uppercase font-semibold">TASK: {task}</span>
                {state.isFallen && (
                    <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/40 font-bold animate-pulse">
                        FALL DETECTED
                    </span>
                )}
            </div>

            {/* Foot contacts indicator bar */}
            <div className="pointer-events-none absolute left-3 bottom-3 z-10 flex items-center gap-2 px-3 py-2 rounded-xl bg-black/80 border border-zinc-800 text-[10px] font-mono text-zinc-400 backdrop-blur">
                <span className="text-zinc-500 uppercase">Foot Contacts:</span>
                {['FL', 'FR', 'RL', 'RR'].map((label, idx) => {
                    const c = state.footContacts[idx]
                    return (
                        <div
                            key={label}
                            className={`px-2 py-0.5 rounded flex items-center gap-1 border transition ${
                                c
                                    ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                            }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${c ? 'bg-emerald-400 shadow-[0_0_4px_#22c55e]' : 'bg-zinc-600'}`} />
                            <span>{label}</span>
                        </div>
                    )
                })}
            </div>

            <Canvas
                shadows
                camera={{ position: [2.4, 1.6, 2.8], fov: 42 }}
                dpr={[1, 1.5]}
                gl={{ powerPreference: 'high-performance', antialias: true }}
            >
                <color attach="background" args={['#06080d']} />
                <fog attach="fog" args={['#06080d', 10, 30]} />

                {/* Ánh sáng vật lý */}
                <ambientLight intensity={0.6} />
                <directionalLight
                    position={[8, 14, 8]}
                    intensity={1.8}
                    castShadow
                    shadow-mapSize={[2048, 2048]}
                    shadow-camera-left={-8}
                    shadow-camera-right={8}
                    shadow-camera-top={8}
                    shadow-camera-bottom={-8}
                />
                <pointLight position={[-4, 4, -4]} intensity={0.5} color="#38bdf8" />

                {/* Sàn tập luyện chia ô mét */}
                <Grid
                    position={[0, 0, 0]}
                    args={[50, 50]}
                    cellSize={0.5}
                    cellThickness={0.7}
                    cellColor="#334155"
                    sectionSize={2.0}
                    sectionThickness={1.4}
                    sectionColor="#76b900"
                    fadeDistance={25}
                    fadeStrength={1.2}
                    infiniteGrid
                />

                {/* Mặt phẳng bóng đổ mặt đất */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.001, 0]}>
                    <planeGeometry args={[100, 100]} />
                    <shadowMaterial transparent opacity={0.4} />
                </mesh>

                {/* Trục hướng tiến +X (Vạch đỏ định hướng đường đi) */}
                <Line
                    points={[
                        [-5, 0.002, 0],
                        [30, 0.002, 0],
                    ]}
                    color="#ef4444"
                    lineWidth={2.5}
                />

                {/* Vệt đường chạy (Trajectory Trail) */}
                {trailPoints.length > 1 && (
                    <Line
                        points={trailPoints}
                        color="#22d3ee"
                        lineWidth={2}
                        transparent
                        opacity={0.7}
                    />
                )}

                {/* Vạch độ cao mục tiêu (Target Height Plane) */}
                <group position={[state.posX, targetHeight, state.posZ]}>
                    <Line
                        points={[
                            [-0.5, 0, 0],
                            [0.5, 0, 0],
                        ]}
                        color="#a855f7"
                        lineWidth={1.5}
                        dashed
                        dashScale={10}
                    />
                </group>

                {/* Robot 4 chân chính */}
                <QuadrupedMesh state={state} robotColor={robotColor} />

                {/* Điều khiển Camera */}
                <OrbitControls
                    ref={controlsRef}
                    makeDefault
                    target={[state.posX, 0.4, state.posZ]}
                    minDistance={1.2}
                    maxDistance={12}
                    maxPolarAngle={Math.PI / 2 - 0.02}
                />
            </Canvas>
        </div>
    )
}

