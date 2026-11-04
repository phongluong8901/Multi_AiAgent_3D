type Props = {
    position: [number, number, number]
}

export default function Computer({ position }: Props) {
    return (
        <group position={position}>
            {/* Màn hình */}
            <mesh position={[0, 0.95, 0]} castShadow>
                <boxGeometry args={[0.7, 0.45, 0.05]} />
                <meshStandardMaterial color="#1a202c" />
            </mesh>

            {/* Màn hình sáng */}
            <mesh position={[0, 0.95, 0.03]}>
                <boxGeometry args={[0.62, 0.38, 0.01]} />
                <meshStandardMaterial color="#63b3ed" emissive="#3182ce" emissiveIntensity={0.4} />
            </mesh>

            {/* Chân màn hình */}
            <mesh position={[0, 0.72, 0]} castShadow>
                <boxGeometry args={[0.08, 0.2, 0.08]} />
                <meshStandardMaterial color="#2d3748" />
            </mesh>

            {/* Đế màn hình */}
            <mesh position={[0, 0.62, 0]} castShadow>
                <boxGeometry args={[0.3, 0.03, 0.2]} />
                <meshStandardMaterial color="#2d3748" />
            </mesh>

            {/* Bàn phím */}
            <mesh position={[0, 0.79, 0.35]} castShadow>
                <boxGeometry args={[0.55, 0.03, 0.2]} />
                <meshStandardMaterial color="#2d3748" />
            </mesh>

            {/* Chuột */}
            <mesh position={[0.4, 0.79, 0.35]} castShadow>
                <boxGeometry args={[0.08, 0.03, 0.12]} />
                <meshStandardMaterial color="#4a5568" />
            </mesh>
        </group>
    )
}