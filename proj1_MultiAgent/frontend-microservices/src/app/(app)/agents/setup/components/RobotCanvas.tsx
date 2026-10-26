'use client'

import React from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text, Float } from '@react-three/drei'
import { IconDuck, IconAmr, IconDrone, IconHumanoid } from '@/components/ui/icons'
import {
    AgentFormType,
    NvidiaRobotRenderer,
} from '@/components/agents/NvidiaRobots'
import NvidiaIsaacHud, { ROBOT_HARDWARE_SPECS } from '@/components/agents/NvidiaIsaacHud'

export type { AgentFormType }

type Props = {
    promptId: string | null
    toolCount: number
    modelId: string | null
    customColor?: string
    label?: string
    agentForm?: AgentFormType
    onFormChange?: (form: AgentFormType) => void
}

// Sàn Studio sạch sẽ: Đổ bóng tiếp xúc mềm dưới chân robot, không có vòng cản trở
function StudioFloor() {
    return (
        <group position={[0, -0.7, 0]}>
            {/* Vệt bóng đổ tiếp xúc mềm trên sàn */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
                <circleGeometry args={[1.1, 32]} />
                <meshBasicMaterial color="#000000" transparent opacity={0.45} />
            </mesh>
            {/* Vạch tròn viền mỏng thanh thoát dưới chân */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
                <ringGeometry args={[1.18, 1.2, 48]} />
                <meshBasicMaterial color="#76b900" transparent opacity={0.2} />
            </mesh>
        </group>
    )
}

export default function RobotCanvas({
    promptId,
    toolCount,
    modelId,
    customColor,
    label,
    agentForm = 'humanoid',
    onFormChange,
}: Props) {
    const specs = ROBOT_HARDWARE_SPECS[agentForm]

    return (
        <div className="relative w-full h-[520px] rounded-2xl overflow-hidden border border-zinc-800 bg-gradient-to-b from-zinc-950 via-[#0a0d14] to-zinc-950 shadow-2xl">
            {/* Top Telemetry & Controls HUD */}
            <div className="absolute top-3 left-3 right-3 z-10 space-y-2 pointer-events-none">
                <NvidiaIsaacHud
                    agentForm={agentForm}
                    agentName={label}
                    color={customColor}
                    showControlsHint={false}
                />
            </div>

            {/* Quick-switch Chassis Selector Buttons */}
            {onFormChange && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 p-1 rounded-2xl bg-zinc-950/90 border border-zinc-800/90 backdrop-blur-md shadow-2xl pointer-events-auto">
                    {[
                        { id: 'humanoid' as AgentFormType, label: 'GR00T Biped', icon: IconHumanoid, color: '#76b900' },
                        { id: 'amr' as AgentFormType, label: 'Nova Carter', icon: IconAmr, color: '#f97316' },
                        { id: 'duck' as AgentFormType, label: 'MicroDuck', icon: IconDuck, color: '#eab308' },
                        { id: 'drone' as AgentFormType, label: 'Falcon Drone', icon: IconDrone, color: '#06b6d4' },
                    ].map((btn) => {
                        const active = agentForm === btn.id
                        const BtnIcon = btn.icon
                        return (
                            <button
                                key={btn.id}
                                type="button"
                                onClick={() => onFormChange(btn.id)}
                                className={`px-2.5 py-1.5 text-xs rounded-xl transition font-medium flex items-center gap-1.5 ${
                                    active
                                        ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700'
                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900/60'
                                }`}
                                style={active ? { borderColor: `${btn.color}80`, color: btn.color } : {}}
                            >
                                <BtnIcon className="w-3.5 h-3.5" />
                                <span>{btn.label}</span>
                            </button>
                        )
                    })}
                </div>
            )}

            {/* 3D Canvas Viewport */}
            <Canvas
                camera={{ position: [0, 0.45, 2.9], fov: 42 }}
                dpr={[1, 1.5]}
                gl={{
                    powerPreference: 'high-performance',
                    antialias: true,
                    stencil: false,
                    depth: true,
                }}
            >
                <color attach="background" args={['#080a10']} />

                {/* Hệ thống ánh sáng Studio NVIDIA chuyên nghiệp */}
                <ambientLight intensity={0.75} />
                <directionalLight position={[5, 10, 6]} intensity={1.8} castShadow shadow-mapSize={[1024, 1024]} />
                <directionalLight position={[-5, 6, -3]} intensity={0.9} color="#06b6d4" />
                <pointLight position={[0, 2.5, 2]} intensity={1.0} color="#76b900" />

                {/* Sàn Studio sạch sẽ */}
                <StudioFloor />

                {/* Robot Model */}
                <Float speed={0.8} rotationIntensity={0.04} floatIntensity={0.08}>
                    <group position={[0, -0.4, 0]}>
                        <NvidiaRobotRenderer
                            form={agentForm}
                            color={customColor}
                            promptId={promptId}
                            toolCount={toolCount}
                            modelId={modelId}
                            isStudioPedestal={true}
                        />
                    </group>

                    {/* Tên Robot trôi nổi trên đỉnh */}
                    <Text
                        position={[0, agentForm === 'duck' ? 0.75 : agentForm === 'amr' ? 0.65 : 1.45, 0]}
                        fontSize={0.13}
                        color="#ffffff"
                        anchorX="center"
                        anchorY="middle"
                    >
                        {label || specs.modelName}
                    </Text>
                </Float>

                <OrbitControls
                    enablePan={false}
                    minDistance={1.8}
                    maxDistance={5.5}
                    maxPolarAngle={Math.PI / 1.8}
                    minPolarAngle={Math.PI / 5}
                />
            </Canvas>
        </div>
    )
}