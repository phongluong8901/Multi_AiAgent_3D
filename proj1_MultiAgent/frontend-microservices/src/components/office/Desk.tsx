import { RigidBody } from '@react-three/rapier'

type Props = {
    position: [number, number, number]
}

export default function Desk({ position }: Props) {
    return (
        <RigidBody type="fixed" colliders="cuboid" position={position}>
            <group>
                {/* Mặt bàn */}
                <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
                    <boxGeometry args={[1.8, 0.08, 0.9]} />
                    <meshStandardMaterial color="#c4a77d" />
                </mesh>

                {/* Chân bàn */}
                {[
                    [-0.8, 0.35, -0.35],
                    [0.8, 0.35, -0.35],
                    [-0.8, 0.35, 0.35],
                    [0.8, 0.35, 0.35],
                ].map((pos, i) => (
                    <mesh key={i} position={pos as [number, number, number]} castShadow>
                        <boxGeometry args={[0.08, 0.7, 0.08]} />
                        <meshStandardMaterial color="#8b7355" />
                    </mesh>
                ))}
            </group>
        </RigidBody>
    )
}