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

/** Vị trí các bàn làm việc trong văn phòng */
export const OFFICE_DESK_SLOTS: [number, number, number][] = [
    [-6, 0, -4],
    [-2, 0, -4],
    [2, 0, -4],
    [6, 0, -3],
    [-6, 0, 2],
    [6, 0, 2],
]

/** Các điểm đích đến tương ứng với hành động trong văn phòng */
export const OFFICE_ACTION_SPOTS = {
    sofa: [-3.2, 0, 9.2] as [number, number, number],
    roundtable: [0, 0, 5.0] as [number, number, number],
    pingpong: [4.2, 0, 9.0] as [number, number, number],
    coffee: [-8.5, 0, -8.5] as [number, number, number],
    roam: [0, 0, 0] as [number, number, number],
}

/** Đường đi vòng HÀNH LANG — không cắt qua bàn */
function buildWalkPath(desk: [number, number, number]): [number, number, number][] {
    const [x, , z] = desk
    return [
        [x, 0, z + 1.2],
        [x + 2.5, 0, z + 1.2],
        [x + 2.5, 0, z + 4],
        [x - 2.5, 0, z + 4],
        [x - 2.5, 0, z + 1.2],
    ]
}

export default function Room({
    agents = [],
    selectedAgentId,
    onSelectAgent,
    onFloorClick,
    agentTargetActions = {},
}: RoomProps) {
    return (
        <group>
            <Floor onFloorClick={onFloorClick} />

            {/* Tường phòng to 24x24 */}
            <Wall position={[0, 0.9, -12]} size={[24, 1.8, 0.2]} />
            <Wall position={[0, 0.9, 12]} size={[24, 1.8, 0.2]} />
            <Wall position={[-12, 0.9, 0]} rotation={[0, Math.PI / 2, 0]} size={[24, 1.8, 0.2]} />
            <Wall position={[12, 0.9, 0]} rotation={[0, Math.PI / 2, 0]} size={[24, 1.8, 0.2]} />

            {/* Hàng bàn phía sau (z âm) */}
            <Desk position={[-6, 0, -5.2]} />
            <Chair position={[-6, 0, -4]} />
            <Computer position={[-6, 0, -5.2]} />

            <Desk position={[-2, 0, -5.2]} />
            <Chair position={[-2, 0, -4]} />
            <Computer position={[-2, 0, -5.2]} />

            <Desk position={[2, 0, -5.2]} />
            <Chair position={[2, 0, -4]} />
            <Computer position={[2, 0, -5.2]} />

            <Desk position={[6, 0, -4.2]} />
            <Chair position={[6, 0, -3]} />
            <Computer position={[6, 0, -4.2]} />

            {/* Bàn phụ 2 bên */}
            <Desk position={[-6, 0, 0.8]} />
            <Chair position={[-6, 0, 2]} />
            <Computer position={[-6, 0, 0.8]} />

            <Desk position={[6, 0, 0.8]} />
            <Chair position={[6, 0, 2]} />
            <Computer position={[6, 0, 0.8]} />

            {/* Khu họp / nghỉ — để giữa-dưới */}
            <RoundTable position={[0, 0, 6]} />
            <Sofa position={[-4, 0, 9]} rotation={[0, 0.3, 0]} />
            <Sofa position={[-2, 0, 10]} rotation={[0, -0.4, 0]} />
            <PingPong position={[5, 0, 9]} />

            <ServerRack position={[-10, 0, -10]} />
            <ServerRack position={[-9.1, 0, -10]} />
            <Cabinet position={[10, 0, -10]} />

            <Plant position={[-10, 0, 10]} />
            <Plant position={[10, 0, 10]} />
            <Plant position={[-10, 0, 0]} />
            <Plant position={[10, 0, 0]} />

            {agents.map((agent, index) => {
                const desk = OFFICE_DESK_SLOTS[index % OFFICE_DESK_SLOTS.length]
                const override = agentTargetActions[agent.id]
                const isSelected = selectedAgentId === agent.id

                return (
                    <Agent
                        key={agent.id}
                        id={agent.id}
                        position={desk}
                        deskPosition={desk}
                        color={agent.color}
                        name={agent.name}
                        status={agent.status}
                        speech={agent.speech}
                        speed={1.0}
                        waypoints={buildWalkPath(desk)}
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