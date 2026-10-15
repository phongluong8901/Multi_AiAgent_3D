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

export default function Room() {
    return (
        <group>
            <Floor />

            {/* Tường */}
            <Wall position={[0, 0.7, -7]} size={[14, 1.4, 0.15]} />
            <Wall position={[0, 0.7, 7]} size={[14, 1.4, 0.15]} />
            <Wall position={[-7, 0.7, 0]} rotation={[0, Math.PI / 2, 0]} size={[14, 1.4, 0.15]} />
            <Wall position={[7, 0.7, 0]} rotation={[0, Math.PI / 2, 0]} size={[14, 1.4, 0.15]} />

            {/* ========== 3 BÀN NHÂN VIÊN ========== */}
            {/* Nhân viên 1 */}
            <Desk position={[-4.2, 0, -2.8]} />
            <Chair position={[-4.2, 0, -1.85]} />
            <Computer position={[-4.2, 0, -2.8]} />

            {/* Nhân viên 2 */}
            <Desk position={[-1.5, 0, -2.8]} />
            <Chair position={[-1.5, 0, -1.85]} />
            <Computer position={[-1.5, 0, -2.8]} />

            {/* Nhân viên 3 */}
            <Desk position={[1.2, 0, -2.8]} />
            <Chair position={[1.2, 0, -1.85]} />
            <Computer position={[1.2, 0, -2.8]} />

            {/* ========== BÀN SẾP (riêng, phía bên phải) ========== */}
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

            {/* ========== NHÂN VẬT ========== */}
            {/* Ben */}
            <Agent
                position={[-4.2, 0, -1.85]}
                color="#4299e1"
                name="Ben"
                speed={1.4}
                waypoints={[
                    [-4.2, 0, -1.85],
                    [-3.2, 0, 1.5],
                    [-3.2, 0, 2.5],
                    [-4.5, 0, 0.5],
                ]}
            />

            {/* Cory */}
            <Agent
                position={[-1.5, 0, -1.85]}
                color="#48bb78"
                name="Cory"
                speed={1.1}
                waypoints={[
                    [-1.5, 0, -1.85],
                    [0, 0, 0],
                    [0.5, 0, 4],
                    [-1, 0, 2],
                ]}
            />

            {/* Allan */}
            <Agent
                position={[1.2, 0, -1.85]}
                color="#ed8936"
                name="Allan"
                speed={1.3}
                waypoints={[
                    [1.2, 0, -1.85],
                    [2, 0, 1],
                    [1, 0, 3],
                    [0, 0, 1.5],
                ]}
            />

            {/* Luke (sếp) */}
            <Agent
                position={[4.5, 0, -0.55]}
                color="#9f7aea"
                name="Luke"
                speed={0.9}
                waypoints={[
                    [4.5, 0, -0.55],
                    [5, 0, 1.5],
                    [3.5, 0, 2],
                    [4.5, 0, 0.5],
                ]}
            />

        </group>
    )
}