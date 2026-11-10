'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Grid, TransformControls, Line, Edges, GizmoHelper, GizmoViewport } from '@react-three/drei'
import * as THREE from 'three'
import {
    AgentBodyDesign,
    AgentJoint,
    AgentLink,
    JointType,
    Vec3,
    jointRange,
} from '@/lib/agentBody/agentBodyTypes'

export type GizmoMode = 'none' | 'translate' | 'rotate'

export const JOINT_COLORS: Record<JointType, string> = {
    revolute: '#f59e0b',
    continuous: '#22d3ee',
    prismatic: '#a855f7',
    fixed: '#71717a',
}

interface AgentBodyCanvasProps {
    design: AgentBodyDesign
    selectedLinkId: string | null
    onSelectLink: (id: string | null) => void
    jointPositions: Record<string, number>
    animate: boolean
    showJoints: boolean
    xray: boolean
    gizmoMode: GizmoMode
    snap: boolean
    onJointTransform: (jointId: string, origin: Vec3, originRotation: Vec3) => void
}

interface RenderCtx {
    linkById: Map<string, AgentLink>
    childJoints: Map<string, AgentJoint[]>
    jointIndex: Map<string, number>
    selectedLinkId: string | null
    onSelectLink: (id: string | null) => void
    jointPositions: Record<string, number>
    animate: boolean
    showJoints: boolean
    xray: boolean
    registerJointGroup: (jointId: string, g: THREE.Group | null) => void
}

const ZYX = (v: Vec3) => new THREE.Euler(v[0], v[1], v[2], 'ZYX')

// ─── Complex Geometry Generators (Three.js) ───────────────────

function createSpurGearGeometry(radius: number, thickness: number, teeth: number, innerHole: number) {
    const shape = new THREE.Shape()
    const toothDepth = radius * 0.22
    const baseR = Math.max(0.005, radius - toothDepth)
    const totalSteps = teeth * 2
    for (let i = 0; i <= totalSteps; i++) {
        const angle = (i / totalSteps) * Math.PI * 2
        const isTip = i % 2 === 1
        const r = isTip ? radius : baseR
        const x = Math.cos(angle) * r
        const y = Math.sin(angle) * r
        if (i === 0) shape.moveTo(x, y)
        else shape.lineTo(x, y)
    }
    const holeR = Math.max(0.002, Math.min(innerHole, baseR * 0.5))
    const holePath = new THREE.Path()
    holePath.absarc(0, 0, holeR, 0, Math.PI * 2, true)
    shape.holes.push(holePath)

    const geom = new THREE.ExtrudeGeometry(shape, {
        depth: thickness,
        bevelEnabled: true,
        bevelThickness: Math.min(0.01, thickness * 0.1),
        bevelSize: Math.min(0.01, thickness * 0.1),
        bevelSegments: 2,
    })
    geom.center()
    return geom
}

function createWedgeGeometry(width: number, height: number, depth: number) {
    const w2 = width / 2
    const h2 = height / 2
    const d2 = depth / 2
    const vertices = new Float32Array([
        -w2, -h2, -d2,   w2, -h2, -d2,   w2, -h2,  d2,
        -w2, -h2, -d2,   w2, -h2,  d2,  -w2, -h2,  d2,
        -w2, -h2, -d2,  -w2, -h2,  d2,  -w2,  h2,  d2,
        -w2, -h2, -d2,  -w2,  h2,  d2,  -w2,  h2, -d2,
        -w2,  h2, -d2,  -w2,  h2,  d2,   w2, -h2,  d2,
        -w2,  h2, -d2,   w2, -h2,  d2,   w2, -h2, -d2,
        -w2, -h2,  d2,   w2, -h2,  d2,  -w2,  h2,  d2,
        -w2, -h2, -d2,  -w2,  h2, -d2,   w2, -h2, -d2,
    ])
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
    geom.computeVertexNormals()
    return geom
}

class HelixCurve extends THREE.Curve<THREE.Vector3> {
    radius: number
    length: number
    coils: number
    constructor(radius: number, length: number, coils: number) {
        super()
        this.radius = radius
        this.length = length
        this.coils = coils
    }
    getPoint(t: number, optionalTarget = new THREE.Vector3()) {
        const angle = t * this.coils * Math.PI * 2
        const x = Math.cos(angle) * this.radius
        const y = (t - 0.5) * this.length
        const z = Math.sin(angle) * this.radius
        return optionalTarget.set(x, y, z)
    }
}

function createSpringGeometry(radius: number, length: number, coils: number, wireRadius: number) {
    const path = new HelixCurve(radius, length, coils)
    return new THREE.TubeGeometry(path, Math.max(30, coils * 16), wireRadius, 8, false)
}

function createProfileGeometry(profile: string, length: number, width: number, height: number) {
    const shape = new THREE.Shape()
    const w2 = width / 2
    const h2 = height / 2

    if (profile === 'hex') {
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2
            const x = Math.cos(a) * w2
            const y = Math.sin(a) * h2
            if (i === 0) shape.moveTo(x, y)
            else shape.lineTo(x, y)
        }
        shape.closePath()
    } else if (profile === 'i-beam') {
        const flange = h2 * 0.28
        const web = w2 * 0.28
        shape.moveTo(-w2, -h2)
        shape.lineTo(w2, -h2)
        shape.lineTo(w2, -h2 + flange)
        shape.lineTo(web, -h2 + flange)
        shape.lineTo(web, h2 - flange)
        shape.lineTo(w2, h2 - flange)
        shape.lineTo(w2, h2)
        shape.lineTo(-w2, h2)
        shape.lineTo(-w2, h2 - flange)
        shape.lineTo(-web, h2 - flange)
        shape.lineTo(-web, -h2 + flange)
        shape.lineTo(-w2, -h2 + flange)
        shape.closePath()
    } else if (profile === 'c-channel') {
        const t = Math.min(w2, h2) * 0.28
        shape.moveTo(-w2, -h2)
        shape.lineTo(w2, -h2)
        shape.lineTo(w2, -h2 + t)
        shape.lineTo(-w2 + t, -h2 + t)
        shape.lineTo(-w2 + t, h2 - t)
        shape.lineTo(w2, h2 - t)
        shape.lineTo(w2, h2)
        shape.lineTo(-w2, h2)
        shape.closePath()
    } else {
        // aerofoil
        shape.moveTo(-w2, 0)
        shape.quadraticCurveTo(0, h2, w2, 0)
        shape.quadraticCurveTo(0, -h2 * 0.35, -w2, 0)
    }

    const geom = new THREE.ExtrudeGeometry(shape, {
        depth: length,
        bevelEnabled: true,
        bevelThickness: 0.005,
        bevelSize: 0.005,
        bevelSegments: 2,
    })
    geom.center()
    return geom
}

// ─── Link geometry ────────────────────────────────────────────

function LinkGeometry({ link }: { link: AgentLink }) {
    const [a, b, c] = link.size
    const params = link.shapeParams || {}

    const customGeom = useMemo(() => {
        if (link.shape === 'gear') {
            const teeth = params.teeth ?? 12
            const hole = params.innerRadius ?? a * 0.25
            return createSpurGearGeometry(Math.max(a, 0.01), Math.max(b, 0.01), teeth, hole)
        }
        if (link.shape === 'wedge') {
            return createWedgeGeometry(Math.max(a, 0.01), Math.max(b, 0.01), Math.max(c, 0.01))
        }
        if (link.shape === 'spring') {
            const coils = params.coils ?? 4
            const wireR = params.wireRadius ?? Math.max(0.004, a * 0.15)
            return createSpringGeometry(Math.max(a, 0.01), Math.max(b, 0.02), coils, wireR)
        }
        if (link.shape === 'extrusion') {
            const profile = params.profile ?? 'i-beam'
            return createProfileGeometry(profile, Math.max(c, 0.02), Math.max(a, 0.01), Math.max(b, 0.01))
        }
        return null
    }, [link.shape, a, b, c, params.teeth, params.innerRadius, params.coils, params.wireRadius, params.profile])

    if (customGeom) {
        return <primitive object={customGeom} attach="geometry" />
    }

    switch (link.shape) {
        case 'sphere':
            return <sphereGeometry args={[Math.max(a, 0.005), 32, 16]} />
        case 'cylinder':
            return <cylinderGeometry args={[Math.max(a, 0.005), Math.max(a, 0.005), Math.max(b, 0.005), 32]} />
        case 'capsule':
            return <capsuleGeometry args={[Math.max(a, 0.005), Math.max(b, 0.001), 8, 20]} />
        case 'cone':
            return <coneGeometry args={[Math.max(a, 0.005), Math.max(b, 0.005), 32]} />
        case 'torus': {
            const tube = params.tubeRadius ?? Math.max(0.004, a * 0.25)
            return <torusGeometry args={[Math.max(a, 0.01), tube, 16, 48]} />
        }
        default:
            return <boxGeometry args={[Math.max(a, 0.005), Math.max(b, 0.005), Math.max(c, 0.005)]} />
    }
}

// ─── Joint gizmo (axis + range arc) ───────────────────────────

function JointGizmo({ joint, onClick }: { joint: AgentJoint; onClick: () => void }) {
    const color = JOINT_COLORS[joint.type]
    const { axisLine, arc } = useMemo(() => {
        const axis = new THREE.Vector3(...joint.axis)
        if (axis.lengthSq() < 1e-9) axis.set(0, 0, 1)
        axis.normalize()
        const axisLine: Vec3[] = [
            [-axis.x * 0.12, -axis.y * 0.12, -axis.z * 0.12],
            [axis.x * 0.12, axis.y * 0.12, axis.z * 0.12],
        ]
        let arc: Vec3[] | null = null
        if (joint.type === 'revolute' || joint.type === 'continuous') {
            const helper = Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
            const u = new THREE.Vector3().crossVectors(axis, helper).normalize()
            const v = new THREE.Vector3().crossVectors(axis, u).normalize()
            const [lo, hi] = joint.type === 'continuous' ? [0, Math.PI * 2] : [joint.limit.lower, joint.limit.upper]
            const steps = 40
            const r = 0.07
            arc = []
            for (let i = 0; i <= steps; i++) {
                const t = lo + ((hi - lo) * i) / steps
                const p = u.clone().multiplyScalar(Math.cos(t) * r).add(v.clone().multiplyScalar(Math.sin(t) * r))
                arc.push([p.x, p.y, p.z])
            }
        } else if (joint.type === 'prismatic') {
            arc = [
                [axis.x * joint.limit.lower, axis.y * joint.limit.lower, axis.z * joint.limit.lower],
                [axis.x * joint.limit.upper, axis.y * joint.limit.upper, axis.z * joint.limit.upper],
            ]
        }
        return { axisLine, arc }
    }, [joint.axis, joint.type, joint.limit.lower, joint.limit.upper])

    return (
        <group>
            <mesh
                renderOrder={10}
                onClick={(e: ThreeEvent<MouseEvent>) => {
                    e.stopPropagation()
                    onClick()
                }}
            >
                <sphereGeometry args={[0.022, 16, 12]} />
                <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.95} />
            </mesh>
            {joint.type !== 'fixed' && (
                <Line points={axisLine} color={color} lineWidth={2} depthTest={false} renderOrder={10} />
            )}
            {arc && <Line points={arc} color={color} lineWidth={1.5} depthTest={false} transparent opacity={0.8} renderOrder={10} />}
        </group>
    )
}

// ─── Recursive link / joint nodes ─────────────────────────────

function LinkNode({ linkId, ctx }: { linkId: string; ctx: RenderCtx }) {
    const link = ctx.linkById.get(linkId)
    const [hovered, setHovered] = useState(false)
    if (!link) return null
    const selected = ctx.selectedLinkId === linkId
    const children = ctx.childJoints.get(linkId) || []

    return (
        <group>
            <mesh
                position={link.visualOffset}
                rotation={ZYX(link.visualRotation)}
                castShadow
                receiveShadow
                onClick={(e: ThreeEvent<MouseEvent>) => {
                    e.stopPropagation()
                    ctx.onSelectLink(linkId)
                }}
                onPointerOver={(e: ThreeEvent<PointerEvent>) => {
                    e.stopPropagation()
                    setHovered(true)
                }}
                onPointerOut={() => setHovered(false)}
            >
                <LinkGeometry link={link} />
                <meshStandardMaterial
                    color={link.color}
                    roughness={0.45}
                    metalness={0.25}
                    transparent={ctx.xray}
                    opacity={ctx.xray ? 0.35 : 1}
                    emissive={selected ? '#22d3ee' : hovered ? '#ffffff' : '#000000'}
                    emissiveIntensity={selected ? 0.35 : hovered ? 0.12 : 0}
                />
                {selected && <Edges color="#22d3ee" threshold={20} />}
            </mesh>
            {children.map((j) => (
                <JointNode key={j.id} joint={j} ctx={ctx} />
            ))}
        </group>
    )
}

function JointNode({ joint, ctx }: { joint: AgentJoint; ctx: RenderCtx }) {
    const motionRef = useRef<THREE.Group>(null)
    const axisVec = useRef(new THREE.Vector3())
    const index = ctx.jointIndex.get(joint.id) ?? 0
    const target = ctx.jointPositions[joint.id] ?? joint.defaultPosition
    const live = useRef({ joint, target, animate: ctx.animate, index })
    live.current = { joint, target, animate: ctx.animate, index }

    useFrame(({ clock }) => {
        const g = motionRef.current
        if (!g) return
        const { joint: j, target: tq, animate, index: idx } = live.current
        let q = tq
        if (animate && j.type !== 'fixed') {
            const t = clock.getElapsedTime()
            if (j.type === 'continuous') {
                q = (t * 3) % (Math.PI * 2)
            } else {
                const [lo, hi] = jointRange(j)
                q = (lo + hi) / 2 + ((hi - lo) / 2) * 0.85 * Math.sin(t * 2.2 + idx * 0.9)
            }
        }
        const ax = axisVec.current.set(j.axis[0], j.axis[1], j.axis[2])
        if (ax.lengthSq() < 1e-9) ax.set(0, 0, 1)
        ax.normalize()
        if (j.type === 'revolute' || j.type === 'continuous') {
            g.position.set(0, 0, 0)
            g.quaternion.setFromAxisAngle(ax, q)
        } else if (j.type === 'prismatic') {
            g.quaternion.identity()
            g.position.copy(ax).multiplyScalar(q)
        } else {
            g.quaternion.identity()
            g.position.set(0, 0, 0)
        }
    })

    return (
        <group
            ref={(g) => ctx.registerJointGroup(joint.id, g)}
            position={joint.origin}
            rotation={ZYX(joint.originRotation)}
        >
            {ctx.showJoints && <JointGizmo joint={joint} onClick={() => ctx.onSelectLink(joint.childLinkId)} />}
            <group ref={motionRef}>
                <LinkNode linkId={joint.childLinkId} ctx={ctx} />
            </group>
        </group>
    )
}

// ─── Main canvas ──────────────────────────────────────────────

export function AgentBodyCanvas({
    design,
    selectedLinkId,
    onSelectLink,
    jointPositions,
    animate,
    showJoints,
    xray,
    gizmoMode,
    snap,
    onJointTransform,
}: AgentBodyCanvasProps) {
    const jointGroups = useRef(new Map<string, THREE.Group>())
    const [gizmoTarget, setGizmoTarget] = useState<THREE.Group | null>(null)
    const lastGizmoInteraction = useRef(0)

    const linkById = useMemo(() => new Map(design.links.map((l) => [l.id, l])), [design.links])
    const childJoints = useMemo(() => {
        const m = new Map<string, AgentJoint[]>()
        for (const j of design.joints) {
            const arr = m.get(j.parentLinkId) || []
            arr.push(j)
            m.set(j.parentLinkId, arr)
        }
        return m
    }, [design.joints])
    const jointIndex = useMemo(() => new Map(design.joints.map((j, i) => [j.id, i])), [design.joints])

    const parentJoint = useMemo(
        () => (selectedLinkId ? design.joints.find((j) => j.childLinkId === selectedLinkId) : undefined),
        [design.joints, selectedLinkId]
    )

    useEffect(() => {
        if (gizmoMode === 'none' || !parentJoint) {
            setGizmoTarget(null)
            return
        }
        setGizmoTarget(jointGroups.current.get(parentJoint.id) || null)
    }, [gizmoMode, parentJoint])

    const ctx: RenderCtx = {
        linkById,
        childJoints,
        jointIndex,
        selectedLinkId,
        onSelectLink,
        jointPositions,
        animate,
        showJoints,
        xray,
        registerJointGroup: (id, g) => {
            if (g) jointGroups.current.set(id, g)
            else jointGroups.current.delete(id)
        },
    }

    const handleGizmoChange = () => {
        if (!gizmoTarget || !parentJoint) return
        lastGizmoInteraction.current = performance.now()
        const p = gizmoTarget.position
        const r = new THREE.Euler().setFromQuaternion(gizmoTarget.quaternion, 'ZYX')
        const rd = (n: number) => Math.round(n * 10000) / 10000
        onJointTransform(parentJoint.id, [rd(p.x), rd(p.y), rd(p.z)], [rd(r.x), rd(r.y), rd(r.z)])
    }

    const stats = {
        links: design.links.length,
        joints: design.joints.length,
        dof: design.joints.filter((j) => j.type !== 'fixed').length,
    }

    return (
        <div className="relative w-full h-full bg-zinc-950 select-none">
            <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/85 border border-zinc-800 text-[11px] backdrop-blur font-mono text-zinc-300 shadow-xl">
                <span className="w-2 h-2 rounded-full bg-[#76b900] shadow-[0_0_6px_#76b900]" />
                <span className="font-bold text-white tracking-wider">BODY STUDIO</span>
                <span className="text-zinc-600">|</span>
                <span className="text-[#76b900]">KINEMATIC TREE</span>
                <span className="text-zinc-500">
                    ({stats.links} links / {stats.joints} joints / {stats.dof} DOF)
                </span>
                {animate && <span className="text-cyan-400 animate-pulse">[MOTION TEST]</span>}
            </div>

            <div className="pointer-events-none absolute left-3 bottom-3 z-10 flex flex-col gap-1 px-3 py-2 rounded-xl bg-black/80 border border-zinc-800 text-[10px] font-mono text-zinc-400">
                {(Object.keys(JOINT_COLORS) as JointType[]).map((t) => (
                    <div key={t} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: JOINT_COLORS[t] }} />
                        <span className="uppercase">{t}</span>
                    </div>
                ))}
            </div>

            <Canvas
                shadows
                dpr={[1, 1.75]}
                camera={{ position: [1.9, 1.4, 1.9], fov: 45, near: 0.01, far: 200 }}
                gl={{ antialias: true, powerPreference: 'high-performance' }}
                onPointerMissed={() => {
                    if (performance.now() - lastGizmoInteraction.current < 300) return
                    onSelectLink(null)
                }}
            >
                <color attach="background" args={['#09090b']} />
                <fog attach="fog" args={['#09090b', 8, 22]} />
                <ambientLight intensity={0.55} />
                <hemisphereLight args={['#e0f2fe', '#18181b', 0.45]} />
                <directionalLight
                    position={[3, 6, 3]}
                    intensity={1.6}
                    castShadow
                    shadow-mapSize={[2048, 2048]}
                    shadow-camera-left={-3}
                    shadow-camera-right={3}
                    shadow-camera-top={3}
                    shadow-camera-bottom={-3}
                />
                <pointLight position={[-2, 2, -2]} intensity={0.6} color="#76b900" />

                <OrbitControls makeDefault enableDamping dampingFactor={0.08} target={[0, 0.4, 0]} minDistance={0.3} maxDistance={15} />

                <Grid
                    position={[0, 0.001, 0]}
                    args={[20, 20]}
                    cellSize={0.1}
                    cellThickness={0.6}
                    cellColor="#3f3f46"
                    sectionSize={1}
                    sectionThickness={1.2}
                    sectionColor="#76b900"
                    fadeDistance={14}
                    fadeStrength={1.2}
                    infiniteGrid
                />
                <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                    <planeGeometry args={[40, 40]} />
                    <shadowMaterial transparent opacity={0.35} />
                </mesh>

                {/* Forward direction hint (+X) */}
                <Line points={[[0, 0.002, 0], [0.5, 0.002, 0]]} color="#ef4444" lineWidth={2} />

                <group position={[0, design.spawnHeight, 0]}>
                    {linkById.has(design.rootLinkId) && <LinkNode linkId={design.rootLinkId} ctx={ctx} />}
                </group>

                {gizmoTarget && gizmoMode !== 'none' && (
                    <TransformControls
                        object={gizmoTarget}
                        mode={gizmoMode}
                        space="local"
                        size={0.6}
                        translationSnap={snap ? 0.01 : null}
                        rotationSnap={snap ? (5 * Math.PI) / 180 : null}
                        onMouseDown={() => (lastGizmoInteraction.current = performance.now())}
                        onMouseUp={() => (lastGizmoInteraction.current = performance.now())}
                        onObjectChange={handleGizmoChange}
                    />
                )}

                <GizmoHelper alignment="top-right" margin={[70, 70]}>
                    <GizmoViewport axisColors={['#ef4444', '#76b900', '#3b82f6']} labelColor="white" />
                </GizmoHelper>
            </Canvas>
        </div>
    )
}

