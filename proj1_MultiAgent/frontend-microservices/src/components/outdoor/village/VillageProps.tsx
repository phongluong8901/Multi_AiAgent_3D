'use client'

/**
 * Thư viện tài sản 3D cho Khu Làng Tác Tử AI (Grand AI Village).
 * Toàn bộ mô hình được dựng bằng primitive của three.js để không phụ thuộc file GLB bên ngoài,
 * đồng thời tối ưu hiệu năng bằng InstancedMesh cho rừng cây, đá và hoa.
 */

import React, { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import * as THREE from 'three'

export type TimeOfDay = 'day' | 'sunset' | 'night'
type Vec3 = [number, number, number]

// ─── Tiện ích ───────────────────────────────────────────────────────────────

/** Bộ sinh số ngẫu nhiên có seed (mulberry32) để bố cục làng ổn định giữa các lần render */
export function seededRandom(seed: number): () => number {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

// ─── 1. ĐỊA HÌNH: thảm cỏ, đường lát đá, quảng trường, đường vành đai ─────

type TerrainProps = {
    onFloorClick?: (point: Vec3) => void
}

const ROAD_COLOR = '#d6d3d1'
const ROAD_EDGE = '#a8a29e'

export function VillageTerrain({ onFloorClick }: TerrainProps) {
    const handleClick = (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        onFloorClick?.([e.point.x, 0, e.point.z])
    }

    // 4 lối đi chéo từ đường vành đai tới 4 phân khu (NE, SE, SW, NW)
    const diagonalPaths: { angle: number; center: Vec3 }[] = [
        { angle: Math.PI / 4, center: [19, 0.022, -19] },
        { angle: -Math.PI / 4, center: [19, 0.022, 19] },
        { angle: (-3 * Math.PI) / 4, center: [-19, 0.022, 19] },
        { angle: (3 * Math.PI) / 4, center: [-19, 0.022, -19] },
    ]

    return (
        <group>
            {/* Mặt đất toàn vùng (có collider vật lý) */}
            <RigidBody type="fixed" colliders="cuboid">
                <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={handleClick}>
                    <planeGeometry args={[280, 280]} />
                    <meshStandardMaterial color="#3d8b4a" roughness={0.95} />
                </mesh>
            </RigidBody>

            {/* Đồng cỏ nội khu sáng màu hơn */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow onClick={handleClick}>
                <circleGeometry args={[54, 72]} />
                <meshStandardMaterial color="#4fa860" roughness={0.92} />
            </mesh>

            {/* Trục đường Đông - Tây */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]} receiveShadow onClick={handleClick}>
                <planeGeometry args={[100, 5]} />
                <meshStandardMaterial color={ROAD_COLOR} roughness={0.75} />
            </mesh>
            {/* Trục đường Bắc - Nam (dừng tại bờ hồ phía Nam) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.019, -12]} receiveShadow onClick={handleClick}>
                <planeGeometry args={[5, 76]} />
                <meshStandardMaterial color={ROAD_COLOR} roughness={0.75} />
            </mesh>

            {/* Viền đường */}
            {[-2.65, 2.65].map((o) => (
                <React.Fragment key={o}>
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, o]}>
                        <planeGeometry args={[100, 0.3]} />
                        <meshStandardMaterial color={ROAD_EDGE} />
                    </mesh>
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[o, 0.021, -12]}>
                        <planeGeometry args={[0.3, 76]} />
                        <meshStandardMaterial color={ROAD_EDGE} />
                    </mesh>
                </React.Fragment>
            ))}

            {/* Đường vành đai tròn */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.024, 0]} receiveShadow onClick={handleClick}>
                <ringGeometry args={[18.5, 21.5, 120]} />
                <meshStandardMaterial color={ROAD_COLOR} roughness={0.75} />
            </mesh>

            {/* 4 lối đi chéo tới các phân khu */}
            {diagonalPaths.map((p, i) => (
                <group key={i} position={p.center} rotation={[0, p.angle, 0]}>
                    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={handleClick}>
                        <planeGeometry args={[16, 3.6]} />
                        <meshStandardMaterial color={ROAD_COLOR} roughness={0.75} />
                    </mesh>
                </group>
            ))}

            {/* Quảng trường trung tâm lát đá hoa cương */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow onClick={handleClick}>
                <circleGeometry args={[11, 72]} />
                <meshStandardMaterial color="#ece7e1" roughness={0.55} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.034, 0]}>
                <ringGeometry args={[10.4, 11, 96]} />
                <meshStandardMaterial color="#78716c" roughness={0.6} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.034, 0]}>
                <ringGeometry args={[6.2, 6.7, 96]} />
                <meshStandardMaterial color="#b45309" roughness={0.5} />
            </mesh>
            {/* Hoa văn ngôi sao 8 cánh trên nền quảng trường */}
            {Array.from({ length: 8 }).map((_, i) => (
                <group key={i} rotation={[0, (i * Math.PI) / 4, 0]}>
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.036, -8.5]}>
                        <planeGeometry args={[0.5, 3.4]} />
                        <meshStandardMaterial color="#a8a29e" />
                    </mesh>
                </group>
            ))}
        </group>
    )
}

// ─── 2. ĐÈN ĐƯỜNG CỔ ĐIỂN ───────────────────────────────────────────────────

type LampProps = {
    position: Vec3
    lit: boolean
    withLight?: boolean
    color?: string
    height?: number
}

export function VillageLamp({ position, lit, withLight = false, color = '#fde68a', height = 3.6 }: LampProps) {
    return (
        <group position={position}>
            <mesh position={[0, 0.15, 0]} castShadow>
                <cylinderGeometry args={[0.22, 0.3, 0.3, 8]} />
                <meshStandardMaterial color="#1c1917" metalness={0.5} roughness={0.4} />
            </mesh>
            <mesh position={[0, height / 2, 0]} castShadow>
                <cylinderGeometry args={[0.055, 0.075, height, 8]} />
                <meshStandardMaterial color="#292524" metalness={0.6} roughness={0.35} />
            </mesh>
            {/* Lồng đèn */}
            <mesh position={[0, height + 0.18, 0]}>
                <boxGeometry args={[0.34, 0.42, 0.34]} />
                <meshStandardMaterial
                    color={lit ? color : '#e7e5e4'}
                    emissive={color}
                    emissiveIntensity={lit ? 2.4 : 0.04}
                    transparent
                    opacity={0.92}
                />
            </mesh>
            <mesh position={[0, height + 0.52, 0]} rotation={[0, Math.PI / 4, 0]}>
                <coneGeometry args={[0.32, 0.3, 4]} />
                <meshStandardMaterial color="#1c1917" metalness={0.5} />
            </mesh>
            {withLight && lit && (
                <pointLight position={[0, height + 0.1, 0]} intensity={3.2} distance={16} decay={1.6} color={color} />
            )}
        </group>
    )
}

// ─── 3. THÁP ĐỒNG HỒ (chạy theo giờ thực) ──────────────────────────────────

export function ClockTower({ position, lit }: { position: Vec3; lit: boolean }) {
    const hourHands = useRef<THREE.Group[]>([])
    const minuteHands = useRef<THREE.Group[]>([])

    useFrame(() => {
        const now = new Date()
        const minutes = now.getMinutes() + now.getSeconds() / 60
        const hours = (now.getHours() % 12) + minutes / 60
        const minuteAngle = -(minutes / 60) * Math.PI * 2
        const hourAngle = -(hours / 12) * Math.PI * 2
        hourHands.current.forEach((h) => h && (h.rotation.z = hourAngle))
        minuteHands.current.forEach((m) => m && (m.rotation.z = minuteAngle))
    })

    return (
        <group position={position}>
            {/* Bệ đá */}
            <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
                <boxGeometry args={[4, 1.2, 4]} />
                <meshStandardMaterial color="#a8a29e" roughness={0.7} />
            </mesh>
            {/* Thân tháp */}
            <mesh position={[0, 6.7, 0]} castShadow receiveShadow>
                <boxGeometry args={[2.8, 11, 2.8]} />
                <meshStandardMaterial color="#f5f0e8" roughness={0.6} />
            </mesh>
            {/* Đường gờ trang trí */}
            {[3.2, 6.4, 9.6].map((y) => (
                <mesh key={y} position={[0, y, 0]} castShadow>
                    <boxGeometry args={[3.05, 0.22, 3.05]} />
                    <meshStandardMaterial color="#b45309" roughness={0.5} />
                </mesh>
            ))}
            {/* Cửa sổ vòm phát sáng */}
            {[4.6, 7.9].map((y) =>
                [0, Math.PI / 2, Math.PI, -Math.PI / 2].map((r, i) => (
                    <group key={`${y}-${i}`} rotation={[0, r, 0]}>
                        <mesh position={[0, y, 1.41]}>
                            <planeGeometry args={[0.6, 1.1]} />
                            <meshStandardMaterial
                                color={lit ? '#fde68a' : '#38bdf8'}
                                emissive={lit ? '#f59e0b' : '#0284c7'}
                                emissiveIntensity={lit ? 1.4 : 0.3}
                            />
                        </mesh>
                    </group>
                ))
            )}
            {/* Buồng đồng hồ */}
            <mesh position={[0, 13.4, 0]} castShadow>
                <boxGeometry args={[3.3, 2.6, 3.3]} />
                <meshStandardMaterial color="#e7e5e4" roughness={0.5} />
            </mesh>
            {/* 4 mặt đồng hồ */}
            {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((r, i) => (
                <group key={i} rotation={[0, r, 0]}>
                    <group position={[0, 13.4, 1.67]}>
                        <mesh>
                            <circleGeometry args={[1.05, 40]} />
                            <meshStandardMaterial
                                color="#fffbeb"
                                emissive="#fde68a"
                                emissiveIntensity={lit ? 1.1 : 0.15}
                            />
                        </mesh>
                        <mesh position={[0, 0, 0.005]}>
                            <ringGeometry args={[0.98, 1.1, 40]} />
                            <meshStandardMaterial color="#b45309" metalness={0.7} roughness={0.3} />
                        </mesh>
                        <group
                            position={[0, 0, 0.02]}
                            ref={(el) => {
                                if (el) hourHands.current[i] = el
                            }}
                        >
                            <mesh position={[0, 0.28, 0]}>
                                <boxGeometry args={[0.09, 0.56, 0.02]} />
                                <meshStandardMaterial color="#1c1917" />
                            </mesh>
                        </group>
                        <group
                            position={[0, 0, 0.03]}
                            ref={(el) => {
                                if (el) minuteHands.current[i] = el
                            }}
                        >
                            <mesh position={[0, 0.42, 0]}>
                                <boxGeometry args={[0.06, 0.84, 0.02]} />
                                <meshStandardMaterial color="#1c1917" />
                            </mesh>
                        </group>
                    </group>
                </group>
            ))}
            {/* Mái chóp & ngọn tháp vàng */}
            <mesh position={[0, 16.4, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                <coneGeometry args={[2.6, 3.4, 4]} />
                <meshStandardMaterial color="#1e3a8a" roughness={0.45} />
            </mesh>
            <mesh position={[0, 18.6, 0]}>
                <cylinderGeometry args={[0.03, 0.08, 1.6, 6]} />
                <meshStandardMaterial color="#facc15" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0, 19.5, 0]}>
                <sphereGeometry args={[0.18, 12, 12]} />
                <meshStandardMaterial color="#facc15" emissive="#f59e0b" emissiveIntensity={0.8} metalness={0.9} />
            </mesh>
        </group>
    )
}

// ─── 4. ĐẠI THƯ VIỆN KÝ ỨC (đền cột kiểu cổ điển + tinh thể tri thức) ──────

export function GrandLibrary({ position, rotationY = 0, lit }: { position: Vec3; rotationY?: number; lit: boolean }) {
    const crystalRef = useRef<THREE.Mesh>(null)
    const haloRef = useRef<THREE.Mesh>(null)

    useFrame((state) => {
        const t = state.clock.elapsedTime
        if (crystalRef.current) {
            crystalRef.current.rotation.y = t * 0.6
            crystalRef.current.position.y = 11.2 + Math.sin(t * 1.2) * 0.35
        }
        if (haloRef.current) {
            haloRef.current.rotation.z = t * 0.4
        }
    })

    const columnsX = [-5.4, -3.6, -1.8, 0, 1.8, 3.6, 5.4]

    return (
        <group position={position} rotation={[0, rotationY, 0]}>
            {/* Bậc nền 3 tầng */}
            <mesh position={[0, 0.25, 0]} receiveShadow castShadow>
                <boxGeometry args={[17, 0.5, 13]} />
                <meshStandardMaterial color="#d6d3d1" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.75, 0]} receiveShadow castShadow>
                <boxGeometry args={[15, 0.5, 11]} />
                <meshStandardMaterial color="#e7e5e4" roughness={0.65} />
            </mesh>
            <mesh position={[0, 1.25, 0]} receiveShadow castShadow>
                <boxGeometry args={[13, 0.5, 9]} />
                <meshStandardMaterial color="#f5f5f4" roughness={0.6} />
            </mesh>

            {/* Hàng cột trước & sau */}
            {[-3.8, 3.8].map((z) =>
                columnsX.map((x) => (
                    <group key={`${x}-${z}`} position={[x, 1.5, z]}>
                        <mesh position={[0, 2.6, 0]} castShadow>
                            <cylinderGeometry args={[0.3, 0.36, 5.2, 14]} />
                            <meshStandardMaterial color="#fafaf9" roughness={0.4} />
                        </mesh>
                        <mesh position={[0, 5.3, 0]}>
                            <boxGeometry args={[0.85, 0.25, 0.85]} />
                            <meshStandardMaterial color="#e7e5e4" />
                        </mesh>
                    </group>
                ))
            )}

            {/* Chính điện bên trong */}
            <mesh position={[0, 3.9, 0]} castShadow receiveShadow>
                <boxGeometry args={[9.5, 4.8, 5.6]} />
                <meshStandardMaterial color="#ede9fe" roughness={0.5} />
            </mesh>
            {/* Cửa chính phát quang tím */}
            <mesh position={[0, 3.2, 2.81]}>
                <planeGeometry args={[2, 3.4]} />
                <meshStandardMaterial color="#c084fc" emissive="#a855f7" emissiveIntensity={lit ? 2 : 0.9} />
            </mesh>
            {/* Cửa sổ thư viện */}
            {[-3.2, 3.2].map((x) => (
                <mesh key={x} position={[x, 3.8, 2.81]}>
                    <planeGeometry args={[1.2, 1.8]} />
                    <meshStandardMaterial
                        color="#e9d5ff"
                        emissive="#c084fc"
                        emissiveIntensity={lit ? 1.4 : 0.35}
                    />
                </mesh>
            ))}

            {/* Xà ngang (entablature) */}
            <mesh position={[0, 7.1, 0]} castShadow>
                <boxGeometry args={[13.4, 0.8, 9]} />
                <meshStandardMaterial color="#f5f5f4" roughness={0.5} />
            </mesh>
            <mesh position={[0, 7.55, 0]}>
                <boxGeometry args={[13.6, 0.12, 9.2]} />
                <meshStandardMaterial color="#a855f7" emissive="#7e22ce" emissiveIntensity={lit ? 0.9 : 0.25} />
            </mesh>

            {/* Mái tam giác (pediment) - lăng trụ tam giác chạy dọc trục Z */}
            <mesh position={[0, 8.3, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.2]} castShadow>
                <cylinderGeometry args={[7.75, 7.75, 9.2, 3, 1, false, Math.PI]} />
                <meshStandardMaterial color="#4c1d95" roughness={0.45} />
            </mesh>

            {/* Tinh thể Tri thức lơ lửng trên mái */}
            <mesh ref={crystalRef} position={[0, 11.2, 0]} castShadow>
                <octahedronGeometry args={[0.95]} />
                <meshStandardMaterial
                    color="#f0abfc"
                    emissive="#c026d3"
                    emissiveIntensity={2.2}
                    roughness={0.1}
                    metalness={0.6}
                />
            </mesh>
            <mesh ref={haloRef} position={[0, 11.2, 0]} rotation={[Math.PI / 2.3, 0, 0]}>
                <torusGeometry args={[1.7, 0.05, 8, 64]} />
                <meshStandardMaterial color="#e879f9" emissive="#d946ef" emissiveIntensity={2} />
            </mesh>
            <pointLight position={[0, 11.2, 0]} intensity={lit ? 6 : 2} distance={26} decay={1.6} color="#e879f9" />

            {/* Trụ tinh thể trước sân thư viện */}
            {[-7.4, 7.4].map((x) => (
                <group key={x} position={[x, 0, 7.6]}>
                    <mesh position={[0, 1.3, 0]} castShadow>
                        <cylinderGeometry args={[0.28, 0.36, 2.6, 8]} />
                        <meshStandardMaterial color="#cbd5e1" roughness={0.4} />
                    </mesh>
                    <mesh position={[0, 2.95, 0]}>
                        <octahedronGeometry args={[0.32]} />
                        <meshStandardMaterial color="#c084fc" emissive="#a855f7" emissiveIntensity={1.8} />
                    </mesh>
                </group>
            ))}
        </group>
    )
}

// ─── 5. HỌC VIỆN KỸ NĂNG / VÕ ĐƯỜNG CÔNG CỤ (kiến trúc mái chùa) ───────────

function TrainingTarget({ position }: { position: Vec3 }) {
    return (
        <group position={position}>
            <mesh position={[0, 1.1, 0]} castShadow>
                <cylinderGeometry args={[0.08, 0.1, 2.2, 8]} />
                <meshStandardMaterial color="#78350f" roughness={0.8} />
            </mesh>
            <group position={[0, 1.75, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
                <mesh castShadow>
                    <cylinderGeometry args={[0.6, 0.6, 0.1, 24]} />
                    <meshStandardMaterial color="#f8fafc" />
                </mesh>
                <mesh position={[0, -0.06, 0]}>
                    <cylinderGeometry args={[0.42, 0.42, 0.02, 24]} />
                    <meshStandardMaterial color="#2563eb" />
                </mesh>
                <mesh position={[0, -0.075, 0]}>
                    <cylinderGeometry args={[0.2, 0.2, 0.02, 24]} />
                    <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={0.4} />
                </mesh>
            </group>
        </group>
    )
}

export function ToolDojo({ position, rotationY = 0, lit }: { position: Vec3; rotationY?: number; lit: boolean }) {
    const orbRefs = useRef<THREE.Mesh[]>([])

    useFrame((state) => {
        const t = state.clock.elapsedTime
        orbRefs.current.forEach((m, i) => {
            if (!m) return
            const a = t * 0.9 + (i * Math.PI * 2) / 3
            m.position.set(Math.cos(a) * 2.6, 1.6 + Math.sin(t * 2 + i) * 0.25, 10 + Math.sin(a) * 2.6)
            m.rotation.y = t * 1.5
        })
    })

    const pillars: Vec3[] = [
        [-5.4, 0, -4.4],
        [5.4, 0, -4.4],
        [-5.4, 0, 4.4],
        [5.4, 0, 4.4],
        [-1.8, 0, 4.4],
        [1.8, 0, 4.4],
    ]

    return (
        <group position={position} rotation={[0, rotationY, 0]}>
            {/* Sàn gỗ nâng */}
            <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
                <boxGeometry args={[13, 0.7, 10.5]} />
                <meshStandardMaterial color="#7c2d12" roughness={0.75} />
            </mesh>
            {/* Bậc thềm */}
            <mesh position={[0, 0.18, 5.8]} receiveShadow>
                <boxGeometry args={[4, 0.36, 1.2]} />
                <meshStandardMaterial color="#9a3412" roughness={0.75} />
            </mesh>
            {/* Cột đỏ son */}
            {pillars.map((p, i) => (
                <mesh key={i} position={[p[0], 3, p[2]]} castShadow>
                    <cylinderGeometry args={[0.26, 0.3, 4.6, 12]} />
                    <meshStandardMaterial color="#b91c1c" roughness={0.45} />
                </mesh>
            ))}
            {/* Chính điện vách giấy shoji */}
            <mesh position={[0, 2.6, -0.6]} castShadow receiveShadow>
                <boxGeometry args={[9, 3.8, 6.4]} />
                <meshStandardMaterial
                    color="#fef3c7"
                    emissive="#fbbf24"
                    emissiveIntensity={lit ? 0.55 : 0.02}
                    roughness={0.8}
                />
            </mesh>
            {/* Khung gỗ trên vách */}
            {[-3, -1, 1, 3].map((x) => (
                <mesh key={x} position={[x, 2.6, 2.61]}>
                    <boxGeometry args={[0.1, 3.8, 0.04]} />
                    <meshStandardMaterial color="#451a03" />
                </mesh>
            ))}
            {/* Mái 2 tầng kiểu chùa */}
            <mesh position={[0, 6.1, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                <coneGeometry args={[9.4, 2.6, 4]} />
                <meshStandardMaterial color="#1f2937" roughness={0.5} />
            </mesh>
            <mesh position={[0, 7.4, 0]} castShadow>
                <boxGeometry args={[4.6, 1.2, 4.6]} />
                <meshStandardMaterial color="#b91c1c" />
            </mesh>
            <mesh position={[0, 8.8, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                <coneGeometry args={[5.2, 2, 4]} />
                <meshStandardMaterial color="#1f2937" roughness={0.5} />
            </mesh>
            <mesh position={[0, 10.2, 0]}>
                <coneGeometry args={[0.25, 1.1, 8]} />
                <meshStandardMaterial color="#facc15" metalness={0.9} roughness={0.2} emissive="#f59e0b" emissiveIntensity={0.4} />
            </mesh>

            {/* Sân luyện tập phía trước */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 10]} receiveShadow>
                <circleGeometry args={[4.6, 48]} />
                <meshStandardMaterial color="#fde68a" roughness={0.9} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 10]}>
                <ringGeometry args={[4.3, 4.7, 64]} />
                <meshStandardMaterial color="#b91c1c" emissive="#ef4444" emissiveIntensity={lit ? 0.9 : 0.1} />
            </mesh>
            <TrainingTarget position={[-6.5, 0, 9]} />
            <TrainingTarget position={[-6.5, 0, 12]} />
            <TrainingTarget position={[6.5, 0, 9]} />
            <TrainingTarget position={[6.5, 0, 12]} />

            {/* 3 khối công cụ phát sáng bay quanh sân tập */}
            {['#38bdf8', '#34d399', '#f472b6'].map((c, i) => (
                <mesh
                    key={c}
                    ref={(el) => {
                        if (el) orbRefs.current[i] = el
                    }}
                    castShadow
                >
                    <icosahedronGeometry args={[0.32, 0]} />
                    <meshStandardMaterial color={c} emissive={c} emissiveIntensity={1.6} />
                </mesh>
            ))}

            {/* Giá công cụ */}
            {[-3.5, 3.5].map((x) => (
                <group key={x} position={[x, 0.7, -5]}>
                    <mesh position={[0, 0.6, 0]} castShadow>
                        <boxGeometry args={[2.4, 1.2, 0.5]} />
                        <meshStandardMaterial color="#451a03" />
                    </mesh>
                    <mesh position={[-0.6, 1.35, 0]}>
                        <boxGeometry args={[0.3, 0.3, 0.3]} />
                        <meshStandardMaterial color="#38bdf8" emissive="#0ea5e9" emissiveIntensity={1.2} />
                    </mesh>
                    <mesh position={[0.6, 1.35, 0]}>
                        <cylinderGeometry args={[0.15, 0.15, 0.32, 10]} />
                        <meshStandardMaterial color="#34d399" emissive="#10b981" emissiveIntensity={1.2} />
                    </mesh>
                </group>
            ))}
        </group>
    )
}

// ─── 6. XƯỞNG THỰC NGHIỆM (nhà xưởng mái răng cưa, ống khói, bánh răng) ────

export function Workshop({ position, rotationY = 0, lit }: { position: Vec3; rotationY?: number; lit: boolean }) {
    const gearRef = useRef<THREE.Group>(null)
    const smokeRefs = useRef<THREE.Mesh[]>([])

    useFrame((state, delta) => {
        if (gearRef.current) gearRef.current.rotation.z += delta * 0.6
        const t = state.clock.elapsedTime
        smokeRefs.current.forEach((m, i) => {
            if (!m) return
            const phase = (t * 0.35 + i / 5) % 1
            m.position.set(4 + Math.sin(phase * 4 + i) * 0.4, 9.5 + phase * 6, -2.5 + phase * 1.2)
            const s = 0.5 + phase * 1.4
            m.scale.setScalar(s)
            const mat = m.material as THREE.MeshStandardMaterial
            mat.opacity = 0.55 * (1 - phase)
        })
    })

    return (
        <group position={position} rotation={[0, rotationY, 0]}>
            {/* Thân nhà xưởng */}
            <mesh position={[0, 2.6, 0]} castShadow receiveShadow>
                <boxGeometry args={[12, 5.2, 8]} />
                <meshStandardMaterial color="#94a3b8" roughness={0.6} metalness={0.2} />
            </mesh>
            {/* Mái răng cưa với giếng trời */}
            {[-4, 0, 4].map((x) => (
                <group key={x} position={[x, 5.2, 0]}>
                    <mesh position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.55]} castShadow>
                        <cylinderGeometry args={[2.3, 2.3, 8, 3, 1, false, Math.PI]} />
                        <meshStandardMaterial color="#475569" roughness={0.5} metalness={0.3} />
                    </mesh>
                    <mesh position={[1.05, 0.65, 0]} rotation={[0, 0, -0.98]}>
                        <planeGeometry args={[1.5, 7.6]} />
                        <meshStandardMaterial
                            color="#7dd3fc"
                            emissive="#0ea5e9"
                            emissiveIntensity={lit ? 1.2 : 0.2}
                            side={THREE.DoubleSide}
                        />
                    </mesh>
                </group>
            ))}
            {/* Cửa cuốn lớn */}
            <mesh position={[0, 1.8, 4.01]}>
                <planeGeometry args={[4.2, 3.6]} />
                <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={lit ? 1.1 : 0.15} />
            </mesh>
            {/* Ống khói */}
            <mesh position={[4, 6.5, -2.5]} castShadow>
                <cylinderGeometry args={[0.55, 0.7, 7, 12]} />
                <meshStandardMaterial color="#7f1d1d" roughness={0.7} />
            </mesh>
            {Array.from({ length: 5 }).map((_, i) => (
                <mesh
                    key={i}
                    ref={(el) => {
                        if (el) smokeRefs.current[i] = el
                    }}
                >
                    <sphereGeometry args={[0.6, 10, 10]} />
                    <meshStandardMaterial color="#e2e8f0" transparent opacity={0.4} depthWrite={false} />
                </mesh>
            ))}
            {/* Bánh răng khổng lồ trên tường */}
            <group ref={gearRef} position={[-3.6, 3, 4.05]}>
                <mesh>
                    <torusGeometry args={[1, 0.22, 10, 32]} />
                    <meshStandardMaterial color="#facc15" metalness={0.85} roughness={0.25} emissive="#f59e0b" emissiveIntensity={lit ? 0.7 : 0.1} />
                </mesh>
                {Array.from({ length: 10 }).map((_, i) => (
                    <mesh key={i} rotation={[0, 0, (i * Math.PI) / 5]} position={[Math.cos((i * Math.PI) / 5) * 1.3, Math.sin((i * Math.PI) / 5) * 1.3, 0]}>
                        <boxGeometry args={[0.35, 0.3, 0.2]} />
                        <meshStandardMaterial color="#facc15" metalness={0.85} roughness={0.25} />
                    </mesh>
                ))}
            </group>
            {/* Thùng hàng & tấm pin mặt trời */}
            {[
                [6.8, 0.5, 3],
                [7.6, 0.5, 1.6],
                [6.9, 1.5, 2.3],
            ].map((p, i) => (
                <mesh key={i} position={p as Vec3} castShadow>
                    <boxGeometry args={[1, 1, 1]} />
                    <meshStandardMaterial color="#a16207" roughness={0.85} />
                </mesh>
            ))}
            {[-2.5, 0, 2.5].map((x) => (
                <group key={x} position={[x, 0, -6.5]}>
                    <mesh position={[0, 0.8, 0]} rotation={[-0.6, 0, 0]} castShadow>
                        <boxGeometry args={[2.2, 0.08, 1.4]} />
                        <meshStandardMaterial color="#1e3a8a" metalness={0.7} roughness={0.2} />
                    </mesh>
                    <mesh position={[0, 0.4, 0.2]}>
                        <cylinderGeometry args={[0.05, 0.05, 0.8, 6]} />
                        <meshStandardMaterial color="#334155" />
                    </mesh>
                </group>
            ))}
        </group>
    )
}

// ─── 7. SẠP CHỢ PHIÊN ──────────────────────────────────────────────────────

export function MarketStall({
    position,
    rotationY = 0,
    colorA = '#dc2626',
    colorB = '#fafaf9',
    goods = '#f59e0b',
}: {
    position: Vec3
    rotationY?: number
    colorA?: string
    colorB?: string
    goods?: string
}) {
    return (
        <group position={position} rotation={[0, rotationY, 0]}>
            <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
                <boxGeometry args={[2.6, 1, 1.2]} />
                <meshStandardMaterial color="#92400e" roughness={0.8} />
            </mesh>
            {[
                [-1.2, -0.5],
                [1.2, -0.5],
                [-1.2, 0.5],
                [1.2, 0.5],
            ].map(([x, z], i) => (
                <mesh key={i} position={[x, 1.25, z]} castShadow>
                    <cylinderGeometry args={[0.05, 0.05, 2.5, 6]} />
                    <meshStandardMaterial color="#451a03" />
                </mesh>
            ))}
            {/* Mái bạt sọc */}
            {Array.from({ length: 6 }).map((_, i) => (
                <mesh key={i} position={[-1.25 + i * 0.5 + 0.25, 2.55, 0.1]} rotation={[0.28, 0, 0]} castShadow>
                    <boxGeometry args={[0.5, 0.06, 1.7]} />
                    <meshStandardMaterial color={i % 2 === 0 ? colorA : colorB} roughness={0.7} />
                </mesh>
            ))}
            {/* Hàng hoá */}
            {[-0.8, -0.3, 0.2, 0.7].map((x, i) => (
                <mesh key={x} position={[x, 1.12, 0.2]} castShadow>
                    {i % 2 === 0 ? <sphereGeometry args={[0.16, 10, 10]} /> : <boxGeometry args={[0.28, 0.24, 0.28]} />}
                    <meshStandardMaterial color={i % 2 === 0 ? goods : '#16a34a'} roughness={0.6} />
                </mesh>
            ))}
        </group>
    )
}

// ─── 8. CỐI XAY GIÓ & ĐỒNG RUỘNG ───────────────────────────────────────────

export function Windmill({ position, rotationY = 0 }: { position: Vec3; rotationY?: number }) {
    const bladesRef = useRef<THREE.Group>(null)
    useFrame((_, delta) => {
        if (bladesRef.current) bladesRef.current.rotation.z += delta * 0.7
    })
    return (
        <group position={position} rotation={[0, rotationY, 0]}>
            <mesh position={[0, 4, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[1.4, 2.2, 8, 10]} />
                <meshStandardMaterial color="#fafaf9" roughness={0.7} />
            </mesh>
            <mesh position={[0, 8.8, 0]} castShadow>
                <coneGeometry args={[1.8, 1.8, 10]} />
                <meshStandardMaterial color="#7f1d1d" roughness={0.6} />
            </mesh>
            <mesh position={[0, 1.2, 2.05]}>
                <planeGeometry args={[1, 2]} />
                <meshStandardMaterial color="#78350f" />
            </mesh>
            <group ref={bladesRef} position={[0, 7.6, 1.7]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.3, 0.3, 0.5, 10]} />
                    <meshStandardMaterial color="#451a03" />
                </mesh>
                {[0, 1, 2, 3].map((i) => (
                    <group key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
                        <mesh position={[0, 2.6, 0.1]} castShadow>
                            <boxGeometry args={[0.12, 5, 0.08]} />
                            <meshStandardMaterial color="#451a03" />
                        </mesh>
                        <mesh position={[0.45, 2.9, 0.12]} castShadow>
                            <boxGeometry args={[0.8, 4, 0.04]} />
                            <meshStandardMaterial color="#f5f5f4" roughness={0.8} />
                        </mesh>
                    </group>
                ))}
            </group>
        </group>
    )
}

export function FarmField({ position, rows = 7, length = 10, crop = '#65a30d' }: { position: Vec3; rows?: number; length?: number; crop?: string }) {
    return (
        <group position={position}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
                <planeGeometry args={[length + 1, rows * 1.2 + 0.6]} />
                <meshStandardMaterial color="#78350f" roughness={1} />
            </mesh>
            {Array.from({ length: rows }).map((_, i) => (
                <mesh key={i} position={[0, 0.28, -((rows - 1) * 1.2) / 2 + i * 1.2]} castShadow>
                    <boxGeometry args={[length, 0.5, 0.55]} />
                    <meshStandardMaterial color={i % 3 === 0 ? '#ca8a04' : crop} roughness={0.85} />
                </mesh>
            ))}
            {/* Hàng rào gỗ */}
            {[-1, 1].map((s) => (
                <mesh key={s} position={[0, 0.45, s * ((rows * 1.2) / 2 + 0.6)]}>
                    <boxGeometry args={[length + 1.2, 0.12, 0.08]} />
                    <meshStandardMaterial color="#a16207" />
                </mesh>
            ))}
        </group>
    )
}

// ─── 9. CỔNG LÀNG ───────────────────────────────────────────────────────────

export function VillageGate({ position, rotationY = 0, lit, title }: { position: Vec3; rotationY?: number; lit: boolean; title: string }) {
    return (
        <group position={position} rotation={[0, rotationY, 0]}>
            {[-4, 4].map((z) => (
                <group key={z} position={[0, 0, z]}>
                    <mesh position={[0, 3.5, 0]} castShadow>
                        <boxGeometry args={[1.2, 7, 1.2]} />
                        <meshStandardMaterial color="#e7e5e4" roughness={0.6} />
                    </mesh>
                    <mesh position={[0, 7.3, 0]}>
                        <boxGeometry args={[1.5, 0.6, 1.5]} />
                        <meshStandardMaterial color="#b45309" />
                    </mesh>
                    <mesh position={[0, 7.9, 0]}>
                        <sphereGeometry args={[0.35, 12, 12]} />
                        <meshStandardMaterial color="#fde68a" emissive="#f59e0b" emissiveIntensity={lit ? 2.2 : 0.3} />
                    </mesh>
                </group>
            ))}
            <mesh position={[0, 6.4, 0]} castShadow>
                <boxGeometry args={[0.9, 1.3, 9.6]} />
                <meshStandardMaterial color="#1e3a8a" roughness={0.4} />
            </mesh>
            <Text
                position={[0.47, 6.4, 0]}
                rotation={[0, Math.PI / 2, 0]}
                fontSize={0.62}
                color="#fde68a"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.02}
                outlineColor="#0f172a"
            >
                {title}
            </Text>
            <Text
                position={[-0.47, 6.4, 0]}
                rotation={[0, -Math.PI / 2, 0]}
                fontSize={0.62}
                color="#fde68a"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.02}
                outlineColor="#0f172a"
            >
                {title}
            </Text>
        </group>
    )
}

// ─── 10. HỒ NƯỚC, CẦU VÒM, THUYỀN ──────────────────────────────────────────

function Boat({ base, color, phase }: { base: Vec3; color: string; phase: number }) {
    const ref = useRef<THREE.Group>(null)
    useFrame((state) => {
        if (!ref.current) return
        const t = state.clock.elapsedTime * 0.12 + phase
        ref.current.position.set(base[0] + Math.cos(t) * 3, 0.12 + Math.sin(t * 9) * 0.05, base[2] + Math.sin(t) * 2)
        ref.current.rotation.y = -t + Math.PI / 2
        ref.current.rotation.z = Math.sin(t * 7) * 0.05
    })
    return (
        <group ref={ref}>
            <mesh castShadow>
                <boxGeometry args={[1.8, 0.35, 0.8]} />
                <meshStandardMaterial color="#92400e" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.9, 0]}>
                <cylinderGeometry args={[0.03, 0.03, 1.6, 6]} />
                <meshStandardMaterial color="#451a03" />
            </mesh>
            <mesh position={[0.3, 0.95, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <coneGeometry args={[0.55, 1.2, 3]} />
                <meshStandardMaterial color={color} side={THREE.DoubleSide} />
            </mesh>
        </group>
    )
}

export function VillageLake({ position, lit }: { position: Vec3; lit: boolean }) {
    const rippleRefs = useRef<THREE.Mesh[]>([])

    useFrame((state) => {
        const t = state.clock.elapsedTime
        rippleRefs.current.forEach((m, i) => {
            if (!m) return
            const phase = (t * 0.25 + i / 3) % 1
            m.scale.setScalar(0.5 + phase * 2.4)
            const mat = m.material as THREE.MeshBasicMaterial
            mat.opacity = 0.35 * (1 - phase)
        })
    })

    const lilies = useMemo(() => {
        const rnd = seededRandom(77)
        return Array.from({ length: 22 }).map(() => {
            const a = rnd() * Math.PI * 2
            const r = 0.55 + rnd() * 0.35
            return { x: Math.cos(a) * 13 * r, z: Math.sin(a) * 8.5 * r, s: 0.3 + rnd() * 0.3, flower: rnd() > 0.6 }
        })
    }, [])

    return (
        <group position={position}>
            {/* Bờ đá */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} scale={[1.5, 1, 1]} receiveShadow>
                <circleGeometry args={[9.8, 64]} />
                <meshStandardMaterial color="#a8a29e" roughness={0.8} />
            </mesh>
            {/* Mặt nước */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} scale={[1.5, 1, 1]} receiveShadow>
                <circleGeometry args={[9, 64]} />
                <meshStandardMaterial
                    color={lit ? '#1e3a8a' : '#0ea5e9'}
                    roughness={0.08}
                    metalness={0.35}
                    transparent
                    opacity={0.9}
                    emissive="#0369a1"
                    emissiveIntensity={lit ? 0.25 : 0.08}
                />
            </mesh>
            {/* Gợn sóng */}
            {[0, 1, 2].map((i) => (
                <mesh
                    key={i}
                    ref={(el) => {
                        if (el) rippleRefs.current[i] = el
                    }}
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[-6 + i * 5, 0.08, -2 + i * 2]}
                >
                    <ringGeometry args={[0.9, 1, 40]} />
                    <meshBasicMaterial color="#e0f2fe" transparent opacity={0.3} depthWrite={false} />
                </mesh>
            ))}
            {/* Lá sen & hoa sen */}
            {lilies.map((l, i) => (
                <group key={i} position={[l.x, 0.075, l.z]}>
                    <mesh rotation={[-Math.PI / 2, 0, 0]}>
                        <circleGeometry args={[l.s, 12]} />
                        <meshStandardMaterial color="#15803d" />
                    </mesh>
                    {l.flower && (
                        <mesh position={[0, 0.08, 0]}>
                            <sphereGeometry args={[0.1, 8, 8]} />
                            <meshStandardMaterial color="#f9a8d4" emissive="#ec4899" emissiveIntensity={lit ? 0.8 : 0.1} />
                        </mesh>
                    )}
                </group>
            ))}
            {/* Cầu vòm gỗ đỏ băng ngang hồ (trục Bắc - Nam) */}
            <group>
                {Array.from({ length: 11 }).map((_, i) => {
                    const z = -9.5 + i * 1.9
                    const y = 0.2 + Math.sin((i / 10) * Math.PI) * 1.3
                    return (
                        <mesh key={i} position={[0, y, z]} castShadow receiveShadow>
                            <boxGeometry args={[3, 0.2, 2]} />
                            <meshStandardMaterial color="#9a3412" roughness={0.7} />
                        </mesh>
                    )
                })}
                {[-1.45, 1.45].map((x) =>
                    Array.from({ length: 11 }).map((_, i) => {
                        const z = -9.5 + i * 1.9
                        const y = 0.2 + Math.sin((i / 10) * Math.PI) * 1.3
                        return (
                            <mesh key={`${x}-${i}`} position={[x, y + 0.5, z]}>
                                <boxGeometry args={[0.1, 0.9, 0.1]} />
                                <meshStandardMaterial color="#b91c1c" />
                            </mesh>
                        )
                    })
                )}
            </group>
            {/* Thuyền buồm */}
            <Boat base={[-7, 0, 1]} color="#fafaf9" phase={0} />
            <Boat base={[7, 0, -1]} color="#fca5a5" phase={2.4} />
        </group>
    )
}

// ─── 11. BỒN HOA, HÀNG RÀO CÂY BỤI ─────────────────────────────────────────

export function FlowerBed({ position, radius = 1.4, palette = ['#f472b6', '#facc15', '#a78bfa', '#fb7185'] }: { position: Vec3; radius?: number; palette?: string[] }) {
    const flowers = useMemo(() => {
        const rnd = seededRandom(Math.floor(position[0] * 31 + position[2] * 17 + 1000))
        return Array.from({ length: 14 }).map(() => {
            const a = rnd() * Math.PI * 2
            const r = Math.sqrt(rnd()) * (radius - 0.25)
            return { x: Math.cos(a) * r, z: Math.sin(a) * r, c: palette[Math.floor(rnd() * palette.length)] }
        })
    }, [position, radius, palette])

    return (
        <group position={position}>
            <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[radius, radius + 0.1, 0.4, 24]} />
                <meshStandardMaterial color="#a8a29e" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.41, 0]}>
                <cylinderGeometry args={[radius - 0.1, radius - 0.1, 0.02, 24]} />
                <meshStandardMaterial color="#3f6212" />
            </mesh>
            {flowers.map((f, i) => (
                <mesh key={i} position={[f.x, 0.58, f.z]}>
                    <sphereGeometry args={[0.13, 8, 8]} />
                    <meshStandardMaterial color={f.c} roughness={0.5} />
                </mesh>
            ))}
        </group>
    )
}

export function Hedge({ position, length = 4, rotationY = 0 }: { position: Vec3; length?: number; rotationY?: number }) {
    return (
        <mesh position={[position[0], 0.45, position[2]]} rotation={[0, rotationY, 0]} castShadow receiveShadow>
            <boxGeometry args={[length, 0.9, 0.7]} />
            <meshStandardMaterial color="#166534" roughness={0.9} />
        </mesh>
    )
}

// ─── 12. KHINH KHÍ CẦU BAY QUANH LÀNG ──────────────────────────────────────

export function HotAirBalloon({
    radius,
    height,
    speed,
    phase,
    colorA,
    colorB,
    lit,
}: {
    radius: number
    height: number
    speed: number
    phase: number
    colorA: string
    colorB: string
    lit: boolean
}) {
    const ref = useRef<THREE.Group>(null)
    useFrame((state) => {
        if (!ref.current) return
        const t = state.clock.elapsedTime * speed + phase
        ref.current.position.set(Math.cos(t) * radius, height + Math.sin(t * 3) * 1.2, Math.sin(t) * radius)
        ref.current.rotation.y = -t
    })
    return (
        <group ref={ref}>
            <mesh scale={[1, 1.2, 1]} castShadow>
                <sphereGeometry args={[2.6, 20, 20]} />
                <meshStandardMaterial color={colorA} roughness={0.55} />
            </mesh>
            {[-0.9, 0, 0.9].map((y) => (
                <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 1]}>
                    <torusGeometry args={[Math.sqrt(Math.max(0.1, 2.62 * 2.62 - (y / 1.2) * (y / 1.2))), 0.12, 8, 40]} />
                    <meshStandardMaterial color={colorB} roughness={0.5} />
                </mesh>
            ))}
            <mesh position={[0, -3.4, 0]}>
                <cylinderGeometry args={[0.5, 1, 1, 12, 1, true]} />
                <meshStandardMaterial color={colorB} side={THREE.DoubleSide} />
            </mesh>
            {[
                [0.45, 0.45],
                [-0.45, 0.45],
                [0.45, -0.45],
                [-0.45, -0.45],
            ].map(([x, z], i) => (
                <mesh key={i} position={[x, -4.6, z]}>
                    <cylinderGeometry args={[0.02, 0.02, 1.6, 4]} />
                    <meshStandardMaterial color="#451a03" />
                </mesh>
            ))}
            <mesh position={[0, -5.7, 0]} castShadow>
                <boxGeometry args={[1.1, 0.8, 1.1]} />
                <meshStandardMaterial color="#92400e" roughness={0.8} />
            </mesh>
            <mesh position={[0, -4.1, 0]}>
                <coneGeometry args={[0.2, 0.6, 8]} />
                <meshStandardMaterial color="#fb923c" emissive="#f97316" emissiveIntensity={lit ? 3 : 1.2} />
            </mesh>
        </group>
    )
}

// ─── 13. MÂY TRÔI ───────────────────────────────────────────────────────────

export function DriftingClouds({ tint = '#ffffff', opacity = 0.92 }: { tint?: string; opacity?: number }) {
    const groupRef = useRef<THREE.Group>(null)
    const clouds = useMemo(() => {
        const rnd = seededRandom(9)
        return Array.from({ length: 11 }).map(() => ({
            x: -110 + rnd() * 220,
            y: 34 + rnd() * 14,
            z: -90 + rnd() * 180,
            s: 1.6 + rnd() * 2.2,
            puffs: Array.from({ length: 5 }).map((__, j) => ({
                x: (j - 2) * 2.1 + rnd() * 0.8,
                y: rnd() * 1.1,
                z: rnd() * 1.6 - 0.8,
                r: 1.6 + rnd() * 1.4,
            })),
        }))
    }, [])

    useFrame((_, delta) => {
        if (!groupRef.current) return
        groupRef.current.children.forEach((c) => {
            c.position.x += delta * 1.4
            if (c.position.x > 120) c.position.x = -120
        })
    })

    return (
        <group ref={groupRef}>
            {clouds.map((c, i) => (
                <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
                    {c.puffs.map((p, j) => (
                        <mesh key={j} position={[p.x, p.y, p.z]}>
                            <sphereGeometry args={[p.r, 12, 12]} />
                            <meshStandardMaterial color={tint} roughness={1} transparent opacity={opacity} depthWrite={false} />
                        </mesh>
                    ))}
                </group>
            ))}
        </group>
    )
}

// ─── 14. DÃY NÚI XA ─────────────────────────────────────────────────────────

export function MountainRange() {
    const peaks = useMemo(() => {
        const rnd = seededRandom(4242)
        return Array.from({ length: 22 }).map((_, i) => {
            const a = (i / 22) * Math.PI * 2 + rnd() * 0.2
            const r = 92 + rnd() * 22
            const h = 20 + rnd() * 26
            return {
                x: Math.cos(a) * r,
                z: Math.sin(a) * r,
                h,
                rad: 14 + rnd() * 12,
                color: rnd() > 0.5 ? '#475569' : '#57534e',
            }
        })
    }, [])

    return (
        <group>
            {peaks.map((p, i) => (
                <group key={i} position={[p.x, 0, p.z]}>
                    <mesh position={[0, p.h / 2, 0]}>
                        <coneGeometry args={[p.rad, p.h, 7]} />
                        <meshStandardMaterial color={p.color} roughness={0.95} flatShading />
                    </mesh>
                    <mesh position={[0, p.h * 0.86, 0]}>
                        <coneGeometry args={[p.rad * 0.28, p.h * 0.28, 7]} />
                        <meshStandardMaterial color="#f8fafc" roughness={0.8} flatShading />
                    </mesh>
                </group>
            ))}
        </group>
    )
}

// ─── 15. RỪNG CÂY INSTANCED (hiệu năng cao) ────────────────────────────────

export type ForestTree = {
    x: number
    z: number
    s: number
    kind: 'pine' | 'round'
    color: string
    rot: number
}

export function InstancedForest({ trees }: { trees: ForestTree[] }) {
    const pines = useMemo(() => trees.filter((t) => t.kind === 'pine'), [trees])
    const rounds = useMemo(() => trees.filter((t) => t.kind === 'round'), [trees])

    const trunkRef = useRef<THREE.InstancedMesh>(null)
    const pineLowRef = useRef<THREE.InstancedMesh>(null)
    const pineHighRef = useRef<THREE.InstancedMesh>(null)
    const roundRef = useRef<THREE.InstancedMesh>(null)
    const roundTopRef = useRef<THREE.InstancedMesh>(null)

    useLayoutEffect(() => {
        const o = new THREE.Object3D()
        const c = new THREE.Color()

        const place = (
            mesh: THREE.InstancedMesh | null,
            list: ForestTree[],
            y: number,
            dx: number,
            lighten: number
        ) => {
            if (!mesh) return
            list.forEach((t, i) => {
                o.position.set(t.x + dx * t.s, y * t.s, t.z)
                o.rotation.set(0, t.rot, 0)
                o.scale.setScalar(t.s)
                o.updateMatrix()
                mesh.setMatrixAt(i, o.matrix)
                c.set(t.color)
                if (lighten !== 0) c.offsetHSL(0, 0, lighten)
                mesh.setColorAt(i, c)
            })
            mesh.instanceMatrix.needsUpdate = true
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
        }

        if (trunkRef.current) {
            trees.forEach((t, i) => {
                o.position.set(t.x, 0.8 * t.s, t.z)
                o.rotation.set(0, t.rot, 0)
                o.scale.setScalar(t.s)
                o.updateMatrix()
                trunkRef.current!.setMatrixAt(i, o.matrix)
            })
            trunkRef.current.instanceMatrix.needsUpdate = true
        }
        place(pineLowRef.current, pines, 2.3, 0, 0)
        place(pineHighRef.current, pines, 3.7, 0, 0.05)
        place(roundRef.current, rounds, 2.8, 0, 0)
        place(roundTopRef.current, rounds, 3.7, 0.4, 0.06)
    }, [trees, pines, rounds])

    return (
        <group>
            {trees.length > 0 && (
                <instancedMesh ref={trunkRef} args={[undefined, undefined, trees.length]} castShadow frustumCulled={false}>
                    <cylinderGeometry args={[0.18, 0.28, 1.6, 6]} />
                    <meshStandardMaterial color="#5c3a21" roughness={0.9} />
                </instancedMesh>
            )}
            {pines.length > 0 && (
                <>
                    <instancedMesh ref={pineLowRef} args={[undefined, undefined, pines.length]} castShadow frustumCulled={false}>
                        <coneGeometry args={[1.6, 2.8, 7]} />
                        <meshStandardMaterial roughness={0.75} flatShading />
                    </instancedMesh>
                    <instancedMesh ref={pineHighRef} args={[undefined, undefined, pines.length]} castShadow frustumCulled={false}>
                        <coneGeometry args={[1.1, 2.3, 7]} />
                        <meshStandardMaterial roughness={0.75} flatShading />
                    </instancedMesh>
                </>
            )}
            {rounds.length > 0 && (
                <>
                    <instancedMesh ref={roundRef} args={[undefined, undefined, rounds.length]} castShadow frustumCulled={false}>
                        <icosahedronGeometry args={[1.55, 1]} />
                        <meshStandardMaterial roughness={0.8} flatShading />
                    </instancedMesh>
                    <instancedMesh ref={roundTopRef} args={[undefined, undefined, rounds.length]} castShadow frustumCulled={false}>
                        <icosahedronGeometry args={[1.0, 1]} />
                        <meshStandardMaterial roughness={0.8} flatShading />
                    </instancedMesh>
                </>
            )}
        </group>
    )
}

/** Đá tảng rải rác (instanced) */
export function InstancedRocks({ rocks }: { rocks: { x: number; z: number; s: number; rot: number }[] }) {
    const ref = useRef<THREE.InstancedMesh>(null)
    useLayoutEffect(() => {
        if (!ref.current) return
        const o = new THREE.Object3D()
        rocks.forEach((r, i) => {
            o.position.set(r.x, r.s * 0.35, r.z)
            o.rotation.set(r.rot, r.rot * 2, 0)
            o.scale.set(r.s, r.s * 0.7, r.s)
            o.updateMatrix()
            ref.current!.setMatrixAt(i, o.matrix)
        })
        ref.current.instanceMatrix.needsUpdate = true
    }, [rocks])
    if (rocks.length === 0) return null
    return (
        <instancedMesh ref={ref} args={[undefined, undefined, rocks.length]} castShadow receiveShadow frustumCulled={false}>
            <dodecahedronGeometry args={[0.8, 0]} />
            <meshStandardMaterial color="#78716c" roughness={0.95} flatShading />
        </instancedMesh>
    )
}

// ─── 16. BIỂN TÊN PHÂN KHU (luôn quay về camera) ───────────────────────────

export function DistrictLabel({
    position,
    title,
    subtitle,
    color,
}: {
    position: Vec3
    title: string
    subtitle?: string
    color: string
}) {
    const ref = useRef<THREE.Group>(null)
    const baseY = position[1]
    useFrame((state) => {
        if (ref.current) ref.current.position.y = baseY + Math.sin(state.clock.elapsedTime * 1.2 + position[0]) * 0.18
    })
    return (
        <group ref={ref} position={position}>
            <Billboard>
                <Text fontSize={1.05} color={color} anchorX="center" anchorY="middle" outlineWidth={0.06} outlineColor="#09090b">
                    {title}
                </Text>
                {subtitle && (
                    <Text
                        position={[0, -0.95, 0]}
                        fontSize={0.48}
                        color="#e4e4e7"
                        anchorX="center"
                        anchorY="middle"
                        outlineWidth={0.04}
                        outlineColor="#09090b"
                    >
                        {subtitle}
                    </Text>
                )}
            </Billboard>
        </group>
    )
}

