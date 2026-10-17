'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Sky } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import Room from './office/Room'
import OutdoorPark from './outdoor/OutdoorPark'
import { Agent as AgentType } from '@/lib/api'
import { AgentAction } from './agents/Agent'

export type MapType = 'office' | 'outdoor'

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

    return (
        <div className="w-full h-full min-h-[calc(100vh-3.5rem)] relative select-none">
            <Canvas
                shadows
                camera={{
                    position: isOutdoor ? [18, 18, 18] : [16, 16, 16],
                    fov: isOutdoor ? 45 : 40,
                }}
            >
                {/* Ánh sáng & Bầu trời theo từng map */}
                {isOutdoor ? (
                    <>
                        <Sky
                            distance={450000}
                            sunPosition={[15, 25, 20]}
                            inclination={0.6}
                            azimuth={0.25}
                        />
                        <ambientLight intensity={0.75} />
                        <directionalLight
                            position={[15, 28, 18]}
                            intensity={1.6}
                            castShadow
                            shadow-mapSize={[2048, 2048]}
                        />
                    </>
                ) : (
                    <>
                        <ambientLight intensity={0.55} />
                        <directionalLight
                            position={[12, 18, 10]}
                            intensity={1.3}
                            castShadow
                            shadow-mapSize={[2048, 2048]}
                        />
                    </>
                )}

                <Physics gravity={[0, -9.81, 0]}>
                    {isOutdoor ? (
                        <OutdoorPark
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
                    maxPolarAngle={Math.PI / 2.15}
                    minDistance={8}
                    maxDistance={40}
                    target={[0, 0, 0]}
                />
            </Canvas>
        </div>
    )
}