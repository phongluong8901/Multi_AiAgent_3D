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
import { AgentState } from '@/hooks/useGateway'

type RoomProps = {
    agents?: AgentState[]
}

const WAYPOINTS: Record<string, [number, number, number][]> = {
    ben: [
        [-4.2, 0, -1.2],
        [-5.5, 0, -1.2],
        [-5.5, 0, 1.5],
        [-3.5, 0, 1.5],
    ],
    cory: [
        [-1.5, 0, -1.2],
        [-1.5, 0, 0.8],
        [0.5, 0, 0.8],
        [0.5, 0, 3.5],
    ],
    allan: [
        [1.2, 0, -1.2],
        [1.2, 0, 0.8],
        [2.8, 0, 0.8],
        [2.8, 0, 3],
    ],
    luke: [
        [4.5, 0, 0.2],
        [5.8, 0, 0.2],
        [5.8, 0, 2.5],
        [3.8, 0, 2.5],
    ],
}

export default function Room({ agents = [] }: RoomProps) {
    return (
        <group>
            <Floor />

            {/* Tường */}
            <Wall position={[0, 0.7, -7]} size={[14, 1.4, 0.15]} />
            <Wall position={[0, 0.7, 7]} size={[14, 1.4, 0.15]} />
            <Wall position={[-7, 0.7, 0]} rotation={[0, Math.PI / 2, 0]} size={[14, 1.4, 0.15]} />
            <Wall position={[7, 0.7, 0]} rotation={[0, Math.PI / 2, 0]} size={[14, 1.4, 0.15]} />

            {/* ========== 3 BÀN NHÂN VIÊN ========== */}
            <Desk position={[-4.2, 0, -2.8]} />
            <Chair position={[-4.2, 0, -1.85]} />
            <Computer position={[-4.2, 0, -2.8]} />

            <Desk position={[-1.5, 0, -2.8]} />
            <Chair position={[-1.5, 0, -1.85]} />
            <Computer position={[-1.5, 0, -2.8]} />

            <Desk position={[1.2, 0, -2.8]} />
            <Chair position={[1.2, 0, -1.85]} />
            <Computer position={[1.2, 0, -2.8]} />

            {/* ========== BÀN SẾP ========== */}
            <Desk position={[4.5, 0, -1.5]} />
            <Chair position={[4.5, 0, -0.55]} />
            <Computer position={[4.5, 0, -1.5]} />

            {/* ========== KHU HỌP ========== */}
            <RoundTable position={[-3.2, 0, 2.5]} />

            {/* ========== KHU NGHỈ ========== */}
            <Sofa position={[3.2, 0, 3.8]} rotation={[0, -Math.PI / 5, 0]} />
            <Sofa position={[5.3, 0, 2.5]} rotation={[0, Math.PI / 2.2, 0]} />

            {/* ========== BÓNG BÀN ========== */}
            <PingPong position={[0.5, 0, 5.2]} />

            {/* ========== SERVER + TỦ ========== */}
            <ServerRack position={[-6.2, 0, -5.5]} />
            <ServerRack position={[-5.3, 0, -5.5]} />
            <Cabinet position={[6.2, 0, -5]} />

            {/* Cây cảnh */}
            <Plant position={[-6, 0, 5.5]} />
            <Plant position={[6, 0, 5.5]} />
            <Plant position={[-6, 0, 0]} />
            <Plant position={[6, 0, 0]} />

            {/* ========== NHÂN VẬT (từ Gateway) ========== */}
            {agents.map((agent) => (
                <Agent
                    key={agent.id}
                    position={agent.position}
                    color={agent.color}
                    name={agent.name}
                    status={agent.status}
                    speech={agent.speech}
                    speed={agent.id === 'luke' ? 0.9 : 1.2}
                    waypoints={WAYPOINTS[agent.id] ?? []}
                />
            ))}
        </group>
    )
}