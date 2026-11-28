type Props = {
    position: [number, number, number]
}

export default function Plant({ position }: Props) {
    return (
        <group position={position}>
            {/* Chậu */}
            <mesh position={[0, 0.2, 0]} castShadow>
                <cylinderGeometry args={[0.18, 0.15, 0.4, 16]} />
                <meshStandardMaterial color="#c53030" />
            </mesh>

            {/* Thân cây */}
            <mesh position={[0, 0.55, 0]} castShadow>
                <cylinderGeometry args={[0.03, 0.04, 0.35, 8]} />
                <meshStandardMaterial color="#744210" />
            </mesh>

            {/* Lá */}
            <mesh position={[0, 0.85, 0]} castShadow>
                <sphereGeometry args={[0.28, 12, 12]} />
                <meshStandardMaterial color="#38a169" />
            </mesh>
        </group>
    )
}