'use client'

import React, { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Sky, Grid } from '@react-three/drei'
import * as THREE from 'three'
import { MapObjectItem, PlaceableItemType } from '@/lib/maps/mapEditorTypes'
import { MapItemRenderer } from '@/components/maps/MapItemRenderer'

interface MapEditorCanvasProps {
    items: MapObjectItem[]
    selectedId: string | null
    onSelectId: (id: string | null) => void
    activeTool: PlaceableItemType | null
    onPlaceItem: (point: [number, number, number]) => void
    groundColor?: string
    groundSize?: [number, number]
    skyPreset?: 'city' | 'outdoor' | 'office'
}

export function MapEditorCanvas({
    items,
    selectedId,
    onSelectId,
    activeTool,
    onPlaceItem,
    groundColor = '#1e293b',
    groundSize = [80, 80],
    skyPreset = 'city',
}: MapEditorCanvasProps) {
    const controlsRef = useRef<any>(null)

    const handlePointerDownFloor = (e: any) => {
        // e.point gives click position
        e.stopPropagation()
        if (activeTool) {
            // Snap to 2 unit grid
            const snapX = Math.round(e.point.x / 2) * 2
            const snapZ = Math.round(e.point.z / 2) * 2
            onPlaceItem([snapX, 0, snapZ])
        } else {
            onSelectId(null)
        }
    }

    return (
        <div className="relative w-full h-full bg-zinc-950 select-none">
            <Canvas
                shadows
                camera={{ position: [30, 24, 30], fov: 45 }}
                className="w-full h-full"
            >
                {/* Sky & Lights */}
                <Sky
                    distance={450000}
                    sunPosition={[20, 30, 20]}
                    inclination={0.6}
                    azimuth={0.25}
                />
                <ambientLight intensity={0.6} />
                <directionalLight
                    position={[20, 35, 20]}
                    intensity={1.5}
                    castShadow
                    shadow-mapSize={[2048, 2048]}
                />
                <pointLight position={[0, 15, 0]} intensity={0.5} color="#38bdf8" />

                {/* Orbit Controls */}
                <OrbitControls
                    ref={controlsRef}
                    makeDefault
                    minDistance={8}
                    maxDistance={120}
                    maxPolarAngle={Math.PI / 2 - 0.05}
                />

                {/* Helper Grid for snapping */}
                <Grid
                    position={[0, 0.01, 0]}
                    args={groundSize}
                    cellSize={2}
                    cellThickness={0.7}
                    cellColor="#475569"
                    sectionSize={10}
                    sectionThickness={1.3}
                    sectionColor="#38bdf8"
                    fadeDistance={100}
                    fadeStrength={1}
                />

                {/* Ground plane */}
                <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[0, 0, 0]}
                    receiveShadow
                    onPointerDown={handlePointerDownFloor}
                >
                    <planeGeometry args={groundSize} />
                    <meshStandardMaterial color={groundColor} roughness={0.8} />
                </mesh>

                {/* Render All Map Objects */}
                {items.map((item) => (
                    <MapItemRenderer
                        key={item.id}
                        item={item}
                        isSelected={selectedId === item.id}
                        onSelect={() => onSelectId(item.id)}
                    />
                ))}
            </Canvas>

            {/* Hint overlay on cursor */}
            {activeTool && (
                <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 bg-cyan-600/90 text-white font-medium text-xs px-4 py-2 rounded-full shadow-2xl backdrop-blur border border-cyan-400/40 animate-pulse flex items-center gap-2">
                    <span>Đang bật công cụ đặt:</span>
                    <strong className="underline uppercase">{activeTool}</strong>
                    <span>(Click chuột trái lên mặt lưới để đặt vật thể)</span>
                </div>
            )}
        </div>
    )
}
