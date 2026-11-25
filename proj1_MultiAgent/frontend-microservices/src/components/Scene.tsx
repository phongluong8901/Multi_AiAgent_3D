'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Sky, Stars } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import Room from './office/Room'
import OutdoorPark from './outdoor/OutdoorPark'
import SmartCity from './iot/SmartCity'
import { Agent as AgentType } from '@/lib/api'
import { AgentAction } from './agents/Agent'

/**
 * Loai ban do 3D:
 * - 'office': Van phong lam viec ao
 * - 'outdoor': Cong vien ngoai troi
 * - 'iot': Thanh pho thong minh IoT
 */
export type MapType = 'office' | 'outdoor' | 'iot'

/**
 * Thoi diem trong ngay (Anh sang moi truong):
 * - 'day': Ban ngay (anh sang tu nhien)
 * - 'sunset': Hoang hon
 * - 'night': Ban dem (kem bau troi day sao Stars)
 */
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

/**
 * Component Khong gian 3D chinh (Three.js / React Three Fiber Canvas):
 * - Render bau troi (Sky / Stars), anh sang (DirectionalLight, AmbientLight) theo TimeOfDay
 * - Tich hop dong hoc vat ly (Rapier Physics)
 * - Render ban do phu hop (Room / OutdoorPark / SmartCity)
 * - Dieu khien camera OrbitControls va tuong tac chon Agent / di chuyen tren san
 */
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
                                <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
                                <ambientLight intensity={0.25} />
                                <directionalLight
                                    position={[15, 25, 10]}
                                    intensity={0.4}
                                    color="#93c5fd"
                                    castShadow
                                    shadow-mapSize={[1024, 1024]}
                                />
                            </>
                        ) : isSunset ? (
                            <>
                                <Sky
                                    sunPosition={[
                                        Math.cos(0.3) * 100,
                                        Math.sin(0.15) * 100,
                                        Math.sin(0.3) * 100,
                                    ]}
                                    turbidity={8}
                                    rayleigh={3}
                                />
                                <ambientLight intensity={0.4} color="#fed7aa" />
                                <directionalLight
                                    position={[30, 15, 20]}
                                    intensity={1.2}
                                    color="#fdba74"
                                    castShadow
                                    shadow-mapSize={[1024, 1024]}
                                />
                            </>
                        ) : (
                            <>
                                <Sky sunPosition={[100, 80, 100]} turbidity={0.5} rayleigh={0.5} />
                                <ambientLight intensity={0.65} />
                                <directionalLight
                                    position={[20, 35, 15]}
                                    intensity={1.4}
                                    castShadow
                                    shadow-mapSize={[2048, 2048]}
                                    shadow-camera-left={-25}
                                    shadow-camera-right={25}
                                    shadow-camera-top={25}
                                    shadow-camera-bottom={-25}
                                />
                            </>
                        )}
                    </>
                ) : (
                    <>
                        <color attach="background" args={isNight ? ['#050811'] : isSunset ? ['#1a0f1e'] : ['#090d16']} />
                        <ambientLight intensity={isNight ? 0.4 : isSunset ? 0.6 : 0.75} />
                        <directionalLight
                            position={[15, 22, 12]}
                            intensity={isNight ? 0.6 : isSunset ? 1.0 : 1.3}
                            color={isSunset ? '#fed7aa' : isNight ? '#bfdbfe' : '#ffffff'}
                            castShadow
                            shadow-mapSize={[2048, 2048]}
                            shadow-camera-left={-15}
                            shadow-camera-right={15}
                            shadow-camera-top={15}
                            shadow-camera-bottom={-15}
                        />
                        <pointLight position={[0, 10, 0]} intensity={isNight ? 0.3 : 0.5} distance={25} />
                    </>
                )}

                <Physics gravity={[0, -9.81, 0]}>
                    {isIot ? (
                        <SmartCity
                            agents={agents}
                            selectedAgentId={selectedAgentId}
                            onSelectAgent={onSelectAgent}
                            onFloorClick={onFloorClick}
                            agentTargetActions={agentTargetActions}
                        />
                    ) : isOutdoor ? (
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
                    enableDamping
                    dampingFactor={0.06}
                    maxPolarAngle={Math.PI / 2.05}
                    minDistance={5}
                    maxDistance={isIot ? 70 : 45}
                    target={[0, 1, 0]}
                    makeDefault
                />
            </Canvas>
        </div>
    )
}
