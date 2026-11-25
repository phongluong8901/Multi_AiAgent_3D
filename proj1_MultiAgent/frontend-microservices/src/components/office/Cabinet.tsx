type Props = {
    position: [number, number, number]
}

export default function Cabinet({ position }: Props) {
    return (
        <group position={position}>
            {/* Thân tủ */}
            <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.2, 1.4, 0.5]} />
                <meshStandardMaterial color="#718096" />
            </mesh>

            {/* Cánh tủ 1 */}
            <mesh position={[-0.3, 0.7, 0.26]} castShadow>
                <boxGeometry args={[0.55, 1.3, 0.04]} />
                <meshStandardMaterial color="#4a5568" />
            </mesh>

            {/* Cánh tủ 2 */}
            <mesh position={[0.3, 0.7, 0.26]} castShadow>
                <boxGeometry args={[0.55, 1.3, 0.04]} />
                <meshStandardMaterial color="#4a5568" />
            </mesh>
        </group>
    )
}