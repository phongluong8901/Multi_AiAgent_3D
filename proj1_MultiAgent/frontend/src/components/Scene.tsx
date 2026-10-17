'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import Room from './office/Room'
import { AgentState } from '@/hooks/useGateway'

type Props = {
    agents: AgentState[]
}

export default function Scene({ agents }: Props) {
    return (
        <div className="w-full h-screen bg-zinc-900">
            <Canvas shadows camera={{ position: [12, 12, 12], fov: 38 }}>
                <ambientLight intensity={0.55} />
                <directionalLight
                    position={[12, 18, 10]}
                    intensity={1.3}
                    castShadow
                    shadow-mapSize={[2048, 2048]}
                />

                <Physics gravity={[0, -9.81, 0]}>
                    <Room agents={agents} />
                </Physics>

                <OrbitControls
                    maxPolarAngle={Math.PI / 2.3}
                    minDistance={8}
                    maxDistance={25}
                    target={[0, 0, 0]}
                />
            </Canvas>
        </div>
    )
}