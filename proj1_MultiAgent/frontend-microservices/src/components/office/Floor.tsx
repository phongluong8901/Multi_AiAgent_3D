import { RigidBody } from '@react-three/rapier'

type FloorProps = {
    onFloorClick?: (point: [number, number, number]) => void
}

export default function Floor({ onFloorClick }: FloorProps) {
    return (
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
                <planeGeometry args={[24, 24]} />
                <meshStandardMaterial color="#e8e0d5" roughness={0.8} />
            </mesh>
        </RigidBody>
    )
}