type Props = {
    position: [number, number, number]
}

export default function ServerRack({ position }: Props) {
    return (
        <group position={position}>
            {/* Thân tủ */}
            <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.7, 1.8, 0.6]} />
                <meshStandardMaterial color="#1a202c" />
            </mesh>

            {/* Các khay server */}
            {[0.3, 0.6, 0.9, 1.2, 1.5].map((y, i) => (
                <mesh key={i} position={[0, y, 0.31]}>
                    <boxGeometry args={[0.6, 0.18, 0.04]} />
                    <meshStandardMaterial
                        color={i % 2 === 0 ? "#2d3748" : "#4a5568"}
                        emissive={i % 2 === 0 ? "#38a169" : "#3182ce"}
                        emissiveIntensity={0.3}
                    />
                </mesh>
            ))}
        </group>
    )
}