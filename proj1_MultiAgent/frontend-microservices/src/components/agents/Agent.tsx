'use client'

import { useRef, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, RapierRigidBody, CapsuleCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import AgentSpeechBubble from './AgentSpeechBubble'
import AgentNameTag from './AgentNameTag'
import AgentBody from './AgentBody'

export type AgentAction =
    | 'desk'
    | 'sofa'
    | 'roundtable'
    | 'pingpong'
    | 'coffee'
    | 'bench'
    | 'picnic'
    | 'gazebo'
    | 'fountain'
    | 'building'
    | 'house'
    | 'industry'
    | 'crossroad'
    | 'streetlight'
    | 'patrol'
    | 'roam'
    | 'manual'
    | 'custom'

type Props = {
    id?: string
    position: [number, number, number]
    deskPosition?: [number, number, number]
    color?: string
    name?: string
    status?: 'idle' | 'working' | 'meeting' | 'blocked' | 'thinking' | 'speaking'
    speech?: string | null
    waypoints?: [number, number, number][]
    speed?: number
    targetAction?: AgentAction
    targetPosition?: [number, number, number] | null
    isSelected?: boolean
    onSelect?: () => void
    ownerName?: string
}

export default function Agent({
    id,
    position,
    deskPosition,
    color = '#4299e1',
    name = 'Agent',
    status = 'idle',
    speech = null,
    waypoints = [],
    speed = 1.2,
    targetAction,
    targetPosition,
    isSelected = false,
    onSelect,
    ownerName,
}: Props) {
    const body = useRef<RapierRigidBody>(null)
    const currentIndex = useRef(0)
    const isWaiting = useRef(false)
    const waitUntil = useRef(0)

    const [isWalking, setIsWalking] = useState(false)
    const keysDown = useRef<{ [key: string]: boolean }>({})

    // Đăng ký bàn phím WASD / Mũi tên khi agent được chọn
    useEffect(() => {
        if (!isSelected) return

        const handleKeyDown = (e: KeyboardEvent) => {
            // Không kích hoạt khi đang gõ chữ trong input
            const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
            if (tag === 'input' || tag === 'textarea') return

            keysDown.current[e.code] = true
        }

        const handleKeyUp = (e: KeyboardEvent) => {
            keysDown.current[e.code] = false
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('keyup', handleKeyUp)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('keyup', handleKeyUp)
            keysDown.current = {}
        }
    }, [isSelected])

    // Kiểm tra tư thế ngồi
    const isSittingAction =
        targetAction === 'sofa' ||
        targetAction === 'desk' ||
        targetAction === 'bench' ||
        targetAction === 'picnic' ||
        (!targetAction && (status === 'working' || status === 'blocked'))

    useFrame((state, delta) => {
        if (!body.current) return

        // 1. Điều khiển thủ công bằng BÀN PHÍM (WASD / Mũi tên)
        if (isSelected) {
            const k = keysDown.current
            let vx = 0
            let vz = 0
            if (k['KeyW'] || k['ArrowUp']) vz -= 1
            if (k['KeyS'] || k['ArrowDown']) vz += 1
            if (k['KeyA'] || k['ArrowLeft']) vx -= 1
            if (k['KeyD'] || k['ArrowRight']) vx += 1

            if (vx !== 0 || vz !== 0) {
                const moveVec = new THREE.Vector3(vx, 0, vz).normalize().multiplyScalar(speed * 1.5)
                body.current.setLinvel({ x: moveVec.x, y: 0, z: moveVec.z }, true)

                const angle = Math.atan2(moveVec.x, moveVec.z)
                body.current.setRotation(
                    { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) },
                    true
                )
                if (!isWalking) setIsWalking(true)
                return
            }
        }

        // 2. Di chuyển đến Điểm Mục Tiêu (Target Position / Action Destination)
        if (targetPosition) {
            const currentPos = body.current.translation()
            const current = new THREE.Vector3(currentPos.x, 0, currentPos.z)
            const target = new THREE.Vector3(targetPosition[0], 0, targetPosition[2])
            const dist = target.distanceTo(current)

            if (dist > 0.18) {
                const dir = target.clone().sub(current).normalize()
                body.current.setLinvel(
                    { x: dir.x * speed * 1.4, y: 0, z: dir.z * speed * 1.4 },
                    true
                )
                const angle = Math.atan2(dir.x, dir.z)
                body.current.setRotation(
                    { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) },
                    true
                )
                if (!isWalking) setIsWalking(true)
                return
            } else {
                // Đã đến đích điểm chọn
                body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
                body.current.setTranslation(
                    { x: targetPosition[0], y: targetPosition[1] || 0, z: targetPosition[2] },
                    true
                )
                if (isWalking) setIsWalking(false)
                return
            }
        }

        // 3. Nếu hành động là làm việc mặc định tại bàn
        if (!targetAction && (status === 'working' || status === 'blocked')) {
            const desk = deskPosition ?? position
            const currentPos = body.current.translation()
            const current = new THREE.Vector3(currentPos.x, 0, currentPos.z)
            const target = new THREE.Vector3(desk[0], 0, desk[2])
            const dist = target.distanceTo(current)

            if (dist > 0.15) {
                const dir = target.clone().sub(current).normalize()
                body.current.setLinvel({ x: dir.x * speed, y: 0, z: dir.z * speed }, true)
                const angle = Math.atan2(dir.x, dir.z)
                body.current.setRotation(
                    { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) },
                    true
                )
                if (!isWalking) setIsWalking(true)
            } else {
                body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
                body.current.setTranslation({ x: desk[0], y: 0, z: desk[2] }, true)
                body.current.setRotation({ x: 0, y: 1, z: 0, w: 0 }, true)
                if (isWalking) setIsWalking(false)
            }
            return
        }

        // 4. Đi dạo tự do theo Waypoints (Patrol / Roam)
        if (waypoints.length > 0) {
            if (isWaiting.current) {
                if (state.clock.elapsedTime > waitUntil.current) {
                    isWaiting.current = false
                }
                body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
                if (isWalking) setIsWalking(false)
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
                if (isWalking) setIsWalking(false)
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
            if (!isWalking) setIsWalking(true)
            return
        }

        // Đứng yên
        body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
        if (isWalking) setIsWalking(false)
    })

    const shouldSit = isSittingAction && !isWalking
    const labelY = shouldSit ? 1.55 : 2.15

    return (
        <RigidBody
            ref={body}
            position={position}
            colliders={false}
            enabledRotations={[false, true, false]}
            linearDamping={2}
            type="dynamic"
        // ❌ Đã xóa onClick khỏi đây vì RigidBody không hỗ trợ
        >
            {/* ✅ Đưa sự kiện click vào nhóm chứa các thành phần hiển thị bên trong */}
            <group
                onClick={(e: any) => {
                    e.stopPropagation()
                    onSelect?.()
                }}
            >
                <CapsuleCollider
                    args={shouldSit ? [0.25, 0.28] : [0.45, 0.28]}
                    position={[0, shouldSit ? 0.55 : 0.85, 0]}
                />

                <AgentBody
                    color={color}
                    sitting={shouldSit}
                    walking={isWalking}
                    working={status === 'working' || targetAction === 'desk'}
                />

                {/* Vòng hào quang Neon khi Agent được chọn */}
                {isSelected && (
                    <group position={[0, 0.05, 0]}>
                        <mesh rotation={[-Math.PI / 2, 0, 0]}>
                            <ringGeometry args={[0.55, 0.7, 32]} />
                            <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
                        </mesh>
                        <mesh rotation={[-Math.PI / 2, 0, 0]}>
                            <circleGeometry args={[0.5, 32]} />
                            <meshBasicMaterial color="#38bdf8" transparent opacity={0.2} side={THREE.DoubleSide} />
                        </mesh>
                    </group>
                )}
            </group>

            <Html position={[0, labelY, 0]} center distanceFactor={8} zIndexRange={[100, 0]}>
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        onSelect?.()
                    }}
                    className={`flex flex-col items-center gap-1 cursor-pointer select-none transition ${isSelected ? 'scale-110 drop-shadow-[0_0_8px_rgba(56,189,248,0.8)]' : ''
                        }`}
                >
                    {speech && <AgentSpeechBubble text={speech} />}
                    <AgentNameTag name={name} status={status} ownerName={ownerName} />
                </div>
            </Html>
        </RigidBody>

    )
}