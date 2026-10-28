'use client'

import React, { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Float, Html, Grid } from '@react-three/drei'
import * as THREE from 'three'

export interface ClusterNode3D {
    id: string
    name: string
    model: string
    status: 'IDLE' | 'BUSY' | 'OFFLINE'
    gpuName?: string
    cpuCores?: number
    ramGB?: number
    bandwidthMbps?: number
    latencyMs?: number
    city?: string
    isHub?: boolean
}

interface ClusterTopology3DViewProps {
    nodes: ClusterNode3D[]
    activeModelFilter?: string | null
    selectedNodeId?: string | null
    onSelectNode?: (id: string | null) => void
}

// ─── ĐƯỜNG KẾT NỐI 3D GIỮA 2 NODE CÓ HIỆU ỨNG PHOTON CHUYỂN ĐỘNG ─────
function LinkLine3D({
    start,
    end,
    color = '#38bdf8',
    isSelected = false,
}: {
    start: THREE.Vector3
    end: THREE.Vector3
    color?: string
    isSelected?: boolean
}) {
    const pulseRef = useRef<THREE.Mesh>(null!)
    const progressRef = useRef(Math.random())

    const curve = useMemo(() => {
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
        // Nâng nhẹ điểm giữa lên theo trục Y và Z để tạo độ uốn cong 3D tự nhiên
        mid.y += (start.distanceTo(end) * 0.18)
        mid.z += (Math.sin(start.x + end.y) * 0.3)
        return new THREE.QuadraticBezierCurve3(start, mid, end)
    }, [start, end])

    const linePoints = useMemo(() => curve.getPoints(28), [curve])
    const lineGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints(linePoints), [linePoints])

    useFrame((_, delta) => {
        progressRef.current = (progressRef.current + delta * 0.45) % 1
        if (pulseRef.current) {
            const pt = curve.getPoint(progressRef.current)
            pulseRef.current.position.copy(pt)
        }
    })

    return (
        <group>
            {/* Đường dây liên kết 3D */}
            <primitive
                object={
                    new THREE.Line(
                        lineGeo,
                        new THREE.LineBasicMaterial({
                            color,
                            transparent: true,
                            opacity: isSelected ? 0.95 : 0.4,
                            linewidth: isSelected ? 2 : 1,
                        })
                    )
                }
            />

            {/* Hạt năng lượng phát sáng di chuyển dọc theo liên kết */}
            <mesh ref={pulseRef}>
                <sphereGeometry args={[0.045, 8, 8]} />
                <meshBasicMaterial color={isSelected ? '#38bdf8' : color} />
            </mesh>
        </group>
    )
}

// ─── NODE 3D ĐỐI TÁC TRONG KHÔNG GIAN ───────────────────────────────
function NodeMesh3D({
    node,
    position,
    isSelected,
    onSelect,
}: {
    node: ClusterNode3D
    position: THREE.Vector3
    isSelected: boolean
    onSelect: () => void
}) {
    const meshRef = useRef<THREE.Mesh>(null!)
    const haloRef = useRef<THREE.Mesh>(null!)

    const color =
        node.status === 'BUSY'
            ? '#f59e0b' // Vàng cam
            : node.status === 'IDLE'
            ? '#10b981' // Xanh lục neon
            : '#64748b' // Xám

    useFrame((_, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.8
            meshRef.current.rotation.x += delta * 0.3
        }
        if (haloRef.current) {
            haloRef.current.rotation.z -= delta * 0.5
        }
    })

    return (
        <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.3}>
            <group position={position}>
                {/* Khối hình học 3D của Node (Octahedron / Icosahedron) */}
                <mesh
                    ref={meshRef}
                    onClick={(e) => {
                        e.stopPropagation()
                        onSelect()
                    }}
                    cursor="pointer"
                >
                    <octahedronGeometry args={[isSelected ? 0.35 : 0.26, 0]} />
                    <meshStandardMaterial
                        color={color}
                        emissive={color}
                        emissiveIntensity={isSelected ? 2.8 : 1.4}
                        roughness={0.2}
                        metalness={0.8}
                        wireframe={false}
                    />
                </mesh>

                {/* Vỏ khung dây Neon bao quanh Node */}
                <mesh scale={1.2}>
                    <octahedronGeometry args={[isSelected ? 0.38 : 0.28, 0]} />
                    <meshBasicMaterial color={color} wireframe transparent opacity={isSelected ? 0.9 : 0.45} />
                </mesh>

                {/* Vòng hào quang quỹ đạo xoay quanh Node */}
                <mesh ref={haloRef} rotation={[Math.PI / 3, 0, 0]}>
                    <ringGeometry args={[0.38, 0.42, 24]} />
                    <meshBasicMaterial color={color} transparent opacity={isSelected ? 0.8 : 0.35} side={THREE.DoubleSide} />
                </mesh>

                {/* Nhãn thông tin 3D tương tác (HTML HUD) */}
                <Html distanceFactor={11} position={[0, 0.45, 0]} center>
                    <div
                        onClick={(e) => {
                            e.stopPropagation()
                            onSelect()
                        }}
                        className={`px-2.5 py-1.5 rounded-xl backdrop-blur-md text-[11px] whitespace-nowrap cursor-pointer transition select-none shadow-xl border ${
                            isSelected
                                ? 'bg-zinc-950/95 border-blue-400 text-white shadow-blue-500/30 scale-105 ring-2 ring-blue-500/30'
                                : 'bg-zinc-900/85 hover:bg-zinc-900 border-zinc-800 text-zinc-300'
                        }`}
                    >
                        <div className="flex items-center gap-1.5 font-bold">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                            <span>{node.name}</span>
                        </div>
                        <div className="text-[9px] text-zinc-400 font-mono mt-0.5 flex items-center gap-1.5">
                            <span className="text-blue-300 font-semibold">{node.model}</span>
                            {node.latencyMs !== undefined && (
                                <span className="text-emerald-400 font-bold">{node.latencyMs}ms</span>
                            )}
                        </div>
                    </div>
                </Html>
            </group>
        </Float>
    )
}

// ─── KHÔNG GIAN TOPO 3D KHI CHƯA CÓ NODE NÀO KẾT NỐI (RADAR SCANNER) ──
function ScanningRadarCore() {
    const ringRef = useRef<THREE.Mesh>(null!)
    const coreRef = useRef<THREE.Mesh>(null!)

    useFrame((_, delta) => {
        if (ringRef.current) {
            ringRef.current.rotation.z += delta * 0.4
            const s = 1 + Math.sin(Date.now() * 0.002) * 0.08
            ringRef.current.scale.set(s, s, s)
        }
        if (coreRef.current) {
            coreRef.current.rotation.y += delta * 0.6
            coreRef.current.rotation.x += delta * 0.4
        }
    })

    return (
        <group position={[0, 0, 0]}>
            {/* Lõi trung tâm Distributed Gateway */}
            <mesh ref={coreRef}>
                <dodecahedronGeometry args={[0.5, 0]} />
                <meshStandardMaterial
                    color="#3b82f6"
                    emissive="#1d4ed8"
                    emissiveIntensity={2}
                    roughness={0.2}
                    metalness={0.8}
                />
            </mesh>

            {/* Vòng sonar quét tín hiệu */}
            <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[1.5, 1.54, 48]} />
                <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} side={THREE.DoubleSide} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[2.4, 2.43, 64]} />
                <meshBasicMaterial color="#38bdf8" transparent opacity={0.3} side={THREE.DoubleSide} />
            </mesh>

            <Html distanceFactor={10} position={[0, -0.9, 0]} center>
                <div className="bg-zinc-950/90 border border-blue-500/40 px-4 py-2 rounded-xl text-center backdrop-blur-md shadow-2xl pointer-events-none whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-blue-400">
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                        <span>Đang Chờ Kết Nối Electron Worker...</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-1 max-w-xs">
                        Khởi chạy <strong>Go-Python Worker (.exe)</strong> trên máy Seller để xuất hiện trong Cụm 3D thời gian thực.
                    </p>
                </div>
            </Html>
        </group>
    )
}

// ─── SCENE TOPO 3D CHÍNH ──────────────────────────────────────────────
export default function ClusterTopology3DView({
    nodes,
    activeModelFilter,
    selectedNodeId,
    onSelectNode,
}: ClusterTopology3DViewProps) {
    // Phân bố các node theo tọa độ 3D có chiều sâu (X, Y, Z)
    const { nodePositions, links } = useMemo(() => {
        const positions: { node: ClusterNode3D; pos: THREE.Vector3 }[] = []
        const total = nodes.length

        if (total === 0) {
            return { nodePositions: [], links: [] }
        }

        // Tạo bố cục đa tầng chiều sâu (Multi-tiered 3D Orbit Layout)
        nodes.forEach((node, i) => {
            const angle = (i / total) * Math.PI * 2
            const radius = 2.4 + (i % 3) * 0.75
            const x = Math.cos(angle) * radius
            const z = Math.sin(angle) * radius
            // Phân bổ chiều cao Y và chiều sâu Z lệch nhau để tạo chiều sâu không gian
            const y = Math.sin(i * 1.5) * 1.1 + (i % 2 === 0 ? 0.3 : -0.3)

            positions.push({
                node,
                pos: new THREE.Vector3(x, y, z),
            })
        })

        // Xây dựng đường liên kết giữa các node cùng model hoặc kết nối tới trung tâm
        const linksList: { start: THREE.Vector3; end: THREE.Vector3; fromId: string; toId: string; color: string }[] = []

        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                const a = positions[i]
                const b = positions[j]

                const hasSharedModel =
                    !activeModelFilter ||
                    (a.node.model === activeModelFilter && b.node.model === activeModelFilter) ||
                    a.node.model === b.node.model

                if (hasSharedModel) {
                    linksList.push({
                        start: a.pos,
                        end: b.pos,
                        fromId: a.node.id,
                        toId: b.node.id,
                        color: a.node.model.includes('coder')
                            ? '#38bdf8' // Xanh lam cho Coder
                            : a.node.model.includes('deepseek')
                            ? '#a855f7' // Tím cho DeepSeek
                            : '#10b981', // Lục cho mô hình khác
                    })
                }
            }
        }

        return { nodePositions: positions, links: linksList }
    }, [nodes, activeModelFilter])

    return (
        <div className="w-full h-full relative bg-zinc-950 overflow-hidden select-none">
            {/* Header gợi ý điều khiển */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-800 text-xs text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="font-semibold text-white">3D Cluster Topology (Độ Sâu Không Gian)</span>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-400">Kéo xoay 360° • Cuộn chuột để Zoom In/Out</span>
            </div>

            <Canvas
                camera={{ position: [0, 2.5, 6.8], fov: 48 }}
                onClick={() => onSelectNode && onSelectNode(null)}
            >
                {/* Ánh sáng đa chiều */}
                <ambientLight intensity={0.65} />
                <directionalLight position={[6, 8, 5]} intensity={1.5} />
                <pointLight position={[-6, -4, -6]} intensity={0.9} color="#38bdf8" />
                <pointLight position={[0, 0, 0]} intensity={1.2} color="#60a5fa" />

                {/* Nền sao vũ trụ có chiều sâu */}
                <Stars radius={80} depth={40} count={2500} factor={3.5} saturation={0} fade speed={0.8} />

                {/* Lưới sàn không gian Cyberpunk 3D Depth Grid */}
                <Grid
                    position={[0, -2.2, 0]}
                    args={[16, 16]}
                    cellSize={0.8}
                    cellThickness={0.8}
                    cellColor="#1e293b"
                    sectionSize={2.4}
                    sectionThickness={1.2}
                    sectionColor="#3b82f6"
                    fadeDistance={14}
                    fadeStrength={1.5}
                />

                {/* Vòng quay tự do bằng chuột */}
                <OrbitControls
                    enableDamping
                    dampingFactor={0.06}
                    minDistance={3.0}
                    maxDistance={14.0}
                    autoRotate={nodes.length > 0}
                    autoRotateSpeed={0.4}
                />

                {/* Nếu chưa có node: hiển thị Radar quét tín hiệu Worker */}
                {nodes.length === 0 ? (
                    <ScanningRadarCore />
                ) : (
                    <>
                        {/* Render các liên kết 3D */}
                        {links.map((link, idx) => {
                            const isSelected =
                                selectedNodeId === link.fromId || selectedNodeId === link.toId
                            return (
                                <LinkLine3D
                                    key={`link-${idx}`}
                                    start={link.start}
                                    end={link.end}
                                    color={link.color}
                                    isSelected={isSelected}
                                />
                            )
                        })}

                        {/* Render các node đối tác 3D */}
                        {nodePositions.map(({ node, pos }) => (
                            <NodeMesh3D
                                key={node.id}
                                node={node}
                                position={pos}
                                isSelected={selectedNodeId === node.id}
                                onSelect={() => onSelectNode && onSelectNode(node.id)}
                            />
                        ))}
                    </>
                )}
            </Canvas>
        </div>
    )
}
