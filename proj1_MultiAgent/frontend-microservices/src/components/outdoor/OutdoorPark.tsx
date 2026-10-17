import OutdoorFloor from './OutdoorFloor'
import Tree from './Tree'
import ParkBench from './ParkBench'
import PicnicTable from './PicnicTable'
import Fountain from './Fountain'
import Gazebo from './Gazebo'
import CoffeeKiosk from './CoffeeKiosk'
import Agent from '../agents/Agent'
import { Agent as AgentType } from '@/lib/api'
import { AgentAction } from '../agents/Agent'

type OutdoorParkProps = {
    agents?: AgentType[]
    selectedAgentId?: string | null
    onSelectAgent?: (id: string) => void
    onFloorClick?: (point: [number, number, number]) => void
    agentTargetActions?: Record<string, { action: AgentAction; targetPos: [number, number, number] }>
}

/** Các điểm làm việc / giải trí ngoài trời */
export const OUTDOOR_ACTION_SPOTS = {
    fountain: [0, 0, 3.2] as [number, number, number],
    bench1: [-6, 0, -3.8] as [number, number, number],
    bench2: [6, 0, -3.8] as [number, number, number],
    bench3: [-6, 0, 3.8] as [number, number, number],
    picnic1: [-8, 0, 8] as [number, number, number],
    picnic2: [-4, 0, 8] as [number, number, number],
    gazebo: [8, 0, 8] as [number, number, number],
    coffee: [0, 0, -6.5] as [number, number, number],
    roam: [0, 0, 0] as [number, number, number],
}

/** Đường đi dạo quanh công viên ngoài trời */
function buildOutdoorWalkPath(base: [number, number, number]): [number, number, number][] {
    const [x, , z] = base
    return [
        [x, 0, z],
        [0, 0, 5],
        [6, 0, 0],
        [0, 0, -5],
        [-6, 0, 0],
    ]
}

const OUTDOOR_DEFAULT_SLOTS: [number, number, number][] = [
    [-6, 0, -3.8], // Băng ghế 1
    [6, 0, -3.8],  // Băng ghế 2
    [-8, 0, 8],    // Bàn dã ngoại 1
    [8, 0, 8],     // Chòi nghỉ Gazebo
    [0, 0, -6.5],  // Quầy Cà phê Kiosk
    [-6, 0, 3.8],  // Băng ghế 3
]

export default function OutdoorPark({
    agents = [],
    selectedAgentId,
    onSelectAgent,
    onFloorClick,
    agentTargetActions = {},
}: OutdoorParkProps) {
    return (
        <group>
            {/* Mặt sàn bãi cỏ và đường đi lát đá */}
            <OutdoorFloor onFloorClick={onFloorClick} />

            {/* Đài phun nước trung tâm */}
            <Fountain position={[0, 0, 0]} />

            {/* Quầy Cà Phê & Nước Ép ngoài trời (phía Bắc) */}
            <CoffeeKiosk position={[0, 0, -8.5]} />

            {/* Chòi họp công nghệ sinh thái Gazebo (phía Đông-Nam) */}
            <Gazebo position={[8.5, 0, 8.5]} />

            {/* Khu bàn gỗ dã ngoại Picnic (phía Tây-Nam) */}
            <PicnicTable position={[-8, 0, 8]} umbrellaColor="#3b82f6" />
            <PicnicTable position={[-4, 0, 8]} umbrellaColor="#e53e3e" />

            {/* Các băng ghế công viên nghỉ ngơi */}
            <ParkBench position={[-6, 0, -4]} rotation={[0, 0, 0]} />
            <ParkBench position={[6, 0, -4]} rotation={[0, 0, 0]} />
            <ParkBench position={[-6, 0, 4]} rotation={[0, Math.PI, 0]} />
            <ParkBench position={[6, 0, 4]} rotation={[0, Math.PI, 0]} />

            {/* Rừng cây xanh mát bao quanh khuôn viên */}
            {/* Cây Sồi & Hoa anh đào góc Tây Bắc */}
            <Tree position={[-12, 0, -12]} scale={1.2} type="oak" />
            <Tree position={[-9, 0, -11]} scale={1.0} type="sakura" />
            <Tree position={[-12, 0, -8]} scale={0.9} type="oak" />

            {/* Cây Thông góc Đông Bắc */}
            <Tree position={[12, 0, -12]} scale={1.3} type="pine" />
            <Tree position={[9, 0, -11]} scale={1.1} type="pine" />
            <Tree position={[12, 0, -8]} scale={0.9} type="pine" />

            {/* Cây Mùa Thu & Anh Đào góc Tây Nam */}
            <Tree position={[-12, 0, 12]} scale={1.2} type="autumn" />
            <Tree position={[-12, 0, 5]} scale={1.0} type="sakura" />

            {/* Cây xanh góc Đông Nam */}
            <Tree position={[12, 0, 12]} scale={1.2} type="oak" />
            <Tree position={[12, 0, 5]} scale={1.1} type="sakura" />

            {/* Agents được bố trí làm việc / tương tác trong khuôn viên */}
            {agents.map((agent, index) => {
                const defaultSpot = OUTDOOR_DEFAULT_SLOTS[index % OUTDOOR_DEFAULT_SLOTS.length]
                const override = agentTargetActions[agent.id]
                const isSelected = selectedAgentId === agent.id

                return (
                    <Agent
                        key={agent.id}
                        id={agent.id}
                        position={defaultSpot}
                        deskPosition={defaultSpot}
                        color={agent.color}
                        name={agent.name}
                        status={agent.status}
                        speech={agent.speech}
                        speed={1.2}
                        waypoints={buildOutdoorWalkPath(defaultSpot)}
                        targetAction={override?.action}
                        targetPosition={override?.targetPos}
                        isSelected={isSelected}
                        onSelect={() => onSelectAgent?.(agent.id)}
                        ownerName={agent.ownerName}
                    />
                )
            })}
        </group>
    )
}
