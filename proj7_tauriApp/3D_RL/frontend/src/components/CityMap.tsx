/**
 * ==============================================================================
 * BẢN ĐỒ THÀNH PHỐ ĐẠI ĐÔ THỊ 100m x 100m (MEGACITY 3D ENVIRONMENT)
 * ==============================================================================
 * Render toàn bộ không gian đô thị 3D Three.js (@react-three/fiber):
 * 1. MegacityRoads: 6 đại lộ nhựa 7m, 9 ngã tư giao lộ lớn, vạch đi bộ Zebra Crossing.
 * 2. DowntownFinancialDistrict: Tháp đôi chọc trời, ngân hàng, tháp đồng hồ.
 * 3. CommercialPromenade: Siêu thị Mega Mall, rạp Cineplex, cây xăng, phố Shophouse.
 * 4. GrandCentralParkAndSports: Hồ sinh thái, cầu vòm gỗ, sân bóng rổ rào lưới, xích đu.
 * 5. ResidentialSuburb: Biệt thự Villa gia đình, nhà phố liền kề, chung cư mini.
 * 6. ResortAndPoolQuarter: Hồ bơi resort nước xanh trong, quầy bar giải khát, chòi cứu hộ.
 * 7. CivicPublicServices: Bệnh viện Đa Khoa, trạm cứu hỏa, nhà hát Opera, trường học, bảo tàng.
 * 8. UrbanStreetProps: Cột đèn đường đô thị, cây xanh vỉa hè, trạm xe buýt.
 * 9. DynamicTrafficVehicles: Xe buýt điện, xe 2 tầng, taxi, xe cấp cứu, robot tuần tra di chuyển.
 * 10. TopologicalGraphOverlay: Lớp phủ hiển thị các nút giao lộ và đường dẫn Waypoints A*.
 */

import { useTrainingStore } from "../stores/useTrainingStore";

// ==========================================
// 1. HỆ THỐNG ĐƯỜNG PHỐ & GIAO LỘ ĐẠI ĐÔ THỊ 100x100
// ==========================================
export function MegacityRoads() {
    // 3 Đại Lộ Đông - Tây: z = 22, 50, 78 (Mỗi đại lộ rộng 7.0m, dài 100m)
    // 3 Đại Lộ Bắc - Nam: x = 22, 50, 78 (Mỗi đại lộ rộng 7.0m, dài 100m)
    const avenuePositions = [22, 50, 78];

    // Vỉa hè chia thành 16 phân khu đô thị
    const blockBounds = [
        { x: 10.5, z: 10.5, w: 17.0, h: 17.0 },
        { x: 36.0, z: 10.5, w: 21.0, h: 17.0 },
        { x: 64.0, z: 10.5, w: 21.0, h: 17.0 },
        { x: 89.5, z: 10.5, w: 17.0, h: 17.0 },

        { x: 10.5, z: 36.0, w: 17.0, h: 21.0 },
        { x: 36.0, z: 36.0, w: 21.0, h: 21.0 },
        { x: 64.0, z: 36.0, w: 21.0, h: 21.0 },
        { x: 89.5, z: 36.0, w: 17.0, h: 21.0 },

        { x: 10.5, z: 64.0, w: 17.0, h: 21.0 },
        { x: 36.0, z: 64.0, w: 21.0, h: 21.0 },
        { x: 64.0, z: 64.0, w: 21.0, h: 21.0 },
        { x: 89.5, z: 64.0, w: 17.0, h: 21.0 },

        { x: 10.5, z: 89.5, w: 17.0, h: 17.0 },
        { x: 36.0, z: 89.5, w: 21.0, h: 17.0 },
        { x: 64.0, z: 89.5, w: 21.0, h: 17.0 },
        { x: 89.5, z: 89.5, w: 17.0, h: 17.0 },
    ];

    return (
        <group>
            {/* Mặt đường nhựa các Đại lộ Đông - Tây */}
            {avenuePositions.map((zPos, idx) => (
                <mesh key={`rd-ew-${idx}`} position={[50, 0.02, zPos]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                    <planeGeometry args={[100, 7.0]} />
                    <meshStandardMaterial color="#1e293b" roughness={0.8} />
                </mesh>
            ))}

            {/* Mặt đường nhựa các Đại lộ Bắc - Nam */}
            {avenuePositions.map((xPos, idx) => (
                <mesh key={`rd-ns-${idx}`} position={[xPos, 0.022, 50]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                    <planeGeometry args={[7.0, 100]} />
                    <meshStandardMaterial color="#1e293b" roughness={0.8} />
                </mesh>
            ))}

            {/* Vạch kẻ đường đứt đoạn màu vàng trên các đại lộ */}
            {avenuePositions.map((zPos, zIdx) =>
                [-42, -35, -28, -14, -7, 7, 14, 28, 35, 42].map((off, oIdx) => (
                    <mesh key={`dash-ew-${zIdx}-${oIdx}`} position={[50 + off, 0.025, zPos]} rotation={[-Math.PI / 2, 0, 0]}>
                        <planeGeometry args={[3.2, 0.2]} />
                        <meshBasicMaterial color="#facc15" />
                    </mesh>
                ))
            )}
            {avenuePositions.map((xPos, xIdx) =>
                [-42, -35, -28, -14, -7, 7, 14, 28, 35, 42].map((off, oIdx) => (
                    <mesh key={`dash-ns-${xIdx}-${oIdx}`} position={[xPos, 0.026, 50 + off]} rotation={[-Math.PI / 2, 0, 0]}>
                        <planeGeometry args={[0.2, 3.2]} />
                        <meshBasicMaterial color="#facc15" />
                    </mesh>
                ))
            )}

            {/* 9 Giao lộ ngã tư lớn với Vạch kẻ sang đường cho người đi bộ (Zebra Crossings) */}
            {avenuePositions.map((xPos) =>
                avenuePositions.map((zPos) => (
                    <group key={`cross-${xPos}-${zPos}`}>
                        {/* Nhánh Bắc */}
                        {[-2.2, -1.3, -0.4, 0.4, 1.3, 2.2].map((off, i) => (
                            <mesh key={`z-n-${i}`} position={[xPos + off, 0.028, zPos - 4.2]} rotation={[-Math.PI / 2, 0, 0]}>
                                <planeGeometry args={[0.5, 1.5]} />
                                <meshBasicMaterial color="#f8fafc" />
                            </mesh>
                        ))}
                        {/* Nhánh Nam */}
                        {[-2.2, -1.3, -0.4, 0.4, 1.3, 2.2].map((off, i) => (
                            <mesh key={`z-s-${i}`} position={[xPos + off, 0.028, zPos + 4.2]} rotation={[-Math.PI / 2, 0, 0]}>
                                <planeGeometry args={[0.5, 1.5]} />
                                <meshBasicMaterial color="#f8fafc" />
                            </mesh>
                        ))}
                        {/* Nhánh Tây */}
                        {[-2.2, -1.3, -0.4, 0.4, 1.3, 2.2].map((off, i) => (
                            <mesh key={`z-w-${i}`} position={[xPos - 4.2, 0.028, zPos + off]} rotation={[-Math.PI / 2, 0, 0]}>
                                <planeGeometry args={[1.5, 0.5]} />
                                <meshBasicMaterial color="#f8fafc" />
                            </mesh>
                        ))}
                        {/* Nhánh Đông */}
                        {[-2.2, -1.3, -0.4, 0.4, 1.3, 2.2].map((off, i) => (
                            <mesh key={`z-e-${i}`} position={[xPos + 4.2, 0.028, zPos + off]} rotation={[-Math.PI / 2, 0, 0]}>
                                <planeGeometry args={[1.5, 0.5]} />
                                <meshBasicMaterial color="#f8fafc" />
                            </mesh>
                        ))}
                    </group>
                ))
            )}

            {/* 16 Khối vỉa hè bê tông phân chia các ô phố */}
            {blockBounds.map((b, idx) => (
                <mesh key={`sidewalk-${idx}`} position={[b.x, 0.05, b.z]} castShadow receiveShadow>
                    <boxGeometry args={[b.w, 0.1, b.h]} />
                    <meshStandardMaterial color="#475569" roughness={0.9} />
                </mesh>
            ))}
        </group>
    );
}

// ==========================================
// 2. KHU TRUNG TÂM TÀI CHÍNH & CAO ỐC CHỌC TRỜI (Downtown Plaza)
// ==========================================
export function DowntownFinancialDistrict({ isNight }: { isNight: boolean }) {
    return (
        <group>
            {/* Tháp Đôi Chọc Trời Tây (Sky Tower A, x=40, z=40) - Cao 24m */}
            <group position={[40, 0, 40]}>
                <mesh position={[0, 12, 0]} castShadow receiveShadow>
                    <boxGeometry args={[6.8, 24, 6.8]} />
                    <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.2} />
                </mesh>
                {/* Lớp kính phản quang xanh */}
                <mesh position={[0, 12, 0]}>
                    <boxGeometry args={[6.85, 23.5, 6.85]} />
                    <meshStandardMaterial
                        color="#0284c7"
                        emissive="#0284c7"
                        emissiveIntensity={isNight ? 0.35 : 0.05}
                        transparent
                        opacity={0.85}
                    />
                </mesh>
                {/* Đỉnh tháp & ăng-ten phát sóng */}
                <mesh position={[0, 24.5, 0]}>
                    <boxGeometry args={[4.5, 1.0, 4.5]} />
                    <meshStandardMaterial color="#334155" metalness={0.8} />
                </mesh>
                <mesh position={[0, 26.5, 0]}>
                    <cylinderGeometry args={[0.08, 0.15, 4.0, 8]} />
                    <meshStandardMaterial color="#94a3b8" metalness={0.9} />
                </mesh>
                {/* Đèn báo đỏ trên đỉnh */}
                <mesh position={[0, 28.5, 0]}>
                    <sphereGeometry args={[0.18, 8, 8]} />
                    <meshBasicMaterial color="#ef4444" />
                </mesh>
            </group>

            {/* Tháp Đôi Chọc Trời Đông (Sky Tower B, x=60, z=40) - Cao 21m */}
            <group position={[60, 0, 40]}>
                <mesh position={[0, 10.5, 0]} castShadow receiveShadow>
                    <boxGeometry args={[6.5, 21, 6.5]} />
                    <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.3} />
                </mesh>
                <mesh position={[0, 10.5, 0]}>
                    <boxGeometry args={[6.55, 20.5, 6.55]} />
                    <meshStandardMaterial
                        color="#0369a1"
                        emissive="#0369a1"
                        emissiveIntensity={isNight ? 0.35 : 0.05}
                        transparent
                        opacity={0.8}
                    />
                </mesh>
                <mesh position={[0, 21.5, 0]}>
                    <coneGeometry args={[3.2, 3.0, 4]} />
                    <meshStandardMaterial color="#38bdf8" metalness={0.7} />
                </mesh>
            </group>

            {/* Cao ốc Ngân Hàng Thành Phố (Bank of Megacity, x=40, z=60) - Cao 16m */}
            <group position={[40, 0, 60]}>
                <mesh position={[0, 8, 0]} castShadow receiveShadow>
                    <boxGeometry args={[6.2, 16, 6.2]} />
                    <meshStandardMaterial color="#1e1b4b" metalness={0.5} roughness={0.3} />
                </mesh>
                {/* Hàng cột đá sảnh ngân hàng */}
                <mesh position={[0, 2, 3.3]}>
                    <boxGeometry args={[5.8, 3.8, 0.4]} />
                    <meshStandardMaterial color="#cbd5e1" roughness={0.4} />
                </mesh>
            </group>

            {/* Tháp Đồng Hồ Đô Thị Cổ Kính (Town Clock Tower, x=60, z=60) - Cao 15m */}
            <group position={[60, 0, 60]}>
                {/* Thân tháp gạch đá */}
                <mesh position={[0, 6.5, 0]} castShadow receiveShadow>
                    <boxGeometry args={[4.2, 13, 4.2]} />
                    <meshStandardMaterial color="#78350f" roughness={0.7} />
                </mesh>
                {/* Buồng đồng hồ */}
                <mesh position={[0, 13.8, 0]} castShadow>
                    <boxGeometry args={[4.6, 2.2, 4.6]} />
                    <meshStandardMaterial color="#451a03" />
                </mesh>
                {/* 4 Mặt đồng hồ phát sáng */}
                {[
                    [0, 13.8, 2.32],
                    [0, 13.8, -2.32],
                    [2.32, 13.8, 0],
                    [-2.32, 13.8, 0],
                ].map((cpos, i) => (
                    <mesh key={`clock-${i}`} position={cpos as [number, number, number]}>
                        <circleGeometry args={[0.85, 16]} />
                        <meshBasicMaterial color="#fef08a" />
                    </mesh>
                ))}
                {/* Mái chóp đồng hồ */}
                <mesh position={[0, 16.2, 0]}>
                    <coneGeometry args={[3.2, 3.0, 4]} />
                    <meshStandardMaterial color="#047857" metalness={0.6} />
                </mesh>
            </group>

            {/* Đài Phun Nước Lớn Trung Tâm (Grand Central Fountain, x=50, z=50) */}
            <group position={[50, 0, 50]}>
                {/* Bể chứa nước tầng 1 (Đường kính 6.4m) */}
                <mesh position={[0, 0.35, 0]} receiveShadow>
                    <cylinderGeometry args={[3.2, 3.4, 0.7, 32]} />
                    <meshStandardMaterial color="#cbd5e1" roughness={0.4} />
                </mesh>
                {/* Mặt nước phun phát sáng */}
                <mesh position={[0, 0.65, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[3.0, 32]} />
                    <meshStandardMaterial
                        color="#06b6d4"
                        emissive="#06b6d4"
                        emissiveIntensity={isNight ? 0.9 : 0.4}
                        roughness={0.1}
                        transparent
                        opacity={0.88}
                    />
                </mesh>
                {/* Trụ phun nước tầng 2 */}
                <mesh position={[0, 1.4, 0]} castShadow>
                    <cylinderGeometry args={[1.5, 1.8, 0.9, 24]} />
                    <meshStandardMaterial color="#e2e8f0" roughness={0.3} />
                </mesh>
                {/* Trụ phun nước tầng 3 & Cột nước bắn cao */}
                <mesh position={[0, 2.3, 0]}>
                    <cylinderGeometry args={[0.6, 0.8, 1.0, 16]} />
                    <meshStandardMaterial color="#f8fafc" />
                </mesh>
                <mesh position={[0, 3.4, 0]}>
                    <coneGeometry args={[0.45, 1.6, 16]} />
                    <meshBasicMaterial color="#67e8f9" transparent opacity={0.8} />
                </mesh>
                {/* Ánh sáng đèn đài phun nước ban đêm */}
                {isNight && (
                    <pointLight position={[0, 1.8, 0]} color="#06b6d4" distance={10} intensity={2.4} />
                )}
            </group>
        </group>
    );
}

// ==========================================
// 3. KHU PHỐ THƯƠNG MẠI & MUA SẮM (Commercial Promenade)
// ==========================================
export function CommercialPromenade({ isNight }: { isNight: boolean }) {
    return (
        <group>
            {/* Đại Siêu Thị Mega Mall (x=74, z=40) */}
            <group position={[74, 0, 40]}>
                <mesh position={[0, 4.0, 0]} castShadow receiveShadow>
                    <boxGeometry args={[7.8, 8.0, 6.8]} />
                    <meshStandardMaterial color="#f8fafc" roughness={0.3} />
                </mesh>
                {/* Biển hiệu đèn LED MEGA MALL */}
                <mesh position={[0, 7.2, 3.45]}>
                    <boxGeometry args={[5.2, 1.1, 0.1]} />
                    <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={isNight ? 2.0 : 0.6} />
                </mesh>
                {/* Cửa kính ra vào */}
                <mesh position={[0, 1.8, 3.45]}>
                    <boxGeometry args={[3.8, 3.2, 0.05]} />
                    <meshStandardMaterial color="#38bdf8" transparent opacity={0.7} />
                </mesh>
            </group>

            {/* Cây Xăng Đô Thị / Petrol Station (x=90, z=40) */}
            <group position={[90, 0, 40]}>
                {/* Mái che vòm trạm xăng */}
                <mesh position={[0, 4.2, 0]} castShadow>
                    <boxGeometry args={[7.2, 0.5, 6.2]} />
                    <meshStandardMaterial color="#e11d48" roughness={0.4} />
                </mesh>
                {/* 4 Cột đỡ mái che */}
                <mesh position={[-2.8, 2.0, 2.4]}>
                    <cylinderGeometry args={[0.18, 0.18, 4.0, 8]} />
                    <meshStandardMaterial color="#94a3b8" />
                </mesh>
                <mesh position={[2.8, 2.0, 2.4]}>
                    <cylinderGeometry args={[0.18, 0.18, 4.0, 8]} />
                    <meshStandardMaterial color="#94a3b8" />
                </mesh>
                <mesh position={[-2.8, 2.0, -2.4]}>
                    <cylinderGeometry args={[0.18, 0.18, 4.0, 8]} />
                    <meshStandardMaterial color="#94a3b8" />
                </mesh>
                <mesh position={[2.8, 2.0, -2.4]}>
                    <cylinderGeometry args={[0.18, 0.18, 4.0, 8]} />
                    <meshStandardMaterial color="#94a3b8" />
                </mesh>
                {/* 2 Trụ bơm xăng */}
                <mesh position={[-1.2, 1.0, 0]} castShadow>
                    <boxGeometry args={[0.7, 2.0, 0.9]} />
                    <meshStandardMaterial color="#facc15" />
                </mesh>
                <mesh position={[1.2, 1.0, 0]} castShadow>
                    <boxGeometry args={[0.7, 2.0, 0.9]} />
                    <meshStandardMaterial color="#22c55e" />
                </mesh>
                {/* Cửa hàng tiện lợi trạm xăng phía sau */}
                <mesh position={[0, 2.2, -4.5]} castShadow receiveShadow>
                    <boxGeometry args={[6.0, 4.4, 2.6]} />
                    <meshStandardMaterial color="#f1f5f9" />
                </mesh>
            </group>

            {/* Dãy Shophouse Phố Ẩm Thực Cafe & Bakery (x=74, z=58) */}
            <group position={[74, 0, 58]}>
                {/* Cửa hàng 1: Cafe Xanh Dương */}
                <mesh position={[-2.8, 3.0, 0]} castShadow receiveShadow>
                    <boxGeometry args={[2.7, 6.0, 5.8]} />
                    <meshStandardMaterial color="#0284c7" roughness={0.4} />
                </mesh>
                {/* Mái hiên sọc che nắng */}
                <mesh position={[-2.8, 2.7, 3.1]} rotation={[0.4, 0, 0]}>
                    <boxGeometry args={[2.8, 0.1, 1.4]} />
                    <meshStandardMaterial color="#38bdf8" />
                </mesh>
                {/* Cửa hàng 2: Tiệm Bánh Bakery Cam Vàng */}
                <mesh position={[0, 3.2, 0]} castShadow receiveShadow>
                    <boxGeometry args={[2.7, 6.4, 5.8]} />
                    <meshStandardMaterial color="#ea580c" roughness={0.4} />
                </mesh>
                <mesh position={[0, 2.8, 3.1]} rotation={[0.4, 0, 0]}>
                    <boxGeometry args={[2.8, 0.1, 1.4]} />
                    <meshStandardMaterial color="#fdba74" />
                </mesh>
                {/* Cửa hàng 3: Nhà Hàng Ẩm Thực Xanh Lá */}
                <mesh position={[2.8, 2.9, 0]} castShadow receiveShadow>
                    <boxGeometry args={[2.7, 5.8, 5.8]} />
                    <meshStandardMaterial color="#15803d" roughness={0.4} />
                </mesh>
                <mesh position={[2.8, 2.7, 3.1]} rotation={[0.4, 0, 0]}>
                    <boxGeometry args={[2.8, 0.1, 1.4]} />
                    <meshStandardMaterial color="#86efac" />
                </mesh>
                {/* Bàn cafe ngoài trời & dù che */}
                {[-2.0, 0.0, 2.0].map((tX, i) => (
                    <group key={`cafe-table-${i}`} position={[tX, 0, 4.4]}>
                        <mesh position={[0, 0.4, 0]}>
                            <cylinderGeometry args={[0.4, 0.4, 0.8, 12]} />
                            <meshStandardMaterial color="#78350f" />
                        </mesh>
                        <mesh position={[0, 1.6, 0]}>
                            <coneGeometry args={[1.0, 0.4, 8]} />
                            <meshStandardMaterial color={i === 0 ? "#ef4444" : i === 1 ? "#3b82f6" : "#22c55e"} />
                        </mesh>
                    </group>
                ))}
            </group>

            {/* Rạp Chiếu Phim Cineplex (x=90, z=60) */}
            <group position={[90, 0, 60]}>
                <mesh position={[0, 4.5, 0]} castShadow receiveShadow>
                    <boxGeometry args={[6.8, 9.0, 6.8]} />
                    <meshStandardMaterial color="#312e81" roughness={0.3} />
                </mesh>
                <mesh position={[0, 7.8, 3.45]}>
                    <boxGeometry args={[5.0, 1.2, 0.1]} />
                    <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={isNight ? 2.2 : 0.6} />
                </mesh>
            </group>
        </group>
    );
}

// ==========================================
// 4. ĐẠI CÔNG VIÊN SINH THÁI & KHU THỂ THAO (Grand Central Park)
// ==========================================
export function GrandCentralParkAndSports() {
    return (
        <group>
            {/* Hồ Nước Sinh Thái Lớn (x=14, z=78) */}
            <group position={[14, 0, 78]}>
                <mesh position={[0, 0.12, 0]} receiveShadow>
                    <cylinderGeometry args={[5.8, 6.2, 0.25, 32]} />
                    <meshStandardMaterial color="#64748b" roughness={0.8} />
                </mesh>
                <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[5.6, 32]} />
                    <meshStandardMaterial color="#0284c7" roughness={0.1} transparent opacity={0.9} />
                </mesh>
            </group>

            {/* Cầu Gỗ Uốn Cong Bắc Qua Kênh (x=26, z=74) */}
            <group position={[26, 0, 74]} rotation={[0, 0.3, 0]}>
                <mesh position={[0, 0.7, 0]} castShadow>
                    <boxGeometry args={[1.8, 0.2, 5.2]} />
                    <meshStandardMaterial color="#78350f" roughness={0.6} />
                </mesh>
                <mesh position={[-0.8, 1.2, 0]}>
                    <boxGeometry args={[0.08, 0.8, 5.2]} />
                    <meshStandardMaterial color="#451a03" />
                </mesh>
                <mesh position={[0.8, 1.2, 0]}>
                    <boxGeometry args={[0.08, 0.8, 5.2]} />
                    <meshStandardMaterial color="#451a03" />
                </mesh>
            </group>

            {/* Sân Chơi Trẻ Em: Cầu Trượt & Xích Đu (x=12, z=90) */}
            <group position={[12, 0, 90]}>
                {/* Nền đệm cát cao su */}
                <mesh position={[0, 0.06, 0]} receiveShadow>
                    <boxGeometry args={[6.2, 0.12, 6.2]} />
                    <meshStandardMaterial color="#fbbf24" roughness={0.9} />
                </mesh>
                {/* Tháp cầu trượt màu đỏ/vàng */}
                <mesh position={[-1.2, 1.5, -1.2]} castShadow>
                    <boxGeometry args={[1.2, 3.0, 1.2]} />
                    <meshStandardMaterial color="#dc2626" />
                </mesh>
                <mesh position={[-1.2, 3.4, -1.2]}>
                    <coneGeometry args={[1.0, 1.0, 4]} />
                    <meshStandardMaterial color="#f59e0b" />
                </mesh>
                {/* Máng trượt dốc */}
                <mesh position={[-0.2, 1.0, 0.2]} rotation={[0.6, 0.4, 0]}>
                    <boxGeometry args={[0.6, 0.1, 2.6]} />
                    <meshStandardMaterial color="#3b82f6" />
                </mesh>
                {/* Cụm xích đu 2 chỗ */}
                <group position={[1.5, 0, 0]}>
                    <mesh position={[0, 1.4, 0]}>
                        <boxGeometry args={[0.1, 2.8, 2.2]} />
                        <meshStandardMaterial color="#1e293b" />
                    </mesh>
                </group>
            </group>

            {/* Sân Bóng Rổ Đô Thị Hoàn Chỉnh (x=26, z=90) */}
            <group position={[26, 0, 90]}>
                {/* Mặt sân sơn màu cam thể thao với đường viền xanh */}
                <mesh position={[0, 0.08, 0]} receiveShadow>
                    <boxGeometry args={[6.8, 0.16, 6.8]} />
                    <meshStandardMaterial color="#ea580c" roughness={0.6} />
                </mesh>
                {/* Vòng tròn giữa sân */}
                <mesh position={[0, 0.17, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[1.1, 1.2, 24]} />
                    <meshBasicMaterial color="#ffffff" />
                </mesh>
                {/* 2 Cột rổ bóng rổ ở hai đầu */}
                <group position={[0, 0, -2.8]}>
                    <mesh position={[0, 1.6, 0]}>
                        <cylinderGeometry args={[0.06, 0.06, 3.2, 8]} />
                        <meshStandardMaterial color="#334155" metalness={0.7} />
                    </mesh>
                    {/* Bảng rổ mica trắng & vành rổ cam */}
                    <mesh position={[0, 2.8, 0.35]}>
                        <boxGeometry args={[1.2, 0.8, 0.06]} />
                        <meshStandardMaterial color="#ffffff" roughness={0.2} />
                    </mesh>
                    <mesh position={[0, 2.6, 0.65]} rotation={[-Math.PI / 2, 0, 0]}>
                        <torusGeometry args={[0.25, 0.03, 8, 16]} />
                        <meshStandardMaterial color="#ef4444" />
                    </mesh>
                </group>
                <group position={[0, 0, 2.8]} rotation={[0, Math.PI, 0]}>
                    <mesh position={[0, 1.6, 0]}>
                        <cylinderGeometry args={[0.06, 0.06, 3.2, 8]} />
                        <meshStandardMaterial color="#334155" metalness={0.7} />
                    </mesh>
                    <mesh position={[0, 2.8, 0.35]}>
                        <boxGeometry args={[1.2, 0.8, 0.06]} />
                        <meshStandardMaterial color="#ffffff" roughness={0.2} />
                    </mesh>
                    <mesh position={[0, 2.6, 0.65]} rotation={[-Math.PI / 2, 0, 0]}>
                        <torusGeometry args={[0.25, 0.03, 8, 16]} />
                        <meshStandardMaterial color="#ef4444" />
                    </mesh>
                </group>
            </group>
        </group>
    );
}

// ==========================================
// 5. KHU BIỆT THỰ & DÂN CƯ (Residential Suburb)
// ==========================================
export function ResidentialSuburb() {
    return (
        <group>
            {/* Biệt Thự Villa Gia Đình (x=12, z=12) */}
            <group position={[12, 0, 12]}>
                <mesh position={[0, 2.2, 0]} castShadow receiveShadow>
                    <boxGeometry args={[5.6, 4.4, 5.2]} />
                    <meshStandardMaterial color="#fef3c7" roughness={0.6} />
                </mesh>
                {/* Mái ngói dốc màu đỏ đất nung */}
                <mesh position={[0, 5.0, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
                    <coneGeometry args={[4.4, 2.0, 4]} />
                    <meshStandardMaterial color="#b91c1c" roughness={0.5} />
                </mesh>
                {/* Ống khói gạch đỏ */}
                <mesh position={[1.4, 5.4, 0.8]}>
                    <boxGeometry args={[0.6, 1.6, 0.6]} />
                    <meshStandardMaterial color="#7f1d1d" />
                </mesh>
                {/* Cửa chính & hiên gỗ */}
                <mesh position={[0, 1.0, 2.65]}>
                    <boxGeometry args={[1.2, 2.0, 0.1]} />
                    <meshStandardMaterial color="#78350f" />
                </mesh>
            </group>

            {/* Dãy Nhà Phố Liền Kề 1 (x=24, z=10) */}
            <group position={[24, 0, 10]}>
                <mesh position={[0, 3.0, 0]} castShadow receiveShadow>
                    <boxGeometry args={[5.2, 6.0, 4.8]} />
                    <meshStandardMaterial color="#e0e7ff" roughness={0.4} />
                </mesh>
                <mesh position={[0, 6.4, 0]} rotation={[0, Math.PI / 4, 0]}>
                    <coneGeometry args={[4.0, 1.6, 4]} />
                    <meshStandardMaterial color="#1e40af" />
                </mesh>
            </group>

            {/* Cụm Nhà Phố Liền Kề 2 (x=10, z=24) */}
            <group position={[10, 0, 24]}>
                <mesh position={[0, 3.2, 0]} castShadow receiveShadow>
                    <boxGeometry args={[4.8, 6.4, 5.2]} />
                    <meshStandardMaterial color="#fae8ff" roughness={0.4} />
                </mesh>
                <mesh position={[0, 6.6, 0]} rotation={[0, Math.PI / 4, 0]}>
                    <coneGeometry args={[3.8, 1.6, 4]} />
                    <meshStandardMaterial color="#86198f" />
                </mesh>
            </group>

            {/* Chung Cư Mini Hiện Đại (x=24, z=24) */}
            <group position={[24, 0, 24]}>
                <mesh position={[0, 4.5, 0]} castShadow receiveShadow>
                    <boxGeometry args={[5.6, 9.0, 5.6]} />
                    <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.2} />
                </mesh>
                {/* Ban công các tầng */}
                {[2.5, 5.0, 7.5].map((bY, i) => (
                    <mesh key={`balcony-${i}`} position={[0, bY, 2.9]}>
                        <boxGeometry args={[4.8, 0.6, 0.4]} />
                        <meshStandardMaterial color="#94a3b8" />
                    </mesh>
                ))}
            </group>
        </group>
    );
}

// ==========================================
// 6. KHU NGHỈ DƯỠNG & HỒ BƠI RESORT (Resort & Pool Quarter)
// ==========================================
export function ResortAndPoolQuarter() {
    return (
        <group>
            {/* Khách Sạn Hoàng Gia Luxury (x=86, z=10) - Cao 14m */}
            <group position={[86, 0, 10]}>
                <mesh position={[0, 7.0, 0]} castShadow receiveShadow>
                    <boxGeometry args={[7.2, 14.0, 6.0]} />
                    <meshStandardMaterial color="#f8fafc" roughness={0.2} metalness={0.4} />
                </mesh>
                <mesh position={[0, 14.4, 0]}>
                    <boxGeometry args={[5.5, 0.8, 4.5]} />
                    <meshStandardMaterial color="#eab308" metalness={0.8} />
                </mesh>
            </group>

            {/* Khu Hồ Bơi Nghỉ Dưỡng Lớn (x=72, z=14) */}
            <group position={[72, 0, 14]}>
                {/* Lòng hồ bơi lát gạch xanh ngọc */}
                <mesh position={[0, 0.15, 0]} receiveShadow>
                    <boxGeometry args={[6.8, 0.3, 5.4]} />
                    <meshStandardMaterial color="#0284c7" roughness={0.2} />
                </mesh>
                <mesh position={[0, 0.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[6.2, 4.8]} />
                    <meshStandardMaterial color="#38bdf8" roughness={0.05} transparent opacity={0.85} />
                </mesh>
                {/* Ván nhảy hồ bơi */}
                <mesh position={[-2.8, 0.6, 0]} rotation={[0, 0, -0.1]}>
                    <boxGeometry args={[1.4, 0.08, 0.6]} />
                    <meshStandardMaterial color="#facc15" />
                </mesh>
                {/* Ghế dài tắm nắng ven hồ */}
                {[-1.2, 0.6, 2.2].map((gX, i) => (
                    <mesh key={`sun-chair-${i}`} position={[gX, 0.2, 3.2]} rotation={[0.2, 0, 0]}>
                        <boxGeometry args={[0.7, 0.15, 1.4]} />
                        <meshStandardMaterial color="#ffffff" />
                    </mesh>
                ))}
            </group>

            {/* Quầy Bar Giải Khát Ven Hồ (x=78, z=26) */}
            <group position={[78, 0, 26]}>
                <mesh position={[0, 1.5, 0]} castShadow>
                    <cylinderGeometry args={[1.8, 2.0, 3.0, 12]} />
                    <meshStandardMaterial color="#78350f" />
                </mesh>
                {/* Mái lá vòm chòi */}
                <mesh position={[0, 3.2, 0]}>
                    <coneGeometry args={[2.5, 1.2, 12]} />
                    <meshStandardMaterial color="#d97706" roughness={0.9} />
                </mesh>
            </group>
        </group>
    );
}

// ==========================================
// 7. KHU Y TẾ, CỨU HỎA & VĂN HÓA (Civic & Public Services)
// ==========================================
export function CivicPublicServices({ isNight }: { isNight: boolean }) {
    return (
        <group>
            {/* Bệnh Viện Đa Khoa Quốc Tế (x=74, z=76) */}
            <group position={[74, 0, 76]}>
                <mesh position={[0, 4.5, 0]} castShadow receiveShadow>
                    <boxGeometry args={[7.4, 9.0, 6.8]} />
                    <meshStandardMaterial color="#f8fafc" roughness={0.3} />
                </mesh>
                {/* Biểu tượng Chữ Thập Đỏ phát sáng trên nóc */}
                <group position={[0, 10.0, 0]}>
                    <mesh>
                        <boxGeometry args={[0.6, 2.2, 0.2]} />
                        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={isNight ? 2.0 : 0.4} />
                    </mesh>
                    <mesh>
                        <boxGeometry args={[2.2, 0.6, 0.2]} />
                        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={isNight ? 2.0 : 0.4} />
                    </mesh>
                </group>
            </group>

            {/* Trạm Cứu Hỏa (Fire Station, x=90, z=76) */}
            <group position={[90, 0, 76]}>
                <mesh position={[0, 3.5, 0]} castShadow receiveShadow>
                    <boxGeometry args={[6.6, 7.0, 6.4]} />
                    <meshStandardMaterial color="#991b1b" roughness={0.4} />
                </mesh>
                {/* 2 Cửa cuốn đỏ của xe cứu hỏa */}
                <mesh position={[-1.6, 1.6, 3.25]}>
                    <boxGeometry args={[2.4, 3.2, 0.1]} />
                    <meshStandardMaterial color="#dc2626" />
                </mesh>
                <mesh position={[1.6, 1.6, 3.25]}>
                    <boxGeometry args={[2.4, 3.2, 0.1]} />
                    <meshStandardMaterial color="#dc2626" />
                </mesh>
            </group>

            {/* Nhà Hát Lớn Opera House (x=50, z=76) */}
            <group position={[50, 0, 76]}>
                <mesh position={[0, 4.0, 0]} castShadow receiveShadow>
                    <boxGeometry args={[8.0, 8.0, 6.8]} />
                    <meshStandardMaterial color="#e2e8f0" roughness={0.3} />
                </mesh>
                {/* Mái vòm La Mã & Cột tròn cổ điển */}
                <mesh position={[0, 8.8, 0]}>
                    <sphereGeometry args={[3.6, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                    <meshStandardMaterial color="#0284c7" metalness={0.7} />
                </mesh>
                {[-2.8, -1.0, 1.0, 2.8].map((cX, i) => (
                    <mesh key={`column-${i}`} position={[cX, 3.0, 3.6]}>
                        <cylinderGeometry args={[0.22, 0.22, 6.0, 12]} />
                        <meshStandardMaterial color="#f8fafc" />
                    </mesh>
                ))}
            </group>

            {/* Trường Tiểu Học Đô Thị (x=12, z=50) */}
            <group position={[12, 0, 50]}>
                <mesh position={[0, 3.5, 0]} castShadow receiveShadow>
                    <boxGeometry args={[6.4, 7.0, 5.8]} />
                    <meshStandardMaterial color="#fef08a" roughness={0.5} />
                </mesh>
                <mesh position={[0, 7.4, 0]}>
                    <boxGeometry args={[5.2, 0.8, 4.8]} />
                    <meshStandardMaterial color="#ca8a04" />
                </mesh>
            </group>
        </group>
    );
}

// ==========================================
// 8. HẠ TẦNG ĐÔ THỊ, ĐÈN GIAO THÔNG & ĐÈN ĐƯỜNG (Urban Street Props)
// ==========================================
export function UrbanStreetProps({ isNight }: { isNight: boolean }) {
    // 24 Cột đèn đường đô thị rải dọc theo 6 trục đại lộ
    const lampCoordinates: [number, number][] = [
        [22, 10], [22, 36], [22, 64], [22, 90],
        [50, 10], [50, 34], [50, 66], [50, 90],
        [78, 10], [78, 36], [78, 64], [78, 90],
        [10, 22], [36, 22], [64, 22], [90, 22],
        [10, 50], [34, 50], [66, 50], [90, 50],
        [10, 78], [36, 78], [64, 78], [90, 78],
    ];

    // Cột đèn tín hiệu giao thông (Traffic Lights) tại 9 ngã tư
    const intersectionPoints = [22, 50, 78];

    return (
        <group>
            {/* Cột đèn đường chiếu sáng đô thị */}
            {lampCoordinates.map(([lx, lz], idx) => (
                <group key={`lamp-${idx}`} position={[lx + 3.8, 0, lz]}>
                    {/* Thân cột đèn kim loại */}
                    <mesh position={[0, 2.0, 0]}>
                        <cylinderGeometry args={[0.07, 0.1, 4.0, 10]} />
                        <meshStandardMaterial color="#334155" metalness={0.8} />
                    </mesh>
                    {/* Tay vươn đèn ra lòng đường */}
                    <mesh position={[-0.4, 3.9, 0]} rotation={[0, 0, 0.4]}>
                        <cylinderGeometry args={[0.05, 0.05, 1.0, 8]} />
                        <meshStandardMaterial color="#334155" metalness={0.8} />
                    </mesh>
                    {/* Chao đèn & Bóng LED vàng ấm */}
                    <mesh position={[-0.8, 4.05, 0]}>
                        <boxGeometry args={[0.45, 0.18, 0.35]} />
                        <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={isNight ? 2.5 : 0.4} />
                    </mesh>
                    {isNight && (
                        <pointLight position={[-0.8, 3.8, 0]} color="#fef08a" distance={11.0} intensity={2.0} />
                    )}
                </group>
            ))}

            {/* Đèn tín hiệu giao thông (Traffic Lights) tại 9 ngã tư */}
            {intersectionPoints.map((ix) =>
                intersectionPoints.map((iz) => (
                    <group key={`tl-${ix}-${iz}`} position={[ix + 3.9, 0, iz + 3.9]}>
                        <mesh position={[0, 2.2, 0]}>
                            <cylinderGeometry args={[0.08, 0.08, 4.4, 8]} />
                            <meshStandardMaterial color="#1e293b" />
                        </mesh>
                        <mesh position={[0, 4.0, 0]}>
                            <boxGeometry args={[0.3, 0.9, 0.3]} />
                            <meshStandardMaterial color="#0f172a" />
                        </mesh>
                        {/* Đèn đỏ, vàng, xanh */}
                        <mesh position={[-0.16, 4.25, 0]}>
                            <sphereGeometry args={[0.09, 8, 8]} />
                            <meshBasicMaterial color="#ef4444" />
                        </mesh>
                        <mesh position={[-0.16, 4.0, 0]}>
                            <sphereGeometry args={[0.09, 8, 8]} />
                            <meshBasicMaterial color="#eab308" />
                        </mesh>
                        <mesh position={[-0.16, 3.75, 0]}>
                            <sphereGeometry args={[0.09, 8, 8]} />
                            <meshBasicMaterial color="#22c55e" />
                        </mesh>
                    </group>
                ))
            )}

            {/* 2 Nhà Chờ Bến Xe Buýt (Bus Shelters) */}
            <group position={[34, 0, 46.2]}>
                <mesh position={[0, 1.4, 0]}>
                    <boxGeometry args={[3.2, 0.08, 1.4]} />
                    <meshStandardMaterial color="#0284c7" />
                </mesh>
                <mesh position={[0, 1.0, -0.6]}>
                    <boxGeometry args={[3.0, 2.0, 0.08]} />
                    <meshStandardMaterial color="#38bdf8" transparent opacity={0.6} />
                </mesh>
            </group>
            <group position={[66, 0, 53.8]} rotation={[0, Math.PI, 0]}>
                <mesh position={[0, 1.4, 0]}>
                    <boxGeometry args={[3.2, 0.08, 1.4]} />
                    <meshStandardMaterial color="#0284c7" />
                </mesh>
                <mesh position={[0, 1.0, -0.6]}>
                    <boxGeometry args={[3.0, 2.0, 0.08]} />
                    <meshStandardMaterial color="#38bdf8" transparent opacity={0.6} />
                </mesh>
            </group>
        </group>
    );
}

// ==========================================
// 9. ĐỘI XE CỘ GIAO THÔNG ĐỘNG 7 CHIẾC (7 Dynamic Vehicles)
// ==========================================
export function DynamicTrafficVehicles({ isNight }: { isNight: boolean }) {
    const vehicles = useTrainingStore((s) => s.dynamicVehicles);

    if (!vehicles || vehicles.length === 0) return null;

    return (
        <group>
            {vehicles.map((v) => {
                const posX = v.pos[0];
                const posZ = v.pos[1];
                const yaw = v.yaw;

                if (v.type === "bus") {
                    return (
                        <group key={v.id} position={[posX, 0, posZ]} rotation={[0, yaw, 0]}>
                            <mesh position={[0, 1.2, 0]} castShadow>
                                <boxGeometry args={[2.4, 2.0, 5.2]} />
                                <meshStandardMaterial color={v.color} roughness={0.3} metalness={0.4} />
                            </mesh>
                            <mesh position={[0, 2.25, 0]}>
                                <boxGeometry args={[2.2, 0.25, 5.0]} />
                                <meshStandardMaterial color="#1e3a8a" roughness={0.5} />
                            </mesh>
                            {/* Kính chắn gió */}
                            <mesh position={[0, 1.4, 2.58]}>
                                <boxGeometry args={[2.1, 1.0, 0.1]} />
                                <meshStandardMaterial color="#0284c7" transparent opacity={0.7} />
                            </mesh>
                            {/* Cặp đèn pha trước */}
                            <mesh position={[-0.9, 0.65, 2.61]}>
                                <boxGeometry args={[0.35, 0.2, 0.05]} />
                                <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={isNight ? 2.5 : 0.8} />
                            </mesh>
                            <mesh position={[0.9, 0.65, 2.61]}>
                                <boxGeometry args={[0.35, 0.2, 0.05]} />
                                <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={isNight ? 2.5 : 0.8} />
                            </mesh>
                            {isNight && (
                                <pointLight position={[0, 0.7, 3.4]} color="#fef08a" distance={13.0} intensity={2.4} />
                            )}
                        </group>
                    );
                }

                if (v.type === "ambulance") {
                    return (
                        <group key={v.id} position={[posX, 0, posZ]} rotation={[0, yaw, 0]}>
                            <mesh position={[0, 1.1, 0]} castShadow>
                                <boxGeometry args={[2.0, 1.8, 4.4]} />
                                <meshStandardMaterial color="#ffffff" roughness={0.3} />
                            </mesh>
                            {/* Sọc đỏ cấp cứu hai bên */}
                            <mesh position={[0, 1.0, 0]}>
                                <boxGeometry args={[2.04, 0.4, 4.3]} />
                                <meshStandardMaterial color="#ef4444" />
                            </mesh>
                            {/* Đèn còi ưu tiên nhấp nháy đỏ xanh trên nóc */}
                            <mesh position={[-0.4, 2.1, 0]}>
                                <boxGeometry args={[0.25, 0.2, 0.4]} />
                                <meshBasicMaterial color="#ef4444" />
                            </mesh>
                            <mesh position={[0.4, 2.1, 0]}>
                                <boxGeometry args={[0.25, 0.2, 0.4]} />
                                <meshBasicMaterial color="#3b82f6" />
                            </mesh>
                        </group>
                    );
                }

                if (v.type === "taxi") {
                    return (
                        <group key={v.id} position={[posX, 0, posZ]} rotation={[0, yaw, 0]}>
                            <mesh position={[0, 0.5, 0]} castShadow>
                                <boxGeometry args={[1.8, 0.6, 3.8]} />
                                <meshStandardMaterial color={v.color} roughness={0.2} metalness={0.5} />
                            </mesh>
                            <mesh position={[0, 1.05, -0.2]} castShadow>
                                <boxGeometry args={[1.5, 0.55, 2.2]} />
                                <meshStandardMaterial color={v.color} roughness={0.2} />
                            </mesh>
                            <mesh position={[0, 1.4, -0.2]}>
                                <boxGeometry args={[0.7, 0.18, 0.35]} />
                                <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={1.8} />
                            </mesh>
                            <mesh position={[-0.65, 0.5, 1.91]}>
                                <boxGeometry args={[0.3, 0.15, 0.05]} />
                                <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={isNight ? 2.5 : 0.8} />
                            </mesh>
                            <mesh position={[0.65, 0.5, 1.91]}>
                                <boxGeometry args={[0.3, 0.15, 0.05]} />
                                <meshStandardMaterial color="#fef08a" emissive="#fef08a" emissiveIntensity={isNight ? 2.5 : 0.8} />
                            </mesh>
                            {isNight && (
                                <pointLight position={[0, 0.6, 2.6]} color="#fef08a" distance={10.0} intensity={2.0} />
                            )}
                        </group>
                    );
                }

                if (v.type === "van") {
                    return (
                        <group key={v.id} position={[posX, 0, posZ]} rotation={[0, yaw, 0]}>
                            <mesh position={[0, 0.7, 1.2]} castShadow>
                                <boxGeometry args={[1.9, 1.2, 1.5]} />
                                <meshStandardMaterial color={v.color} roughness={0.3} metalness={0.4} />
                            </mesh>
                            <mesh position={[0, 1.1, -0.7]} castShadow>
                                <boxGeometry args={[2.0, 2.0, 2.8]} />
                                <meshStandardMaterial color="#f8fafc" roughness={0.6} />
                            </mesh>
                        </group>
                    );
                }

                // Robot tuần tra / Patrol Bot
                return (
                    <group key={v.id} position={[posX, 0, posZ]} rotation={[0, yaw, 0]}>
                        <mesh position={[0, 0.65, 0]} castShadow>
                            <cylinderGeometry args={[0.6, 0.7, 1.2, 16]} />
                            <meshStandardMaterial color={v.color} roughness={0.2} metalness={0.7} />
                        </mesh>
                        <mesh position={[0, 1.35, 0]}>
                            <sphereGeometry args={[0.32, 16, 16]} />
                            <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1.6} />
                        </mesh>
                        <mesh position={[0, 1.75, 0]}>
                            <cylinderGeometry args={[0.09, 0.09, 0.18, 8]} />
                            <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={2.8} />
                        </mesh>
                    </group>
                );
            })}
        </group>
    );
}

// ==========================================
// 10. ĐỒ THỊ TOPO & ĐƯỜNG ĐỊNH TUYẾN A* (Topological Graph Overlay)
// ==========================================
export function TopologicalGraphOverlay() {
    const show = useTrainingStore((s) => s.showTopoAndTraffic);
    const boPath = useTrainingStore((s) => s.boTopoPath);
    const biPath = useTrainingStore((s) => s.biTopoPath);
    const topoNodes = useTrainingStore((s) => s.topoNodes);

    if (!show) return null;

    return (
        <group>
            {/* Điểm nút giao lộ ngã tư thành phố */}
            {topoNodes &&
                topoNodes.map((n) => (
                    <mesh key={n.id} position={[n.pos[0], 0.038, n.pos[1]]} rotation={[-Math.PI / 2, 0, 0]}>
                        <ringGeometry args={[0.35, 0.6, 16]} />
                        <meshBasicMaterial color="#38bdf8" transparent opacity={0.35} />
                    </mesh>
                ))}

            {/* Lộ trình A* của Bé Bo (Màu Cyan / Electric Blue) */}
            {boPath && boPath.length > 1 && (
                <group>
                    {boPath.map((pt, idx) => {
                        if (idx === 0) return null;
                        const prev = boPath[idx - 1];
                        const dx = pt[0] - prev[0];
                        const dz = pt[1] - prev[1];
                        const len = Math.sqrt(dx * dx + dz * dz);
                        const midX = (prev[0] + pt[0]) / 2;
                        const midZ = (prev[1] + pt[1]) / 2;
                        const angle = Math.atan2(dx, dz);

                        return (
                            <mesh
                                key={`bo-seg-${idx}`}
                                position={[midX, 0.048, midZ]}
                                rotation={[-Math.PI / 2, 0, -angle + Math.PI / 2]}
                            >
                                <planeGeometry args={[len, 0.32]} />
                                <meshBasicMaterial color="#06b6d4" transparent opacity={0.8} />
                            </mesh>
                        );
                    })}
                </group>
            )}

            {/* Lộ trình A* của Bé Bi (Màu Emerald Green) */}
            {biPath && biPath.length > 1 && (
                <group>
                    {biPath.map((pt, idx) => {
                        if (idx === 0) return null;
                        const prev = biPath[idx - 1];
                        const dx = pt[0] - prev[0];
                        const dz = pt[1] - prev[1];
                        const len = Math.sqrt(dx * dx + dz * dz);
                        const midX = (prev[0] + pt[0]) / 2;
                        const midZ = (prev[1] + pt[1]) / 2;
                        const angle = Math.atan2(dx, dz);

                        return (
                            <mesh
                                key={`bi-seg-${idx}`}
                                position={[midX, 0.052, midZ]}
                                rotation={[-Math.PI / 2, 0, -angle + Math.PI / 2]}
                            >
                                <planeGeometry args={[len, 0.28]} />
                                <meshBasicMaterial color="#10b981" transparent opacity={0.8} />
                            </mesh>
                        );
                    })}
                </group>
            )}
        </group>
    );
}

// ==========================================
// COMPONENT TỔNG HỢP TOÀN BỘ ĐẠI ĐÔ THỊ 100x100
// ==========================================
export default function CityMap({ isNightOverride }: { isNightOverride?: boolean }) {
    const isNightFromStore = useTrainingStore((s) => s.isNight);
    const isNight = isNightOverride ?? isNightFromStore;

    return (
        <group>
            {/* 1. Hệ thống đường phố, đại lộ bàn cờ và vỉa hè 100x100 */}
            <MegacityRoads />

            {/* 2. Khu Trung Tâm Tài Chính & Cao Ốc Chọc Trời (Downtown) */}
            <DowntownFinancialDistrict isNight={isNight} />

            {/* 3. Khu Phố Thương Mại, Mua Sắm & Cây Xăng */}
            <CommercialPromenade isNight={isNight} />

            {/* 4. Đại Công Viên Sinh Thái & Sân Bóng Rổ */}
            <GrandCentralParkAndSports />

            {/* 5. Khu Biệt Thự & Nhà Phố Liền Kề */}
            <ResidentialSuburb />

            {/* 6. Khu Khách Sạn & Hồ Bơi Resort */}
            <ResortAndPoolQuarter />

            {/* 7. Khu Y Tế Bệnh Viện, Cứu Hỏa & Nhà Hát Lớn */}
            <CivicPublicServices isNight={isNight} />

            {/* 8. Hạ tầng đèn đường, đèn giao thông & bến xe buýt */}
            <UrbanStreetProps isNight={isNight} />

            {/* 9. Đội xe cộ giao thông động 7 chiếc tuần tra */}
            <DynamicTrafficVehicles isNight={isNight} />

            {/* 10. Bản đồ Đồ thị Topo Graph & Lộ trình A* */}
            <TopologicalGraphOverlay />
        </group>
    );
}
