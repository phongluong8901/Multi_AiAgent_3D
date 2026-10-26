'use client'

import React from 'react'
import {
    IconCpu,
    IconActivity,
    IconZap,
    IconDuck,
    IconAmr,
    IconDrone,
    IconHumanoid,
    IconGameController,
} from '@/components/ui/icons'
import { AgentFormType } from './NvidiaRobots'

interface NvidiaIsaacHudProps {
    agentForm?: AgentFormType
    agentName?: string
    agentId?: string
    color?: string
    isLiveDriving?: boolean
    showControlsHint?: boolean
    compact?: boolean
}

export const ROBOT_HARDWARE_SPECS: Record<
    AgentFormType,
    {
        modelName: string
        chipset: string
        computePower: string
        perception: string
        chassisType: string
        icon: React.ComponentType<{ className?: string }>
        accentColor: string
    }
> = {
    humanoid: {
        modelName: 'Project GR00T Biped',
        chipset: 'NVIDIA Jetson Thor',
        computePower: '800 TFLOPS FP8',
        perception: 'Stereoscopic Vision + Visor LiDAR',
        chassisType: 'Dual Hydraulic Bipedal',
        icon: IconHumanoid,
        accentColor: '#76b900',
    },
    amr: {
        modelName: 'Nova Carter AMR',
        chipset: 'Jetson AGX Orin 64GB',
        computePower: '275 TOPS INT8',
        perception: '360° LiDAR + 4x RealSense D455',
        chassisType: 'Segway RMP Differential Drive',
        icon: IconAmr,
        accentColor: '#f97316',
    },
    duck: {
        modelName: 'MicroDuck Bipedal',
        chipset: 'MicroDuck AI Controller',
        computePower: 'Multi-Servo Locomotion',
        perception: 'Camera Eye + Bipedal Balance',
        chassisType: 'Articulated Servo Biped',
        icon: IconDuck,
        accentColor: '#38bdf8',
    },
    drone: {
        modelName: 'Cyber Falcon Aerial',
        chipset: 'Jetson Orin NX 16GB',
        computePower: '100 TOPS Drone Engine',
        perception: '3-Axis 4K Gimbal + RTK-GNSS',
        chassisType: 'Carbon X-Quadrotor',
        icon: IconDrone,
        accentColor: '#06b6d4',
    },
}

export default function NvidiaIsaacHud({
    agentForm = 'humanoid',
    agentName,
    agentId,
    color,
    isLiveDriving = false,
    showControlsHint = true,
    compact = false,
}: NvidiaIsaacHudProps) {
    const specs = ROBOT_HARDWARE_SPECS[agentForm] || ROBOT_HARDWARE_SPECS.humanoid
    const FormIcon = specs.icon
    const effectiveColor = color || specs.accentColor

    if (compact) {
        return (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/80 border border-zinc-800 text-[11px] backdrop-blur font-mono">
                <span className="w-2 h-2 rounded-full bg-[#76b900] shadow-[0_0_6px_#76b900]" />
                <span className="text-zinc-400 font-semibold uppercase">{specs.modelName}</span>
                <span className="text-zinc-600">|</span>
                <span className="text-[#76b900]">{specs.computePower}</span>
            </div>
        )
    }

    return (
        <div className="pointer-events-none select-none">
            {/* Top Bar Telemetry */}
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 px-3 py-1.5 bg-black/75 backdrop-blur-md rounded-xl border border-zinc-800/80 shadow-lg">
                <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-[#76b900] shadow-[0_0_8px_#76b900]" />
                    <span className="text-zinc-200 font-bold tracking-wider">NVIDIA ISAAC SIM</span>
                    <span className="text-zinc-600">/</span>
                    <span className="text-[#76b900]">PHYSX 5.3</span>
                    <span className="hidden sm:inline text-zinc-600">/</span>
                    <span className="hidden sm:inline text-cyan-400">TENSOR-RT 10.0</span>
                </div>

                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-zinc-400">
                        <IconActivity className="w-3.5 h-3.5 text-[#76b900]" />
                        <span>60.0 FPS</span>
                    </span>
                    <span className="hidden md:flex items-center gap-1 text-zinc-500">
                        <span>LATENCY:</span>
                        <span className="text-zinc-300">1.8ms</span>
                    </span>
                </div>
            </div>

            {/* Bottom Hardware Card / Telemetry Banner */}
            <div className="mt-2 flex items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-950/85 backdrop-blur border border-zinc-800/90 shadow-xl">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div
                        className="p-1.5 rounded-lg shrink-0 border"
                        style={{
                            borderColor: `${effectiveColor}40`,
                            backgroundColor: `${effectiveColor}15`,
                            color: effectiveColor,
                        }}
                    >
                        <FormIcon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-white truncate">
                                {agentName || specs.modelName}
                            </span>
                            {agentId && (
                                <span className="text-[10px] font-mono text-zinc-500">
                                    @{agentId}
                                </span>
                            )}
                            <span
                                className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded border"
                                style={{
                                    borderColor: `${effectiveColor}50`,
                                    backgroundColor: `${effectiveColor}15`,
                                    color: effectiveColor,
                                }}
                            >
                                {specs.computePower}
                            </span>
                        </div>
                        <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                            <span className="text-zinc-500">{specs.chipset}</span> · <span>{specs.perception}</span>
                        </div>
                    </div>
                </div>

                {showControlsHint && (
                    <div className="hidden sm:flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-[10px] text-zinc-400">
                        <IconGameController className="w-3.5 h-3.5 text-[#76b900]" />
                        <span>WASD DRIVE</span>
                    </div>
                )}
            </div>
        </div>
    )
}
