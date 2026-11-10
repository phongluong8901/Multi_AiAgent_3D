'use client'

type Props = {
    position?: [number, number, number]
    width?: number
    length?: number
    rotation?: number // radian, xoay đường
}

export default function Road({
    position = [0, 0.01, 0],
    width = 8,
    length = 60,
    rotation = 0,
}: Props) {
    return (
        <group position={position} rotation={[0, rotation, 0]}>
            {/* Mặt đường chính */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[width, length]} />
                <meshStandardMaterial color="#334155" roughness={0.9} />
            </mesh>

            {/* Vạch kẻ giữa đường (đứt đoạn) */}
            {Array.from({ length: Math.floor(length / 4) }).map((_, i) => (
                <mesh
                    key={i}
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[0, 0.015, -length / 2 + 2 + i * 4]}
                >
                    <planeGeometry args={[0.25, 1.8]} />
                    <meshStandardMaterial color="#f8fafc" />
                </mesh>
            ))}

            {/* Lề đường 2 bên */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2 + 0.4, 0.02, 0]}>
                <planeGeometry args={[0.8, length]} />
                <meshStandardMaterial color="#1e293b" />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-(width / 2 + 0.4), 0.02, 0]}>
                <planeGeometry args={[0.8, length]} />
                <meshStandardMaterial color="#1e293b" />
            </mesh>
        </group>
    )
}