'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
    AgentBodyDesign,
    AgentJoint,
    AgentLink,
    BODY_TEMPLATES,
    jointRange,
    Vec3,
} from '@/lib/agentBody/agentBodyTypes'
import { agentBodiesApi } from '@/lib/api/agentBodies'

export interface CustomAgentBodyMeshProps {
    bodyId?: string | null
    bodyDesign?: AgentBodyDesign | null
    color?: string
    walking?: boolean
    sitting?: boolean
    working?: boolean
    isStudioPedestal?: boolean
}

const ZYX = (v: Vec3) => new THREE.Euler(v[0], v[1], v[2], 'ZYX')

function LinkGeom({ link }: { link: AgentLink }) {
    const [a, b, c] = link.size
    const params = link.shapeParams || {}
    switch (link.shape) {
        case 'sphere':
            return <sphereGeometry args={[Math.max(a, 0.01), 24, 16]} />
        case 'cylinder':
            return <cylinderGeometry args={[Math.max(a, 0.01), Math.max(a, 0.01), Math.max(b, 0.01), 24]} />
        case 'capsule':
            return <capsuleGeometry args={[Math.max(a, 0.01), Math.max(b, 0.005), 8, 16]} />
        case 'cone':
            return <coneGeometry args={[Math.max(a, 0.01), Math.max(b, 0.01), 24]} />
        case 'torus': {
            const tube = params.tubeRadius ?? Math.max(0.004, a * 0.25)
            return <torusGeometry args={[Math.max(a, 0.01), tube, 16, 32]} />
        }
        case 'gear':
        case 'spring':
            return <cylinderGeometry args={[Math.max(a, 0.01), Math.max(a, 0.01), Math.max(b, 0.01), 16]} />
        case 'wedge':
        case 'extrusion':
        default:
            return <boxGeometry args={[Math.max(a, 0.01), Math.max(b, 0.01), Math.max(c, 0.01)]} />
    }
}

interface NodeContext {
    linkMap: Map<string, AgentLink>
    childJointsMap: Map<string, AgentJoint[]>
    jointIndexMap: Map<string, number>
    walking: boolean
    sitting: boolean
    isStudioPedestal: boolean
    customColor?: string
}

function KinematicLinkNode({ linkId, ctx }: { linkId: string; ctx: NodeContext }) {
    const link = ctx.linkMap.get(linkId)
    if (!link) return null
    const children = ctx.childJointsMap.get(linkId) || []
    const linkColor = ctx.customColor && linkId === ctx.linkMap.keys().next().value ? ctx.customColor : link.color

    return (
        <group>
            <mesh
                position={link.visualOffset}
                rotation={ZYX(link.visualRotation)}
                castShadow
                receiveShadow
            >
                <LinkGeom link={link} />
                <meshStandardMaterial
                    color={linkColor}
                    roughness={0.4}
                    metalness={0.3}
                />
            </mesh>
            {children.map((j) => (
                <KinematicJointNode key={j.id} joint={j} ctx={ctx} />
            ))}
        </group>
    )
}

function KinematicJointNode({ joint, ctx }: { joint: AgentJoint; ctx: NodeContext }) {
    const groupRef = useRef<THREE.Group>(null)
    const axisVec = useRef(new THREE.Vector3())
    const index = ctx.jointIndexMap.get(joint.id) ?? 0

    useFrame(({ clock }) => {
        const g = groupRef.current
        if (!g || joint.type === 'fixed') return
        const t = clock.getElapsedTime()
        let q = joint.defaultPosition

        // Nếu robot đang bước đi hoặc đang ở chế độ xem studio, tạo chuyển động nhịp nhàng
        const shouldAnimate = ctx.walking || ctx.isStudioPedestal
        if (shouldAnimate) {
            if (joint.type === 'continuous') {
                q = (t * (ctx.walking ? 8 : 2)) % (Math.PI * 2)
            } else {
                const [lo, hi] = jointRange(joint)
                const amp = Math.min((hi - lo) * 0.45, 0.6)
                const freq = ctx.walking ? 4.5 : 2.0
                const phase = index * 1.2
                q = joint.defaultPosition + amp * Math.sin(t * freq + phase)
            }
        } else if (ctx.sitting) {
            const [lo, hi] = jointRange(joint)
            q = (lo + hi) * 0.35
        }

        const ax = axisVec.current.set(joint.axis[0], joint.axis[1], joint.axis[2])
        if (ax.lengthSq() < 1e-9) ax.set(0, 0, 1)
        ax.normalize()

        if (joint.type === 'revolute' || joint.type === 'continuous') {
            g.quaternion.setFromAxisAngle(ax, q)
            g.position.set(0, 0, 0)
        } else if (joint.type === 'prismatic') {
            g.quaternion.identity()
            g.position.copy(ax).multiplyScalar(q)
        }
    })

    return (
        <group position={joint.origin} rotation={ZYX(joint.originRotation)}>
            <group ref={groupRef}>
                <KinematicLinkNode linkId={joint.childLinkId} ctx={ctx} />
            </group>
        </group>
    )
}

export function CustomAgentBodyMesh({
    bodyId,
    bodyDesign,
    color,
    walking = false,
    sitting = false,
    working = false,
    isStudioPedestal = false,
}: CustomAgentBodyMeshProps) {
    const [loadedDesign, setLoadedDesign] = useState<AgentBodyDesign | null>(bodyDesign || null)

    useEffect(() => {
        if (bodyDesign) {
            setLoadedDesign(bodyDesign)
            return
        }

        if (!bodyId) {
            // Mặc định nạp mẫu Quadruped nếu chưa chọn bodyId cụ thể
            setLoadedDesign(BODY_TEMPLATES.quadruped.build())
            return
        }

        // Kiểm tra cache local trước
        try {
            const cached = localStorage.getItem(`custom_body_design:${bodyId}`)
            if (cached) {
                const parsed = JSON.parse(cached)
                if (parsed?.rootLinkId && parsed?.links) {
                    setLoadedDesign(parsed)
                }
            }
        } catch (_) {}

        // Tải từ API mapdraw-service
        let cancelled = false
        agentBodiesApi
            .getBodyById(bodyId)
            .then((res) => {
                if (!cancelled && res?.data) {
                    setLoadedDesign(res.data)
                    try {
                        localStorage.setItem(`custom_body_design:${bodyId}`, JSON.stringify(res.data))
                    } catch (_) {}
                }
            })
            .catch(() => {
                // Fallback nếu offline: Quadruped
                if (!cancelled && !loadedDesign) {
                    setLoadedDesign(BODY_TEMPLATES.quadruped.build())
                }
            })

        return () => {
            cancelled = true
        }
    }, [bodyId, bodyDesign])

    const design = loadedDesign || BODY_TEMPLATES.quadruped.build()

    const linkMap = useMemo(() => new Map(design.links.map((l) => [l.id, l])), [design.links])
    const childJointsMap = useMemo(() => {
        const m = new Map<string, AgentJoint[]>()
        for (const j of design.joints) {
            const arr = m.get(j.parentLinkId) || []
            arr.push(j)
            m.set(j.parentLinkId, arr)
        }
        return m
    }, [design.joints])
    const jointIndexMap = useMemo(() => new Map(design.joints.map((j, i) => [j.id, i])), [design.joints])

    const ctx: NodeContext = {
        linkMap,
        childJointsMap,
        jointIndexMap,
        walking,
        sitting,
        isStudioPedestal,
        customColor: color,
    }

    return (
        <group position={[0, isStudioPedestal ? 0.35 : design.spawnHeight || 0.45, 0]}>
            {linkMap.has(design.rootLinkId) && (
                <KinematicLinkNode linkId={design.rootLinkId} ctx={ctx} />
            )}
        </group>
    )
}

