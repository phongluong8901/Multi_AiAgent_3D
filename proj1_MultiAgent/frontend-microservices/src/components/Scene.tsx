'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Sky, Stars } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import Room from './office/Room'
import OutdoorPark from './outdoor/OutdoorPark'
import SmartCity from './iot/SmartCity'
import { Agent as AgentType } from '@/lib/api'
import { AgentAction } from './agents/Agent'

export type MapType = 'office' | 'outdoor' | 'iot'
export type TimeOfDay = 'day' | 'sunset' | 'night'

type Props = {
    agents: AgentType[]
    mapType?: MapType
    timeOfDay?: TimeOfDay
    selectedAgentId?: string | null
    onSelectAgent?: (id: string) => void
    onFloorClick?: (point: [number, number, number]) => void
    agentTargetActions?: Record<string, { action: AgentAction; targetPos: [number, number, number] }>
}

export default function Scene({
    agents,
    mapType = 'office',
    timeOfDay = 'day',
    selectedAgentId,
    onSelectAgent,
    onFloorClick,
    agentTargetActions = {},
}: Props) {
    const isOutdoor = mapType === 'outdoor'
    const isIot = mapType === 'iot'
    const isNight = timeOfDay === 'night'
    const isSunset = timeOfDay === 'sunset'

    return (
        <div className="w-full h-full min-h-[calc(100vh-3.5rem)] relative select-none">
            <Canvas
                shadows
                dpr={[1, 1.5]}
                gl={{
                    powerPreference: 'high-performance',
                    antialias: true,
                    stencil: false,
                    depth: true,
                }}
                camera={{
                    position: isIot ? [28, 22, 28] : isOutdoor ? [18, 18, 18] : [20, 19, 20],
                    fov: isIot ? 42 : isOutdoor ? 45 : 44,
                }}
            >
                {/* Ánh sáng & Bầu trời theo từng map và thời điểm trong ngày */}
                {isOutdoor || isIot ? (
                    <>
                        {isNight ? (
                            <>
                                <Stars
                                    radius={100}
                                    depth={50}
                                    count={3200}
                                    factor={4}
                                    saturation={0.2}
                                    fade
                                    speed={1.2}
                                />
                                <ambientLight intensity={0.22} color="#1e1b4b" />
                                <directionalLight
                                    position={[12, 25, 14]}
                                    intensity={0.45}
                                    color="#93c5fd"
                                    castShadow
                                    shadow-mapSize={[1024, 1024]}
                                />
                                <pointLight position={[0, 15, 0]} intensity={0.6} color="#38bdf8" />
                            </>
                        ) : isSunset ? (
                            <>
                                <Sky
                                    distance={450000}
                                    sunPosition={[30, 4, 18]}
                                    inclination={0.48}
                                    azimuth={0.25}
                                />
                                <ambientLight intensity={0.55} color="#fed7aa" />
                                <directionalLight
                                    position={[25, 10, 18]}
                                    intensity={1.4}
                                    color="#fb923c"
                                    castShadow
                                    shadow-mapSize={[1024, 1024]}
                                />
                                <hemisphereLight color="#fdba74" groundColor="#334155" intensity={0.4} />
                            </>
                        ) : (
                            <>
                                <Sky
                                    distance={450000}
                                    sunPosition={[15, 26, 20]}
                                    inclination={0.6}
                                    azimuth={0.25}
                                />
                                <ambientLight intensity={isIot ? 0.55 : 0.75} />
                                <directionalLight
                                    position={[15, 28, 18]}
                                    intensity={isIot ? 1.4 : 1.6}
                                    castShadow
                                    shadow-mapSize={[1024, 1024]}
                                />
                            </>
                        )}
                        {isIot && !isNight && (
                            <pointLight position={[0, 12, 0]} intensity={0.4} color="#38bdf8" />
                        )}
                    </>
                ) : (
                    <>
                        <ambientLight intensity={0.55} />
                        <directionalLight
                            position={[12, 18, 10]}
                            intensity={1.3}
                            castShadow
                            shadow-mapSize={[1024, 1024]}
                        />
                    </>
                )}

                <Physics gravity={[0, -9.81, 0]}>
                    {mapType === 'outdoor' ? (
                        <OutdoorPark
                            agents={agents}
                            selectedAgentId={selectedAgentId}
                            onSelectAgent={onSelectAgent}
                            onFloorClick={onFloorClick}
                            agentTargetActions={agentTargetActions}
                            timeOfDay={timeOfDay}
                        />
                    ) : mapType === 'iot' ? (
                        <SmartCity
                            agents={agents}
                            selectedAgentId={selectedAgentId}
                            onSelectAgent={onSelectAgent}
                            onFloorClick={onFloorClick}
                            agentTargetActions={agentTargetActions}
                        />
                    ) : (
                        <Room
                            agents={agents}
                            selectedAgentId={selectedAgentId}
                            onSelectAgent={onSelectAgent}
                            onFloorClick={onFloorClick}
                            agentTargetActions={agentTargetActions}
                        />
                    )}
                </Physics>

                <OrbitControls
                    enableDamping
                    dampingFactor={0.05}
                    maxPolarAngle={Math.PI / 2.15}
                    minDistance={isIot ? 12 : 8}
                    maxDistance={isIot ? 55 : 40}
                    target={[0, 0, 0]}
                />
            </Canvas>
        </div>
    )
}
