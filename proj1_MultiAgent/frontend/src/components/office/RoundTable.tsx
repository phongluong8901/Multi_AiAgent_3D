type Props = {
    position: [number, number, number]
}

export default function RoundTable({ position }: Props) {
    return (
        <group position={position}>
            {/* Mặt bàn tròn */}
            <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[1.1, 1.1, 0.08, 32]} />
                <meshStandardMaterial color="#d4a574" />
            </mesh>

            {/* Chân bàn */}
            <mesh position={[0, 0.35, 0]} castShadow>
                <cylinderGeometry args={[0.12, 0.18, 0.7, 16]} />
                <meshStandardMaterial color="#8b6914" />
            </mesh>
        </group>
    )
}