'use client'

import { useRef, useEffect, useState, useMemo } from 'react'
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
    status?: 'idle' | 'working' | 'meeting' | 'blocked' | 'thinking' | 'speaking'
    speech?: string | null
    waypoints?: [number, number, number][]
    speed?: number
    targetAction?: AgentAction
    targetPosition?: [number, number, number] | null
    isSelected?: boolean
    onSelect?: () => void
    ownerName?: string
    form?: 'humanoid' | 'duck' | 'amr' | 'drone'
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
}: Props) {
    const body = useRef<RapierRigidBody>(null)
    const currentIndex = useRef(0)
    const isWaiting = useRef(false)
    const waitUntil = useRef(0)

    const [isWalking, setIsWalking] = useState(false)
    const isWalkingRef = useRef(false)
    const keysDown = useRef<{ [key: string]: boolean }>({})

    // Cập nhật trạng thái bước đi an toàn, không gây re-render dư thừa
    const setWalkingSafe = (val: boolean) => {
        if (isWalkingRef.current !== val) {
            isWalkingRef.current = val
            setIsWalking(val)
        }
    }

    // Nhận diện hình thái Agent (Duck, AMR, Drone, Humanoid)
    const agentForm = useMemo<'humanoid' | 'duck' | 'amr' | 'drone'>(() => {
        if (form) return form
        if (typeof window !== 'undefined' && id) {
            const saved = localStorage.getItem(`agent_form:${id}`)
            if (saved === 'duck' || saved === 'amr' || saved === 'drone' || saved === 'humanoid') {
                return saved
            }
        }
        const lower = ((name || '') + ' ' + (id || '')).toLowerCase()
        if (lower.includes('duck') || lower.includes('vit') || lower.includes('microduck')) return 'duck'
        if (lower.includes('amr') || lower.includes('agv') || lower.includes('xe') || lower.includes('logistics') || lower.includes('carter')) return 'amr'
        if (lower.includes('drone') || lower.includes('fly') || lower.includes('bay') || lower.includes('falcon')) return 'drone'
        return 'humanoid'
    }, [form, name, id])

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
                _vMove.set(vx, 0, vz).normalize().multiplyScalar(speed * 1.5)
                body.current.setLinvel({ x: _vMove.x, y: 0, z: _vMove.z }, true)

                const angle = Math.atan2(_vMove.x, _vMove.z)
                body.current.setRotation(
                    { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) },
                    true
                )
                setWalkingSafe(true)
                return
            }
        }

        // 2. Di chuyển đến Điểm Mục Tiêu (Target Position / Action Destination)
        if (targetPosition) {
            const currentPos = body.current.translation()
            _vCurrent.set(currentPos.x, 0, currentPos.z)
            _vTarget.set(targetPosition[0], 0, targetPosition[2])
            const dist = _vTarget.distanceTo(_vCurrent)

            if (dist > 0.18) {
                _vDir.subVectors(_vTarget, _vCurrent).normalize()
                body.current.setLinvel(
                    { x: _vDir.x * speed * 1.4, y: 0, z: _vDir.z * speed * 1.4 },
                    true
                )
                const angle = Math.atan2(_vDir.x, _vDir.z)
                body.current.setRotation(
                    { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) },
                    true
                )
                setWalkingSafe(true)
                return
            } else {
                // Đã đến đích điểm chọn
                body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
                body.current.setTranslation(
                    { x: targetPosition[0], y: targetPosition[1] || 0, z: targetPosition[2] },
                    true
                )
                setWalkingSafe(false)
                return
            }
        }

        // 3. Nếu hành động là làm việc mặc định tại bàn
        if (!targetAction && (status === 'working' || status === 'blocked')) {
            const desk = deskPosition ?? position
            const currentPos = body.current.translation()
            _vCurrent.set(currentPos.x, 0, currentPos.z)
            _vTarget.set(desk[0], 0, desk[2])
            const dist = _vTarget.distanceTo(_vCurrent)

            if (dist > 0.15) {
                _vDir.subVectors(_vTarget, _vCurrent).normalize()
                body.current.setLinvel({ x: _vDir.x * speed, y: 0, z: _vDir.z * speed }, true)
                const angle = Math.atan2(_vDir.x, _vDir.z)
                body.current.setRotation(
                    { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) },
                    true
                )
                setWalkingSafe(true)
            } else {
                body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
                body.current.setTranslation({ x: desk[0], y: 0, z: desk[2] }, true)
                body.current.setRotation({ x: 0, y: 1, z: 0, w: 0 }, true)
                setWalkingSafe(false)
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
                setWalkingSafe(false)
                return
            }

            const currentPos = body.current.translation()
            _vCurrent.set(currentPos.x, 0, currentPos.z)
            const wp = waypoints[currentIndex.current]
            _vTarget.set(wp[0], 0, wp[2])
            _vDir.subVectors(_vTarget, _vCurrent)
            const distance = _vDir.length()

            if (distance < 0.25) {
                isWaiting.current = true
                waitUntil.current = state.clock.elapsedTime + 1.8 + Math.random()
                currentIndex.current = (currentIndex.current + 1) % waypoints.length
                body.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
                setWalkingSafe(false)
                return
            }

            _vDir.normalize()
            body.current.setLinvel(
                { x: _vDir.x * speed, y: 0, z: _vDir.z * speed },
                true
            )
            const angle = Math.atan2(_vDir.x, _vDir.z)
            body.current.setRotation(
                { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) },
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
        if (agentForm === 'amr') return 0.95
        if (agentForm === 'duck') return shouldSit ? 0.85 : 1.15
        if (agentForm === 'drone') return 1.65
        return shouldSit ? 1.55 : 2.15
    }, [agentForm, shouldSit])

    const colliderConfig = useMemo<{ args: [number, number]; pos: [number, number, number] }>(() => {
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
                    <AgentNameTag name={name} status={status} ownerName={ownerName} />
                </div>
            </Html>
        </RigidBody>

    )
}