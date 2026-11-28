'use client'

import React, { useMemo } from 'react'
import { Sparkles } from '@react-three/drei'
import Tree from './Tree'
import ParkBench from './ParkBench'
import PicnicTable from './PicnicTable'
import Fountain from './Fountain'
import Gazebo from './Gazebo'
import CoffeeKiosk from './CoffeeKiosk'
import House from '../iot/House'
import Agent from '../agents/Agent'
import { Agent as AgentType } from '@/lib/api'
import { AgentAction } from '../agents/Agent'
import type { Obstacle2D } from '@/lib/rl/rlNavigator'
import {
    VillageTerrain,
    VillageLamp,
    ClockTower,
    GrandLibrary,
    ToolDojo,
    Workshop,
    MarketStall,
    Windmill,
    FarmField,
    VillageGate,
    VillageLake,
    FlowerBed,
    Hedge,
    HotAirBalloon,
    DriftingClouds,
    MountainRange,
    InstancedForest,
    InstancedRocks,
    DistrictLabel,
    ForestTree,
    seededRandom,
    TimeOfDay,
} from './village/VillageProps'

type Vec3 = [number, number, number]

type OutdoorParkProps = {
    agents?: AgentType[]
    selectedAgentId?: string | null
    onSelectAgent?: (id: string) => void
    onFloorClick?: (point: Vec3) => void
    agentTargetActions?: Record<string, { action: AgentAction; targetPos: Vec3 }>
    timeOfDay?: TimeOfDay
}

// ─── BỐ CỤC ĐẠI LÀNG TÁC TỬ AI (quy mô ~100m x 100m, gấp 3 lần bản cũ) ─────

/** Các điểm sinh hoạt chính của Làng (đặt trước mặt công trình, hướng về quảng trường) */
export const VILLAGE_ACTION_SPOTS = {
    town_square: [0, 0, 7.5] as Vec3,
    tool_academy: [-24, 0, 24] as Vec3,
    wisdom_library: [24, 0, 24] as Vec3,
    residences: [27, 0, -27.5] as Vec3,
    coffee_kiosk: [0, 0, -34] as Vec3,
    workshop: [-24, 0, -24] as Vec3,
}

/** Bí danh tương thích ngược với các module cũ */
export const OUTDOOR_ACTION_SPOTS = {
    fountain: VILLAGE_ACTION_SPOTS.town_square,
    bench1: [-7, 0, -6] as Vec3,
    bench2: [7, 0, -6] as Vec3,
    bench3: [-7, 0, 6] as Vec3,
    picnic1: [-5, 0, -41] as Vec3,
    picnic2: [5, 0, -41] as Vec3,
    gazebo: VILLAGE_ACTION_SPOTS.wisdom_library,
    coffee: VILLAGE_ACTION_SPOTS.coffee_kiosk,
    roam: [0, 0, 0] as Vec3,
}

/** Siêu dữ liệu phân khu (dùng cho minimap và HUD) */
export const VILLAGE_DISTRICTS: {
    id: keyof typeof VILLAGE_ACTION_SPOTS
    name: string
    color: string
    center: Vec3
    radius: number
}[] = [
    { id: 'town_square', name: 'Quảng trường', color: '#38bdf8', center: [0, 0, 0], radius: 11 },
    { id: 'residences', name: 'Khu dân cư', color: '#f472b6', center: [34, 0, -33], radius: 13 },
    { id: 'wisdom_library', name: 'Thư viện Ký ức', color: '#c084fc', center: [32, 0, 32], radius: 10 },
    { id: 'tool_academy', name: 'Học viện Tool', color: '#34d399', center: [-32, 0, 32], radius: 10 },
    { id: 'workshop', name: 'Xưởng thực nghiệm', color: '#fb923c', center: [-32, 0, -32], radius: 9 },
    { id: 'coffee_kiosk', name: 'Chợ & Quán trà', color: '#fbbf24', center: [0, 0, -34], radius: 10 },
]

/** Toạ độ nhà ở trong khu dân cư */
const HOUSES: { pos: Vec3; rot: number; color: string; roof: string }[] = [
    { pos: [34, 0, -22.5], rot: Math.PI, color: '#fef3c7', roof: '#b91c1c' },
    { pos: [42, 0, -22.5], rot: Math.PI, color: '#f1f5f9', roof: '#1e3a8a' },
    { pos: [26, 0, -32.5], rot: 0, color: '#ecfccb', roof: '#166534' },
    { pos: [34, 0, -32.5], rot: 0, color: '#fae8ff', roof: '#7e22ce' },
    { pos: [42, 0, -32.5], rot: 0, color: '#ffedd5', roof: '#c2410c' },
    { pos: [26, 0, -42.5], rot: 0, color: '#e0f2fe', roof: '#0369a1' },
    { pos: [34, 0, -42.5], rot: 0, color: '#fef9c3', roof: '#a16207' },
]

/** Danh sách chướng ngại vật cho thuật toán né tránh RL của Agent trong Làng */
export const VILLAGE_OBSTACLES: Obstacle2D[] = [
    { x: 0, z: 0, radius: 3.2, type: 'fountain' },
    { x: 12, z: -5, radius: 2.6, type: 'clock_tower' },
    { x: 32, z: 32, radius: 8.5, type: 'library' },
    { x: -32, z: 32, radius: 7.5, type: 'dojo' },
    { x: -32, z: -32, radius: 7.5, type: 'workshop' },
    { x: 0, z: -44, radius: 3.2, type: 'tea_house' },
    { x: -38, z: -12, radius: 2.6, type: 'windmill' },
    { x: -8, z: 36, radius: 8, type: 'lake' },
    { x: 8, z: 36, radius: 8, type: 'lake' },
    ...HOUSES.map((h) => ({ x: h.pos[0], z: h.pos[2], radius: 2.6, type: 'house' })),
]

/** Điểm xuất phát mặc định của cư dân */
const DEFAULT_SLOTS: Vec3[] = [
    VILLAGE_ACTION_SPOTS.town_square,
    VILLAGE_ACTION_SPOTS.tool_academy,
    VILLAGE_ACTION_SPOTS.wisdom_library,
    VILLAGE_ACTION_SPOTS.residences,
    VILLAGE_ACTION_SPOTS.coffee_kiosk,
    VILLAGE_ACTION_SPOTS.workshop,
]

/** Lộ trình dạo chơi theo đường vành đai */
function buildVillageWalkPath(base: Vec3, index: number): Vec3[] {
    const start = (index * Math.PI) / 3
    const ring: Vec3[] = Array.from({ length: 4 }).map((_, i) => {
        const a = start + (i * Math.PI) / 2 + Math.PI / 8
        return [Math.cos(a) * 20, 0, Math.sin(a) * 20]
    })
    return [base, ...ring]
}

/** Kiểm tra điểm có nằm trên đường, hồ hay công trình không (để trồng cây hợp lệ) */
function isBlocked(x: number, z: number): boolean {
    if (Math.abs(z) < 4.5 && Math.abs(x) < 52) return true // đường Đông - Tây
    if (Math.abs(x) < 4.5 && z < 28 && z > -52) return true // đường Bắc - Nam
    const r = Math.hypot(x, z)
    if (r > 16.5 && r < 23.5) return true // đường vành đai
    if (r < 12) return true // quảng trường
    if ((x / 15) ** 2 + ((z - 36) / 10.5) ** 2 < 1) return true // hồ
    for (const o of VILLAGE_OBSTACLES) {
        if (Math.hypot(x - o.x, z - o.z) < o.radius + 2.2) return true
    }
    return false
}

function generateForest(): ForestTree[] {
    const rnd = seededRandom(20261102)
    const greens = ['#166534', '#15803d', '#14532d', '#3f6212', '#1a6b3c']
    const trees: ForestTree[] = []

    const push = (x: number, z: number, kind: ForestTree['kind'], color: string, s: number) => {
        if (isBlocked(x, z)) return
        trees.push({ x, z, s, kind, color, rot: rnd() * Math.PI * 2 })
    }

    // Rừng vành đai bao quanh làng
    for (let i = 0; i < 260; i++) {
        const a = rnd() * Math.PI * 2
        const r = 56 + rnd() * 22
        const x = Math.cos(a) * r
        const z = Math.sin(a) * r
        const pine = rnd() > 0.45
        push(x, z, pine ? 'pine' : 'round', greens[Math.floor(rnd() * greens.length)], 1 + rnd() * 0.9)
    }

    const grove = (x0: number, x1: number, z0: number, z1: number, n: number, kind: ForestTree['kind'], palette: string[]) => {
        for (let i = 0; i < n; i++) {
            const x = x0 + rnd() * (x1 - x0)
            const z = z0 + rnd() * (z1 - z0)
            push(x, z, kind, palette[Math.floor(rnd() * palette.length)], 0.85 + rnd() * 0.5)
        }
    }

    // Rừng hoa anh đào quanh Thư viện Ký ức
    grove(44, 53, 14, 46, 18, 'round', ['#f9a8d4', '#f472b6', '#fbcfe8'])
    grove(18, 46, 44, 53, 16, 'round', ['#f9a8d4', '#f472b6', '#fbcfe8'])
    // Rừng lá phong mùa thu quanh Học viện
    grove(-53, -44, 14, 46, 18, 'round', ['#ea580c', '#f59e0b', '#b91c1c', '#d97706'])
    grove(-46, -18, 44, 53, 16, 'round', ['#ea580c', '#f59e0b', '#b91c1c'])
    // Rừng thông phía sau khu dân cư
    grove(20, 50, -54, -47, 18, 'pine', ['#14532d', '#166534'])
    grove(47, 54, -46, -14, 14, 'pine', ['#14532d', '#166534'])
    // Rừng hỗn giao quanh Xưởng
    grove(-54, -44, -46, -22, 14, 'round', greens)
    grove(-46, -18, -54, -46, 14, 'pine', greens)

    // Đại lộ cây xanh dọc hai bên đường vành đai
    for (let deg = 0; deg < 360; deg += 15) {
        if (deg % 45 === 0) continue
        const a = (deg * Math.PI) / 180
        const sakura = deg % 30 === 0
        const x = Math.cos(a) * 25
        const z = Math.sin(a) * 25
        if (!isBlocked(x, z)) trees.push({ x, z, s: 0.9, kind: 'round', color: sakura ? '#f9a8d4' : '#16a34a', rot: a })
    }
    return trees
}

function generateRocks() {
    const rnd = seededRandom(555)
    const rocks: { x: number; z: number; s: number; rot: number }[] = []
    for (let i = 0; i < 70; i++) {
        const a = rnd() * Math.PI * 2
        const r = 30 + rnd() * 45
        const x = Math.cos(a) * r
        const z = Math.sin(a) * r
        if (isBlocked(x, z)) continue
        rocks.push({ x, z, s: 0.5 + rnd() * 1.3, rot: rnd() * Math.PI })
    }
    return rocks
}

export default function OutdoorPark({
    agents = [],
    selectedAgentId,
    onSelectAgent,
    onFloorClick,
    agentTargetActions = {},
    timeOfDay = 'day',
}: OutdoorParkProps) {
    const lit = timeOfDay !== 'day'
    const isNight = timeOfDay === 'night'
    const forest = useMemo(() => generateForest(), [])
    const rocks = useMemo(() => generateRocks(), [])

    // Đèn quảng trường (8 cột, xen kẽ đèn có ánh sáng thật để tối ưu hiệu năng)
    const plazaLamps: { pos: Vec3; light: boolean }[] = Array.from({ length: 8 }).map((_, i) => {
        const a = Math.PI / 8 + (i * Math.PI) / 4
        return { pos: [Math.cos(a) * 10.3, 0, Math.sin(a) * 10.3] as Vec3, light: i % 2 === 0 }
    })

    // Đèn dọc trục đường chính
    const roadLamps: { pos: Vec3; light: boolean }[] = [
        ...[-44, -34, -27, 27, 34, 44].map((x, i) => ({ pos: [x, 0, i % 2 === 0 ? 3.3 : -3.3] as Vec3, light: false })),
        ...[-27, -33, -39].map((z, i) => ({ pos: [i % 2 === 0 ? 3.3 : -3.3, 0, z] as Vec3, light: i === 1 })),
        ...[14, 24].map((z) => ({ pos: [3.3, 0, z] as Vec3, light: false })),
        { pos: [22, 0, -27.5], light: true },
        { pos: [22, 0, -37.5], light: false },
        { pos: [-22, 0, 20], light: true },
        { pos: [-22, 0, -20], light: false },
    ]

    return (
        <group>
            {/* ═══ ĐỊA HÌNH & CẢNH QUAN XA ═══ */}
            <VillageTerrain onFloorClick={onFloorClick} />
            <MountainRange />
            {!isNight && <DriftingClouds tint={timeOfDay === 'sunset' ? '#fed7aa' : '#ffffff'} />}
            <InstancedForest trees={forest} />
            <InstancedRocks rocks={rocks} />

            {/* Khinh khí cầu bay vòng quanh làng */}
            <HotAirBalloon radius={38} height={26} speed={0.05} phase={0} colorA="#ef4444" colorB="#fde68a" lit={lit} />
            <HotAirBalloon radius={30} height={32} speed={0.04} phase={2.6} colorA="#3b82f6" colorB="#f8fafc" lit={lit} />
            <HotAirBalloon radius={46} height={22} speed={0.035} phase={4.4} colorA="#a855f7" colorB="#fbcfe8" lit={lit} />

            {/* ═══ 1. QUẢNG TRƯỜNG TRUNG TÂM ═══ */}
            <group scale={1.7}>
                <Fountain position={[0, 0, 0]} />
            </group>
            {[0, 1, 2, 3].map((i) => {
                const a = (i * Math.PI) / 2 + Math.PI / 4
                return (
                    <group key={i} position={[Math.cos(a) * 7.6, 0, Math.sin(a) * 7.6]} rotation={[0, -a - Math.PI / 2, 0]}>
                        <ParkBench position={[0, 0, 0]} rotation={[0, 0, 0]} />
                    </group>
                )
            })}
            {[0, 1, 2, 3].map((i) => {
                const a = (i * Math.PI) / 2
                return <FlowerBed key={i} position={[Math.cos(a) * 8.2 + (i % 2 === 0 ? 0 : 0), 0, Math.sin(a) * 8.2]} radius={1.3} />
            })}
            {plazaLamps.map((l, i) => (
                <VillageLamp key={`pl-${i}`} position={l.pos} lit={lit} withLight={l.light} height={4} />
            ))}
            <ClockTower position={[12, 0, -5]} lit={lit} />
            <DistrictLabel position={[0, 9, 0]} title="QUẢNG TRƯỜNG LÀNG" subtitle="Giao lưu - Chia sẻ tri thức" color="#38bdf8" />

            {/* ═══ 2. KHU DÂN CƯ & PHẢN TƯ (Đông Bắc) ═══ */}
            {/* Các ngõ nội khu */}
            {[-27.5, -37.5].map((z) => (
                <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[35, 0.021, z]} receiveShadow>
                    <planeGeometry args={[26, 3]} />
                    <meshStandardMaterial color="#d6d3d1" roughness={0.75} />
                </mesh>
            ))}
            {HOUSES.map((h, i) => (
                <group key={i}>
                    <House position={h.pos} color={h.color} roofColor={h.roof} windowGlow={lit} rotation={[0, h.rot, 0]} />
                    <Hedge position={[h.pos[0] - 2.4, 0, h.pos[2] + (h.rot === 0 ? 2.6 : -2.6)]} length={1.4} />
                    <Hedge position={[h.pos[0] + 2.4, 0, h.pos[2] + (h.rot === 0 ? 2.6 : -2.6)]} length={1.4} />
                    <FlowerBed
                        position={[h.pos[0] + 2.6, 0, h.pos[2] + (h.rot === 0 ? -0.5 : 0.5)]}
                        radius={0.6}
                        palette={['#fb7185', '#fde047', '#c4b5fd']}
                    />
                </group>
            ))}
            <ParkBench position={[30, 0, -27.5]} rotation={[0, 0, 0]} />
            <ParkBench position={[38, 0, -37.5]} rotation={[0, Math.PI, 0]} />
            <DistrictLabel position={[34, 8.5, -32]} title="KHU DÂN CƯ" subtitle="Nghỉ ngơi - Nén ký ức ban đêm" color="#f472b6" />

            {/* ═══ 3. ĐẠI THƯ VIỆN KÝ ỨC (Đông Nam) ═══ */}
            <GrandLibrary position={[32, 0, 32]} rotationY={(-3 * Math.PI) / 4} lit={lit} />
            <Sparkles
                position={[32, 6, 32]}
                count={60}
                scale={[16, 10, 16]}
                size={4}
                speed={0.4}
                color="#e879f9"
                opacity={0.8}
            />
            <DistrictLabel position={[32, 15.5, 32]} title="ĐẠI THƯ VIỆN KÝ ỨC" subtitle="Long-term Memory Archive" color="#c084fc" />

            {/* ═══ 4. HỌC VIỆN KỸ NĂNG & VÕ ĐƯỜNG TOOL (Tây Nam) ═══ */}
            <ToolDojo position={[-32, 0, 32]} rotationY={(3 * Math.PI) / 4} lit={lit} />
            <DistrictLabel position={[-32, 13.5, 32]} title="HỌC VIỆN KỸ NĂNG" subtitle="Tool Practice Dojo" color="#34d399" />

            {/* ═══ 5. XƯỞNG THỰC NGHIỆM (Tây Bắc) ═══ */}
            <Workshop position={[-32, 0, -32]} rotationY={Math.PI / 4} lit={lit} />
            <DistrictLabel position={[-32, 11, -32]} title="XƯỞNG THỰC NGHIỆM" subtitle="Data Lab - Phân tích" color="#fb923c" />

            {/* ═══ 6. PHỐ CHỢ & QUÁN TRÀ (Bắc) ═══ */}
            {[
                { z: -24, a: '#dc2626', g: '#f59e0b' },
                { z: -30, a: '#2563eb', g: '#e11d48' },
                { z: -36, a: '#16a34a', g: '#facc15' },
            ].map((s, i) => (
                <React.Fragment key={i}>
                    <MarketStall position={[-5.6, 0, s.z]} rotationY={Math.PI / 2} colorA={s.a} goods={s.g} />
                    <MarketStall position={[5.6, 0, s.z]} rotationY={-Math.PI / 2} colorA={i === 1 ? '#a855f7' : '#ea580c'} goods={s.g} />
                </React.Fragment>
            ))}
            <group position={[0, 0, -45]} scale={1.5}>
                <CoffeeKiosk position={[0, 0, 0]} />
            </group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.026, -41]} receiveShadow>
                <planeGeometry args={[14, 5]} />
                <meshStandardMaterial color="#78350f" roughness={0.75} />
            </mesh>
            <PicnicTable position={[-5, 0, -41]} umbrellaColor="#f59e0b" />
            <PicnicTable position={[5, 0, -41]} umbrellaColor="#ef4444" />
            <DistrictLabel position={[0, 9, -38]} title="PHỐ CHỢ & QUÁN TRÀ" subtitle="Trao đổi kinh nghiệm" color="#fbbf24" />

            {/* ═══ 7. ĐỒNG RUỘNG & CỐI XAY GIÓ (Tây) ═══ */}
            <Windmill position={[-38, 0, -12]} rotationY={Math.PI / 2} />
            <FarmField position={[-38, 0, 11]} rows={7} length={11} />
            <FarmField position={[-24, 0, 10]} rows={5} length={6} crop="#84cc16" />

            {/* ═══ 8. HỒ GƯƠNG & CẦU VÒM (Nam) ═══ */}
            <VillageLake position={[0, 0, 36]} lit={lit} />
            <group position={[19, 0, 36]}>
                <Gazebo position={[0, 0, 0]} />
            </group>
            <ParkBench position={[-16, 0, 30]} rotation={[0, Math.PI / 4, 0]} />
            <ParkBench position={[-16, 0, 42]} rotation={[0, (3 * Math.PI) / 4, 0]} />
            <DistrictLabel position={[0, 6.5, 36]} title="HỒ GƯƠNG" color="#7dd3fc" />

            {/* ═══ 9. CỔNG LÀNG ═══ */}
            <VillageGate position={[50, 0, 0]} lit={lit} title="AUTONOMOUS AI VILLAGE" />
            <VillageGate position={[-50, 0, 0]} lit={lit} title="AUTONOMOUS AI VILLAGE" />

            {/* ═══ 10. HỆ THỐNG ĐÈN ĐƯỜNG ═══ */}
            {roadLamps.map((l, i) => (
                <VillageLamp key={`rl-${i}`} position={l.pos} lit={lit} withLight={l.light} />
            ))}

            {/* Cây cảnh có collider gần khu trung tâm */}
            <Tree position={[-14, 0, 8]} scale={1.1} type="sakura" />
            <Tree position={[-14, 0, -8]} scale={1.1} type="oak" />
            <Tree position={[14, 0, 9]} scale={1.1} type="sakura" />

            {/* Đom đóm ban đêm & cánh hoa bay ban ngày */}
            {lit ? (
                <>
                    <Sparkles position={[0, 1.5, 36]} count={90} scale={[30, 3, 20]} size={5} speed={0.35} color="#fde68a" />
                    <Sparkles position={[0, 2, 0]} count={50} scale={[24, 4, 24]} size={4} speed={0.3} color="#fef08a" />
                    <Sparkles position={[-32, 2, 32]} count={40} scale={[20, 4, 20]} size={4} speed={0.3} color="#86efac" />
                </>
            ) : (
                <Sparkles position={[44, 3, 34]} count={50} scale={[16, 6, 30]} size={3} speed={0.5} color="#fbcfe8" />
            )}

            {/* ═══ CƯ DÂN AI ═══ */}
            {agents.map((agent, index) => {
                const base = DEFAULT_SLOTS[index % DEFAULT_SLOTS.length]
                const ring = Math.floor(index / DEFAULT_SLOTS.length)
                const spawn: Vec3 = [base[0] + ring * 1.4, 0, base[2] + ring * 1.1]
                const override = agentTargetActions[agent.id]
                return (
                    <Agent
                        key={agent.id}
                        id={agent.id}
                        position={spawn}
                        deskPosition={spawn}
                        color={agent.color}
                        name={agent.name}
                        status={agent.status}
                        speech={agent.speech}
                        speed={2.6}
                        waypoints={buildVillageWalkPath(spawn, index)}
                        targetAction={override?.action}
                        targetPosition={override?.targetPos}
                        isSelected={selectedAgentId === agent.id}
                        onSelect={() => onSelectAgent?.(agent.id)}
                        ownerName={agent.ownerName}
                        form={agent.form}
                        navMode="direct"
                        navObstacles={VILLAGE_OBSTACLES}
                    />
                )
            })}
        </group>
    )
}
