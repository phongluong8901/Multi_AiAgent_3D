type Props = {
    position: [number, number, number]
    rotation?: [number, number, number]
}

export default function Sofa({ position, rotation = [0, 0, 0] }: Props) {
    return (
        <group position={position} rotation={rotation}>
            {/* Đệm ngồi */}
            <mesh position={[0, 0.35, 0]} castShadow>
                <boxGeometry args={[1.8, 0.35, 0.7]} />
                <meshStandardMaterial color="#5a67d8" />
            </mesh>

            {/* Tựa lưng */}
            <mesh position={[0, 0.65, -0.28]} castShadow>
                <boxGeometry args={[1.8, 0.55, 0.2]} />
                <meshStandardMaterial color="#4c51bf" />
            </mesh>

            {/* Tay vịn trái */}
            <mesh position={[-0.85, 0.5, 0]} castShadow>
                <boxGeometry args={[0.15, 0.4, 0.7]} />
                <meshStandardMaterial color="#4c51bf" />
            </mesh>

            {/* Tay vịn phải */}
            <mesh position={[0.85, 0.5, 0]} castShadow>
                <boxGeometry args={[0.15, 0.4, 0.7]} />
                <meshStandardMaterial color="#4c51bf" />
            </mesh>
        </group>
    )
}