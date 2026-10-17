'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import Room from './office/Room'
import { Agent } from '@/lib/api'

type Props = {
    agents: Agent[]
}

export default function Scene({ agents }: Props) {
    return (
        <div className="w-full h-full min-h-[calc(100vh-3.5rem)] bg-zinc-900">
            <Canvas shadows camera={{ position: [16, 16, 16], fov: 40 }}>
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
                    minDistance={10}
                    maxDistance={35}
                    target={[0, 0, 0]}
                />
            </Canvas>
        </div>
    )
}