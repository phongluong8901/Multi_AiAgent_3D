type Props = {
    color: string
    sitting?: boolean
}

export default function AgentBody({ color, sitting = false }: Props) {
    if (sitting) {
        // Ngồi: thân thấp, chân gập phía trước ghế
        return (
            <group>
                {/* Đầu */}
                <mesh position={[0, 1.15, 0]} castShadow>
                    <sphereGeometry args={[0.2, 16, 16]} />
                    <meshStandardMaterial color="#f6e05e" />
                </mesh>

                {/* Thân */}
                <mesh position={[0, 0.78, 0]} castShadow>
                    <boxGeometry args={[0.38, 0.4, 0.24]} />
                    <meshStandardMaterial color={color} />
                </mesh>

                {/* Tay */}
                <mesh position={[-0.26, 0.72, 0.12]} rotation={[0.6, 0, 0]} castShadow>
                    <boxGeometry args={[0.1, 0.35, 0.1]} />
                    <meshStandardMaterial color={color} />
                </mesh>
                <mesh position={[0.26, 0.72, 0.12]} rotation={[0.6, 0, 0]} castShadow>
                    <boxGeometry args={[0.1, 0.35, 0.1]} />
                    <meshStandardMaterial color={color} />
                </mesh>

                {/* Đùi (nằm ngang) */}
                <mesh position={[-0.1, 0.48, 0.18]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                    <boxGeometry args={[0.12, 0.28, 0.12]} />
                    <meshStandardMaterial color="#2d3748" />
                </mesh>
                <mesh position={[0.1, 0.48, 0.18]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                    <boxGeometry args={[0.12, 0.28, 0.12]} />
                    <meshStandardMaterial color="#2d3748" />
                </mesh>

                {/* Cẳng chân (xuống sàn) */}
                <mesh position={[-0.1, 0.28, 0.32]} castShadow>
                    <boxGeometry args={[0.11, 0.28, 0.11]} />
                    <meshStandardMaterial color="#2d3748" />
                </mesh>
                <mesh position={[0.1, 0.28, 0.32]} castShadow>
                    <boxGeometry args={[0.11, 0.28, 0.11]} />
                    <meshStandardMaterial color="#2d3748" />
                </mesh>
            </group>
        )
    }

    // Đứng (đi bộ)
    return (
        <group>
            <mesh position={[0, 1.55, 0]} castShadow>
                <sphereGeometry args={[0.22, 16, 16]} />
                <meshStandardMaterial color="#f6e05e" />
            </mesh>
            <mesh position={[0, 1.05, 0]} castShadow>
                <boxGeometry args={[0.4, 0.55, 0.25]} />
                <meshStandardMaterial color={color} />
            </mesh>
            <mesh position={[-0.28, 1.05, 0]} castShadow>
                <boxGeometry args={[0.12, 0.45, 0.12]} />
                <meshStandardMaterial color={color} />
            </mesh>
            <mesh position={[0.28, 1.05, 0]} castShadow>
                <boxGeometry args={[0.12, 0.45, 0.12]} />
                <meshStandardMaterial color={color} />
            </mesh>
            <mesh position={[-0.12, 0.45, 0]} castShadow>
                <boxGeometry args={[0.14, 0.5, 0.14]} />
                <meshStandardMaterial color="#2d3748" />
            </mesh>
            <mesh position={[0.12, 0.45, 0]} castShadow>
                <boxGeometry args={[0.14, 0.5, 0.14]} />
                <meshStandardMaterial color="#2d3748" />
            </mesh>
        </group>
    )
}