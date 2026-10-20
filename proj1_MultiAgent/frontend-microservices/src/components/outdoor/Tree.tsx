import { RigidBody } from '@react-three/rapier'
import * as THREE from 'three'

type TreeProps = {
    position: [number, number, number]
    scale?: number
    type?: 'oak' | 'pine' | 'sakura' | 'autumn'
}

export default function Tree({ position, scale = 1, type = 'oak' }: TreeProps) {
    const foliageColor =
        type === 'sakura'
            ? '#f687b3'
            : type === 'autumn'
            ? '#dd6b20'
            : type === 'pine'
            ? '#22543d'
            : '#2f855a'

    const highlightColor =
        type === 'sakura'
            ? '#fbb6ce'
            : type === 'autumn'
            ? '#ed8936'
            : type === 'pine'
            ? '#276749'
            : '#38a169'

    if (type === 'pine') {
        return (
            <group position={position} scale={scale}>
                {/* Thân cây thông */}
                <RigidBody type="fixed" colliders="cuboid">
                    <mesh position={[0, 0.9, 0]} castShadow>
                        <cylinderGeometry args={[0.18, 0.28, 1.8, 8]} />
                        <meshStandardMaterial color="#5c3a21" roughness={0.9} />
                    </mesh>
                </RigidBody>

                {/* Tán thông 3 tầng hình nón */}
                <mesh position={[0, 1.8, 0]} castShadow>
                    <coneGeometry args={[1.4, 1.4, 7]} />
                    <meshStandardMaterial color={foliageColor} roughness={0.7} flatShading />
                </mesh>
                <mesh position={[0, 2.6, 0]} castShadow>
                    <coneGeometry args={[1.1, 1.3, 7]} />
                    <meshStandardMaterial color={highlightColor} roughness={0.7} flatShading />
                </mesh>
                <mesh position={[0, 3.4, 0]} castShadow>
                    <coneGeometry args={[0.7, 1.1, 7]} />
                    <meshStandardMaterial color={foliageColor} roughness={0.7} flatShading />
                </mesh>
            </group>
        )
    }

    return (
        <group position={position} scale={scale}>
            {/* Thân cây gỗ tròn tự nhiên */}
            <RigidBody type="fixed" colliders="cuboid">
                <mesh position={[0, 1.0, 0]} castShadow>
                    <cylinderGeometry args={[0.22, 0.32, 2.0, 8]} />
                    <meshStandardMaterial color="#654321" roughness={0.9} />
                </mesh>
            </RigidBody>

            {/* Tán lá Low-poly phân tầng */}
            <mesh position={[0, 2.5, 0]} castShadow>
                <dodecahedronGeometry args={[1.3, 1]} />
                <meshStandardMaterial color={foliageColor} roughness={0.6} flatShading />
            </mesh>
            <mesh position={[0.4, 3.1, 0.2]} castShadow>
                <dodecahedronGeometry args={[1.0, 1]} />
                <meshStandardMaterial color={highlightColor} roughness={0.6} flatShading />
            </mesh>
            <mesh position={[-0.4, 2.8, -0.3]} castShadow>
                <dodecahedronGeometry args={[0.9, 1]} />
                <meshStandardMaterial color={foliageColor} roughness={0.6} flatShading />
            </mesh>
        </group>
    )
}
