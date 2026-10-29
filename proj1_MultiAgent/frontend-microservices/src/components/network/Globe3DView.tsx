'use client'

import React, { useRef, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Html } from '@react-three/drei'
import * as THREE from 'three'

export interface GeoNode {
    id: string
    name: string
    email: string
    city: string
    country: string
    lat: number
    lng: number
    status: 'IDLE' | 'BUSY' | 'OFFLINE'
    gpuName?: string
    models: string[]
    latencyMs: number
    bandwidthMbps: number
}

export interface GeoLink {
    from: GeoNode
    to: GeoNode
    model: string
    latency: number
    type?: 'seller-seller' | 'seller-owner'
}

// Chuyển đổi tọa độ Lat/Lng sang Vector3 trên mặt cầu bán kính R
export function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
    const phi = (90 - lat) * (Math.PI / 180)
    const theta = (lng + 180) * (Math.PI / 180)
    const x = -(radius * Math.sin(phi) * Math.cos(theta))
    const z = radius * Math.sin(phi) * Math.sin(theta)
    const y = radius * Math.cos(phi)
    return new THREE.Vector3(x, y, z)
}

// ─── ĐƯỜNG CONG VÒNG CUNG LIÊN KẾT GIỮA 2 NODE (GREAT CIRCLE ARC) ─────
function ArcLine({
    link,
    globeRadius,
    isSelected,
}: {
    link: GeoLink
    globeRadius: number
    isSelected: boolean
}) {
    const p1 = latLngToVector3(link.from.lat, link.from.lng, globeRadius)
    const p2 = latLngToVector3(link.to.lat, link.to.lng, globeRadius)

    // Tạo điểm điều khiển đỉnh vòm ở giữa uốn cong lên không gian
    const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5)
    const dist = p1.distanceTo(p2)
    const altitude = globeRadius + dist * 0.28 // độ cao vòm tỷ lệ với khoảng cách
    midPoint.normalize().multiplyScalar(altitude)

    const curve = useMemo(() => {
        return new THREE.QuadraticBezierCurve3(p1, midPoint, p2)
    }, [p1, midPoint, p2])

    const points = useMemo(() => curve.getPoints(40), [curve])
    const lineGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points])

    // Hạt photon năng lượng chạy dọc đường cong mô phỏng gói tin
    const pulseRef = useRef<THREE.Mesh>(null)
    const [tOffset] = useState(() => Math.random())

    useFrame(({ clock }) => {
        if (!pulseRef.current) return
        const t = (clock.getElapsedTime() * 0.4 + tOffset) % 1
        const pos = curve.getPoint(t)
        pulseRef.current.position.copy(pos)
    })

    const color = isSelected ? '#38bdf8' : link.type === 'seller-owner' ? '#06b6d4' : '#3b82f6'

    return (
        <group>
            {/* Đường dây nối uốn cong */}
            <primitive object={new THREE.Line(
                lineGeo,
                new THREE.LineBasicMaterial({
                    color,
                    transparent: true,
                    opacity: isSelected ? 0.9 : 0.4,
                    linewidth: isSelected ? 2 : 1,
                })
            )} />

            {/* Hạt photon phát sáng di chuyển */}
            <mesh ref={pulseRef}>
                <sphereGeometry args={[0.045, 8, 8]} />
                <meshBasicMaterial color="#38bdf8" />
            </mesh>
        </group>
    )
}

// ─── ĐIỂM NÚT NODE TRÊN QUẢ ĐỊA CẦU ─────────────────────────────────
function NodeMarker({
    node,
    globeRadius,
    isSelected,
    onSelect,
}: {
    node: GeoNode
    globeRadius: number
    isSelected: boolean
    onSelect: () => void
}) {
    const pos = useMemo(() => latLngToVector3(node.lat, node.lng, globeRadius * 1.01), [node, globeRadius])
    const markerColor = node.status === 'BUSY' ? '#f59e0b' : node.status === 'IDLE' ? '#10b981' : '#64748b'

    return (
        <group position={pos}>
            {/* Điểm nút phát sáng */}
            <mesh onClick={(e) => { e.stopPropagation(); onSelect() }}>
                <sphereGeometry args={[0.07, 16, 16]} />
                <meshStandardMaterial
                    color={markerColor}
                    emissive={markerColor}
                    emissiveIntensity={isSelected ? 3.0 : 1.8}
                />
            </mesh>

            {/* Vòng hào quang ping */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.09, 0.13, 20]} />
                <meshBasicMaterial color={markerColor} transparent opacity={isSelected ? 0.9 : 0.4} side={THREE.DoubleSide} />
            </mesh>

            {/* Popup nhãn thông tin khi được chọn */}
            {isSelected && (
                <Html distanceFactor={14} position={[0, 0.25, 0]} center>
                    <div className="bg-zinc-950/95 border border-cyan-500/50 backdrop-blur-md px-3 py-2 rounded-xl text-white shadow-2xl text-[11px] whitespace-nowrap pointer-events-none space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <strong className="text-cyan-300 font-bold">{node.name}</strong>
                            <span className="text-zinc-400 text-[10px]">({node.city}, {node.country})</span>
                        </div>
                        <div className="text-zinc-400 text-[10px] flex items-center gap-2">
                            <span>GPU: <span className="text-zinc-200">{node.gpuName || 'CPU'}</span></span>
                            <span>•</span>
                            <span>Ping: <span className="text-emerald-400 font-mono">{node.latencyMs}ms</span></span>
                        </div>
                        <div className="flex flex-wrap gap-1 pt-1">
                            {node.models.slice(0, 2).map((m) => (
                                <span key={m} className="bg-blue-600/30 text-blue-300 px-1.5 py-0.5 rounded text-[9px] border border-blue-500/20">
                                    {m}
                                </span>
                            ))}
                        </div>
                    </div>
                </Html>
            )}
        </group>
    )
}

// ─── THÂN QUẢ ĐỊA CẦU 3D ─────────────────────────────────────────────
function GlobeSphere({ radius }: { radius: number }) {
    const globeRef = useRef<THREE.Mesh>(null)

    useFrame((_, delta) => {
        if (globeRef.current) {
            globeRef.current.rotation.y += delta * 0.04 // xoay chậm tự nhiên
        }
    })

    return (
        <group>
            {/* Lõi quả cầu mặt đất màu Dark Tech */}
            <mesh ref={globeRef}>
                <sphereGeometry args={[radius, 64, 64]} />
                <meshStandardMaterial
                    color="#090d16"
                    roughness={0.7}
                    metalness={0.2}
                />
            </mesh>

            {/* Lớp lưới kinh độ/vĩ độ Wireframe công nghệ cao */}
            <mesh>
                <sphereGeometry args={[radius * 1.002, 32, 32]} />
                <meshBasicMaterial
                    color="#1e293b"
                    wireframe
                    transparent
                    opacity={0.35}
                />
            </mesh>

            {/* Khí quyển bao quanh phát sáng xanh lam */}
            <mesh>
                <sphereGeometry args={[radius * 1.08, 48, 48]} />
                <meshBasicMaterial
                    color="#0284c7"
                    transparent
                    opacity={0.07}
                    side={THREE.BackSide}
                />
            </mesh>
        </group>
    )
}

// ─── COMPONENT 3D EARTH GLOBE HOÀN CHỈNH ─────────────────────────────
export default function Globe3DView({
    nodes,
    links,
    selectedNodeId,
    onSelectNode,
}: {
    nodes: GeoNode[]
    links: GeoLink[]
    selectedNodeId: string | null
    onSelectNode: (id: string | null) => void
}) {
    const globeRadius = 3.2

    return (
        <div className="w-full h-full relative bg-zinc-950 overflow-hidden select-none">
            {/* Overlay chú thích góc nhìn */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-800 text-xs text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-semibold text-white">3D Global AI Neural Mesh</span>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-400">Cuộn chuột để Zoom • Kéo chuột để Xoay</span>
            </div>

            <Canvas camera={{ position: [0, 2, 7.8], fov: 45 }}>
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 10]} intensity={1.4} />
                <pointLight position={[-10, -5, -10]} intensity={0.6} color="#38bdf8" />

                <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />

                {/* Quả địa cầu */}
                <GlobeSphere radius={globeRadius} />

                {/* Các đường liên kết vòm bay lượn giữa các Node */}
                {links.map((link, idx) => {
                    const isSelected =
                        selectedNodeId === link.from.id || selectedNodeId === link.to.id
                    return (
                        <ArcLine
                            key={idx}
                            link={link}
                            globeRadius={globeRadius}
                            isSelected={isSelected}
                        />
                    )
                })}

                {/* Các điểm nút Node trên các châu lục */}
                {nodes.map((node) => (
                    <NodeMarker
                        key={node.id}
                        node={node}
                        globeRadius={globeRadius}
                        isSelected={selectedNodeId === node.id}
                        onSelect={() => onSelectNode(node.id)}
                    />
                ))}

                <OrbitControls
                    makeDefault
                    enablePan={false}
                    minDistance={5}
                    maxDistance={14}
                    rotateSpeed={0.6}
                />
            </Canvas>
        </div>
    )
}
