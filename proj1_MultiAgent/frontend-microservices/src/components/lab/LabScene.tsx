'use client'

import React, { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, Float, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { Physics } from '@react-three/rapier'
import Agent from '../agents/Agent'
import { Agent as AgentType } from '@/lib/api'
import ServerRack from '../office/ServerRack'

type LabSceneProps = {
    currentStep: number // 0 (idle), 1 (manager), 2 (search), 3 (summarizer), 4 (coder), 5 (completed)
    createdAgent: AgentType | null
    isSynthesizing: boolean
    activeSpeech: { agentId: string; text: string } | null
    onSelectStation?: (stationId: string) => void
}

/** 1. Đài chế tạo trung tâm (Quantum Synthesis Chamber) */
function IncubationPod({
    isSynthesizing,
    isCompleted,
    createdAgent,
}: {
    isSynthesizing: boolean
    isCompleted: boolean
    createdAgent: AgentType | null
}) {
    const ringRef1 = useRef<THREE.Mesh>(null)
    const ringRef2 = useRef<THREE.Mesh>(null)
    const cylinderRef = useRef<THREE.Mesh>(null)

    useFrame((_, delta) => {
        if (ringRef1.current) {
            ringRef1.current.rotation.z += delta * (isSynthesizing ? 2.5 : 0.6)
        }
        if (ringRef2.current) {
            ringRef2.current.rotation.z -= delta * (isSynthesizing ? 3.0 : 0.8)
        }
        if (cylinderRef.current && isSynthesizing) {
            cylinderRef.current.rotation.y += delta * 1.5
        }
    })

    const podColor = isCompleted ? '#10b981' : isSynthesizing ? '#ec4899' : '#06b6d4'

    return (
        <group position={[0, 0, 0]}>
            {/* Đế nền buồng chế tạo */}
            <mesh position={[0, 0.05, 0]} receiveShadow>
                <cylinderGeometry args={[2.8, 3.2, 0.1, 48]} />
                <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.2} />
            </mesh>

            {/* Vòng sáng LED viền đế */}
            <mesh position={[0, 0.11, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[2.5, 2.7, 48]} />
                <meshBasicMaterial color={podColor} side={THREE.DoubleSide} />
            </mesh>

            {/* Vòng tròn ma trận lõi */}
            <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[1.2, 1.35, 32]} />
                <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
            </mesh>

            {/* Vỏ kính năng lượng hình trụ trong suốt */}
            <mesh ref={cylinderRef} position={[0, 1.8, 0]}>
                <cylinderGeometry args={[2.2, 2.2, 3.4, 32, 1, true]} />
                <meshStandardMaterial
                    color={podColor}
                    transparent
                    opacity={isSynthesizing ? 0.35 : 0.18}
                    roughness={0.1}
                    metalness={0.9}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Vòng laser quay xung quanh buồng chế tạo */}
            <group position={[0, 1.8, 0]}>
                <mesh ref={ringRef1} rotation={[Math.PI / 6, 0, 0]}>
                    <torusGeometry args={[2.35, 0.03, 16, 64]} />
                    <meshBasicMaterial color={isSynthesizing ? '#f43f5e' : '#38bdf8'} />
                </mesh>
                <mesh ref={ringRef2} rotation={[-Math.PI / 6, Math.PI / 4, 0]}>
                    <torusGeometry args={[2.45, 0.03, 16, 64]} />
                    <meshBasicMaterial color={isSynthesizing ? '#a855f7' : '#06b6d4'} />
                </mesh>
            </group>

            {/* Đỉnh buồng chiếu Hologram */}
            <mesh position={[0, 3.55, 0]} castShadow>
                <cylinderGeometry args={[1.8, 2.3, 0.2, 32]} />
                <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[0, 3.44, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.5, 1.6, 32]} />
                <meshBasicMaterial color={podColor} side={THREE.DoubleSide} />
            </mesh>

            {/* Chùm tia Laser quang phổ thẳng đứng khi đang tổng hợp */}
            {isSynthesizing && (
                <mesh position={[0, 1.8, 0]}>
                    <cylinderGeometry args={[0.25, 0.25, 3.4, 16]} />
                    <meshBasicMaterial color="#ec4899" transparent opacity={0.65} />
                </mesh>
            )}

            {/* Hạt năng lượng lượng tử lơ lửng bên trong Pod */}
            <Sparkles
                count={isSynthesizing ? 120 : 40}
                scale={[3.5, 3.2, 3.5]}
                size={isSynthesizing ? 4 : 2}
                speed={isSynthesizing ? 2.5 : 0.8}
                color={podColor}
            />

            {/* Tên buồng hiển thị chữ 3D */}
            <Text
                position={[0, 3.9, 0]}
                fontSize={0.28}
                color={podColor}
                anchorX="center"
                anchorY="middle"
            >
                {isCompleted ? '✓ AGENT HOÀN THIỆN' : isSynthesizing ? '[FAST] ĐANG TỔNG HỢP AGENT...' : 'QUANTUM AGENT POD'}
            </Text>

            {/* Nếu chưa có agent nào được sinh và không đang tạo: hiển thị khối hologram lập phương lơ lửng */}
            {!createdAgent && !isSynthesizing && (
                <Float speed={2} rotationIntensity={1.5} floatIntensity={1}>
                    <mesh position={[0, 1.4, 0]}>
                        <octahedronGeometry args={[0.6, 0]} />
                        <meshStandardMaterial
                            color="#38bdf8"
                            wireframe
                            emissive="#0284c7"
                            emissiveIntensity={0.8}
                        />
                    </mesh>
                </Float>
            )}
        </group>
    )
}

/** 2. Đường ống dẫn năng lượng nối từ trạm về buồng trung tâm */
function EnergyConduit({
    from,
    to,
    active,
    color = '#38bdf8',
}: {
    from: [number, number, number]
    to: [number, number, number]
    active: boolean
    color?: string
}) {
    const pulseRef = useRef<THREE.Mesh>(null)

    useFrame((_, delta) => {
        if (pulseRef.current && active) {
            pulseRef.current.position.y = 0.08 + Math.sin(Date.now() * 0.006) * 0.03
        }
    })

    const midX = (from[0] + to[0]) / 2
    const midZ = (from[2] + to[2]) / 2
    const dx = to[0] - from[0]
    const dz = to[2] - from[2]
    const length = Math.sqrt(dx * dx + dz * dz)
    const angle = Math.atan2(dx, dz)

    return (
        <group position={[midX, 0.04, midZ]} rotation={[0, angle, 0]}>
            {/* Thanh ray dẫn năng lượng sàn */}
            <mesh receiveShadow>
                <boxGeometry args={[0.2, 0.05, length]} />
                <meshStandardMaterial color="#1e293b" />
            </mesh>
            {/* Lõi dẫn quang */}
            <mesh ref={pulseRef} position={[0, 0.04, 0]}>
                <boxGeometry args={[0.08, 0.03, length - 0.2]} />
                <meshBasicMaterial
                    color={active ? color : '#334155'}
                    transparent
                    opacity={active ? 0.95 : 0.3}
                />
            </mesh>
        </group>
    )
}

/** 3. Bàn trạm làm việc công nghệ cao (Sci-fi Workstation) */
function SciFiStation({
    position,
    rotation = [0, 0, 0],
    title,
    accentColor,
    active,
    subtitle,
}: {
    position: [number, number, number]
    rotation?: [number, number, number]
    title: string
    accentColor: string
    active: boolean
    subtitle?: string
}) {
    return (
        <group position={position} rotation={rotation}>
            {/* Bàn làm việc hình chữ nhật bo góc */}
            <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
                <boxGeometry args={[2.2, 0.9, 1.0]} />
                <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.3} />
            </mesh>

            {/* Dải LED viền bàn */}
            <mesh position={[0, 0.91, 0.48]}>
                <boxGeometry args={[2.1, 0.03, 0.03]} />
                <meshBasicMaterial color={active ? accentColor : '#334155'} />
            </mesh>

            {/* Màn hình Hologram cong chính */}
            <mesh position={[0, 1.35, -0.2]} rotation={[-0.15, 0, 0]}>
                <boxGeometry args={[1.4, 0.7, 0.04]} />
                <meshStandardMaterial
                    color="#020617"
                    emissive={active ? accentColor : '#1e293b'}
                    emissiveIntensity={active ? 0.6 : 0.2}
                />
            </mesh>

            {/* Nhãn Hologram 3D trên màn hình */}
            <Text
                position={[0, 1.45, -0.16]}
                fontSize={0.13}
                color={active ? '#ffffff' : '#94a3b8'}
                anchorX="center"
                anchorY="middle"
            >
                {title}
            </Text>
            {subtitle && (
                <Text
                    position={[0, 1.25, -0.16]}
                    fontSize={0.09}
                    color={active ? accentColor : '#64748b'}
                    anchorX="center"
                    anchorY="middle"
                >
                    {subtitle}
                </Text>
            )}

            {/* Đế tròn phát sáng dưới chân trạm */}
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[1.8, 32]} />
                <meshBasicMaterial
                    color={active ? accentColor : '#1e293b'}
                    transparent
                    opacity={active ? 0.25 : 0.08}
                />
            </mesh>
        </group>
    )
}

export default function LabScene({
    currentStep,
    createdAgent,
    isSynthesizing,
    activeSpeech,
}: LabSceneProps) {
    // 4 Agent nòng cốt thực hiện dây chuyền tạo Agent trong Lab
    const managerAgent: AgentType = {
        id: 'agent_manager',
        name: 'Manager Lead',
        color: '#3b82f6',
        status: currentStep === 1 || currentStep === 5 ? 'speaking' : 'idle',
        speech:
            activeSpeech?.agentId === 'agent_manager'
                ? activeSpeech.text
                : currentStep === 1
                ? 'Đang tiếp nhận yêu cầu & điều phối quy trình...'
                : currentStep === 5
                ? 'Agent mới đã kích hoạt thành công!'
                : 'Sẵn sàng điều phối chế tạo',
        position: [0, 0, -4.8],
    }

    const searchAgent: AgentType = {
        id: 'agent_search',
        name: 'Search Researcher',
        color: '#10b981',
        status: currentStep === 2 ? 'speaking' : 'idle',
        speech:
            activeSpeech?.agentId === 'agent_search'
                ? activeSpeech.text
                : currentStep === 2
                ? 'Đang tìm kiếm tài liệu, thư viện và giải thuật...'
                : 'Trạm nghiên cứu tài liệu',
        position: [4.8, 0, 0],
    }

    const summarizerAgent: AgentType = {
        id: 'agent_summarizer',
        name: 'Synthesis Specialist',
        color: '#f59e0b',
        status: currentStep === 3 ? 'speaking' : 'idle',
        speech:
            activeSpeech?.agentId === 'agent_summarizer'
                ? activeSpeech.text
                : currentStep === 3
                ? 'Đang tổng hợp prompt và lược đồ tham số...'
                : 'Trạm thiết kế Prompt',
        position: [0, 0, 4.8],
    }

    const coderAgent: AgentType = {
        id: 'agent_coder',
        name: 'Python Code Generator',
        color: '#ec4899',
        status: currentStep === 4 ? 'speaking' : 'idle',
        speech:
            activeSpeech?.agentId === 'agent_coder'
                ? activeSpeech.text
                : currentStep === 4
                ? 'Đang sinh mã Python và kiểm thử trong Sandbox...'
                : 'Trạm Sandbox Code',
        position: [-4.8, 0, 0],
    }

    // Agent mới sinh ra sẽ xuất hiện giữa lòng đài trung tâm
    const newbornAgent: AgentType | null = createdAgent
        ? {
              ...createdAgent,
              position: [0, 0, 0],
              status: 'speaking',
              speech:
                  activeSpeech?.agentId === createdAgent.id
                      ? activeSpeech.text
                      : createdAgent.speech || 'Tôi đã sẵn sàng phục vụ!',
          }
        : null

    return (
        <div className="w-full h-full min-h-[580px] relative select-none rounded-2xl overflow-hidden border border-cyan-500/30 bg-slate-950 shadow-2xl">
            <Canvas
                shadows
                dpr={[1, 1.5]}
                gl={{ powerPreference: 'high-performance', antialias: true }}
                camera={{ position: [0, 16, 18], fov: 42 }}
            >
                {/* Ánh sáng & Bầu không khí Cyberpunk Lab */}
                <color attach="background" args={['#030712']} />
                <fog attach="fog" args={['#030712', 15, 45]} />
                <ambientLight intensity={0.45} />
                <directionalLight
                    position={[10, 20, 12]}
                    intensity={1.2}
                    castShadow
                    shadow-mapSize={[1024, 1024]}
                />
                <pointLight position={[0, 4, 0]} intensity={1.8} color="#06b6d4" distance={15} />

                <Physics gravity={[0, -9.81, 0]}>
                    {/* Sàn phòng Lab kim loại đen & lưới Grid Neon */}
                    <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                        <planeGeometry args={[36, 36]} />
                        <meshStandardMaterial color="#080e1a" roughness={0.4} metalness={0.8} />
                    </mesh>
                    <gridHelper
                        args={[36, 36, '#0891b2', '#1e293b']}
                        position={[0, 0.01, 0]}
                    />

                    {/* Tường phòng Lab công nghệ cao & Racks */}
                    <group position={[0, 0, 0]}>
                        <ServerRack position={[-11, 0, -11]} />
                        <ServerRack position={[-9.8, 0, -11]} />
                        <ServerRack position={[9.8, 0, -11]} />
                        <ServerRack position={[11, 0, -11]} />
                        <ServerRack position={[-11, 0, 11]} />
                        <ServerRack position={[11, 0, 11]} />
                    </group>

                    {/* 1. Đài chế tạo trung tâm */}
                    <IncubationPod
                        isSynthesizing={isSynthesizing}
                        isCompleted={currentStep === 5}
                        createdAgent={createdAgent}
                    />

                    {/* 2. Đường cáp năng lượng dẫn từ 4 trạm vào đài trung tâm */}
                    <EnergyConduit
                        from={[0, 0, -4.8]}
                        to={[0, 0, -2.4]}
                        active={currentStep === 1 || currentStep === 5}
                        color="#3b82f6"
                    />
                    <EnergyConduit
                        from={[4.8, 0, 0]}
                        to={[2.4, 0, 0]}
                        active={currentStep === 2 || currentStep === 5}
                        color="#10b981"
                    />
                    <EnergyConduit
                        from={[0, 0, 4.8]}
                        to={[0, 0, 2.4]}
                        active={currentStep === 3 || currentStep === 5}
                        color="#f59e0b"
                    />
                    <EnergyConduit
                        from={[-4.8, 0, 0]}
                        to={[-2.4, 0, 0]}
                        active={currentStep === 4 || currentStep === 5}
                        color="#ec4899"
                    />

                    {/* 3. Bàn trạm của 4 Agent */}
                    <SciFiStation
                        position={[0, 0, -5.8]}
                        title="COMMAND CONSOLE"
                        subtitle="Manager Lead • Điều phối"
                        accentColor="#3b82f6"
                        active={currentStep === 1 || currentStep === 5}
                    />
                    <SciFiStation
                        position={[5.8, 0, 0]}
                        rotation={[0, -Math.PI / 2, 0]}
                        title="RESEARCH VAULT"
                        subtitle="Search Agent • Khảo sát thư viện"
                        accentColor="#10b981"
                        active={currentStep === 2 || currentStep === 5}
                    />
                    <SciFiStation
                        position={[0, 0, 5.8]}
                        rotation={[0, Math.PI, 0]}
                        title="SYNTHESIS MATRIX"
                        subtitle="Summarizer • Kiến trúc Prompt"
                        accentColor="#f59e0b"
                        active={currentStep === 3 || currentStep === 5}
                    />
                    <SciFiStation
                        position={[-5.8, 0, 0]}
                        rotation={[0, Math.PI / 2, 0]}
                        title="SANDBOX COMPILER"
                        subtitle="Coder Agent • Python Container"
                        accentColor="#ec4899"
                        active={currentStep === 4 || currentStep === 5}
                    />

                    {/* 4. Render 4 Agent Avatar */}
                    <Agent {...managerAgent} isSelected={currentStep === 1} />
                    <Agent {...searchAgent} isSelected={currentStep === 2} />
                    <Agent {...summarizerAgent} isSelected={currentStep === 3} />
                    <Agent {...coderAgent} isSelected={currentStep === 4} />

                    {/* 5. Render Agent mới sinh nếu đã hoàn tất */}
                    {newbornAgent && (
                        <Agent
                            {...newbornAgent}
                            isSelected={true}
                            position={[0, 0.2, 0]}
                        />
                    )}
                </Physics>

                {/* Điều khiển Camera 3D */}
                <OrbitControls
                    enableDamping
                    dampingFactor={0.05}
                    maxPolarAngle={Math.PI / 2.1}
                    minDistance={8}
                    maxDistance={35}
                    target={[0, 1.2, 0]}
                />
            </Canvas>

            {/* HUD Status góc trên bên trái */}
            <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md border border-cyan-500/40 rounded-xl px-3.5 py-2 flex items-center gap-3 text-xs shadow-lg">
                <span className="relative flex h-3 w-3">
                    <span
                        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                            isSynthesizing ? 'bg-pink-400' : 'bg-emerald-400'
                        }`}
                    />
                    <span
                        className={`relative inline-flex rounded-full h-3 w-3 ${
                            isSynthesizing ? 'bg-pink-500' : 'bg-emerald-500'
                        }`}
                    />
                </span>
                <div>
                    <div className="font-bold text-white tracking-wide uppercase text-[10px]">
                        AI Agent Foundry 3D
                    </div>
                    <div className="text-cyan-400 font-mono text-[11px]">
                        {isSynthesizing
                            ? `Giai đoạn ${currentStep}/5: Đang tổng hợp...`
                            : currentStep === 5
                            ? 'Agent mới đã sẵn sàng!'
                            : 'Hệ thống trực tuyến (Online)'}
                    </div>
                </div>
            </div>

            {/* Gợi ý tương tác góc dưới */}
            <div className="absolute bottom-3 left-4 text-[10px] text-slate-400 bg-slate-950/70 px-2.5 py-1 rounded-md border border-slate-800">
                Kéo chuột để xoay góc nhìn 3D • Cuộn chuột để phóng to/thu nhỏ
            </div>
        </div>
    )
}
