'use client'

import { useRef, useEffect, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, RapierRigidBody, CapsuleCollider } from '@react-three/rapier'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import AgentSpeechBubble from './AgentSpeechBubble'
import AgentNameTag from './AgentNameTag'
import AgentBody from './AgentBody'
import { AgentFormType } from './NvidiaRobots'
import { computeRLNavigationVelocity, getOfficeWaypoints } from '@/lib/rl/rlNavigator'

export type AgentAction =
    | 'desk'
    | 'sofa'
    | 'roundtable'
    | 'pingpong'
    | 'coffee'
    | 'management_office'
    | 'research_lab'
    | 'analytics_dept'
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
    status?: 'idle' | 'working' | 'meeting' | 'blocked' | 'thinking' | 'speaking' | 'error' | string
    speech?: string | null
    waypoints?: [number, number, number][]
    speed?: number
    targetAction?: AgentAction
    targetPosition?: [number, number, number] | null
    isSelected?: boolean
    onSelect?: () => void
    ownerName?: string
    form?: AgentFormType
    bodyId?: string | null
    useRL?: boolean
}

// Vector pool dùng chung cho useFrame nhằm triệt tiêu hoàn toàn rác bộ nhớ (Zero Garbage Collection)
const _vCurrent = new THREE.Vector3()
const _vTarget = new THREE.Vector3()
const _vDir = new THREE.Vector3()
const _vMove = new THREE.Vector3()

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
    form,
    bodyId,
    useRL = true,
}: Props) {
    const body = useRef<RapierRigidBody>(null)
    const currentIndex = useRef(0)
    const isWaiting = useRef(false)
    const waitUntil = useRef(0)

    const [isWalking, setIsWalking] = useState(false)
    const isWalkingRef = useRef(false)
    const keysDown = useRef<{ [key: string]: boolean }>({})

    // Lưu vết điều hướng xuyên phòng và làm mượt góc xoay (Smooth Heading)
    const currentHeadingRef = useRef<number>(0)
    const officeWaypointsRef = useRef<[number, number, number][]>([])
    const prevTargetKeyRef = useRef<string>('')

    // Cập nhật trạng thái bước đi an toàn, không gây re-render dư thừa
    const setWalkingSafe = (val: boolean) => {
        if (isWalkingRef.current !== val) {
            isWalkingRef.current = val
            setIsWalking(val)
        }
    }

    // Nhận diện hình thái Agent (Duck, AMR, Drone, Humanoid, Custom)
    const agentForm = useMemo<AgentFormType>(() => {
        if (form) return form
        if (bodyId) return 'custom'
        if (typeof window !== 'undefined' && id) {
            const saved = localStorage.getItem(`agent_form:${id}`)
            if (saved === 'duck' || saved === 'amr' || saved === 'drone' || saved === 'humanoid' || saved === 'custom') {
                return saved as AgentFormType
            }
        }
        const lower = ((name || '') + ' ' + (id || '')).toLowerCase()
        if (lower.includes('custom') || lower.includes('body')) return 'custom'
        if (lower.includes('duck') || lower.includes('vit') || lower.includes('microduck')) return 'duck'
        if (lower.includes('amr') || lower.includes('agv') || lower.includes('xe') || lower.includes('logistics') || lower.includes('carter')) return 'amr'
        if (lower.includes('drone') || lower.includes('fly') || lower.includes('bay') || lower.includes('falcon')) return 'drone'
        return 'humanoid'
    }, [form, bodyId, name, id])

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
                officeWaypointsRef.current = []
                prevTargetKeyRef.current = ''

                _vMove.set(vx, 0, vz).normalize().multiplyScalar(speed * 1.5)
                body.current.setLinvel({ x: _vMove.x, y: 0, z: _vMove.z }, true)

                const angle = Math.atan2(_vMove.x, _vMove.z)
                currentHeadingRef.current = angle
                body.current.setRotation(
                    { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) },
                    true
                )
                setWalkingSafe(true)
                return
            }
        }

        // 2. Di chuyển đến Điểm Mục Tiêu (Target Position / Action Destination) bằng RL Navigation xuyên phòng
        if (targetPosition) {
            const currentPos = body.current.translation()
            const targetKey = `${targetPosition[0].toFixed(2)}_${targetPosition[2].toFixed(2)}`

            // Nếu đổi mục tiêu mới hoặc chưa lập lộ trình, tính toán chuỗi trạm Waypoints xuyên phòng
            if (prevTargetKeyRef.current !== targetKey) {
                prevTargetKeyRef.current = targetKey
                officeWaypointsRef.current = getOfficeWaypoints(
                    [currentPos.x, 0, currentPos.z],
                    targetPosition
                )
            }

            if (officeWaypointsRef.current.length > 0) {
                const nextWp = officeWaypointsRef.current[0]
                const isFinal = officeWaypointsRef.current.length === 1
                const arriveDist = isFinal ? 0.35 : 0.85

                const dx = nextWp[0] - currentPos.x
                const dz = nextWp[2] - currentPos.z
                const distToWp = Math.sqrt(dx * dx + dz * dz)

                if (distToWp < arriveDist) {
                    officeWaypointsRef.current.shift()
                    if (officeWaypointsRef.current.length === 0) {
                        body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
                        setWalkingSafe(false)
                        return
                    }
                }

                const currentWp = officeWaypointsRef.current[0] || nextWp
                const rlNav = computeRLNavigationVelocity(
                    { x: currentPos.x, z: currentPos.z },
                    { x: currentWp[0], z: currentWp[2] },
                    currentHeadingRef.current,
                    speed
                )

                body.current.setLinvel(
                    { x: rlNav.velocity.x, y: 0, z: rlNav.velocity.z },
                    true
                )

                // Làm mượt góc quay thân người (Smooth Heading), khử hoàn toàn hiện tượng rung lắc
                const targetAngle = rlNav.rotationY
                let diff = targetAngle - currentHeadingRef.current
                while (diff > Math.PI) diff -= 2 * Math.PI
                while (diff < -Math.PI) diff += 2 * Math.PI
                currentHeadingRef.current += diff * Math.min(1.0, delta * 12)

                const h = currentHeadingRef.current
                body.current.setRotation(
                    { x: 0, y: Math.sin(h / 2), z: 0, w: Math.cos(h / 2) },
                    true
                )
                setWalkingSafe(true)
                return
            }
        }

        // 3. Nếu hành động là làm việc mặc định tại bàn (Về bàn với cơ chế né bàn ghế xuyên phòng)
        if (!targetAction && (status === 'working' || status === 'blocked')) {
            const desk = deskPosition ?? position
            const currentPos = body.current.translation()
            const targetKey = `desk_${desk[0].toFixed(2)}_${desk[2].toFixed(2)}`

            if (prevTargetKeyRef.current !== targetKey) {
                prevTargetKeyRef.current = targetKey
                officeWaypointsRef.current = getOfficeWaypoints(
                    [currentPos.x, 0, currentPos.z],
                    desk
                )
            }

            if (officeWaypointsRef.current.length > 0) {
                const nextWp = officeWaypointsRef.current[0]
                const isFinal = officeWaypointsRef.current.length === 1
                const arriveDist = isFinal ? 0.35 : 0.85

                const dx = nextWp[0] - currentPos.x
                const dz = nextWp[2] - currentPos.z
                const distToWp = Math.sqrt(dx * dx + dz * dz)

                if (distToWp < arriveDist) {
                    officeWaypointsRef.current.shift()
                    if (officeWaypointsRef.current.length === 0) {
                        body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
                        setWalkingSafe(false)
                        return
                    }
                }

                const currentWp = officeWaypointsRef.current[0] || nextWp
                const rlNav = computeRLNavigationVelocity(
                    { x: currentPos.x, z: currentPos.z },
                    { x: currentWp[0], z: currentWp[2] },
                    currentHeadingRef.current,
                    speed * 0.95
                )

                body.current.setLinvel(
                    { x: rlNav.velocity.x, y: 0, z: rlNav.velocity.z },
                    true
                )

                const targetAngle = rlNav.rotationY
                let diff = targetAngle - currentHeadingRef.current
                while (diff > Math.PI) diff -= 2 * Math.PI
                while (diff < -Math.PI) diff += 2 * Math.PI
                currentHeadingRef.current += diff * Math.min(1.0, delta * 12)

                const h = currentHeadingRef.current
                body.current.setRotation(
                    { x: 0, y: Math.sin(h / 2), z: 0, w: Math.cos(h / 2) },
                    true
                )
                setWalkingSafe(true)
                return
            }
        }

        // 4. Đi dạo tự do theo Waypoints (Patrol / Roam)
        if (waypoints.length > 0) {
            if (isWaiting.current) {
                if (state.clock.elapsedTime > waitUntil.current) {
                    isWaiting.current = false
                }
                body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
                setWalkingSafe(false)
                return
            }

            const currentPos = body.current.translation()
            const wp = waypoints[currentIndex.current]
            const dx = wp[0] - currentPos.x
            const dz = wp[2] - currentPos.z
            const distance = Math.sqrt(dx * dx + dz * dz)

            if (distance < 0.6) {
                currentIndex.current = (currentIndex.current + 1) % waypoints.length
                isWaiting.current = true
                waitUntil.current = state.clock.elapsedTime + 2.0
                body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
                setWalkingSafe(false)
                return
            }

            const rlNav = computeRLNavigationVelocity(
                { x: currentPos.x, z: currentPos.z },
                { x: wp[0], z: wp[2] },
                currentHeadingRef.current,
                speed
            )

            body.current.setLinvel(
                { x: rlNav.velocity.x, y: 0, z: rlNav.velocity.z },
                true
            )

            const targetAngle = rlNav.rotationY
            let diff = targetAngle - currentHeadingRef.current
            while (diff > Math.PI) diff -= 2 * Math.PI
            while (diff < -Math.PI) diff += 2 * Math.PI
            currentHeadingRef.current += diff * Math.min(1.0, delta * 12)

            const h = currentHeadingRef.current
            body.current.setRotation(
                { x: 0, y: Math.sin(h / 2), z: 0, w: Math.cos(h / 2) },
                true
            )
            setWalkingSafe(true)
            return
        }

        // Đứng yên
        body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
        setWalkingSafe(false)
    })

    const shouldSit = isSittingAction && !isWalking
    const labelY = useMemo(() => {
        if (agentForm === 'custom') return 1.35
        if (agentForm === 'amr') return 0.95
        if (agentForm === 'duck') return shouldSit ? 0.85 : 1.15
        if (agentForm === 'drone') return 1.65
        return shouldSit ? 1.55 : 2.15
    }, [agentForm, shouldSit])

    const colliderConfig = useMemo<{ args: [number, number]; pos: [number, number, number] }>(() => {
        if (agentForm === 'custom') return { args: [0.35, 0.35], pos: [0, 0.45, 0] }
        if (agentForm === 'amr') return { args: [0.18, 0.42], pos: [0, 0.28, 0] }
        if (agentForm === 'duck') return { args: [0.22, 0.26], pos: [0, 0.32, 0] }
        if (agentForm === 'drone') return { args: [0.22, 0.32], pos: [0, 0.9, 0] }
        return {
            args: shouldSit ? [0.25, 0.28] : [0.45, 0.28],
            pos: [0, shouldSit ? 0.55 : 0.85, 0],
        }
    }, [agentForm, shouldSit])

    return (
        <RigidBody
            ref={body}
            position={position}
            colliders={false}
            enabledRotations={[false, true, false]}
            linearDamping={2}
            type="dynamic"
        >
            <group
                onClick={(e: any) => {
                    e.stopPropagation()
                    onSelect?.()
                }}
            >
                <CapsuleCollider
                    args={colliderConfig.args}
                    position={colliderConfig.pos}
                />

                <AgentBody
                    color={color}
                    sitting={shouldSit}
                    walking={isWalking}
                    working={status === 'working' || targetAction === 'desk'}
                    form={agentForm}
                    bodyId={bodyId}
                />

                {/* Vòng hào quang Neon / Target Reticle khi Agent được chọn */}
                {isSelected && (
                    <group position={[0, 0.04, 0]}>
                        <mesh rotation={[-Math.PI / 2, 0, 0]}>
                            <ringGeometry args={[0.55, 0.58, 48]} />
                            <meshBasicMaterial color="#76b900" side={THREE.DoubleSide} />
                        </mesh>
                        <mesh rotation={[-Math.PI / 2, 0, 0]}>
                            <circleGeometry args={[0.55, 32]} />
                            <meshBasicMaterial color="#76b900" transparent opacity={0.12} side={THREE.DoubleSide} />
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
                    <AgentNameTag name={name} status={status as any} ownerName={ownerName} />
                </div>
            </Html>
        </RigidBody>

    )
}