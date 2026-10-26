'use client'

import React from 'react'
import { RoundedBox } from '@react-three/drei'
import Building from '@/components/iot/Building'
import House from '@/components/iot/House'
import IndustrialBuilding from '@/components/iot/IndustrialBuilding'
import Road from '@/components/iot/Road'
import StreetLight from '@/components/iot/StreetLight'
import { MapObjectItem } from '@/lib/maps/mapEditorTypes'
import { NvidiaRobotRenderer } from '@/components/agents/NvidiaRobots'

interface MapItemRendererProps {
    item: MapObjectItem
    isSelected: boolean
    onSelect: () => void
}

export function MapItemRenderer({ item, isSelected, onSelect }: MapItemRendererProps) {
    const rotationRad = ((item.rotation || 0) * Math.PI) / 180
    const isRobot = item.type.startsWith('agent_') || item.type === 'robot_prototype' || item.type === 'robot_arm'
    const ringInner = isRobot ? 0.95 : 2.5
    const ringOuter = isRobot ? 1.05 : 2.7

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
                        <ringGeometry args={[ringInner, ringOuter, 32]} />
                        <meshBasicMaterial color={isRobot ? '#76b900' : '#38bdf8'} />
                    </mesh>
                    <pointLight position={[0, 2, 0]} intensity={1.5} color={isRobot ? '#76b900' : '#38bdf8'} distance={5} />
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

            {/* --- 1. CÁNH TAY ROBOT CÔNG NGHIỆP 6 TRỤC (ROBOT ARM) --- */}
            {item.type === 'robot_arm' && (
                <group position={[0, 0, 0]}>
                    {/* Đế kim loại tròn */}
                    <mesh position={[0, 0.15, 0]} castShadow>
                        <cylinderGeometry args={[0.7, 0.8, 0.3, 24]} />
                        <meshStandardMaterial color="#27272a" roughness={0.4} metalness={0.8} />
                    </mesh>
                    {/* Khớp xoay thân đế */}
                    <mesh position={[0, 0.5, 0]} castShadow>
                        <cylinderGeometry args={[0.45, 0.5, 0.4, 20]} />
                        <meshStandardMaterial color={item.color || '#eab308'} roughness={0.3} metalness={0.5} />
                    </mesh>
                    {/* Khớp khuỷu 1 */}
                    <mesh position={[0, 0.8, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
                        <cylinderGeometry args={[0.25, 0.25, 0.6, 16]} />
                        <meshStandardMaterial color="#18181b" metalness={0.9} />
                    </mesh>
                    {/* Cánh tay chính vươn lên */}
                    <mesh position={[0.4, 1.4, 0]} rotation={[0, 0, -Math.PI / 6]} castShadow>
                        <boxGeometry args={[0.3, 1.4, 0.35]} />
                        <meshStandardMaterial color={item.color || '#eab308'} roughness={0.3} metalness={0.5} />
                    </mesh>
                    {/* Khớp khuỷu 2 */}
                    <mesh position={[0.75, 1.95, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
                        <cylinderGeometry args={[0.2, 0.2, 0.5, 16]} />
                        <meshStandardMaterial color="#18181b" metalness={0.9} />
                    </mesh>
                    {/* Cẳng tay vươn ngang */}
                    <mesh position={[1.3, 1.95, 0]} rotation={[0, 0, -Math.PI / 12]} castShadow>
                        <boxGeometry args={[1.0, 0.22, 0.25]} />
                        <meshStandardMaterial color={item.color || '#eab308'} roughness={0.3} metalness={0.5} />
                    </mesh>
                    {/* Cổ tay xoay & Đầu kẹp Gripper */}
                    <mesh position={[1.9, 1.95, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
                        <cylinderGeometry args={[0.14, 0.14, 0.2, 16]} />
                        <meshStandardMaterial color="#94a3b8" metalness={0.9} />
                    </mesh>
                    {/* 2 ngón kẹp gắp phôi kim loại */}
                    <mesh position={[2.08, 2.05, 0]} castShadow>
                        <boxGeometry args={[0.2, 0.05, 0.12]} />
                        <meshStandardMaterial color="#cbd5e1" metalness={0.95} />
                    </mesh>
                    <mesh position={[2.08, 1.85, 0]} castShadow>
                        <boxGeometry args={[0.2, 0.05, 0.12]} />
                        <meshStandardMaterial color="#cbd5e1" metalness={0.95} />
                    </mesh>
                </group>
            )}

            {/* --- NVIDIA FLEET ROBOTS --- */}
            {(item.type === 'robot_prototype' || item.type === 'agent_amr') && (
                <group position={[0, 0, 0]}>
                    <NvidiaRobotRenderer form="amr" color={item.color || '#f97316'} />
                </group>
            )}

            {item.type === 'agent_gr00t' && (
                <group position={[0, 0, 0]}>
                    <NvidiaRobotRenderer form="humanoid" color={item.color || '#76b900'} />
                </group>
            )}

            {item.type === 'agent_duck' && (
                <group position={[0, 0, 0]}>
                    <NvidiaRobotRenderer form="duck" color={item.color || '#7dd3fc'} />
                </group>
            )}

            {item.type === 'agent_drone' && (
                <group position={[0, 0, 0]}>
                    <NvidiaRobotRenderer form="drone" color={item.color || '#06b6d4'} />
                </group>
            )}

            {/* --- 3. ĐÈN XƯỞNG CÔNG NGHIỆP HIGH-BAY (INDUSTRIAL LAMP) --- */}
            {item.type === 'industrial_lamp' && (
                <group position={[0, 0, 0]}>
                    {/* Cột trụ kim loại đứng vững chãi */}
                    <mesh position={[0, 2.2, 0]} castShadow>
                        <cylinderGeometry args={[0.06, 0.09, 4.4, 12]} />
                        <meshStandardMaterial color="#475569" metalness={0.8} />
                    </mesh>
                    {/* Cần vươn ngang */}
                    <mesh position={[0.4, 4.3, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
                        <cylinderGeometry args={[0.05, 0.05, 0.9, 8]} />
                        <meshStandardMaterial color="#475569" metalness={0.8} />
                    </mesh>
                    {/* Chóa đèn công nghiệp hình nón úp */}
                    <mesh position={[0.8, 4.15, 0]} castShadow>
                        <coneGeometry args={[0.55, 0.35, 16, 1, true]} />
                        <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} side={2} />
                    </mesh>
                    {/* Bóng đèn LED công suất lớn tỏa sáng rọi sàn */}
                    <mesh position={[0.8, 4.1, 0]}>
                        <sphereGeometry args={[0.18, 16, 16]} />
                        <meshStandardMaterial color="#fef08a" emissive="#f59e0b" emissiveIntensity={3} />
                    </mesh>
                    <pointLight position={[0.8, 3.8, 0]} color="#fef08a" intensity={2.2} distance={12} />
                </group>
            )}

            {/* --- 4. QUẠT THÔNG GIÓ CÔNG NGHIỆP (INDUSTRIAL FAN) --- */}
            {item.type === 'industrial_fan' && (
                <group position={[0, 0, 0]}>
                    {/* Khung chân giá đỡ chữ H */}
                    <mesh position={[0, 0.06, 0]} castShadow>
                        <boxGeometry args={[1.4, 0.1, 0.8]} />
                        <meshStandardMaterial color="#334155" metalness={0.8} />
                    </mesh>
                    <mesh position={[0, 0.7, 0]} castShadow>
                        <cylinderGeometry args={[0.06, 0.06, 1.2, 12]} />
                        <meshStandardMaterial color="#475569" metalness={0.8} />
                    </mesh>
                    {/* Khung lồng bảo vệ tròn */}
                    <mesh position={[0, 1.4, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                        <torusGeometry args={[0.65, 0.05, 12, 24]} />
                        <meshStandardMaterial color="#64748b" metalness={0.8} />
                    </mesh>
                    {/* Tâm motor quạt */}
                    <mesh position={[0, 1.4, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                        <cylinderGeometry args={[0.2, 0.2, 0.22, 16]} />
                        <meshStandardMaterial color="#1e293b" metalness={0.6} />
                    </mesh>
                    {/* 4 cánh quạt kim loại tạo luồng gió */}
                    {[-Math.PI / 4, Math.PI / 4, (3 * Math.PI) / 4, (-3 * Math.PI) / 4].map((ang, i) => (
                        <mesh key={i} position={[0, 1.4, 0]} rotation={[0, 0, ang]}>
                            <boxGeometry args={[0.12, 0.85, 0.02]} />
                            <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
                        </mesh>
                    ))}
                </group>
            )}

            {/* --- 5. CAMERA AN NINH CCTV 3D (CCTV CAMERA) --- */}
            {item.type === 'cctv_camera' && (
                <group position={[0, 0, 0]}>
                    {/* Cột gắn camera */}
                    <mesh position={[0, 1.3, 0]} castShadow>
                        <cylinderGeometry args={[0.05, 0.06, 2.6, 12]} />
                        <meshStandardMaterial color="#475569" metalness={0.7} />
                    </mesh>
                    {/* Khớp gập xoay góc */}
                    <mesh position={[0.15, 2.5, 0]} rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[0.06, 0.06, 0.25, 12]} />
                        <meshStandardMaterial color="#1e293b" />
                    </mesh>
                    {/* Vỏ thân camera hình hộp trụ bo tròn */}
                    <RoundedBox args={[0.6, 0.22, 0.25]} radius={0.04} position={[0.4, 2.4, 0]} rotation={[0, 0, -Math.PI / 8]} castShadow>
                        <meshStandardMaterial color={item.color || '#f1f5f9'} roughness={0.2} />
                    </RoundedBox>
                    {/* Mắt kính camera đen */}
                    <mesh position={[0.7, 2.27, 0]} rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[0.09, 0.09, 0.05, 16]} />
                        <meshStandardMaterial color="#020617" roughness={0.1} metalness={0.9} />
                    </mesh>
                    {/* Đèn LED hồng ngoại an ninh nhấp nháy đỏ */}
                    <mesh position={[0.68, 2.37, 0]}>
                        <sphereGeometry args={[0.025, 8, 8]} />
                        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={3} />
                    </mesh>
                    {/* Vùng nón quét quan sát camera (trực quan hóa góc soi) */}
                    <mesh position={[1.4, 1.4, 0]} rotation={[0, 0, -Math.PI / 3]}>
                        <coneGeometry args={[1.2, 2.5, 16, 1, true]} />
                        <meshBasicMaterial color="#38bdf8" transparent opacity={0.12} wireframe />
                    </mesh>
                </group>
            )}

            {/* --- 6. BĂNG CHUYỀN SẢN XUẤT (CONVEYOR) --- */}
            {item.type === 'conveyor' && (
                <group position={[0, 0, 0]}>
                    {/* 4 chân giá đỡ thép */}
                    {[-0.85, 0.85].map((x) =>
                        [-2.5, 0, 2.5].map((z, idx) => (
                            <mesh key={`${x}-${z}-${idx}`} position={[x, 0.35, z]} castShadow>
                                <boxGeometry args={[0.08, 0.7, 0.08]} />
                                <meshStandardMaterial color="#334155" metalness={0.8} />
                            </mesh>
                        ))
                    )}
                    {/* Khung sườn ray 2 bên */}
                    <mesh position={[-0.9, 0.75, 0]} castShadow>
                        <boxGeometry args={[0.08, 0.15, 6]} />
                        <meshStandardMaterial color="#475569" metalness={0.85} />
                    </mesh>
                    <mesh position={[0.9, 0.75, 0]} castShadow>
                        <boxGeometry args={[0.08, 0.15, 6]} />
                        <meshStandardMaterial color="#475569" metalness={0.85} />
                    </mesh>
                    {/* Mặt thảm băng tải cao su đen */}
                    <mesh position={[0, 0.74, 0]} receiveShadow>
                        <boxGeometry args={[1.7, 0.08, 5.9]} />
                        <meshStandardMaterial color="#18181b" roughness={0.7} />
                    </mesh>
                    {/* Các con lăn rãnh trên băng tải */}
                    {[-2.2, -1.4, -0.6, 0.2, 1.0, 1.8].map((z, idx) => (
                        <mesh key={idx} position={[0, 0.79, z]}>
                            <boxGeometry args={[1.65, 0.02, 0.06]} />
                            <meshStandardMaterial color="#3f3f46" metalness={0.5} />
                        </mesh>
                    ))}
                    {/* Kiện hàng mẫu đặt trên băng chuyền */}
                    <RoundedBox args={[0.8, 0.5, 0.8]} radius={0.02} position={[0, 1.05, 0]} castShadow>
                        <meshStandardMaterial color="#d97706" roughness={0.6} />
                    </RoundedBox>
                </group>
            )}

            {/* --- 7. ĐÈN LED THÔNG MINH RGB (SMART LED) --- */}
            {item.type === 'smart_led' && (
                <group position={[0, 0, 0]}>
                    {/* Chân đế kim loại tròn */}
                    <mesh position={[0, 0.04, 0]} castShadow>
                        <cylinderGeometry args={[0.3, 0.35, 0.08, 20]} />
                        <meshStandardMaterial color="#1e293b" metalness={0.8} />
                    </mesh>
                    {/* Thân cột đứng thanh mảnh */}
                    <mesh position={[0, 0.9, 0]} castShadow>
                        <cylinderGeometry args={[0.03, 0.03, 1.7, 12]} />
                        <meshStandardMaterial color="#334155" metalness={0.9} />
                    </mesh>
                    {/* Quả cầu / Ống đèn LED RGB phát quang */}
                    <mesh position={[0, 1.7, 0]}>
                        <sphereGeometry args={[0.22, 20, 20]} />
                        <meshStandardMaterial
                            color={item.color || '#a855f7'}
                            emissive={item.color || '#a855f7'}
                            emissiveIntensity={2.5}
                            toneMapped={false}
                        />
                    </mesh>
                    <pointLight position={[0, 1.7, 0]} color={item.color || '#a855f7'} intensity={1.8} distance={8} />
                </group>
            )}

            {/* --- 8. VÒI TƯỚI NƯỚC TỰ ĐỘNG (WATER SPRINKLER) --- */}
            {item.type === 'water_sprinkler' && (
                <group position={[0, 0, 0]}>
                    {/* Cọc cắm đất */}
                    <mesh position={[0, 0.3, 0]} castShadow>
                        <cylinderGeometry args={[0.04, 0.04, 0.6, 12]} />
                        <meshStandardMaterial color="#1e293b" />
                    </mesh>
                    {/* Đầu xoay tưới phun nước */}
                    <mesh position={[0, 0.65, 0]} castShadow>
                        <cylinderGeometry args={[0.12, 0.12, 0.15, 16]} />
                        <meshStandardMaterial color={item.color || '#0284c7'} metalness={0.7} />
                    </mesh>
                    {/* 3 tay vòi phun nước hướng chéo */}
                    {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((rad, idx) => (
                        <mesh key={idx} position={[Math.cos(rad) * 0.25, 0.72, Math.sin(rad) * 0.25]} rotation={[0, -rad, Math.PI / 4]}>
                            <cylinderGeometry args={[0.02, 0.02, 0.28, 8]} />
                            <meshStandardMaterial color="#38bdf8" metalness={0.9} />
                        </mesh>
                    ))}
                    {/* Tia nước phun sương hình vòng cung 3D */}
                    <mesh position={[0, 0.75, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                        <ringGeometry args={[0.8, 1.8, 24]} />
                        <meshBasicMaterial color="#38bdf8" transparent opacity={0.25} side={2} />
                    </mesh>
                </group>
            )}

            {/* --- 9. RÈM CỬA TỰ ĐỘNG THÔNG MINH (SMART CURTAIN) --- */}
            {item.type === 'smart_curtain' && (
                <group position={[0, 0, 0]}>
                    {/* Thanh ray nhôm trượt phía trên */}
                    <mesh position={[0, 2.7, 0]} castShadow>
                        <boxGeometry args={[3.2, 0.08, 0.1]} />
                        <meshStandardMaterial color="#94a3b8" metalness={0.9} />
                    </mesh>
                    {/* Hộp động cơ rèm Motor thông minh ở góc */}
                    <mesh position={[1.5, 2.65, 0]} castShadow>
                        <boxGeometry args={[0.2, 0.25, 0.14]} />
                        <meshStandardMaterial color="#0f172a" />
                    </mesh>
                    {/* Tấm rèm vải xếp nếp hiện đại */}
                    <RoundedBox args={[2.9, 2.5, 0.06]} radius={0.02} position={[0, 1.35, 0]} castShadow>
                        <meshStandardMaterial color={item.color || '#e2e8f0'} roughness={0.7} />
                    </RoundedBox>
                    {/* Nếp gấp rèm */}
                    {[-1.0, -0.5, 0, 0.5, 1.0].map((x, idx) => (
                        <mesh key={idx} position={[x, 1.35, 0.04]}>
                            <boxGeometry args={[0.04, 2.45, 0.02]} />
                            <meshStandardMaterial color="#cbd5e1" roughness={0.9} />
                        </mesh>
                    ))}
                </group>
            )}

            {/* --- 10. ĐIỀU HÒA KHÔNG KHÍ INVERTER (AIR CONDITIONER) --- */}
            {item.type === 'air_conditioner' && (
                <group position={[0, 0, 0]}>
                    {/* Khung máy lạnh bo cạnh mềm */}
                    <RoundedBox args={[2.2, 0.65, 0.45]} radius={0.06} position={[0, 2.4, 0]} castShadow>
                        <meshStandardMaterial color={item.color || '#f8fafc'} roughness={0.2} metalness={0.1} />
                    </RoundedBox>
                    {/* Cánh vẫy gió bên dưới hơi hé mở */}
                    <mesh position={[0, 2.1, 0.15]} rotation={[Math.PI / 8, 0, 0]}>
                        <boxGeometry args={[2.0, 0.04, 0.2]} />
                        <meshStandardMaterial color="#e2e8f0" />
                    </mesh>
                    {/* Màn hình hiển thị nhiệt độ LED 24°C */}
                    <mesh position={[0.7, 2.4, 0.23]}>
                        <boxGeometry args={[0.25, 0.1, 0.01]} />
                        <meshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={2.5} />
                    </mesh>
                    {/* Luồng gió mát làm mát 3D */}
                    <mesh position={[0, 1.5, 0.5]} rotation={[Math.PI / 4, 0, 0]}>
                        <planeGeometry args={[1.8, 1.2]} />
                        <meshBasicMaterial color="#38bdf8" transparent opacity={0.12} side={2} />
                    </mesh>
                </group>
            )}

            {/* --- 11. CỬA THÔNG MINH NHẬN DIỆN FACEID / VÂN TAY (SMART DOOR) --- */}
            {item.type === 'smart_door' && (
                <group position={[0, 0, 0]}>
                    {/* Khung bao cửa nhôm xingfa */}
                    <mesh position={[0, 1.3, 0]} castShadow>
                        <boxGeometry args={[1.8, 2.6, 0.15]} />
                        <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.8} />
                    </mesh>
                    {/* Cánh cửa chính */}
                    <mesh position={[0, 1.28, 0.02]} castShadow>
                        <boxGeometry args={[1.55, 2.45, 0.08]} />
                        <meshStandardMaterial color={item.color || '#1e293b'} roughness={0.5} />
                    </mesh>
                    {/* Kính lấy sáng ở giữa cửa */}
                    <mesh position={[0, 1.5, 0.02]}>
                        <boxGeometry args={[0.5, 1.2, 0.09]} />
                        <meshPhysicalMaterial color="#38bdf8" transparent opacity={0.4} roughness={0.1} />
                    </mesh>
                    {/* Khóa cửa điện tử thông minh có đầu đọc vân tay */}
                    <mesh position={[0.65, 1.1, 0.09]} castShadow>
                        <boxGeometry args={[0.1, 0.35, 0.05]} />
                        <meshStandardMaterial color="#020617" metalness={0.9} />
                    </mesh>
                    {/* Đèn báo xác thực thành công màu xanh lá */}
                    <mesh position={[0.65, 1.22, 0.12]}>
                        <sphereGeometry args={[0.02, 10, 10]} />
                        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={3} />
                    </mesh>
                </group>
            )}

            {/* --- 12. VỊT VÀNG AI THÔNG THÁI (RUBBER DUCK DEBUGGER) --- */}
            {item.type === 'agent_duck' && (
                <group position={[0, 0, 0]}>
                    {/* Bệ đệm tròn phát quang dịu */}
                    <mesh position={[0, 0.05, 0]}>
                        <cylinderGeometry args={[0.7, 0.75, 0.1, 24]} />
                        <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.8} />
                    </mesh>
                    <mesh position={[0, 0.11, 0]}>
                        <cylinderGeometry args={[0.65, 0.65, 0.02, 24]} />
                        <meshStandardMaterial color="#eab308" emissive="#eab308" emissiveIntensity={0.8} />
                    </mesh>

                    {/* Thân vịt bầu bĩnh */}
                    <mesh position={[0, 0.6, 0]} scale={[1, 0.85, 1.2]} castShadow>
                        <sphereGeometry args={[0.5, 24, 24]} />
                        <meshStandardMaterial color={item.color || '#facc15'} roughness={0.3} metalness={0.1} />
                    </mesh>

                    {/* Đuôi vịt vểnh lên phía sau */}
                    <mesh position={[0, 0.75, -0.55]} rotation={[-Math.PI / 4, 0, 0]} castShadow>
                        <coneGeometry args={[0.22, 0.38, 16]} />
                        <meshStandardMaterial color={item.color || '#facc15'} roughness={0.3} />
                    </mesh>

                    {/* Cánh vịt bên trái và phải */}
                    <mesh position={[-0.48, 0.6, 0.02]} rotation={[0, 0, Math.PI / 8]} scale={[0.15, 0.45, 0.75]} castShadow>
                        <sphereGeometry args={[0.5, 16, 16]} />
                        <meshStandardMaterial color="#eab308" roughness={0.35} />
                    </mesh>
                    <mesh position={[0.48, 0.6, 0.02]} rotation={[0, 0, -Math.PI / 8]} scale={[0.15, 0.45, 0.75]} castShadow>
                        <sphereGeometry args={[0.5, 16, 16]} />
                        <meshStandardMaterial color="#eab308" roughness={0.35} />
                    </mesh>

                    {/* Cổ và Đầu vịt tròn */}
                    <mesh position={[0, 1.05, 0.3]} castShadow>
                        <sphereGeometry args={[0.36, 24, 24]} />
                        <meshStandardMaterial color={item.color || '#facc15'} roughness={0.3} metalness={0.1} />
                    </mesh>

                    {/* Mỏ vịt cam đặc trưng dẹp */}
                    <mesh position={[0, 0.98, 0.65]} scale={[1.2, 0.5, 1]} castShadow>
                        <boxGeometry args={[0.26, 0.14, 0.28]} />
                        <meshStandardMaterial color="#f97316" roughness={0.3} />
                    </mesh>

                    {/* Mắt to tròn long lanh */}
                    <mesh position={[-0.15, 1.15, 0.58]}>
                        <sphereGeometry args={[0.07, 16, 16]} />
                        <meshStandardMaterial color="#0f172a" roughness={0.1} />
                    </mesh>
                    <mesh position={[-0.13, 1.18, 0.63]}>
                        <sphereGeometry args={[0.025, 12, 12]} />
                        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} />
                    </mesh>

                    <mesh position={[0.15, 1.15, 0.58]}>
                        <sphereGeometry args={[0.07, 16, 16]} />
                        <meshStandardMaterial color="#0f172a" roughness={0.1} />
                    </mesh>
                    <mesh position={[0.13, 1.18, 0.63]}>
                        <sphereGeometry args={[0.025, 12, 12]} />
                        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} />
                    </mesh>

                    {/* Kính tri thức gọng tròn thông thái */}
                    <mesh position={[-0.15, 1.15, 0.62]} rotation={[0, 0, 0]}>
                        <torusGeometry args={[0.09, 0.015, 12, 24]} />
                        <meshStandardMaterial color="#0284c7" metalness={0.9} roughness={0.1} />
                    </mesh>
                    <mesh position={[0.15, 1.15, 0.62]} rotation={[0, 0, 0]}>
                        <torusGeometry args={[0.09, 0.015, 12, 24]} />
                        <meshStandardMaterial color="#0284c7" metalness={0.9} roughness={0.1} />
                    </mesh>
                    <mesh position={[0, 1.15, 0.63]}>
                        <cylinderGeometry args={[0.01, 0.01, 0.12]} rotation={[0, 0, Math.PI / 2]} />
                        <meshStandardMaterial color="#0284c7" metalness={0.9} />
                    </mesh>

                    {/* Mũ cử nhân tốt nghiệp trên đầu chú vịt */}
                    <mesh position={[0, 1.42, 0.28]} rotation={[0.05, 0, 0]} castShadow>
                        <boxGeometry args={[0.5, 0.04, 0.5]} />
                        <meshStandardMaterial color="#1e1b4b" roughness={0.4} />
                    </mesh>
                    <mesh position={[0, 1.34, 0.28]}>
                        <cylinderGeometry args={[0.2, 0.24, 0.15, 16]} />
                        <meshStandardMaterial color="#1e1b4b" roughness={0.4} />
                    </mesh>
                    {/* Quả tua rua nón */}
                    <mesh position={[0.22, 1.32, 0.4]}>
                        <sphereGeometry args={[0.04, 12, 12]} />
                        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1} />
                    </mesh>
                </group>
            )}

            {/* --- 13. ROBOT TỰ HÀNH AMR (AUTONOMOUS MOBILE ROBOT / AGV) --- */}
            {item.type === 'agent_amr' && (
                <group position={[0, 0, 0]}>
                    {/* Khung gầm chịu lực công nghiệp màu vàng/đen */}
                    <RoundedBox args={[1.5, 0.45, 1.1]} radius={0.08} position={[0, 0.35, 0]} castShadow>
                        <meshStandardMaterial color={item.color || '#f59e0b'} roughness={0.35} metalness={0.6} />
                    </RoundedBox>

                    {/* Viền cản trước & sau màu đen carbon chống va chạm */}
                    <mesh position={[0, 0.22, 0.57]} castShadow>
                        <boxGeometry args={[1.52, 0.16, 0.1]} />
                        <meshStandardMaterial color="#0f172a" roughness={0.6} />
                    </mesh>
                    <mesh position={[0, 0.22, -0.57]} castShadow>
                        <boxGeometry args={[1.52, 0.16, 0.1]} />
                        <meshStandardMaterial color="#0f172a" roughness={0.6} />
                    </mesh>

                    {/* 4 Bánh xe cơ điện công nghiệp */}
                    <mesh position={[-0.68, 0.2, 0.4]} rotation={[0, 0, Math.PI / 2]} castShadow>
                        <cylinderGeometry args={[0.2, 0.2, 0.16, 20]} />
                        <meshStandardMaterial color="#18181b" roughness={0.8} />
                    </mesh>
                    <mesh position={[0.68, 0.2, 0.4]} rotation={[0, 0, Math.PI / 2]} castShadow>
                        <cylinderGeometry args={[0.2, 0.2, 0.16, 20]} />
                        <meshStandardMaterial color="#18181b" roughness={0.8} />
                    </mesh>
                    <mesh position={[-0.68, 0.2, -0.4]} rotation={[0, 0, Math.PI / 2]} castShadow>
                        <cylinderGeometry args={[0.2, 0.2, 0.16, 20]} />
                        <meshStandardMaterial color="#18181b" roughness={0.8} />
                    </mesh>
                    <mesh position={[0.68, 0.2, -0.4]} rotation={[0, 0, Math.PI / 2]} castShadow>
                        <cylinderGeometry args={[0.2, 0.2, 0.16, 20]} />
                        <meshStandardMaterial color="#18181b" roughness={0.8} />
                    </mesh>

                    {/* Tháp cảm biến Lidar laser xoay 360 trên đỉnh */}
                    <mesh position={[0, 0.65, 0.3]} castShadow>
                        <cylinderGeometry args={[0.18, 0.2, 0.16, 24]} />
                        <meshStandardMaterial color="#09090b" metalness={0.9} roughness={0.2} />
                    </mesh>
                    <mesh position={[0, 0.75, 0.3]}>
                        <cylinderGeometry args={[0.14, 0.14, 0.06, 24]} />
                        <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={2} />
                    </mesh>

                    {/* Đèn dải LED trạng thái an toàn 360 độ (xanh cyan chạy quanh xe) */}
                    <mesh position={[0, 0.38, 0]}>
                        <boxGeometry args={[1.52, 0.04, 1.12]} />
                        <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={2.5} />
                    </mesh>

                    {/* Cảm biến an toàn khẩn cấp E-Stop màu đỏ nổi bật */}
                    <mesh position={[0.55, 0.65, -0.4]} castShadow>
                        <cylinderGeometry args={[0.07, 0.07, 0.1, 16]} />
                        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1} />
                    </mesh>

                    {/* Khay nâng hàng chở pallet / hộp hàng trên lưng xe */}
                    <RoundedBox args={[1.1, 0.08, 0.8]} radius={0.02} position={[0, 0.6, -0.1]} castShadow>
                        <meshStandardMaterial color="#27272a" metalness={0.8} roughness={0.3} />
                    </RoundedBox>
                    {/* Thùng hàng mẫu đặt trên AMR */}
                    <mesh position={[0, 0.85, -0.1]} castShadow>
                        <boxGeometry args={[0.8, 0.42, 0.65]} />
                        <meshStandardMaterial color="#b45309" roughness={0.7} />
                    </mesh>
                </group>
            )}

            {/* --- 14. DRONE GIÁM SÁT & TUẦN TRA CYBER --- */}
            {item.type === 'agent_drone' && (
                <group position={[0, 0, 0]}>
                    {/* Thân drone chính khí động học */}
                    <mesh position={[0, 1.8, 0]} castShadow>
                        <sphereGeometry args={[0.35, 24, 16]} />
                        <meshStandardMaterial color={item.color || '#0f172a'} roughness={0.2} metalness={0.8} />
                    </mesh>

                    {/* Đĩa vành công nghệ phát sáng ở giữa thân */}
                    <mesh position={[0, 1.8, 0]}>
                        <cylinderGeometry args={[0.42, 0.42, 0.05, 32]} />
                        <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={3} />
                    </mesh>

                    {/* 4 Cánh tay đòn gắn động cơ */}
                    {[-1, 1].map((x) =>
                        [-1, 1].map((z) => (
                            <group key={`${x}-${z}`}>
                                <mesh position={[x * 0.45, 1.8, z * 0.45]} rotation={[0, (x * z * Math.PI) / 4, 0]}>
                                    <boxGeometry args={[0.7, 0.04, 0.08]} />
                                    <meshStandardMaterial color="#27272a" metalness={0.7} />
                                </mesh>
                                {/* Cụm bảo vệ cánh quạt lồng tròn ducted fan */}
                                <mesh position={[x * 0.65, 1.82, z * 0.65]} rotation={[-Math.PI / 2, 0, 0]}>
                                    <torusGeometry args={[0.22, 0.025, 16, 24]} />
                                    <meshStandardMaterial color="#3f3f46" metalness={0.8} />
                                </mesh>
                                {/* Đèn LED hoa tiêu */}
                                <mesh position={[x * 0.65, 1.86, z * 0.65]}>
                                    <sphereGeometry args={[0.03, 8, 8]} />
                                    <meshStandardMaterial
                                        color={x > 0 ? '#22c55e' : '#ef4444'}
                                        emissive={x > 0 ? '#22c55e' : '#ef4444'}
                                        emissiveIntensity={3}
                                    />
                                </mesh>
                            </group>
                        ))
                    )}

                    {/* Cụm camera gimbal xoay rọi xuống dưới */}
                    <mesh position={[0, 1.5, 0.1]} castShadow>
                        <sphereGeometry args={[0.15, 16, 16]} />
                        <meshStandardMaterial color="#020617" roughness={0.1} metalness={0.9} />
                    </mesh>
                    <mesh position={[0, 1.42, 0.15]}>
                        <cylinderGeometry args={[0.08, 0.08, 0.06, 16]} rotation={[Math.PI / 4, 0, 0]} />
                        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={3.5} />
                    </mesh>
                    {/* Chùm sáng quét hình nón xuống mặt đất */}
                    <mesh position={[0, 0.75, 0.35]} rotation={[Math.PI / 8, 0, 0]}>
                        <coneGeometry args={[0.9, 1.6, 24, 1, true]} />
                        <meshBasicMaterial color="#38bdf8" transparent opacity={0.12} side={2} />
                    </mesh>
                </group>
            )}
        </group>
    )
}

