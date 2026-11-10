'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, RapierRigidBody, CapsuleCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import AgentSpeechBubble from './AgentSpeechBubble'
import AgentNameTag from './AgentNameTag'

type Props = {
    position: [number, number, number]
    color?: string
    name?: string
    status?: 'idle' | 'working' | 'meeting' | 'blocked'
    speech?: string | null
    waypoints?: [number, number, number][]
    speed?: number
}

export default function Agent({
    position,
    color = '#4299e1',
    name = 'Agent',
    status = 'idle',
    speech = null,
    waypoints = [],
    speed = 1.8,
}: Props) {
    const body = useRef<RapierRigidBody>(null)
    const currentIndex = useRef(0)
    const isWaiting = useRef(false)
    const waitUntil = useRef(0)

    useFrame((state) => {
        if (!body.current || waypoints.length === 0) return

        if (isWaiting.current) {
            if (state.clock.elapsedTime > waitUntil.current) {
                isWaiting.current = false
            }
            // Đứng yên khi chờ
            body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
            return
        }

        const target = new THREE.Vector3(...waypoints[currentIndex.current])
        const currentPos = body.current.translation()
        const current = new THREE.Vector3(currentPos.x, 0, currentPos.z)

        const direction = target.clone().sub(current)
        const distance = direction.length()

        if (distance < 0.25) {
            isWaiting.current = true
            waitUntil.current = state.clock.elapsedTime + 1.8 + Math.random()
            currentIndex.current = (currentIndex.current + 1) % waypoints.length
            body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
            return
        }

        direction.normalize()

        // Dùng vận tốc thay vì set vị trí → sẽ bị chặn bởi vật cản
        body.current.setLinvel(
            {
                x: direction.x * speed,
                y: 0,
                z: direction.z * speed,
            },
            true
        )

        // Xoay mặt theo hướng đi
        const angle = Math.atan2(direction.x, direction.z)
        body.current.setRotation(
            { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) },
            true
        )
    })

    return (
        <RigidBody
            ref={body}
            position={position}
            colliders={false}
            enabledRotations={[false, true, false]} // chỉ cho xoay trục Y
            linearDamping={1}
            type="dynamic"
        >
            {/* Collider hình viên nang (giống người) */}
            <CapsuleCollider args={[0.5, 0.25]} position={[0, 0.9, 0]} />

            {/* Hình dáng */}
            <group>
                <mesh position={[0, 1.55, 0]} castShadow>
                    <sphereGeometry args={[0.22, 16, 16]} />
                    <meshStandardMaterial color="#f6e05e" />
                </mesh>

                <mesh position={[0, 1.05, 0]} castShadow>
                    <boxGeometry args={[0.4, 0.55, 0.25]} />
                    <meshStandardMaterial color={color} />
                </mesh>

                <mesh position={[-0.28, 1.05, 0]} castShadow>
                    <boxGeometry args={[0.12, 0.45, 0.12]} />
                    <meshStandardMaterial color={color} />
                </mesh>

                <mesh position={[0.28, 1.05, 0]} castShadow>
                    <boxGeometry args={[0.12, 0.45, 0.12]} />
                    <meshStandardMaterial color={color} />
                </mesh>

                <mesh position={[-0.12, 0.45, 0]} castShadow>
                    <boxGeometry args={[0.14, 0.5, 0.14]} />
                    <meshStandardMaterial color="#2d3748" />
                </mesh>

                <mesh position={[0.12, 0.45, 0]} castShadow>
                    <boxGeometry args={[0.14, 0.5, 0.14]} />
                    <meshStandardMaterial color="#2d3748" />
                </mesh>
            </group>

            <Html position={[0, 2.15, 0]} center distanceFactor={8} zIndexRange={[100, 0]}>
                <div className="flex flex-col items-center gap-1 pointer-events-none select-none">
                    {speech && <AgentSpeechBubble text={speech} />}
                    <AgentNameTag name={name} status={status} />
                </div>
            </Html>
        </RigidBody>
    )
}