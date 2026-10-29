import { RigidBody } from '@react-three/rapier'

type Props = {
    position: [number, number, number]
    rotation?: [number, number, number]
}

export default function Chair({ position, rotation = [0, 0, 0] }: Props) {
    return (
        <RigidBody type="fixed" colliders={false} position={position} rotation={rotation}>
            <group>
                <mesh position={[0, 0.45, 0]} castShadow>
                    <boxGeometry args={[0.52, 0.06, 0.52]} />
                    <meshStandardMaterial color="#4a5568" />
                </mesh>

                <mesh position={[0, 0.78, 0.23]} castShadow>
                    <boxGeometry args={[0.52, 0.6, 0.06]} />
                    <meshStandardMaterial color="#4a5568" />
                </mesh>

                {[
                    [-0.2, 0.22, -0.2],
                    [0.2, 0.22, -0.2],
                    [-0.2, 0.22, 0.2],
                    [0.2, 0.22, 0.2],
                ].map((pos, i) => (
                    <mesh key={i} position={pos as [number, number, number]} castShadow>
                        <boxGeometry args={[0.05, 0.44, 0.05]} />
                        <meshStandardMaterial color="#2d3748" />
                    </mesh>
                ))}
            </group>
        </RigidBody>
    )
}
