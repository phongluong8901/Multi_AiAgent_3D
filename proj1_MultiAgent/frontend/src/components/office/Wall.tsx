import { RigidBody } from '@react-three/rapier'

type Props = {
    position: [number, number, number]
    rotation?: [number, number, number]
    size?: [number, number, number]
}

export default function Wall({
    position,
    rotation = [0, 0, 0],
    size = [14, 1.4, 0.15],
}: Props) {
    return (
        <RigidBody type="fixed" colliders="cuboid" position={position} rotation={rotation}>
            <mesh castShadow receiveShadow>
                <boxGeometry args={size} />
                <meshStandardMaterial color="#d4cbc0" />
            </mesh>
        </RigidBody>
    )
}