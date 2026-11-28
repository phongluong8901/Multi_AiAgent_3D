'use client'

import React, { useMemo } from 'react'
import { Text } from '@react-three/drei'
import Floor from './Floor'
import Wall from './Wall'
import Desk from './Desk'
import Chair from './Chair'
import Computer from './Computer'
import Plant from './Plant'
import Cabinet from './Cabinet'
import RoundTable from './RoundTable'
import Sofa from './Sofa'
import PingPong from './PingPong'
import ServerRack from './ServerRack'
import Agent from '../agents/Agent'
import { Agent as AgentType } from '@/lib/api'
import { AgentAction } from '../agents/Agent'

type RoomProps = {
    agents?: AgentType[]
    selectedAgentId?: string | null
    onSelectAgent?: (id: string) => void
    onFloorClick?: (point: [number, number, number]) => void
    agentTargetActions?: Record<string, { action: AgentAction; targetPos: [number, number, number] }>
}

/** 1. Vị trí bàn làm việc PHÒNG QUẢN LÝ & ĐIỀU HÀNH (Executive Management) */
export const MANAGEMENT_DESK_SLOTS: [number, number, number][] = [
    [-9.5, 0, -8.0],   // Bàn Giám đốc / Lead Trưởng phòng
    [-5.5, 0, -8.0],   // Bàn Phó phòng / Thư ký điều phối
    [-9.5, 0, -4.0],   // Bàn Quản lý dự án PM
]

/** Vị trí xuất phát (spawn) ban đầu của Agent trong phòng Quản lý: sàn thoáng, không chạm bàn ghế */
export const MANAGEMENT_SPAWN_SLOTS: [number, number, number][] = [
    [-7.5, 0.1, -5.8],   // Lối đi thoáng trung tâm phòng Quản lý
    [-5.5, 0.1, -5.8],   // Lối đi trước bàn Điều phối
    [-7.5, 0.1, -3.2],   // Lối đi giữa bàn PM và bàn họp nhỏ
]

/** 2. Vị trí bàn làm việc PHÒNG NGHIÊN CỨU & TÌM KIẾM (Research & Search Lab) */
export const RESEARCH_DESK_SLOTS: [number, number, number][] = [
    [5.5, 0, -8.0],    // Chuyên viên Nghiên cứu AI / Machine Learning
    [9.5, 0, -8.0],    // Kỹ sư Thu thập & Web Crawler
    [5.5, 0, -4.0],    // Chuyên gia Tìm kiếm & Knowledge Graph
    [9.5, 0, -4.0],    // Chuyên viên Tổng hợp tri thức
]

/** Vị trí xuất phát (spawn) ban đầu của Agent trong phòng Nghiên cứu */
export const RESEARCH_SPAWN_SLOTS: [number, number, number][] = [
    [5.5, 0.1, -5.8],    // Hành lang thoáng giữa 2 hàng bàn Nghiên cứu
    [9.5, 0.1, -5.8],    // Hành lang thoáng gần server rack
    [5.5, 0.1, -2.0],    // Lối đi trước cửa phòng Nghiên cứu
    [9.5, 0.1, -2.0],    // Lối đi thoáng phía Nam
]

/** 3. Vị trí bàn làm việc PHÒNG PHÂN TÍCH & ĐÁNH GIÁ (Data & Analytics Dept) */
export const ANALYTICS_DESK_SLOTS: [number, number, number][] = [
    [5.5, 0, 4.0],     // Chuyên viên Phân tích Dữ liệu Data Analyst
    [9.5, 0, 4.0],     // Kỹ sư Đo lường & Metric Evaluation
    [5.5, 0, 8.0],     // Chuyên viên Đánh giá chất lượng QA & KCS
    [9.5, 0, 8.0],     // Chuyên gia Thẩm định Rủi ro & Audit
]

/** Vị trí xuất phát (spawn) ban đầu của Agent trong phòng Phân tích */
export const ANALYTICS_SPAWN_SLOTS: [number, number, number][] = [
    [5.5, 0.1, 2.0],     // Lối đi thoáng trước cửa phòng Phân tích
    [9.5, 0.1, 2.0],     // Lối đi thoáng phía Bắc
    [5.5, 0.1, 5.8],     // Hành lang thoáng giữa 2 hàng bàn Phân tích
    [9.5, 0.1, 5.8],     // Hành lang thoáng trước bảng Dashboard KPI
]

/** Danh sách tổng hợp tất cả các bàn trong toàn bộ văn phòng */
export const OFFICE_DESK_SLOTS: [number, number, number][] = [
    ...MANAGEMENT_DESK_SLOTS,
    ...RESEARCH_DESK_SLOTS,
    ...ANALYTICS_DESK_SLOTS,
]

/** Vị trí làm việc tại ghế ngồi trước bàn (không trùng tâm bàn để tránh va chạm cuboid của Desk) */
export function getDeskSeatPosition(desk: [number, number, number]): [number, number, number] {
    const [x, , z] = desk
    const isNorth = z < 0
    return [x, 0, z + (isNorth ? 1.05 : -1.05)]
}

/** Các điểm đích đến tương ứng với hành động trong văn phòng */
export const OFFICE_ACTION_SPOTS = {
    sofa: [-9.0, 0, 4.5] as [number, number, number],
    roundtable: [-6.0, 0, 4.0] as [number, number, number],
    pingpong: [-8.5, 0, 8.5] as [number, number, number],
    coffee: [-3.5, 0, 1.5] as [number, number, number],
    roam: [0, 0, 0] as [number, number, number],
    management_office: [-7.5, 0, -6.0] as [number, number, number],
    research_lab: [7.5, 0, -6.0] as [number, number, number],
    analytics_dept: [7.5, 0, 6.0] as [number, number, number],
}

export type OfficeDepartment = 'management' | 'research' | 'analytics'

/** Phân loại phòng ban phù hợp theo vai trò, tên hoặc prompt của Agent */
export function detectAgentDepartment(agent: AgentType): OfficeDepartment {
    const raw = `${agent.name || ''} ${agent.id || ''}`.toLowerCase()

    // 1. Quản lý, điều hành, lãnh đạo
    if (
        raw.includes('manage') ||
        raw.includes('lead') ||
        raw.includes('boss') ||
        raw.includes('admin') ||
        raw.includes('director') ||
        raw.includes('quản lý') ||
        raw.includes('điều hành') ||
        raw.includes('chỉ đạo') ||
        raw.includes('groot') ||
        raw.includes('pm')
    ) {
        return 'management'
    }

    // 2. Nghiên cứu, tìm kiếm, crawler, duck
    if (
        raw.includes('search') ||
        raw.includes('research') ||
        raw.includes('find') ||
        raw.includes('crawl') ||
        raw.includes('duck') ||
        raw.includes('vit') ||
        raw.includes('summari') ||
        raw.includes('tổng hợp') ||
        raw.includes('nghiên cứu') ||
        raw.includes('tìm kiếm') ||
        raw.includes('tra cứu') ||
        raw.includes('thư viện')
    ) {
        return 'research'
    }

    // 3. Phân tích, đánh giá, kiểm thử, QA, KCS
    if (
        raw.includes('analy') ||
        raw.includes('eval') ||
        raw.includes('judge') ||
        raw.includes('test') ||
        raw.includes('qa') ||
        raw.includes('kcs') ||
        raw.includes('phân tích') ||
        raw.includes('đánh giá') ||
        raw.includes('thẩm định') ||
        raw.includes('báo cáo') ||
        raw.includes('metric') ||
        raw.includes('amr')
    ) {
        return 'analytics'
    }

    // Mặc định
    return 'research'
}

/** Đường đi tuần tra hành lang xuất phát từ vị trí spawn thoáng đãng */
function buildWalkPath(spawn: [number, number, number]): [number, number, number][] {
    const [x, , z] = spawn
    const isEast = x > 0
    const isNorth = z < 0

    return [
        [x, 0, z],
        [isEast ? 4.0 : -4.0, 0, isNorth ? -3.0 : 3.0],
        [0, 0, isNorth ? -3.0 : 3.0],
        [0, 0, 0],
        [0, 0, isNorth ? -3.0 : 3.0],
        [isEast ? 4.0 : -4.0, 0, isNorth ? -3.0 : 3.0],
        [x, 0, z],
    ]
}

/** Vách kính cường lực trong suốt hiện đại ngăn các phòng */
function GlassPartition({
    position,
    size,
}: {
    position: [number, number, number]
    size: [number, number, number]
}) {
    return (
        <group position={position}>
            {/* Khung nhôm titan đen mờ */}
            <mesh castShadow>
                <boxGeometry args={[size[0], size[1], size[2]]} />
                <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Tấm kính cường lực xanh ngọc trong suốt */}
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[size[0] - 0.04, size[1] - 0.04, size[2] + 0.02]} />
                <meshPhysicalMaterial
                    color="#bae6fd"
                    transparent
                    opacity={0.3}
                    roughness={0.08}
                    metalness={0.1}
                    transmission={0.65}
                    thickness={0.4}
                />
            </mesh>
        </group>
    )
}

/** Biển hiệu 3D LED chữ nổi định danh phòng ban */
function DepartmentSign({
    position,
    rotation = [0, 0, 0],
    title,
    subtitle,
    color = '#38bdf8',
}: {
    position: [number, number, number]
    rotation?: [number, number, number]
    title: string
    subtitle: string
    color?: string
}) {
    return (
        <group position={position} rotation={rotation}>
            {/* Bảng nền gắn tường viền LED */}
            <mesh position={[0, 0, -0.02]} castShadow>
                <boxGeometry args={[2.8, 0.7, 0.05]} />
                <meshStandardMaterial color="#090d16" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[0, -0.32, 0]}>
                <boxGeometry args={[2.7, 0.03, 0.02]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} />
            </mesh>
            {/* Tên chính */}
            <Text
                position={[0, 0.1, 0.03]}
                fontSize={0.17}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
            >
                {title}
            </Text>
            {/* Phụ đề */}
            <Text
                position={[0, -0.12, 0.03]}
                fontSize={0.09}
                color={color}
                anchorX="center"
                anchorY="middle"
            >
                {subtitle}
            </Text>
        </group>
    )
}

export default function Room({
    agents = [],
    selectedAgentId,
    onSelectAgent,
    onFloorClick,
    agentTargetActions = {},
}: RoomProps) {
    // Phân bổ từng agent vào đúng phòng ban, vị trí spawn thông thoáng và vị trí bàn ngồi làm việc
    const agentSlots = useMemo(() => {
        const counters: Record<OfficeDepartment, number> = {
            management: 0,
            research: 0,
            analytics: 0,
        }

        return agents.map((agent) => {
            const dept = detectAgentDepartment(agent)
            const count = counters[dept]++
            let desk: [number, number, number]
            let spawnPos: [number, number, number]

            if (dept === 'management') {
                desk = MANAGEMENT_DESK_SLOTS[count % MANAGEMENT_DESK_SLOTS.length]
                spawnPos = MANAGEMENT_SPAWN_SLOTS[count % MANAGEMENT_SPAWN_SLOTS.length]
            } else if (dept === 'research') {
                desk = RESEARCH_DESK_SLOTS[count % RESEARCH_DESK_SLOTS.length]
                spawnPos = RESEARCH_SPAWN_SLOTS[count % RESEARCH_SPAWN_SLOTS.length]
            } else {
                desk = ANALYTICS_DESK_SLOTS[count % ANALYTICS_DESK_SLOTS.length]
                spawnPos = ANALYTICS_SPAWN_SLOTS[count % ANALYTICS_SPAWN_SLOTS.length]
            }

            const seatPos = getDeskSeatPosition(desk)

            return {
                agent,
                dept,
                desk,
                spawnPos,
                seatPos,
            }
        })
    }, [agents])

    return (
        <group>
            {/* Sàn văn phòng phân khu cao cấp 28x22m */}
            <Floor onFloorClick={onFloorClick} size={[28, 22]} />

            {/* ===== 1. TƯỜNG BAO NGOẠI THẤT (OUTER WALLS) ===== */}
            <Wall position={[0, 0.9, -11]} size={[28, 1.8, 0.25]} />
            <Wall position={[0, 0.9, 11]} size={[28, 1.8, 0.25]} />
            <Wall position={[-14, 0.9, 0]} rotation={[0, Math.PI / 2, 0]} size={[22, 1.8, 0.25]} />
            <Wall position={[14, 0.9, 0]} rotation={[0, Math.PI / 2, 0]} size={[22, 1.8, 0.25]} />

            {/* ===== 2. VÁCH NGĂN PHÂN CHIA PHÒNG BAN & HÀNH LANG (PARTITIONS) ===== */}
            {/* Vách ngang chia Tây Bắc (Phòng Quản lý) & Tây Nam (Khu Lounge) */}
            <Wall position={[-8.25, 0.9, 0]} size={[11.5, 1.8, 0.2]} />

            {/* Vách ngang chia Đông Bắc (Phòng Nghiên cứu) & Đông Nam (Phòng Phân tích) */}
            <Wall position={[8.25, 0.9, 0]} size={[11.5, 1.8, 0.2]} />

            {/* Vách kính dọc phía Tây: Ngăn hành lang với Phòng Quản lý & Lounge */}
            <GlassPartition position={[-2.5, 0.9, -7.5]} size={[0.15, 1.8, 7.0]} />
            <GlassPartition position={[-2.5, 0.9, -0.8]} size={[0.15, 1.8, 1.6]} />
            <GlassPartition position={[-2.5, 0.9, 6.5]} size={[0.15, 1.8, 7.5]} />

            {/* Vách kính dọc phía Đông: Ngăn hành lang với Phòng Nghiên cứu & Phân tích */}
            <GlassPartition position={[2.5, 0.9, -7.5]} size={[0.15, 1.8, 7.0]} />
            <GlassPartition position={[2.5, 0.9, 0]} size={[0.15, 1.8, 1.8]} />
            <GlassPartition position={[2.5, 0.9, 7.5]} size={[0.15, 1.8, 7.0]} />

            {/* ===== 3. BIỂN HIỆU 3D LED ĐỊNH DANH PHÒNG BAN ===== */}
            {/* Biển Phòng Quản Lý & Điều Hành */}
            <DepartmentSign
                position={[-2.52, 2.05, -2.8]}
                rotation={[0, Math.PI / 2, 0]}
                title="EXECUTIVE SUITE"
                subtitle="Phòng Quản Lý & Điều Hành"
                color="#facc15"
            />

            {/* Biển Phòng Nghiên Cứu & Tìm Kiếm */}
            <DepartmentSign
                position={[2.52, 2.05, -2.8]}
                rotation={[0, -Math.PI / 2, 0]}
                title="RESEARCH & SEARCH"
                subtitle="Nghiên Cứu & Khai Thác Tri Thức"
                color="#38bdf8"
            />

            {/* Biển Phòng Phân Tích & Đánh Giá */}
            <DepartmentSign
                position={[2.52, 2.05, 2.8]}
                rotation={[0, -Math.PI / 2, 0]}
                title="DATA & ANALYTICS"
                subtitle="Phân Tích & Đánh Giá Dữ Liệu"
                color="#fb923c"
            />

            {/* Biển Khu Lounge Nghỉ Ngơi */}
            <DepartmentSign
                position={[-2.52, 2.05, 1.5]}
                rotation={[0, Math.PI / 2, 0]}
                title="BREAKOUT LOUNGE"
                subtitle="Không Gian Nghỉ Ngơi & Hội Ý"
                color="#34d399"
            />

            {/* ===== 4. NỘI THẤT: PHÒNG QUẢN LÝ & ĐIỀU HÀNH (EXECUTIVE SUITE) ===== */}
            {/* Bàn 1: Giám đốc / Lead */}
            <Desk position={[-9.5, 0, -8.0]} />
            <Chair position={[-9.5, 0, -6.8]} />
            <Computer position={[-9.5, 0, -8.0]} />

            {/* Bàn 2: Phó phòng / Điều phối */}
            <Desk position={[-5.5, 0, -8.0]} />
            <Chair position={[-5.5, 0, -6.8]} />
            <Computer position={[-5.5, 0, -8.0]} />

            {/* Bàn 3: Quản lý dự án PM */}
            <Desk position={[-9.5, 0, -4.0]} />
            <Chair position={[-9.5, 0, -2.8]} />
            <Computer position={[-9.5, 0, -4.0]} />

            {/* Tủ tài liệu lưu trữ cao cấp & Bàn họp nhỏ */}
            <Cabinet position={[-13.2, 0, -6.0]} />
            <Cabinet position={[-13.2, 0, -4.5]} />
            <RoundTable position={[-5.5, 0, -3.5]} />
            <Plant position={[-13.2, 0, -9.5]} />
            <Plant position={[-3.5, 0, -9.5]} />

            {/* ===== 5. NỘI THẤT: PHÒNG NGHIÊN CỨU & TÌM KIẾM (RESEARCH & SEARCH LAB) ===== */}
            {/* 4 Bàn nghiên cứu AI, dữ liệu, tri thức */}
            <Desk position={[5.5, 0, -8.0]} />
            <Chair position={[5.5, 0, -6.8]} />
            <Computer position={[5.5, 0, -8.0]} />

            <Desk position={[9.5, 0, -8.0]} />
            <Chair position={[9.5, 0, -6.8]} />
            <Computer position={[9.5, 0, -8.0]} />

            <Desk position={[5.5, 0, -4.0]} />
            <Chair position={[5.5, 0, -2.8]} />
            <Computer position={[5.5, 0, -4.0]} />

            <Desk position={[9.5, 0, -4.0]} />
            <Chair position={[9.5, 0, -2.8]} />
            <Computer position={[9.5, 0, -4.0]} />

            {/* Cụm Server Rack siêu máy tính AI & Bảng nghiên cứu */}
            <ServerRack position={[13.2, 0, -9.0]} />
            <ServerRack position={[13.2, 0, -6.0]} />
            <ServerRack position={[13.2, 0, -4.0]} />
            <Plant position={[3.5, 0, -9.5]} />
            <Plant position={[13.2, 0, -1.2]} />

            {/* ===== 6. NỘI THẤT: PHÒNG PHÂN TÍCH & ĐÁNH GIÁ (DATA & ANALYTICS DEPT) ===== */}
            {/* 4 Bàn phân tích số liệu, metrics, QA */}
            <Desk position={[5.5, 0, 4.0]} />
            <Chair position={[5.5, 0, 2.8]} />
            <Computer position={[5.5, 0, 4.0]} />

            <Desk position={[9.5, 0, 4.0]} />
            <Chair position={[9.5, 0, 2.8]} />
            <Computer position={[9.5, 0, 4.0]} />

            <Desk position={[5.5, 0, 8.0]} />
            <Chair position={[5.5, 0, 6.8]} />
            <Computer position={[5.5, 0, 8.0]} />

            <Desk position={[9.5, 0, 8.0]} />
            <Chair position={[9.5, 0, 6.8]} />
            <Computer position={[9.5, 0, 8.0]} />

            {/* Màn hình TV Dashboard phân tích biểu đồ KPI trên tường */}
            <group position={[13.88, 1.3, 6.0]} rotation={[0, -Math.PI / 2, 0]}>
                <mesh castShadow>
                    <boxGeometry args={[3.2, 1.4, 0.06]} />
                    <meshStandardMaterial color="#090d16" metalness={0.9} />
                </mesh>
                <mesh position={[0, 0, 0.035]}>
                    <planeGeometry args={[3.0, 1.2]} />
                    <meshStandardMaterial color="#0f172a" emissive="#0284c7" emissiveIntensity={0.6} />
                </mesh>
                <Text position={[0, 0.35, 0.045]} fontSize={0.12} color="#38bdf8" anchorX="center">
                    REALTIME EVALUATION DASHBOARD
                </Text>
                <Text position={[0, 0, 0.045]} fontSize={0.09} color="#94a3b8" anchorX="center">
                    Accuracy: 99.4% | Latency: 12ms | Throughput: 4.8k ops
                </Text>
            </group>
            <Cabinet position={[13.2, 0, 2.5]} />
            <Plant position={[3.5, 0, 9.5]} />
            <Plant position={[13.2, 0, 9.5]} />

            {/* ===== 7. NỘI THẤT: KHU VỰC LOUNGE & NGHỈ NGƠI (BREAKOUT LOUNGE) ===== */}
            <RoundTable position={[-6.0, 0, 4.0]} />
            <Sofa position={[-9.0, 0, 4.5]} rotation={[0, 0.4, 0]} />
            <PingPong position={[-8.5, 0, 8.5]} />
            <Plant position={[-13.2, 0, 1.5]} />
            <Plant position={[-13.2, 0, 9.5]} />

            {/* Máy pha cà phê và quầy trà tại sảnh */}
            <group position={[-3.5, 0, 1.5]}>
                <mesh position={[0, 0.5, 0]} castShadow>
                    <boxGeometry args={[1.2, 1.0, 0.6]} />
                    <meshStandardMaterial color="#334155" metalness={0.5} />
                </mesh>
                <mesh position={[0, 1.15, 0]} castShadow>
                    <boxGeometry args={[0.4, 0.3, 0.3]} />
                    <meshStandardMaterial color="#0f172a" metalness={0.8} />
                </mesh>
            </group>

            {/* ===== 8. ĐẶT AGENT VÀO VỊ TRÍ SPAWN THOÁNG ĐÃNG TRÁNH KẸT BÀN GHẾ ===== */}
            {agentSlots.map(({ agent, spawnPos, seatPos }) => {
                const override = agentTargetActions[agent.id]
                const isSelected = selectedAgentId === agent.id

                return (
                    <Agent
                        key={agent.id}
                        id={agent.id}
                        position={spawnPos}
                        deskPosition={seatPos}
                        color={agent.color}
                        name={agent.name}
                        status={agent.status}
                        speech={agent.speech}
                        speed={1.0}
                        waypoints={buildWalkPath(spawnPos)}
                        targetAction={override?.action}
                        targetPosition={override?.targetPos}
                        isSelected={isSelected}
                        onSelect={() => onSelectAgent?.(agent.id)}
                        ownerName={agent.ownerName}
                        form={agent.form}
                    />
                )
            })}
        </group>
    )
}
