'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Sky, Environment } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import Building from './Building'
import House from './House'
import IndustrialBuilding from './IndustrialBuilding'
import Road from './Road'
import StreetLight from './StreetLight'
// import Agent từ chỗ bạn đang dùng

export default function SmartCityScene() {
    return (
        <div className="w-full h-[calc(100vh-80px)] rounded-xl overflow-hidden border border-zinc-800">
            <Canvas shadows camera={{ position: [25, 18, 25], fov: 45 }}>
                <color attach="background" args={['#0f172a']} />
                <fog attach="fog" args={['#0f172a', 30, 80]} />

                <ambientLight intensity={0.35} />
                <directionalLight
                    position={[20, 30, 10]}
                    intensity={1.4}
                    castShadow
                    shadow-mapSize={[2048, 2048]}
                />

                <Sky sunPosition={[100, 40, 100]} />
                <Environment preset="city" />

                <Physics gravity={[0, -9.81, 0]}>
                    {/* Đất */}
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                        <planeGeometry args={[80, 80]} />
                        <meshStandardMaterial color="#1e293b" />
                    </mesh>

                    {/* Đường */}
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
                        <planeGeometry args={[8, 80]} />
                        <meshStandardMaterial color="#334155" />
                    </mesh>

                    {/* Nhà ở */}
                    <House position={[-12, 0, -8]} color="#f1f5f9" />
                    <House position={[-12, 0, 2]} color="#e2e8f0" />
                    <House position={[-18, 0, -3]} color="#f8fafc" />

                    {/* Tòa nhà */}
                    <Building position={[10, 0, -10]} width={5} height={12} depth={5} color="#64748b" />
                    <Building position={[18, 0, -6]} width={4} height={9} depth={4} color="#475569" />
                    <Building position={[14, 0, 6]} width={6} height={15} depth={5} color="#334155" />

                    {/* Khu công nghiệp */}
                    <IndustrialBuilding position={[8, 0, 14]} />
                    <IndustrialBuilding position={[16, 0, 16]} />

                    {/* Có thể thêm Agent vào đây */}
                    {/* <Agent position={[0, 0, 0]} ... /> */}

                    {/* Đường chính */}
                    <Road position={[0, 0.01, 0]} width={8} length={70} />

                    {/* Đường ngang */}
                    <Road position={[0, 0.01, 12]} width={6} length={40} rotation={Math.PI / 2} />

                    {/* Đèn đường */}
                    <StreetLight position={[-5, 0, -15]} />
                    <StreetLight position={[5, 0, -15]} />
                    <StreetLight position={[-5, 0, 0]} />
                    <StreetLight position={[5, 0, 0]} />
                    <StreetLight position={[-5, 0, 15]} />
                    <StreetLight position={[5, 0, 15]} />
                </Physics>

                <OrbitControls maxPolarAngle={Math.PI / 2.1} minDistance={10} maxDistance={60} />
            </Canvas>
        </div>
    )
}