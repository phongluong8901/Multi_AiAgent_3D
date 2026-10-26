import { RigidBody } from '@react-three/rapier'

type FloorProps = {
    onFloorClick?: (point: [number, number, number]) => void
    size?: [number, number]
}

export default function Floor({ onFloorClick, size = [28, 22] }: FloorProps) {
    return (
        <RigidBody type="fixed" colliders="cuboid">
            {/* Mặt sàn chính: Đá sáng lát hành lang cao cấp */}
            <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0, 0]}
                receiveShadow
                onClick={(e) => {
                    e.stopPropagation()
                    onFloorClick?.([e.point.x, 0, e.point.z])
                }}
            >
                <planeGeometry args={size} />
                <meshStandardMaterial color="#cbd5e1" roughness={0.6} />
            </mesh>

            {/* Thảm sàn 1: Phòng Quản Lý & Điều Hành (Gỗ nâu sang trọng) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-8.25, 0.006, -5.5]}>
                <planeGeometry args={[11.2, 10.2]} />
                <meshStandardMaterial color="#292524" roughness={0.7} />
            </mesh>

            {/* Thảm sàn 2: Phòng Nghiên Cứu & Tìm Kiếm (Xanh than công nghệ cao) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8.25, 0.006, -5.5]}>
                <planeGeometry args={[11.2, 10.2]} />
                <meshStandardMaterial color="#1e293b" roughness={0.8} />
            </mesh>

            {/* Thảm sàn 3: Phòng Phân Tích & Đánh Giá (Xám than hiện đại) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8.25, 0.006, 5.5]}>
                <planeGeometry args={[11.2, 10.2]} />
                <meshStandardMaterial color="#1c1917" roughness={0.8} />
            </mesh>

            {/* Thảm sàn 4: Khu Nghỉ Ngơi / Lounge (Nâu ấm thư giãn) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-8.25, 0.006, 5.5]}>
                <planeGeometry args={[11.2, 10.2]} />
                <meshStandardMaterial color="#262626" roughness={0.9} />
            </mesh>

            {/* Dải thảm hành lang trung tâm tiếp đón */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
                <planeGeometry args={[3.2, 21.6]} />
                <meshStandardMaterial color="#334155" roughness={0.8} />
            </mesh>
        </RigidBody>
    )
}