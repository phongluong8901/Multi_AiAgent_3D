'use client'

import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

import { CustomAgentBodyMesh } from './CustomAgentBodyMesh'
import type { AgentBodyDesign } from '@/lib/agentBody/agentBodyTypes'

export type AgentFormType = 'humanoid' | 'duck' | 'amr' | 'drone' | 'custom'

export interface NvidiaRobotProps {
    form?: AgentFormType
    color?: string
    walking?: boolean
    sitting?: boolean
    working?: boolean
    promptId?: string | null
    toolCount?: number
    modelId?: string | null
    isStudioPedestal?: boolean
    bodyId?: string | null
    bodyDesign?: AgentBodyDesign | null
}

// ──────────────────────────────────────────────────────────────
// 1. PROJECT GR00T BIPED HUMANOID (CHUẨN NVIDIA & UNITREE G1)
// ──────────────────────────────────────────────────────────────
export function NvidiaGr00tRobotMesh({
    color = '#76b900',
    walking = false,
    sitting = false,
    working = false,
    promptId,
    toolCount = 0,
    modelId,
    isStudioPedestal = false,
}: NvidiaRobotProps) {
    const leftLegRef = useRef<THREE.Group>(null)
    const rightLegRef = useRef<THREE.Group>(null)
    const leftArmRef = useRef<THREE.Group>(null)
    const rightArmRef = useRef<THREE.Group>(null)
    const headRef = useRef<THREE.Group>(null)
    const scannerRef = useRef<THREE.Mesh>(null)
    const chestCoreRef = useRef<THREE.Mesh>(null)
    const spineRef = useRef<THREE.Group>(null)

    useFrame((state) => {
        const t = state.clock.elapsedTime

        // 1. Tia laser quang học trên kính ngắm Visor
        if (scannerRef.current) {
            scannerRef.current.position.x = Math.sin(t * 3.5) * 0.16
        }

        // 2. Nhịp thở năng lượng Arc Core Tensor Processor
        if (chestCoreRef.current) {
            const pulse = 1 + Math.sin(t * 4.5) * 0.08
            chestCoreRef.current.scale.set(pulse, pulse, 1)
        }

        // 3. Chuyển động cơ học cơ thể (Đi bộ, Ngồi làm việc, Đứng thở)
        if (walking) {
            const swing = Math.sin(t * 7) * 0.55
            const armSwing = Math.cos(t * 7) * 0.45

            if (leftLegRef.current) {
                leftLegRef.current.rotation.x = swing
                leftLegRef.current.rotation.z = 0
            }
            if (rightLegRef.current) {
                rightLegRef.current.rotation.x = -swing
                rightLegRef.current.rotation.z = 0
            }
            if (leftArmRef.current) leftArmRef.current.rotation.x = -armSwing
            if (rightArmRef.current) rightArmRef.current.rotation.x = armSwing
            if (spineRef.current) {
                spineRef.current.position.y = Math.abs(Math.sin(t * 14)) * 0.05
                spineRef.current.rotation.y = Math.sin(t * 7) * 0.06
            }
        } else if (sitting) {
            if (leftLegRef.current) {
                leftLegRef.current.rotation.x = -Math.PI / 2 + 0.1
                leftLegRef.current.rotation.z = -0.05
            }
            if (rightLegRef.current) {
                rightLegRef.current.rotation.x = -Math.PI / 2 + 0.1
                rightLegRef.current.rotation.z = 0.05
            }
            if (leftArmRef.current) leftArmRef.current.rotation.x = working ? -Math.PI / 3 + Math.sin(t * 12) * 0.08 : -Math.PI / 4
            if (rightArmRef.current) rightArmRef.current.rotation.x = working ? -Math.PI / 3 + Math.cos(t * 12) * 0.08 : -Math.PI / 4
            if (spineRef.current) {
                spineRef.current.position.y = 0
                spineRef.current.rotation.x = 0.08
                spineRef.current.rotation.y = 0
            }
        } else {
            // Idle thở nhẹ nhàng
            const idle = Math.sin(t * 2) * 0.02
            if (leftLegRef.current) {
                leftLegRef.current.rotation.x = 0
                leftLegRef.current.rotation.z = 0.03
            }
            if (rightLegRef.current) {
                rightLegRef.current.rotation.x = 0
                rightLegRef.current.rotation.z = -0.03
            }
            if (leftArmRef.current) leftArmRef.current.rotation.x = idle
            if (rightArmRef.current) rightArmRef.current.rotation.x = -idle
            if (spineRef.current) {
                spineRef.current.position.y = Math.sin(t * 2.5) * 0.015
                spineRef.current.rotation.x = 0
                spineRef.current.rotation.y = Math.sin(t * 1.5) * 0.03
            }
            if (headRef.current && isStudioPedestal) {
                headRef.current.rotation.y = Math.sin(t * 1.2) * 0.12
            }
        }
    })

    const armorWhite = '#f8fafc'
    const carbonBlack = '#121418'
    const metallicChrome = '#64748b'
    const nvidiaGreen = '#76b900'
    const customAccent = (!color || color === '#4299e1') ? nvidiaGreen : color

    return (
        <group position={[0, sitting ? -0.2 : 0, 0]}>
            <group ref={spineRef}>
                {/* ===== 1. KHUNG THÂN TRÊN (SCULPTED TORSO & CHEST) ===== */}
                <group position={[0, 0.95, 0]}>
                    {/* Khung xương chịu lực carbon bên trong */}
                    <mesh position={[0, 0, 0]} castShadow>
                        <boxGeometry args={[0.42, 0.52, 0.28]} />
                        <meshStandardMaterial color={carbonBlack} metalness={0.9} roughness={0.3} />
                    </mesh>

                    {/* Tấm giáp ngực Pectoral Armor Plate màu trắng sứ / titan */}
                    <RoundedBox args={[0.48, 0.34, 0.14]} radius={0.06} position={[0, 0.1, 0.1]} castShadow>
                        <meshStandardMaterial color={armorWhite} roughness={0.2} metalness={0.4} />
                    </RoundedBox>

                    {/* Vệt sơn thể thao NVIDIA Green / Custom Accent trên ngực */}
                    <mesh position={[0, 0.12, 0.175]}>
                        <boxGeometry args={[0.38, 0.03, 0.01]} />
                        <meshStandardMaterial color={customAccent} emissive={customAccent} emissiveIntensity={0.6} />
                    </mesh>

                    {/* NVIDIA ARC CORE / TENSOR-RT PROCESSOR Ở GIỮA NGỰC */}
                    <group position={[0, 0.06, 0.18]}>
                        {/* Khung viền lục giác */}
                        <mesh rotation={[0, 0, Math.PI / 6]}>
                            <cylinderGeometry args={[0.075, 0.075, 0.015, 6]} />
                            <meshStandardMaterial color={carbonBlack} metalness={0.95} />
                        </mesh>
                        {/* Lõi năng lượng phát sáng rực rỡ */}
                        <mesh ref={chestCoreRef} position={[0, 0, 0.008]}>
                            <circleGeometry args={[0.055, 16]} />
                            <meshStandardMaterial
                                color={nvidiaGreen}
                                emissive={nvidiaGreen}
                                emissiveIntensity={2.8}
                                side={THREE.DoubleSide}
                            />
                        </mesh>
                    </group>

                    {/* Khung xương sườn & Cột sống cơ học (Mechanical Spine) */}
                    {[-0.1, -0.18].map((yOffset, i) => (
                        <group key={i} position={[0, yOffset, 0.04]}>
                            <mesh>
                                <boxGeometry args={[0.34, 0.04, 0.24]} />
                                <meshStandardMaterial color={metallicChrome} metalness={0.85} roughness={0.25} />
                            </mesh>
                        </group>
                    ))}

                    {/* BA LÔ JETSON THOR SUPERCOMPUTER PHÍA SAU */}
                    <group position={[0, 0.05, -0.19]}>
                        <RoundedBox args={[0.36, 0.44, 0.12]} radius={0.04} castShadow>
                            <meshStandardMaterial color={carbonBlack} metalness={0.85} roughness={0.3} />
                        </RoundedBox>
                        {/* Khe tản nhiệt dọc */}
                        {[-0.08, -0.03, 0.03, 0.08].map((xPos, idx) => (
                            <mesh key={idx} position={[xPos, 0.05, -0.065]}>
                                <boxGeometry args={[0.02, 0.22, 0.01]} />
                                <meshStandardMaterial color={nvidiaGreen} emissive={nvidiaGreen} emissiveIntensity={1.5} />
                            </mesh>
                        ))}
                        {/* Logo NVIDIA & Đèn báo trạng thái Jetson Thor */}
                        <mesh position={[0, -0.12, -0.065]}>
                            <boxGeometry args={[0.2, 0.04, 0.01]} />
                            <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={2} />
                        </mesh>
                    </group>
                </group>

                {/* ===== 2. KHUNG HÔNG & KHỚP HÁNG (PELVIS & HIP JOINTS) ===== */}
                <group position={[0, 0.62, 0]}>
                    <RoundedBox args={[0.36, 0.14, 0.24]} radius={0.04} castShadow>
                        <meshStandardMaterial color={carbonBlack} metalness={0.85} />
                    </RoundedBox>
                    {/* Hai quả cầu bạc khớp háng trái & phải */}
                    {[-0.14, 0.14].map((xPos, idx) => (
                        <mesh key={idx} position={[xPos, -0.04, 0]} castShadow>
                            <sphereGeometry args={[0.07, 16, 16]} />
                            <meshStandardMaterial color={metallicChrome} metalness={0.95} roughness={0.15} />
                        </mesh>
                    ))}
                </group>

                {/* ===== 3. ĐẦU ROBOT GR00T (AERODYNAMIC CURVED HELMET) ===== */}
                <group ref={headRef} position={[0, 1.4, 0]}>
                    {/* Khớp cổ 2 trục xoay có đệm cao su đen */}
                    <mesh position={[0, -0.14, 0]}>
                        <cylinderGeometry args={[0.08, 0.09, 0.1, 16]} />
                        <meshStandardMaterial color={carbonBlack} metalness={0.8} />
                    </mesh>

                    {/* Vỏ mũ giáp khí động học màu trắng sứ / titan */}
                    <RoundedBox args={[0.38, 0.34, 0.36]} radius={0.1} castShadow>
                        <meshStandardMaterial color={armorWhite} roughness={0.18} metalness={0.35} />
                    </RoundedBox>

                    {/* Tấm ốp bảo vệ gáy carbon đen */}
                    <mesh position={[0, -0.02, -0.18]} castShadow>
                        <boxGeometry args={[0.3, 0.26, 0.06]} />
                        <meshStandardMaterial color={carbonBlack} metalness={0.85} />
                    </mesh>

                    {/* TAI ROBOT (ACOUSTIC SENSORS & STATUS LEDS) */}
                    {[-0.2, 0.2].map((xPos, idx) => (
                        <group key={idx} position={[xPos, 0, 0]}>
                            <mesh rotation={[0, 0, Math.PI / 2]}>
                                <cylinderGeometry args={[0.07, 0.07, 0.03, 16]} />
                                <meshStandardMaterial color={metallicChrome} metalness={0.9} />
                            </mesh>
                            <mesh position={[xPos > 0 ? 0.018 : -0.018, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                                <circleGeometry args={[0.04, 16]} />
                                <meshStandardMaterial color={nvidiaGreen} emissive={nvidiaGreen} emissiveIntensity={2.5} />
                            </mesh>
                        </group>
                    ))}

                    {/* KÍNH NGẮM QUANG HỌC LIỀN MẠCH (CURVED BLACK VISOR) */}
                    <RoundedBox args={[0.34, 0.16, 0.08]} radius={0.04} position={[0, 0.02, 0.16]} castShadow>
                        <meshStandardMaterial color="#020408" roughness={0.05} metalness={0.98} />
                    </RoundedBox>

                    {/* TIA QUÉT LASER AI SCANNER BÊN TRONG KÍNH NGẮM */}
                    <mesh ref={scannerRef} position={[0, 0.02, 0.205]}>
                        <boxGeometry args={[0.08, 0.025, 0.005]} />
                        <meshStandardMaterial
                            color={nvidiaGreen}
                            emissive={nvidiaGreen}
                            emissiveIntensity={3.5}
                        />
                    </mesh>
                </group>

                {/* ===== 4. CÁNH TAY TRÁI & PHẢI (ARTICULATED 5-FINGER ARMS) ===== */}
                {/* TAY TRÁI */}
                <group ref={leftArmRef} position={[-0.3, 1.15, 0]}>
                    {/* Bọc vai khí động học (Shoulder Pauldron) */}
                    <RoundedBox args={[0.14, 0.16, 0.18]} radius={0.04} position={[-0.04, 0, 0]} castShadow>
                        <meshStandardMaterial color={armorWhite} roughness={0.2} />
                    </RoundedBox>
                    <mesh position={[-0.04, 0.04, 0.095]}>
                        <boxGeometry args={[0.1, 0.02, 0.01]} />
                        <meshStandardMaterial color={customAccent} emissive={customAccent} emissiveIntensity={1.2} />
                    </mesh>

                    {/* Khớp cầu vai */}
                    <mesh position={[-0.04, -0.08, 0]}>
                        <sphereGeometry args={[0.065, 16, 16]} />
                        <meshStandardMaterial color={metallicChrome} metalness={0.95} />
                    </mesh>

                    {/* Cánh tay trên (Bicep) carbon đen */}
                    <mesh position={[-0.04, -0.22, 0]} castShadow>
                        <cylinderGeometry args={[0.05, 0.055, 0.2, 12]} />
                        <meshStandardMaterial color={carbonBlack} metalness={0.8} />
                    </mesh>

                    {/* Khớp khuỷu tay trục xoay */}
                    <mesh position={[-0.04, -0.34, 0]} rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[0.05, 0.05, 0.1, 12]} />
                        <meshStandardMaterial color={metallicChrome} metalness={0.9} />
                    </mesh>

                    {/* Cẳng tay (Forearm) có giáp trắng */}
                    <RoundedBox args={[0.09, 0.22, 0.1]} radius={0.02} position={[-0.04, -0.47, 0]} castShadow>
                        <meshStandardMaterial color={armorWhite} roughness={0.25} />
                    </RoundedBox>

                    {/* BÀN TAY TACTILE 5 NGÓN (DEXTEROUS HAND) */}
                    <group position={[-0.04, -0.61, 0]}>
                        <mesh castShadow>
                            <boxGeometry args={[0.08, 0.07, 0.04]} />
                            <meshStandardMaterial color={carbonBlack} metalness={0.9} />
                        </mesh>
                        {/* 4 ngón tay kim loại */}
                        {[-0.03, -0.01, 0.01, 0.03].map((fX, fIdx) => (
                            <group key={fIdx} position={[fX, -0.05, 0]}>
                                <mesh>
                                    <cylinderGeometry args={[0.007, 0.007, 0.045, 8]} />
                                    <meshStandardMaterial color={metallicChrome} metalness={0.9} />
                                </mesh>
                                {/* Đầu ngón cảm ứng phát sáng */}
                                <mesh position={[0, -0.025, 0]}>
                                    <sphereGeometry args={[0.008, 8, 8]} />
                                    <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={2} />
                                </mesh>
                            </group>
                        ))}
                    </group>
                </group>

                {/* TAY PHẢI */}
                <group ref={rightArmRef} position={[0.3, 1.15, 0]}>
                    <RoundedBox args={[0.14, 0.16, 0.18]} radius={0.04} position={[0.04, 0, 0]} castShadow>
                        <meshStandardMaterial color={armorWhite} roughness={0.2} />
                    </RoundedBox>
                    <mesh position={[0.04, 0.04, 0.095]}>
                        <boxGeometry args={[0.1, 0.02, 0.01]} />
                        <meshStandardMaterial color={customAccent} emissive={customAccent} emissiveIntensity={1.2} />
                    </mesh>

                    <mesh position={[0.04, -0.08, 0]}>
                        <sphereGeometry args={[0.065, 16, 16]} />
                        <meshStandardMaterial color={metallicChrome} metalness={0.95} />
                    </mesh>

                    <mesh position={[0.04, -0.22, 0]} castShadow>
                        <cylinderGeometry args={[0.05, 0.055, 0.2, 12]} />
                        <meshStandardMaterial color={carbonBlack} metalness={0.8} />
                    </mesh>

                    <mesh position={[0.04, -0.34, 0]} rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[0.05, 0.05, 0.1, 12]} />
                        <meshStandardMaterial color={metallicChrome} metalness={0.9} />
                    </mesh>

                    <RoundedBox args={[0.09, 0.22, 0.1]} radius={0.02} position={[0.04, -0.47, 0]} castShadow>
                        <meshStandardMaterial color={armorWhite} roughness={0.25} />
                    </RoundedBox>

                    <group position={[0.04, -0.61, 0]}>
                        <mesh castShadow>
                            <boxGeometry args={[0.08, 0.07, 0.04]} />
                            <meshStandardMaterial color={carbonBlack} metalness={0.9} />
                        </mesh>
                        {[-0.03, -0.01, 0.01, 0.03].map((fX, fIdx) => (
                            <group key={fIdx} position={[fX, -0.05, 0]}>
                                <mesh>
                                    <cylinderGeometry args={[0.007, 0.007, 0.045, 8]} />
                                    <meshStandardMaterial color={metallicChrome} metalness={0.9} />
                                </mesh>
                                <mesh position={[0, -0.025, 0]}>
                                    <sphereGeometry args={[0.008, 8, 8]} />
                                    <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={2} />
                                </mesh>
                            </group>
                        ))}
                    </group>
                </group>
            </group>

            {/* ===== 5. HAI CHÂN ROBOT (BIPEDAL HYDRAULIC LEGS) ===== */}
            {/* CHÂN TRÁI */}
            <group ref={leftLegRef} position={[-0.14, 0.55, 0]}>
                {/* Đùi (Thigh) có giáp mặt trước & pít-tông thủy lực sau */}
                <RoundedBox args={[0.13, 0.28, 0.15]} radius={0.03} position={[0, -0.15, 0]} castShadow>
                    <meshStandardMaterial color={armorWhite} roughness={0.2} />
                </RoundedBox>
                {/* Pít-tông trợ lực phía sau đùi */}
                <mesh position={[0, -0.15, -0.09]}>
                    <cylinderGeometry args={[0.02, 0.02, 0.24, 8]} />
                    <meshStandardMaterial color={metallicChrome} metalness={0.95} />
                </mesh>

                {/* Khớp đầu gối cơ học 2 trục */}
                <mesh position={[0, -0.32, 0]} rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[0.06, 0.06, 0.13, 16]} />
                    <meshStandardMaterial color={carbonBlack} metalness={0.9} />
                </mesh>

                {/* Cẳng chân (Shin & Calf) */}
                <RoundedBox args={[0.12, 0.3, 0.14]} radius={0.03} position={[0, -0.5, 0]} castShadow>
                    <meshStandardMaterial color={carbonBlack} metalness={0.8} />
                </RoundedBox>
                {/* Giáp ống đồng titan */}
                <mesh position={[0, -0.48, 0.075]} castShadow>
                    <boxGeometry args={[0.1, 0.24, 0.02]} />
                    <meshStandardMaterial color={armorWhite} roughness={0.25} />
                </mesh>

                {/* Khớp cổ chân & Bàn chân bám đường cao su */}
                <group position={[0, -0.7, 0.05]}>
                    <RoundedBox args={[0.13, 0.08, 0.24]} radius={0.02} position={[0, 0, 0]} castShadow>
                        <meshStandardMaterial color={carbonBlack} metalness={0.9} />
                    </RoundedBox>
                    {/* Đế giày bám đường màu xám đậm */}
                    <mesh position={[0, -0.045, 0]}>
                        <boxGeometry args={[0.14, 0.02, 0.25]} />
                        <meshStandardMaterial color="#0a0a0c" roughness={0.9} />
                    </mesh>
                </group>
            </group>

            {/* CHÂN PHẢI */}
            <group ref={rightLegRef} position={[0.14, 0.55, 0]}>
                <RoundedBox args={[0.13, 0.28, 0.15]} radius={0.03} position={[0, -0.15, 0]} castShadow>
                    <meshStandardMaterial color={armorWhite} roughness={0.2} />
                </RoundedBox>
                <mesh position={[0, -0.15, -0.09]}>
                    <cylinderGeometry args={[0.02, 0.02, 0.24, 8]} />
                    <meshStandardMaterial color={metallicChrome} metalness={0.95} />
                </mesh>

                <mesh position={[0, -0.32, 0]} rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[0.06, 0.06, 0.13, 16]} />
                    <meshStandardMaterial color={carbonBlack} metalness={0.9} />
                </mesh>

                <RoundedBox args={[0.12, 0.3, 0.14]} radius={0.03} position={[0, -0.5, 0]} castShadow>
                    <meshStandardMaterial color={carbonBlack} metalness={0.8} />
                </RoundedBox>
                <mesh position={[0, -0.48, 0.075]} castShadow>
                    <boxGeometry args={[0.1, 0.24, 0.02]} />
                    <meshStandardMaterial color={armorWhite} roughness={0.25} />
                </mesh>

                <group position={[0, -0.7, 0.05]}>
                    <RoundedBox args={[0.13, 0.08, 0.24]} radius={0.02} position={[0, 0, 0]} castShadow>
                        <meshStandardMaterial color={carbonBlack} metalness={0.9} />
                    </RoundedBox>
                    <mesh position={[0, -0.045, 0]}>
                        <boxGeometry args={[0.14, 0.02, 0.25]} />
                        <meshStandardMaterial color="#0a0a0c" roughness={0.9} />
                    </mesh>
                </group>
            </group>
        </group>
    )
}

// ──────────────────────────────────────────────────────────────
// 2. NVIDIA NOVA CARTER AMR (SEGWAY RMP REFERENCE ROBOT)
// ──────────────────────────────────────────────────────────────
export function NvidiaNovaCarterRobotMesh({
    color = '#f97316',
    walking = false,
}: NvidiaRobotProps) {
    const lidarRef = useRef<THREE.Group>(null)
    const leftWheelRef = useRef<THREE.Group>(null)
    const rightWheelRef = useRef<THREE.Group>(null)
    const scanRingRef = useRef<THREE.Mesh>(null)

    useFrame((state, delta) => {
        const t = state.clock.elapsedTime
        // 1. Vòm cảm biến LiDAR xoay 360 độ liên tục
        if (lidarRef.current) {
            lidarRef.current.rotation.y += delta * 6.5
        }
        // 2. Hiệu ứng quét laser
        if (scanRingRef.current) {
            scanRingRef.current.rotation.z = t * 3
            const s = 1 + Math.sin(t * 8) * 0.05
            scanRingRef.current.scale.set(s, s, 1)
        }
        // 3. Bánh xe quay khi di chuyển
        if (walking) {
            if (leftWheelRef.current) leftWheelRef.current.rotation.x += delta * 12
            if (rightWheelRef.current) rightWheelRef.current.rotation.x += delta * 12
        }
    })

    const carbonBody = '#14171d'
    const titaniumChassis = '#262a34'
    const nvidiaGreen = '#76b900'
    const safetyOrange = (!color || color === '#4299e1' || color === '#76b900') ? '#f97316' : color

    return (
        <group position={[0, 0.1, 0]}>
            {/* ===== 1. KHUNG GẦM HEAVY-DUTY VÁT GÓC (SEGWAY RMP BASE) ===== */}
            <group position={[0, 0.22, 0]}>
                <RoundedBox args={[0.92, 0.26, 1.2]} radius={0.06} castShadow>
                    <meshStandardMaterial color={carbonBody} roughness={0.3} metalness={0.7} />
                </RoundedBox>

                {/* Tấm ốp bảo vệ hợp kim titan vát góc dưới gầm */}
                <mesh position={[0, -0.12, 0]}>
                    <boxGeometry args={[0.84, 0.06, 1.12]} />
                    <meshStandardMaterial color={titaniumChassis} metalness={0.85} />
                </mesh>

                {/* ĐƯỜNG VIỀN SỌC AN TOÀN NVIDIA LIME & SAFETY ORANGE */}
                <mesh position={[0, 0.02, 0.605]}>
                    <boxGeometry args={[0.82, 0.05, 0.01]} />
                    <meshStandardMaterial color={nvidiaGreen} emissive={nvidiaGreen} emissiveIntensity={1.2} />
                </mesh>
                <mesh position={[-0.465, 0.02, 0]}>
                    <boxGeometry args={[0.01, 0.04, 0.9]} />
                    <meshStandardMaterial color={safetyOrange} emissive={safetyOrange} emissiveIntensity={0.8} />
                </mesh>
                <mesh position={[0.465, 0.02, 0]}>
                    <boxGeometry args={[0.01, 0.04, 0.9]} />
                    <meshStandardMaterial color={safetyOrange} emissive={safetyOrange} emissiveIntensity={0.8} />
                </mesh>

                {/* DẢI ĐÈN LED CHU VI 360° (PERIMETER SAFETY HALO) */}
                <mesh position={[0, -0.06, 0]}>
                    <boxGeometry args={[0.94, 0.02, 1.22]} />
                    <meshStandardMaterial
                        color={walking ? safetyOrange : nvidiaGreen}
                        emissive={walking ? safetyOrange : nvidiaGreen}
                        emissiveIntensity={2.2}
                    />
                </mesh>
            </group>

            {/* ===== 2. HỆ THỐNG TRUYỀN ĐỘNG & BÁNH CAO SU GAI DẦY ===== */}
            {/* BÁNH TRÁI */}
            <group ref={leftWheelRef} position={[-0.51, 0.22, 0]}>
                <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                    <cylinderGeometry args={[0.22, 0.22, 0.12, 24]} />
                    <meshStandardMaterial color="#090a0d" roughness={0.9} />
                </mesh>
                {/* Mâm đĩa kim loại & Viền xanh NVIDIA */}
                <mesh position={[-0.065, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                    <circleGeometry args={[0.13, 16]} />
                    <meshStandardMaterial color={titaniumChassis} metalness={0.9} />
                </mesh>
                <mesh position={[-0.068, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                    <ringGeometry args={[0.09, 0.11, 16]} />
                    <meshStandardMaterial color={nvidiaGreen} emissive={nvidiaGreen} emissiveIntensity={2} />
                </mesh>
            </group>

            {/* BÁNH PHẢI */}
            <group ref={rightWheelRef} position={[0.51, 0.22, 0]}>
                <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                    <cylinderGeometry args={[0.22, 0.22, 0.12, 24]} />
                    <meshStandardMaterial color="#090a0d" roughness={0.9} />
                </mesh>
                <mesh position={[0.065, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                    <circleGeometry args={[0.13, 16]} />
                    <meshStandardMaterial color={titaniumChassis} metalness={0.9} />
                </mesh>
                <mesh position={[0.068, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                    <ringGeometry args={[0.09, 0.11, 16]} />
                    <meshStandardMaterial color={nvidiaGreen} emissive={nvidiaGreen} emissiveIntensity={2} />
                </mesh>
            </group>

            {/* BÁNH XOAY OMNI PHÍA TRƯỚC VÀ SAU (CASTER WHEELS) */}
            {[-0.45, 0.45].map((zPos, idx) => (
                <group key={idx} position={[0, 0.08, zPos]}>
                    <mesh castShadow>
                        <sphereGeometry args={[0.075, 16, 16]} />
                        <meshStandardMaterial color="#2d3748" metalness={0.8} />
                    </mesh>
                </group>
            ))}

            {/* ===== 3. MẶT SÀN TẢI & NÚT DỪNG KHẨN CẤP E-STOP ===== */}
            <group position={[0, 0.36, 0]}>
                <mesh receiveShadow>
                    <boxGeometry args={[0.82, 0.03, 1.08]} />
                    <meshStandardMaterial color="#1a1e26" roughness={0.7} />
                </mesh>

                {/* NÚT KHẨN CẤP E-STOP (CHỐT NẤM ĐỎ TIÊU CHUẨN CÔNG NGHIỆP) */}
                <group position={[0.28, 0.04, 0.38]}>
                    {/* Đế vuông màu vàng cảnh báo */}
                    <mesh position={[0, 0.02, 0]}>
                        <boxGeometry args={[0.09, 0.04, 0.09]} />
                        <meshStandardMaterial color="#eab308" roughness={0.4} />
                    </mesh>
                    {/* Nấm đỏ dừng khẩn cấp */}
                    <mesh position={[0, 0.06, 0]}>
                        <cylinderGeometry args={[0.05, 0.035, 0.04, 16]} />
                        <meshStandardMaterial color="#dc2626" roughness={0.3} />
                    </mesh>
                </group>

                {/* Đồng hồ pin LED 5 vạch phía sau */}
                <group position={[0, 0.02, -0.52]}>
                    {[-0.06, -0.03, 0, 0.03, 0.06].map((pX, pIdx) => (
                        <mesh key={pIdx} position={[pX, 0, 0]}>
                            <boxGeometry args={[0.02, 0.01, 0.02]} />
                            <meshStandardMaterial color={nvidiaGreen} emissive={nvidiaGreen} emissiveIntensity={2.5} />
                        </mesh>
                    ))}
                </group>
            </group>

            {/* ===== 4. CỤM CẢM BIẾN REALSENSE LẬP THỂ (STEREO VISION ARRAY) ===== */}
            {/* Cụm RealSense D455 trước */}
            <group position={[0, 0.26, 0.61]}>
                <RoundedBox args={[0.34, 0.08, 0.04]} radius={0.015} castShadow>
                    <meshStandardMaterial color="#0b0e14" metalness={0.9} />
                </RoundedBox>
                {/* 2 mắt kính đo chiều sâu trái & phải */}
                {[-0.12, 0.12].map((camX, camIdx) => (
                    <mesh key={camIdx} position={[camX, 0, 0.022]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[0.022, 0.022, 0.01, 16]} />
                        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={2.5} />
                    </mesh>
                ))}
                {/* Đèn chiếu hồng ngoại IR ở tâm */}
                <mesh position={[0, 0, 0.022]}>
                    <circleGeometry args={[0.012, 12]} />
                    <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={2} />
                </mesh>
            </group>

            {/* Cụm RealSense lùi phía sau */}
            <group position={[0, 0.26, -0.61]}>
                <RoundedBox args={[0.26, 0.07, 0.03]} radius={0.015} castShadow>
                    <meshStandardMaterial color="#0b0e14" metalness={0.9} />
                </RoundedBox>
                {[-0.08, 0.08].map((camX, camIdx) => (
                    <mesh key={camIdx} position={[camX, 0, -0.018]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[0.018, 0.018, 0.01, 16]} />
                        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={2} />
                    </mesh>
                ))}
            </group>

            {/* ===== 5. THÁP QUÉT LIDAR 360° (HESAI PANDAR / VELODYNE PUCK) ===== */}
            <group position={[0, 0.38, -0.15]}>
                {/* Cột trụ hợp kim nhôm định hình nâng LiDAR */}
                <mesh position={[0, 0.16, 0]} castShadow>
                    <cylinderGeometry args={[0.05, 0.065, 0.32, 16]} />
                    <meshStandardMaterial color={titaniumChassis} metalness={0.9} />
                </mesh>

                {/* Vòm cảm biến LiDAR xoay liên tục 360 độ */}
                <group ref={lidarRef} position={[0, 0.36, 0]}>
                    {/* Thân vòm kim loại đen */}
                    <mesh castShadow>
                        <cylinderGeometry args={[0.13, 0.13, 0.16, 24]} />
                        <meshStandardMaterial color="#05070a" metalness={0.95} roughness={0.1} />
                    </mesh>
                    {/* Dải kính hồng ngoại quang học trong suốt ở giữa */}
                    <mesh position={[0, 0, 0]}>
                        <cylinderGeometry args={[0.132, 0.132, 0.07, 24]} />
                        <meshStandardMaterial color="#06b6d4" transparent opacity={0.65} metalness={0.5} roughness={0.1} />
                    </mesh>
                    {/* Đèn laser phát xung bên trong */}
                    <mesh position={[0.08, 0, 0]}>
                        <sphereGeometry args={[0.02, 12, 12]} />
                        <meshStandardMaterial color={nvidiaGreen} emissive={nvidiaGreen} emissiveIntensity={3} />
                    </mesh>
                </group>
            </group>
        </group>
    )
}

// ──────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────
// 3. MICRODUCK BIPEDAL ROBOT (CHUẨN THEO ẢNH NGUYÊN BẢN MICRODUCK)
// ──────────────────────────────────────────────────────────────
export function NvidiaMicroDuckRobotMesh({
    color = '#7dd3fc', // Baby blue nguyên bản
    walking = false,
    sitting = false,
}: NvidiaRobotProps) {
    const headRef = useRef<THREE.Group>(null)
    const neckRef = useRef<THREE.Group>(null)
    const bodyRef = useRef<THREE.Group>(null)
    const leftLegRef = useRef<THREE.Group>(null)
    const rightLegRef = useRef<THREE.Group>(null)

    useFrame((state) => {
        const t = state.clock.elapsedTime

        if (walking) {
            // Bước đi lạch bạch đặc trưng của vịt bipedal
            const step = Math.sin(t * 7) * 0.45
            const waddle = Math.sin(t * 7) * 0.14
            const bob = Math.abs(Math.sin(t * 14)) * 0.05

            if (leftLegRef.current) leftLegRef.current.rotation.x = step
            if (rightLegRef.current) rightLegRef.current.rotation.x = -step

            if (bodyRef.current) {
                bodyRef.current.rotation.z = waddle
                bodyRef.current.position.y = bob
            }

            if (headRef.current) {
                headRef.current.rotation.z = -waddle * 0.7
                headRef.current.rotation.x = 0.18 + Math.sin(t * 7) * 0.08
            }
        } else if (sitting) {
            if (leftLegRef.current) leftLegRef.current.rotation.x = -Math.PI / 3
            if (rightLegRef.current) rightLegRef.current.rotation.x = -Math.PI / 3
            if (bodyRef.current) {
                bodyRef.current.position.y = -0.15
                bodyRef.current.rotation.z = 0
            }
            if (headRef.current) {
                headRef.current.rotation.x = -0.1
                headRef.current.rotation.y = Math.sin(t * 1.5) * 0.15
            }
        } else {
            // Idle tò mò nghiêng đầu nhìn ngắm xung quanh
            if (leftLegRef.current) leftLegRef.current.rotation.x = 0
            if (rightLegRef.current) rightLegRef.current.rotation.x = 0

            if (bodyRef.current) {
                bodyRef.current.position.y = Math.sin(t * 2) * 0.01
                bodyRef.current.rotation.z = Math.sin(t * 1.5) * 0.03
            }

            if (headRef.current) {
                headRef.current.rotation.x = 0.14 + Math.sin(t * 1.2) * 0.06
                headRef.current.rotation.y = Math.sin(t * 0.8) * 0.18
                headRef.current.rotation.z = -0.12 + Math.cos(t * 1.0) * 0.04
            }
        }
    })

    const duckBlue = (!color || color === '#4299e1' || color === '#76b900') ? '#7dd3fc' : color // Màu xanh baby blue nguyên bản
    const beakOrange = '#f97316' // Màu cam mỏ & mắt & chân
    const footYellow = '#fbbf24' // Đế giày vàng
    const servoBlack = '#18181b' // Vỏ motor servo đen
    const hornSilver = '#d1d5db' // Đĩa servo kim loại bạc
    const faceGray = '#9ca3af' // Mặt xám

    return (
        <group position={[0, sitting ? -0.2 : 0, 0]}>
            <group ref={bodyRef}>
                {/* ===== 1. THÂN MICRODUCK (BABY BLUE COMPACT TORSO) ===== */}
                <group position={[0, 0.42, 0]}>
                    <RoundedBox args={[0.34, 0.18, 0.32]} radius={0.06} castShadow>
                        <meshStandardMaterial color={duckBlue} roughness={0.3} metalness={0.1} />
                    </RoundedBox>

                    {/* Khối khung gá servo đen bên dưới thân */}
                    <mesh position={[0, -0.1, 0]} castShadow>
                        <boxGeometry args={[0.28, 0.08, 0.26]} />
                        <meshStandardMaterial color={servoBlack} metalness={0.8} roughness={0.3} />
                    </mesh>

                    {/* Đĩa ốc kim loại bạc bên sườn thân */}
                    {[-0.175, 0.175].map((sX, sIdx) => (
                        <group key={sIdx} position={[sX, 0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
                            <cylinderGeometry args={[0.025, 0.025, 0.01, 12]} />
                            <meshStandardMaterial color={hornSilver} metalness={0.9} />
                        </group>
                    ))}
                </group>

                {/* ===== 2. CỔ MICRODUCK (MULTI-SERVO BLACK NECK & WIRES) ===== */}
                <group ref={neckRef} position={[0.02, 0.58, 0.05]}>
                    {/* Servo đốt cổ 1 */}
                    <group position={[0, 0.06, 0]}>
                        <mesh castShadow>
                            <boxGeometry args={[0.1, 0.12, 0.1]} />
                            <meshStandardMaterial color={servoBlack} metalness={0.85} roughness={0.3} />
                        </mesh>
                        <mesh position={[0, 0.065, 0]}>
                            <boxGeometry args={[0.11, 0.02, 0.11]} />
                            <meshStandardMaterial color={hornSilver} metalness={0.9} />
                        </mesh>
                    </group>

                    {/* Servo đốt cổ 2 (nghiêng về phía trước) */}
                    <group position={[0, 0.18, 0.02]} rotation={[0.15, 0, 0]}>
                        <mesh castShadow>
                            <boxGeometry args={[0.1, 0.12, 0.1]} />
                            <meshStandardMaterial color={servoBlack} metalness={0.85} roughness={0.3} />
                        </mesh>
                        <mesh position={[0, 0.065, 0]}>
                            <boxGeometry args={[0.11, 0.02, 0.11]} />
                            <meshStandardMaterial color={hornSilver} metalness={0.9} />
                        </mesh>
                    </group>

                    {/* DÂY CÁP ĐEN UỐN CONG PHÍA SAU CỔ (REAR WIRES) */}
                    {[-0.03, 0, 0.03].map((wX, wIdx) => (
                        <group key={wIdx} position={[wX, 0.12, -0.065]} rotation={[-0.3, 0, 0]}>
                            <cylinderGeometry args={[0.008, 0.008, 0.22, 8]} />
                            <meshStandardMaterial color="#090a0f" roughness={0.8} />
                        </group>
                    ))}
                </group>

                {/* ===== 3. ĐẦU MICRODUCK NGUYÊN BẢN (BABY BLUE SHELL & ORANGE BEAK) ===== */}
                <group ref={headRef} position={[0.04, 0.88, 0.12]}>
                    {/* Vỏ đầu tròn vát cạnh màu baby blue */}
                    <RoundedBox args={[0.34, 0.26, 0.36]} radius={0.08} castShadow>
                        <meshStandardMaterial color={duckBlue} roughness={0.3} metalness={0.1} />
                    </RoundedBox>

                    {/* MẶT PHẲNG XÁM (GRAY FACE PLATE) */}
                    <group position={[0, -0.02, 0.17]}>
                        <RoundedBox args={[0.3, 0.2, 0.04]} radius={0.03} castShadow>
                            <meshStandardMaterial color={faceGray} roughness={0.4} metalness={0.2} />
                        </RoundedBox>

                        {/* MẮT TO TRÒN TRƯNG (ICONIC ORANGE EYE WITH CAMERA LENS) */}
                        {/* Mắt phải (mặt bên phải nổi bật trong ảnh) */}
                        <group position={[0.07, 0.02, 0.022]}>
                            <mesh rotation={[Math.PI / 2, 0, 0]}>
                                <cylinderGeometry args={[0.06, 0.06, 0.015, 24]} />
                                <meshStandardMaterial color={beakOrange} roughness={0.3} />
                            </mesh>
                            <mesh position={[0, 0, 0.008]} rotation={[Math.PI / 2, 0, 0]}>
                                <cylinderGeometry args={[0.045, 0.045, 0.005, 24]} />
                                <meshStandardMaterial color={footYellow} roughness={0.3} />
                            </mesh>
                            <mesh position={[0, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]}>
                                <cylinderGeometry args={[0.028, 0.028, 0.006, 20]} />
                                <meshStandardMaterial color="#09090b" roughness={0.1} metalness={0.9} />
                            </mesh>
                            <mesh position={[0.045, -0.02, 0.008]}>
                                <circleGeometry args={[0.008, 12]} />
                                <meshStandardMaterial color="#1e293b" />
                            </mesh>
                        </group>

                        {/* Mắt trái đối xứng */}
                        <group position={[-0.07, 0.02, 0.022]}>
                            <mesh rotation={[Math.PI / 2, 0, 0]}>
                                <cylinderGeometry args={[0.06, 0.06, 0.015, 24]} />
                                <meshStandardMaterial color={beakOrange} roughness={0.3} />
                            </mesh>
                            <mesh position={[0, 0, 0.008]} rotation={[Math.PI / 2, 0, 0]}>
                                <cylinderGeometry args={[0.045, 0.045, 0.005, 24]} />
                                <meshStandardMaterial color={footYellow} roughness={0.3} />
                            </mesh>
                            <mesh position={[0, 0, 0.012]} rotation={[Math.PI / 2, 0, 0]}>
                                <cylinderGeometry args={[0.028, 0.028, 0.006, 20]} />
                                <meshStandardMaterial color="#09090b" roughness={0.1} metalness={0.9} />
                            </mesh>
                        </group>

                        {/* MỎ VỊT MÀU CAM NẰM NGANG PHÍA DƯỚI MẶT (ORANGE BEAK / JAW) */}
                        <group position={[0, -0.11, 0.015]}>
                            <RoundedBox args={[0.34, 0.065, 0.14]} radius={0.02} castShadow>
                                <meshStandardMaterial color={beakOrange} roughness={0.35} />
                            </RoundedBox>
                            {/* Mấu cam nhô lên ở góc trên bên phải đặc trưng */}
                            <mesh position={[0.15, 0.06, 0.02]}>
                                <boxGeometry args={[0.035, 0.055, 0.06]} />
                                <meshStandardMaterial color={beakOrange} roughness={0.35} />
                            </mesh>
                        </group>
                    </group>
                </group>
            </group>

            {/* ===== 4. HAI CHÂN BIPEDAL SERVO & BÀN CHÂN VỊT CAM ===== */}
            {/* CHÂN TRÁI */}
            <group ref={leftLegRef} position={[-0.18, 0.38, 0]}>
                {/* Tấm ốp hông baby blue nghiêng về sau (Hip Guard Flap) */}
                <group position={[-0.03, -0.05, -0.04]} rotation={[0.45, 0, 0]}>
                    <RoundedBox args={[0.03, 0.16, 0.22]} radius={0.02} castShadow>
                        <meshStandardMaterial color={duckBlue} roughness={0.3} />
                    </RoundedBox>
                    <mesh position={[-0.016, 0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[0.01, 0.01, 0.005, 8]} />
                        <meshStandardMaterial color={hornSilver} metalness={0.9} />
                    </mesh>
                </group>

                {/* Motor Servo háng (Hip Servo) */}
                <mesh position={[0, 0, 0]} castShadow>
                    <boxGeometry args={[0.09, 0.1, 0.12]} />
                    <meshStandardMaterial color={servoBlack} metalness={0.85} roughness={0.3} />
                </mesh>
                <mesh position={[0.048, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[0.038, 0.038, 0.005, 16]} />
                    <meshStandardMaterial color={hornSilver} metalness={0.95} />
                </mesh>

                {/* Đùi gập ngược kiểu chim/vịt (Bird-Leg Joint) */}
                <group position={[0, -0.14, -0.04]} rotation={[-0.35, 0, 0]}>
                    <mesh castShadow>
                        <boxGeometry args={[0.08, 0.09, 0.09]} />
                        <meshStandardMaterial color={servoBlack} metalness={0.85} roughness={0.3} />
                    </mesh>
                    <mesh position={[0, -0.08, 0.02]} rotation={[0.4, 0, 0]}>
                        <boxGeometry args={[0.07, 0.12, 0.04]} />
                        <meshStandardMaterial color={hornSilver} metalness={0.9} />
                    </mesh>

                    {/* BÀN CHÂN VỊT CAM BỰ (CHUNKY ORANGE WEBBED FOOT) */}
                    <group position={[0, -0.16, 0.08]} rotation={[-0.05, 0, 0]}>
                        <RoundedBox args={[0.17, 0.07, 0.26]} radius={0.03} castShadow>
                            <meshStandardMaterial color={beakOrange} roughness={0.35} />
                        </RoundedBox>
                        <mesh position={[0, -0.04, 0]}>
                            <boxGeometry args={[0.16, 0.015, 0.25]} />
                            <meshStandardMaterial color={footYellow} roughness={0.8} />
                        </mesh>
                        <mesh position={[0, 0.04, -0.04]}>
                            <cylinderGeometry args={[0.02, 0.02, 0.02, 12]} />
                            <meshStandardMaterial color={hornSilver} metalness={0.9} />
                        </mesh>
                    </group>
                </group>
            </group>

            {/* CHÂN PHẢI */}
            <group ref={rightLegRef} position={[0.18, 0.38, 0]}>
                <group position={[0.03, -0.05, -0.04]} rotation={[0.45, 0, 0]}>
                    <RoundedBox args={[0.03, 0.16, 0.22]} radius={0.02} castShadow>
                        <meshStandardMaterial color={duckBlue} roughness={0.3} />
                    </RoundedBox>
                    <mesh position={[0.016, 0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[0.01, 0.01, 0.005, 8]} />
                        <meshStandardMaterial color={hornSilver} metalness={0.9} />
                    </mesh>
                </group>

                <mesh position={[0, 0, 0]} castShadow>
                    <boxGeometry args={[0.09, 0.1, 0.12]} />
                    <meshStandardMaterial color={servoBlack} metalness={0.85} roughness={0.3} />
                </mesh>
                <mesh position={[-0.048, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[0.038, 0.038, 0.005, 16]} />
                    <meshStandardMaterial color={hornSilver} metalness={0.95} />
                </mesh>

                <group position={[0, -0.14, -0.04]} rotation={[-0.35, 0, 0]}>
                    <mesh castShadow>
                        <boxGeometry args={[0.08, 0.09, 0.09]} />
                        <meshStandardMaterial color={servoBlack} metalness={0.85} roughness={0.3} />
                    </mesh>
                    <mesh position={[0, -0.08, 0.02]} rotation={[0.4, 0, 0]}>
                        <boxGeometry args={[0.07, 0.12, 0.04]} />
                        <meshStandardMaterial color={hornSilver} metalness={0.9} />
                    </mesh>

                    {/* BÀN CHÂN VỊT CAM BỰ */}
                    <group position={[0, -0.16, 0.08]} rotation={[-0.05, 0, 0]}>
                        <RoundedBox args={[0.17, 0.07, 0.26]} radius={0.03} castShadow>
                            <meshStandardMaterial color={beakOrange} roughness={0.35} />
                        </RoundedBox>
                        <mesh position={[0, -0.04, 0]}>
                            <boxGeometry args={[0.16, 0.015, 0.25]} />
                            <meshStandardMaterial color={footYellow} roughness={0.8} />
                        </mesh>
                        <mesh position={[0, 0.04, -0.04]}>
                            <cylinderGeometry args={[0.02, 0.02, 0.02, 12]} />
                            <meshStandardMaterial color={hornSilver} metalness={0.9} />
                        </mesh>
                    </group>
                </group>
            </group>
        </group>
    )
}

// ──────────────────────────────────────────────────────────────
// 4. NVIDIA CYBER FALCON (INSPECTION DRONE QUADROTOR)
// ──────────────────────────────────────────────────────────────
export function NvidiaCyberDroneRobotMesh({
    color = '#06b6d4',
    walking = false,
}: NvidiaRobotProps) {
    const rotorRefs = [
        useRef<THREE.Group>(null),
        useRef<THREE.Group>(null),
        useRef<THREE.Group>(null),
        useRef<THREE.Group>(null),
    ]
    const gimbalRef = useRef<THREE.Group>(null)
    const floatRef = useRef<THREE.Group>(null)

    useFrame((state, delta) => {
        const t = state.clock.elapsedTime
        // 1. Cánh quạt quay tốc độ cao (nhanh hơn khi bay di chuyển)
        const rotSpeed = delta * (walking ? 45 : 30)
        rotorRefs.forEach((r, i) => {
            if (r.current) r.current.rotation.y += i % 2 === 0 ? rotSpeed : -rotSpeed
        })
        // 2. Chuyển động lơ lửng hover của drone
        if (floatRef.current) {
            floatRef.current.position.y = Math.sin(t * 3) * 0.04
            floatRef.current.rotation.x = walking ? 0.12 : Math.sin(t * 2) * 0.02
            floatRef.current.rotation.z = Math.cos(t * 2.5) * 0.02
        }
        // 3. Gimbal camera ổn định con quay hồi chuyển
        if (gimbalRef.current) {
            gimbalRef.current.rotation.y = Math.sin(t * 1.5) * 0.2
        }
    })

    const carbonBlack = '#101317'
    const cyanAccent = (!color || color === '#4299e1' || color === '#76b900') ? '#06b6d4' : color
    const nvidiaGreen = '#76b900'

    const armCoords: [number, number][] = [
        [-0.38, 0.38],
        [0.38, 0.38],
        [-0.38, -0.38],
        [0.38, -0.38],
    ]

    return (
        <group ref={floatRef} position={[0, 0.9, 0]}>
            {/* THÂN CHÍNH KHÍ ĐỘNG HỌC (CARBON CENTRAL FUSELAGE) */}
            <group position={[0, 0, 0]}>
                <RoundedBox args={[0.34, 0.15, 0.42]} radius={0.04} castShadow>
                    <meshStandardMaterial color={carbonBlack} metalness={0.9} roughness={0.2} />
                </RoundedBox>

                {/* Vành phát sáng năng lượng trên nóc */}
                <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.07, 0.09, 16]} />
                    <meshStandardMaterial color={cyanAccent} emissive={cyanAccent} emissiveIntensity={2.5} />
                </mesh>

                {/* CỘT ĂNG-TEN ĐỊNH VỊ RTK GNSS TRÊN ĐỈNH */}
                <group position={[0, 0.16, -0.08]}>
                    <mesh castShadow>
                        <cylinderGeometry args={[0.015, 0.02, 0.14, 8]} />
                        <meshStandardMaterial color="#64748b" metalness={0.9} />
                    </mesh>
                    <mesh position={[0, 0.08, 0]}>
                        <sphereGeometry args={[0.035, 12, 12]} />
                        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={3} />
                    </mesh>
                </group>
            </group>

            {/* 4 CÁNH TAY SỢI CARBON CHỮ X (CARBON X-FRAME ARMS) */}
            {armCoords.map(([xPos, zPos], idx) => {
                const angle = Math.atan2(zPos, xPos)
                const dist = Math.sqrt(xPos * xPos + zPos * zPos)
                return (
                    <group key={idx}>
                        {/* Ống carbon nối động cơ */}
                        <mesh
                            position={[xPos / 2, 0, zPos / 2]}
                            rotation={[0, -angle + Math.PI / 2, Math.PI / 2]}
                            castShadow
                        >
                            <cylinderGeometry args={[0.02, 0.02, dist, 8]} />
                            <meshStandardMaterial color="#0b0e14" metalness={0.8} />
                        </mesh>

                        {/* ĐỘNG CƠ BRUSHLESS Ở ĐẦU CÁNH */}
                        <group position={[xPos, 0, zPos]}>
                            <mesh castShadow>
                                <cylinderGeometry args={[0.06, 0.065, 0.08, 16]} />
                                <meshStandardMaterial color="#334155" metalness={0.95} />
                            </mesh>

                            {/* CÁNH QUẠT XOAY TỐC ĐỘ CAO */}
                            <group ref={rotorRefs[idx]} position={[0, 0.05, 0]}>
                                <mesh>
                                    <boxGeometry args={[0.42, 0.008, 0.035]} />
                                    <meshStandardMaterial
                                        color="#38bdf8"
                                        transparent
                                        opacity={0.65}
                                        roughness={0.1}
                                    />
                                </mesh>
                                {/* Đèn LED tip cánh quạt phát sáng */}
                                {[-0.2, 0.2].map((tipX, tIdx) => (
                                    <mesh key={tIdx} position={[tipX, 0, 0]}>
                                        <sphereGeometry args={[0.015, 8, 8]} />
                                        <meshStandardMaterial
                                            color={nvidiaGreen}
                                            emissive={nvidiaGreen}
                                            emissiveIntensity={3}
                                        />
                                    </mesh>
                                ))}
                            </group>
                        </group>
                    </group>
                )
            })}

            {/* GIMBAL CAMERA QUAN SÁT 3 TRỤC BÊN DƯỚI BỤNG */}
            <group ref={gimbalRef} position={[0, -0.14, 0.06]}>
                <mesh castShadow>
                    <sphereGeometry args={[0.07, 16, 16]} />
                    <meshStandardMaterial color="#090d16" roughness={0.1} metalness={0.95} />
                </mesh>
                {/* Ống kính quang học 4K rọi về phía trước */}
                <mesh position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.03, 0.03, 0.02, 16]} />
                    <meshStandardMaterial color={cyanAccent} emissive={cyanAccent} emissiveIntensity={2.5} />
                </mesh>
            </group>

            {/* CÀNG HẠ CÁNH KIM LOẠI (LANDING GEAR) */}
            {[-0.14, 0.14].map((gX, gIdx) => (
                <group key={gIdx} position={[gX, -0.15, 0]}>
                    <mesh castShadow>
                        <boxGeometry args={[0.02, 0.02, 0.36]} />
                        <meshStandardMaterial color="#475569" metalness={0.9} />
                    </mesh>
                </group>
            ))}
        </group>
    )
}

// ──────────────────────────────────────────────────────────────
// MASTER DISPATCHER: RENDER ĐÚNG HÌNH THÁI ROBOT CHUẨN NVIDIA
// ──────────────────────────────────────────────────────────────
export function NvidiaRobotRenderer(props: NvidiaRobotProps) {
    const { form = 'humanoid' } = props

    switch (form) {
        case 'custom':
            return <CustomAgentBodyMesh {...props} />
        case 'duck':
            return <NvidiaMicroDuckRobotMesh {...props} />
        case 'amr':
            return <NvidiaNovaCarterRobotMesh {...props} />
        case 'drone':
            return <NvidiaCyberDroneRobotMesh {...props} />
        case 'humanoid':
        default:
            return <NvidiaGr00tRobotMesh {...props} />
    }
}
