import { RigidBody } from '@react-three/rapier'
import * as THREE from 'three'

type OutdoorFloorProps = {
    onFloorClick?: (point: [number, number, number]) => void
}

export default function OutdoorFloor({ onFloorClick }: OutdoorFloorProps) {
    return (
        <group>
            {/* Thảm cỏ xanh mướt toàn khuôn viên 30x30 */}
            <RigidBody type="fixed" colliders="cuboid">
                <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[0, 0, 0]}
                    receiveShadow
                    onClick={(e) => {
                        e.stopPropagation()
                        onFloorClick?.([e.point.x, 0, e.point.z])
                    }}
                >
                    <planeGeometry args={[32, 32]} />
                    <meshStandardMaterial color="#48bb78" roughness={0.9} />
                </mesh>

                {/* Đường lát đá chính trục X */}
                <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[0, 0.01, 0]}
                    receiveShadow
                    onClick={(e) => {
                        e.stopPropagation()
                        onFloorClick?.([e.point.x, 0, e.point.z])
                    }}
                >
                    <planeGeometry args={[32, 3.2]} />
                    <meshStandardMaterial color="#cbd5e0" roughness={0.7} />
                </mesh>

                {/* Đường lát đá chính trục Z */}
                <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[0, 0.015, 0]}
                    receiveShadow
                    onClick={(e) => {
                        e.stopPropagation()
                        onFloorClick?.([e.point.x, 0, e.point.z])
                    }}
                >
                    <planeGeometry args={[3.2, 32]} />
                    <meshStandardMaterial color="#cbd5e0" roughness={0.7} />
                </mesh>

                {/* Vòng quảng trường đá trung tâm bao quanh đài phun nước */}
                <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[0, 0.02, 0]}
                    receiveShadow
                    onClick={(e) => {
                        e.stopPropagation()
                        onFloorClick?.([e.point.x, 0, e.point.z])
                    }}
                >
                    <circleGeometry args={[5.2, 32]} />
                    <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
                </mesh>
            </RigidBody>
        </group>
    )
}
