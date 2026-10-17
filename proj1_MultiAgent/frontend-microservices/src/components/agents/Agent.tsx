'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, RapierRigidBody, CapsuleCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import AgentSpeechBubble from './AgentSpeechBubble'
import AgentNameTag from './AgentNameTag'
import AgentBody from './AgentBody'

type Props = {
    position: [number, number, number]
    deskPosition?: [number, number, number]
    color?: string
    name?: string
    status?: 'idle' | 'working' | 'meeting' | 'blocked'
    speech?: string | null
    waypoints?: [number, number, number][]
    speed?: number
}

export default function Agent({
    position,
    deskPosition,
    color = '#4299e1',
    name = 'Agent',
    status = 'idle',
    speech = null,
    waypoints = [],
    speed = 1.0,
}: Props) {
    const body = useRef<RapierRigidBody>(null)
    const currentIndex = useRef(0)
    const isWaiting = useRef(false)
    const waitUntil = useRef(0)

    const shouldSit = status === 'working' || status === 'blocked'
    // Ghế hơi trước bàn — trùng Chair trong Room
    const desk = deskPosition ?? position
    const seatPos: [number, number, number] = [desk[0], 0, desk[2]]

    useFrame((state) => {
        if (!body.current) return

        if (shouldSit) {
            const pos = body.current.translation()
            const target = new THREE.Vector3(seatPos[0], 0, seatPos[2])
            const current = new THREE.Vector3(pos.x, 0, pos.z)
            const dist = target.distanceTo(current)

            if (dist > 0.12) {
                const dir = target.clone().sub(current).normalize()
                body.current.setLinvel(
                    { x: dir.x * speed, y: 0, z: dir.z * speed },
                    true
                )
                const angle = Math.atan2(dir.x, dir.z)
                body.current.setRotation(
                    { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) },
                    true
                )
            } else {
                // Khóa tại ghế
                body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
                body.current.setTranslation(
                    { x: seatPos[0], y: 0, z: seatPos[2] },
                    true
                )
                // Quay mặt vào bàn (z âm = về phía desk)
                body.current.setRotation({ x: 0, y: 1, z: 0, w: 0 }, true)
            }
            return
        }

        if (waypoints.length === 0) {
            body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
            return
        }

        if (isWaiting.current) {
            if (state.clock.elapsedTime > waitUntil.current) isWaiting.current = false
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
            waitUntil.current = state.clock.elapsedTime + 1.5 + Math.random()
            currentIndex.current = (currentIndex.current + 1) % waypoints.length
            body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
            return
        }

        direction.normalize()
        body.current.setLinvel(
            { x: direction.x * speed, y: 0, z: direction.z * speed },
            true
        )
        const angle = Math.atan2(direction.x, direction.z)
        body.current.setRotation(
            { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) },
            true
        )
    })

    const labelY = shouldSit ? 1.55 : 2.15

    return (
        <RigidBody
            ref={body}
            position={position}
            colliders={false}
            enabledRotations={[false, true, false]}
            linearDamping={2}
            type="dynamic"
        >
            <CapsuleCollider
                args={shouldSit ? [0.25, 0.28] : [0.45, 0.28]}
                position={[0, shouldSit ? 0.55 : 0.85, 0]}
            />

            <AgentBody color={color} sitting={shouldSit} />

            <Html position={[0, labelY, 0]} center distanceFactor={8} zIndexRange={[100, 0]}>
                <div className="flex flex-col items-center gap-1 pointer-events-none select-none">
                    {speech && <AgentSpeechBubble text={speech} />}
                    <AgentNameTag name={name} status={status} />
                </div>
            </Html>
        </RigidBody>
    )
}