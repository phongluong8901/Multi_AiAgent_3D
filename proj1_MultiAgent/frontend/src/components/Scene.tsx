'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

function Floor() {
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[10, 10]} />
            <meshStandardMaterial color="#e8e0d5" />
        </mesh>
    )
}

function Wall({ position, rotation }: { position: [number, number, number], rotation?: [number, number, number] }) {
    return (
        <mesh position={position} rotation={rotation || [0, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[10, 1.2, 0.15]} />
            <meshStandardMaterial color="#d4cbc0" />
        </mesh>
    )
}

function Room() {
    return (
        <group>
            <Floor />

            {/* Tường sau */}
            <Wall position={[0, 0.6, -5]} />

            {/* Tường trước (thấp hơn một chút để nhìn vào) */}
            <Wall position={[0, 0.6, 5]} />

            {/* Tường trái */}
            <Wall position={[-5, 0.6, 0]} rotation={[0, Math.PI / 2, 0]} />

            {/* Tường phải */}
            <Wall position={[5, 0.6, 0]} rotation={[0, Math.PI / 2, 0]} />
        </group>
    )
}

export default function Scene() {
    return (
        <div className="w-full h-screen bg-zinc-900">
            <Canvas
                shadows
                camera={{ position: [8, 8, 8], fov: 45 }}
            >
                <ambientLight intensity={0.6} />
                <directionalLight
                    position={[10, 15, 10]}
                    intensity={1.2}
                    castShadow
                    shadow-mapSize={[1024, 1024]}
                />

                <Room />

                <OrbitControls
                    maxPolarAngle={Math.PI / 2.2}
                    minDistance={6}
                    maxDistance={20}
                />
            </Canvas>
        </div>
    )
}