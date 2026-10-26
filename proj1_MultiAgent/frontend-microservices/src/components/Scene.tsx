'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Sky } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import Room from './office/Room'
import OutdoorPark from './outdoor/OutdoorPark'
import SmartCity from './iot/SmartCity'          // ← thêm dòng này
import { Agent as AgentType } from '@/lib/api'
import { AgentAction } from './agents/Agent'

export type MapType = 'office' | 'outdoor' | 'iot'   // ← thêm 'iot'

type Props = {
    agents: AgentType[]
    mapType?: MapType
    selectedAgentId?: string | null
    onSelectAgent?: (id: string) => void
    onFloorClick?: (point: [number, number, number]) => void
    agentTargetActions?: Record<string, { action: AgentAction; targetPos: [number, number, number] }>
}

export default function Scene({
    agents,
    mapType = 'office',
    selectedAgentId,
    onSelectAgent,
    onFloorClick,
    agentTargetActions = {},
}: Props) {
    const isOutdoor = mapType === 'outdoor'
    const isIot = mapType === 'iot'

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
                {/* Ánh sáng & Bầu trời theo từng map */}
                {isOutdoor || isIot ? (
                    <>
                        <Sky
                            distance={450000}
                            sunPosition={[15, 25, 20]}
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
                        {isIot && (
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