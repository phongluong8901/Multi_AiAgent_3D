'use client'

import React from 'react'
import { RoundedBox } from '@react-three/drei'
import Building from '@/components/iot/Building'
import House from '@/components/iot/House'
import IndustrialBuilding from '@/components/iot/IndustrialBuilding'
import Road from '@/components/iot/Road'
import StreetLight from '@/components/iot/StreetLight'
import { MapObjectItem } from '@/lib/maps/mapEditorTypes'

interface MapItemRendererProps {
    item: MapObjectItem
    isSelected: boolean
    onSelect: () => void
}

export function MapItemRenderer({ item, isSelected, onSelect }: MapItemRendererProps) {
    const rotationRad = ((item.rotation || 0) * Math.PI) / 180

    return (
        <group
            position={item.position}
            rotation={[0, rotationRad, 0]}
            onClick={(e) => {
                e.stopPropagation()
                onSelect()
            }}
        >
            {/* Visual selection outline / ring */}
            {isSelected && (
                <group position={[0, 0.05, 0]}>
                    <mesh rotation={[-Math.PI / 2, 0, 0]}>
                        <ringGeometry args={[2.5, 2.7, 32]} />
                        <meshBasicMaterial color="#38bdf8" />
                    </mesh>
                    <pointLight position={[0, 2, 0]} intensity={1.5} color="#38bdf8" distance={6} />
                </group>
            )}

            {/* Các đối tượng 3D tương ứng theo type */}
            {item.type === 'building' && (
                <Building
                    position={[0, 0, 0]}
                    width={item.width || 5}
                    height={item.height || 11}
                    depth={item.depth || 5}
                    color={item.color || '#64748b'}
                />
            )}

            {item.type === 'house' && (
                <House position={[0, 0, 0]} color={item.color || '#f8fafc'} />
            )}

            {item.type === 'industrial' && (
                <IndustrialBuilding position={[0, 0, 0]} />
            )}

            {item.type === 'road' && (
                <Road
                    position={[0, 0.02, 0]}
                    width={item.width || 8}
                    length={item.depth || 20}
                />
            )}

            {item.type === 'crossroad' && (
                <group position={[0, 0.02, 0]}>
                    <Road width={item.width || 8} length={item.width || 8} />
                    <Road width={item.width || 8} length={item.width || 8} rotation={Math.PI / 2} />
                </group>
            )}

            {item.type === 'streetlight' && (
                <StreetLight position={[0, 0, 0]} height={item.height || 5.5} />
            )}

            {item.type === 'tree' && (
                <group position={[0, 0, 0]}>
                    {/* Thân cây */}
                    <mesh position={[0, 1, 0]} castShadow>
                        <cylinderGeometry args={[0.2, 0.3, 2, 8]} />
                        <meshStandardMaterial color="#78350f" roughness={0.9} />
                    </mesh>
                    {/* Tán cây */}
                    <mesh position={[0, 2.6, 0]} castShadow>
                        <coneGeometry args={[1.6, 2.8, 8]} />
                        <meshStandardMaterial color={item.color || '#15803d'} roughness={0.8} />
                    </mesh>
                    <mesh position={[0, 3.8, 0]} castShadow>
                        <coneGeometry args={[1.2, 2.2, 8]} />
                        <meshStandardMaterial color={item.color || '#16a34a'} roughness={0.8} />
                    </mesh>
                </group>
            )}

            {item.type === 'bench' && (
                <group position={[0, 0.3, 0]}>
                    {/* Mặt ghế */}
                    <mesh position={[0, 0.2, 0]} castShadow>
                        <boxGeometry args={[1.8, 0.1, 0.6]} />
                        <meshStandardMaterial color={item.color || '#b45309'} />
                    </mesh>
                    {/* Lưng ghế */}
                    <mesh position={[0, 0.6, -0.25]} castShadow>
                        <boxGeometry args={[1.8, 0.5, 0.08]} />
                        <meshStandardMaterial color={item.color || '#b45309'} />
                    </mesh>
                    {/* Chân ghế */}
                    <mesh position={[-0.7, -0.1, 0]}>
                        <boxGeometry args={[0.1, 0.5, 0.5]} />
                        <meshStandardMaterial color="#1e293b" />
                    </mesh>
                    <mesh position={[0.7, -0.1, 0]}>
                        <boxGeometry args={[0.1, 0.5, 0.5]} />
                        <meshStandardMaterial color="#1e293b" />
                    </mesh>
                </group>
            )}

            {item.type === 'desk' && (
                <group position={[0, 0, 0]}>
                    {/* Mặt bàn */}
                    <RoundedBox args={[2, 0.1, 1.2]} radius={0.02} position={[0, 1.1, 0]} castShadow>
                        <meshStandardMaterial color="#e2e8f0" roughness={0.3} />
                    </RoundedBox>
                    {/* Chân bàn */}
                    <mesh position={[-0.9, 0.55, -0.5]}>
                        <cylinderGeometry args={[0.04, 0.04, 1.1]} />
                        <meshStandardMaterial color="#475569" metalness={0.8} />
                    </mesh>
                    <mesh position={[0.9, 0.55, -0.5]}>
                        <cylinderGeometry args={[0.04, 0.04, 1.1]} />
                        <meshStandardMaterial color="#475569" metalness={0.8} />
                    </mesh>
                    <mesh position={[-0.9, 0.55, 0.5]}>
                        <cylinderGeometry args={[0.04, 0.04, 1.1]} />
                        <meshStandardMaterial color="#475569" metalness={0.8} />
                    </mesh>
                    <mesh position={[0.9, 0.55, 0.5]}>
                        <cylinderGeometry args={[0.04, 0.04, 1.1]} />
                        <meshStandardMaterial color="#475569" metalness={0.8} />
                    </mesh>
                    {/* Laptop mini trên bàn */}
                    <mesh position={[0, 1.18, 0]}>
                        <boxGeometry args={[0.5, 0.03, 0.35]} />
                        <meshStandardMaterial color="#0284c7" />
                    </mesh>
                </group>
            )}
        </group>
    )
}
