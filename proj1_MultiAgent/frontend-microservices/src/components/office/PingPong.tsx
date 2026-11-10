type Props = {
    position: [number, number, number]
}

export default function PingPong({ position }: Props) {
    return (
        <group position={position}>
            {/* Mặt bàn */}
            <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
                <boxGeometry args={[2.2, 0.06, 1.2]} />
                <meshStandardMaterial color="#2f855a" />
            </mesh>

            {/* Viền trắng */}
            <mesh position={[0, 0.785, 0]}>
                <boxGeometry args={[2.25, 0.01, 1.25]} />
                <meshStandardMaterial color="#ffffff" />
            </mesh>

            {/* Lưới */}
            <mesh position={[0, 0.9, 0]} castShadow>
                <boxGeometry args={[0.03, 0.25, 1.15]} />
                <meshStandardMaterial color="#ffffff" />
            </mesh>

            {/* 4 chân */}
            {[
                [-0.95, 0.35, -0.5],
                [0.95, 0.35, -0.5],
                [-0.95, 0.35, 0.5],
                [0.95, 0.35, 0.5],
            ].map((pos, i) => (
                <mesh key={i} position={pos as [number, number, number]} castShadow>
                    <boxGeometry args={[0.07, 0.7, 0.07]} />
                    <meshStandardMaterial color="#2d3748" />
                </mesh>
            ))}
        </group>
    )
}