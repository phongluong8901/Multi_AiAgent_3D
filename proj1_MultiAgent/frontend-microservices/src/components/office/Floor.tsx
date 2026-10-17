import { RigidBody } from '@react-three/rapier'

export default function Floor() {
    return (
        <RigidBody type="fixed" colliders="cuboid">
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <planeGeometry args={[24, 24]} />
                <meshStandardMaterial color="#e8e0d5" />
            </mesh>
        </RigidBody>
    )
}