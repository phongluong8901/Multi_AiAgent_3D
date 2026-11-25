'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

type Options = {
    waypoints?: [number, number, number][]
    speed?: number
    pauseTime?: number // thời gian đứng nghỉ (giây)
}

export function useAgentMovement({
    waypoints = [],
    speed = 1.2,
    pauseTime = 2,
}: Options) {
    const group = useRef<THREE.Group>(null)
    const currentIndex = useRef(0)
    const isWaiting = useRef(false)
    const waitUntil = useRef(0)

    useFrame((state, delta) => {
        if (!group.current || waypoints.length === 0) return

        // Đang đứng chờ
        if (isWaiting.current) {
            if (state.clock.elapsedTime > waitUntil.current) {
                isWaiting.current = false
            }
            return
        }

        const target = new THREE.Vector3(...waypoints[currentIndex.current])
        const current = group.current.position

        const direction = target.clone().sub(current)
        const distance = direction.length()

        if (distance < 0.08) {
            // Đến nơi → nghỉ một chút rồi đi tiếp
            isWaiting.current = true
            waitUntil.current = state.clock.elapsedTime + pauseTime + Math.random()
            currentIndex.current = (currentIndex.current + 1) % waypoints.length
            return
        }

        // Di chuyển
        direction.normalize()
        current.add(direction.multiplyScalar(speed * delta))

        // Xoay mặt theo hướng đi
        const angle = Math.atan2(direction.x, direction.z)
        group.current.rotation.y = angle
    })

    return group
}