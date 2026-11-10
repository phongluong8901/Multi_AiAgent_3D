/**
 * ==============================================================================
 * CÁC ĐIỂM TÀI NGUYÊN & MỤC TIÊU 3D (RESOURCES & GOAL OBJECTS)
 * ==============================================================================
 * Render toàn bộ các trạm sinh hoạt và điểm khám phá trong thế giới 3D:
 * 1. HolographicCountdownClock: Vòng đồng hồ đếm ngược 3D lơ lửng hiển thị thời gian còn lại
 *    trước khi nguồn thức ăn / nước uống tự động biến mất và di chuyển sang tọa độ mới.
 * 2. RealisticFoodStation: Bàn ăn gỗ chữ nhật với bánh hamburger phô mai, tô súp nóng và giỏ trái cây,
 *    có vòng thể hiện dung lượng Kcal còn lại.
 * 3. RealisticWaterDispenser: Cây nước nóng lạnh tinh khiết có bình 20L úp ngược và cột nước thay đổi.
 * 4. RealisticBed: Giường ngủ cao cấp kèm nệm lò xo, chăn gấp nếp, gối êm ái và táp đèn ngủ ấm áp.
 * 5. RealisticGoalBeacon: Đài ngọc lục bảo phát sáng bát giác (cột sáng xanh lá).
 * 6. HistoricalDepletedSpots: Đánh dấu các vị trí cũ mà tài nguyên đã cạn kiệt trong ký ức.
 */

import { useTrainingStore } from "../stores/useTrainingStore";

// Đồng Hồ Đếm Ngược Holographic 3D (Floating Holographic Countdown Ring)
function HolographicCountdownClock({
    timeLeft,
    maxTime,
    yOffset = 1.6,
    color = "#f59e0b",
}: {
    timeLeft: number;
    maxTime: number;
    yOffset?: number;
    color?: string;
}) {
    const ratio = Math.max(0, Math.min(1, timeLeft / Math.max(1, maxTime)));
    const isUrgent = timeLeft <= 8.0;
    const ringColor = isUrgent ? "#ef4444" : color;
    const angle = (1.0 - ratio) * Math.PI * 2;

    return (
        <group position={[0, yOffset, 0]}>
            {/* Vòng đĩa đồng hồ holographic bán trong suốt */}
            <mesh rotation={[-Math.PI / 3, 0, 0]}>
                <ringGeometry args={[0.26, 0.34, 32]} />
                <meshBasicMaterial color={ringColor} transparent opacity={0.65} />
            </mesh>
            {/* Vành ngoài đồng hồ */}
            <mesh rotation={[-Math.PI / 3, 0, 0]}>
                <ringGeometry args={[0.34, 0.37, 32]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.35} />
            </mesh>
            {/* Điểm kim đồng hồ chỉ thời gian */}
            <mesh
                rotation={[-Math.PI / 3, 0, 0]}
                position={[
                    Math.sin(angle) * 0.3,
                    Math.cos(angle) * 0.3 * Math.cos(Math.PI / 3),
                    -Math.cos(angle) * 0.3 * Math.sin(Math.PI / 3),
                ]}
            >
                <sphereGeometry args={[0.045, 12, 12]} />
                <meshBasicMaterial color={isUrgent ? "#ef4444" : "#ffffff"} />
            </mesh>
            {/* Điểm tâm phát sáng */}
            <mesh rotation={[-Math.PI / 3, 0, 0]}>
                <circleGeometry args={[0.07, 16]} />
                <meshBasicMaterial color={ringColor} transparent opacity={0.8} />
            </mesh>
        </group>
    );
}

// 1. Khu Vực Bàn Ăn Dinh Dưỡng Thực Thụ (Realistic Dining Table & Food)
function RealisticFoodStation({
    position,
    capacity,
    timeLeft,
    maxTime,
}: {
    position: number[];
    capacity: number;
    timeLeft: number;
    maxTime: number;
}) {
    const isLow = capacity <= 25;
    const capacityRatio = Math.max(0.1, capacity / 100);

    return (
        <group position={[position[0], 0, position[1]]}>
            {/* Thảm sàn khu vực phòng bếp */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
                <circleGeometry args={[1.6, 32]} />
                <meshStandardMaterial color="#f59e0b" transparent opacity={0.18} />
            </mesh>

            {/* Vòng hiển thị dung lượng thức ăn còn lại */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                <ringGeometry args={[1.35, 1.45, 32]} />
                <meshBasicMaterial
                    color={isLow ? "#ef4444" : "#f59e0b"}
                    transparent
                    opacity={0.6}
                />
            </mesh>

            {/* BÀN ĂN GỖ CHỮ NHẬT */}
            {/* Mặt bàn gỗ sồi sẫm bóng */}
            <mesh position={[0, 0.58, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.6, 0.08, 1.0]} />
                <meshStandardMaterial color="#854d0e" roughness={0.35} metalness={0.05} />
            </mesh>
            {/* Khăn trải bàn chạy dọc giữa bàn */}
            <mesh position={[0, 0.625, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.61, 0.01, 0.38]} />
                <meshStandardMaterial color="#fef3c7" roughness={0.7} />
            </mesh>

            {/* 4 Chân bàn gỗ với đế bọc kim loại */}
            {[
                [-0.68, -0.38],
                [0.68, -0.38],
                [-0.68, 0.38],
                [0.68, 0.38],
            ].map(([cx, cz], idx) => (
                <group key={idx} position={[cx, 0.27, cz]}>
                    <mesh castShadow>
                        <cylinderGeometry args={[0.045, 0.035, 0.54, 16]} />
                        <meshStandardMaterial color="#713f12" roughness={0.5} />
                    </mesh>
                    <mesh position={[0, -0.25, 0]}>
                        <cylinderGeometry args={[0.05, 0.05, 0.04, 16]} />
                        <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
                    </mesh>
                </group>
            ))}

            {/* GHẾ ĂN GỖ 2 BÊN */}
            {[-0.65, 0.65].map((gz, gIdx) => (
                <group key={gIdx} position={[0, 0, gz]}>
                    {/* Đệm mặt ghế */}
                    <mesh position={[0, 0.34, 0]} castShadow receiveShadow>
                        <boxGeometry args={[0.42, 0.05, 0.42]} />
                        <meshStandardMaterial color="#92400e" roughness={0.5} />
                    </mesh>
                    {/* Tựa lưng ghế */}
                    <mesh position={[0, 0.58, gz > 0 ? 0.18 : -0.18]} castShadow>
                        <boxGeometry args={[0.38, 0.44, 0.04]} />
                        <meshStandardMaterial color="#78350f" roughness={0.4} />
                    </mesh>
                    {/* 4 chân ghế */}
                    {[
                        [-0.16, -0.16],
                        [0.16, -0.16],
                        [-0.16, 0.16],
                        [0.16, 0.16],
                    ].map(([jx, jz], jIdx) => (
                        <mesh key={jIdx} position={[jx, 0.16, jz]} castShadow>
                            <cylinderGeometry args={[0.025, 0.02, 0.32, 12]} />
                            <meshStandardMaterial color="#713f12" />
                        </mesh>
                    ))}
                </group>
            ))}

            {/* MÓN ĂN THỰC THỤ TRÊN BÀN */}
            {capacity > 10 && (
                <group position={[0, 0.63, 0]} scale={[capacityRatio, capacityRatio, capacityRatio]}>
                    {/* Đĩa 1: Bánh Hamburger kẹp phô mai & xà lách */}
                    <group position={[-0.42, 0, 0]}>
                        <mesh position={[0, 0.015, 0]} castShadow receiveShadow>
                            <cylinderGeometry args={[0.22, 0.18, 0.025, 24]} />
                            <meshStandardMaterial color="#ffffff" roughness={0.15} />
                        </mesh>
                        {/* Vỏ bánh mì dưới */}
                        <mesh position={[0, 0.045, 0]} castShadow>
                            <cylinderGeometry args={[0.13, 0.11, 0.035, 16]} />
                            <meshStandardMaterial color="#d97706" roughness={0.6} />
                        </mesh>
                        {/* Thịt bò nướng */}
                        <mesh position={[0, 0.075, 0]} castShadow>
                            <cylinderGeometry args={[0.14, 0.14, 0.035, 16]} />
                            <meshStandardMaterial color="#451a03" roughness={0.8} />
                        </mesh>
                        {/* Lát phô mai vàng & rau xanh */}
                        <mesh position={[0, 0.098, 0]} rotation={[0, 0.4, 0]}>
                            <boxGeometry args={[0.2, 0.012, 0.2]} />
                            <meshStandardMaterial color="#facc15" roughness={0.3} />
                        </mesh>
                        {/* Nắp bánh mì trên rắc vừng */}
                        <mesh position={[0, 0.13, 0]} castShadow>
                            <sphereGeometry args={[0.13, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
                            <meshStandardMaterial color="#b45309" roughness={0.5} />
                        </mesh>
                    </group>

                    {/* Đĩa 2: Tô Súp Nóng Dinh Dưỡng */}
                    <group position={[0.38, 0, 0]}>
                        <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
                            <cylinderGeometry args={[0.18, 0.11, 0.14, 24]} />
                            <meshStandardMaterial color="#f8fafc" roughness={0.2} />
                        </mesh>
                        {/* Mặt nước súp vàng óng */}
                        <mesh position={[0, 0.135, 0]}>
                            <cylinderGeometry args={[0.165, 0.165, 0.02, 20]} />
                            <meshStandardMaterial color="#ea580c" roughness={0.2} metalness={0.1} />
                        </mesh>
                        {/* Muỗng súp nhỏ */}
                        <mesh position={[0.07, 0.145, 0.05]} rotation={[0.2, 0.4, 0]}>
                            <boxGeometry args={[0.03, 0.01, 0.14]} />
                            <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.2} />
                        </mesh>
                    </group>

                    {/* Giỏ Trái Cây Tươi Ở Giữa Bàn */}
                    <group position={[0, 0, 0]}>
                        <mesh position={[0, 0.04, 0]} castShadow>
                            <cylinderGeometry args={[0.16, 0.1, 0.06, 16]} />
                            <meshStandardMaterial color="#78350f" roughness={0.7} />
                        </mesh>
                        {/* Táo đỏ */}
                        <mesh position={[-0.05, 0.09, -0.03]} castShadow>
                            <sphereGeometry args={[0.055, 14, 14]} />
                            <meshStandardMaterial color="#dc2626" roughness={0.2} />
                        </mesh>
                        {/* Cam vàng */}
                        <mesh position={[0.05, 0.09, 0.03]} castShadow>
                            <sphereGeometry args={[0.055, 14, 14]} />
                            <meshStandardMaterial color="#f97316" roughness={0.4} />
                        </mesh>
                    </group>
                </group>
            )}

            {/* Đồng hồ đếm ngược thời gian tài nguyên bàn ăn */}
            <HolographicCountdownClock timeLeft={timeLeft} maxTime={maxTime} yOffset={1.4} color="#f59e0b" />

            {/* Ánh sáng đèn bàn ăn ấm áp */}
            <pointLight position={[0, 1.4, 0]} color="#fef08a" distance={3.2} intensity={1.2} />
        </group>
    );
}

// 2. Khu Vực Cây Nước Nóng Lạnh Tinh Khiết (Realistic Water Dispenser Cooler)
function RealisticWaterDispenser({
    position,
    capacity,
    timeLeft,
    maxTime,
}: {
    position: number[];
    capacity: number;
    timeLeft: number;
    maxTime: number;
}) {
    const isLow = capacity <= 25;
    const waterHeight = Math.max(0.05, (capacity / 100) * 0.42);

    return (
        <group position={[position[0], 0, position[1]]}>
            {/* Thảm sàn khu vực cấp nước */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
                <circleGeometry args={[1.5, 32]} />
                <meshStandardMaterial color="#06b6d4" transparent opacity={0.2} />
            </mesh>

            {/* Vòng hiển thị dung lượng nước còn lại */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                <ringGeometry args={[1.25, 1.35, 32]} />
                <meshBasicMaterial
                    color={isLow ? "#ef4444" : "#06b6d4"}
                    transparent
                    opacity={0.65}
                />
            </mesh>

            {/* THÂN MÁY CÂY NƯỚC UỐNG */}
            {/* Khung máy đứng màu trắng bóng */}
            <mesh position={[0, 0.52, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.55, 1.04, 0.55]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.2} metalness={0.1} />
            </mesh>
            {/* Khung viền kim loại bạc chân máy */}
            <mesh position={[0, 0.04, 0]}>
                <boxGeometry args={[0.57, 0.08, 0.57]} />
                <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
            </mesh>

            {/* HỐC LẤY NƯỚC ÂM VÀO THÂN */}
            <mesh position={[0, 0.58, 0.17]}>
                <boxGeometry args={[0.38, 0.38, 0.22]} />
                <meshStandardMaterial color="#0f172a" roughness={0.4} />
            </mesh>
            {/* Khay hứng nước inox bạc */}
            <mesh position={[0, 0.41, 0.2]} castShadow receiveShadow>
                <boxGeometry args={[0.36, 0.03, 0.16]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.15} />
            </mesh>

            {/* 2 VÒI GẠT NƯỚC NÓNG - LẠNH */}
            {/* Vòi Nóng Đỏ */}
            <group position={[-0.08, 0.72, 0.18]}>
                <mesh>
                    <cylinderGeometry args={[0.015, 0.015, 0.06, 12]} />
                    <meshStandardMaterial color="#ef4444" roughness={0.3} />
                </mesh>
            </group>
            {/* Vòi Lạnh Xanh Dương */}
            <group position={[0.08, 0.72, 0.18]}>
                <mesh>
                    <cylinderGeometry args={[0.015, 0.015, 0.06, 12]} />
                    <meshStandardMaterial color="#0284c7" roughness={0.3} />
                </mesh>
            </group>

            {/* Ly thủy tinh hứng nước mát trên khay */}
            <group position={[0.05, 0.49, 0.2]}>
                <mesh castShadow>
                    <cylinderGeometry args={[0.055, 0.04, 0.13, 16]} />
                    <meshStandardMaterial
                        color="#38bdf8"
                        transparent
                        opacity={0.65}
                        roughness={0.1}
                        metalness={0.1}
                    />
                </mesh>
            </group>

            {/* BÌNH NƯỚC KHOÁNG 20L ÚP PHÍA TRÊN */}
            {/* Cổ bình cắm vào máy */}
            <mesh position={[0, 1.08, 0]}>
                <cylinderGeometry args={[0.13, 0.15, 0.08, 20]} />
                <meshStandardMaterial color="#0284c7" roughness={0.2} />
            </mesh>
            {/* Thân bình nhựa màu xanh trong suốt */}
            <mesh position={[0, 1.34, 0]} castShadow>
                <cylinderGeometry args={[0.22, 0.22, 0.44, 24]} />
                <meshStandardMaterial
                    color="#0284c7"
                    transparent
                    opacity={0.4}
                    roughness={0.1}
                    metalness={0.1}
                />
            </mesh>
            {/* Cột nước bên trong bình (thay đổi theo capacity) */}
            <mesh position={[0, 1.14 + waterHeight / 2, 0]}>
                <cylinderGeometry args={[0.21, 0.21, waterHeight, 20]} />
                <meshStandardMaterial
                    color="#38bdf8"
                    emissive="#0284c7"
                    emissiveIntensity={0.3}
                    transparent
                    opacity={0.8}
                    roughness={0.05}
                />
            </mesh>
            {/* Đáy bình vòm tròn úp ngược */}
            <mesh position={[0, 1.56, 0]}>
                <sphereGeometry args={[0.22, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial
                    color="#0284c7"
                    transparent
                    opacity={0.4}
                    roughness={0.1}
                />
            </mesh>

            {/* Đồng hồ đếm ngược thời gian tài nguyên cây nước */}
            <HolographicCountdownClock timeLeft={timeLeft} maxTime={maxTime} yOffset={2.0} color="#0284c7" />

            {/* Đèn ánh xanh mát dịu nhẹ */}
            <pointLight position={[0, 1.3, 0.4]} color="#38bdf8" distance={2.8} intensity={1.0} />
        </group>
    );
}

// 3. Khu Vực Giường Ngủ Cao Cấp & Táp Đầu Giường (Realistic Cozy Platform Bed)
function RealisticBed({ position }: { position: number[] }) {
    return (
        <group position={[position[0], 0, position[1]]}>
            {/* Thảm phòng ngủ êm ái */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
                <planeGeometry args={[2.6, 2.6]} />
                <meshStandardMaterial color="#6366f1" transparent opacity={0.16} />
            </mesh>

            {/* KHUNG GIƯỜNG GỖ TỰ NHIÊN */}
            {/* Thân khung giường */}
            <mesh position={[0, 0.16, 0.05]} castShadow receiveShadow>
                <boxGeometry args={[1.9, 0.18, 2.05]} />
                <meshStandardMaterial color="#78350f" roughness={0.6} />
            </mesh>

            {/* Tấm tựa đầu giường cao */}
            <mesh position={[0, 0.65, -0.92]} castShadow receiveShadow>
                <boxGeometry args={[1.95, 0.85, 0.1]} />
                <meshStandardMaterial color="#92400e" roughness={0.5} />
            </mesh>

            {/* 4 Chân giường gỗ tròn góc */}
            {[
                [-0.88, -0.9],
                [0.88, -0.9],
                [-0.88, 0.98],
                [0.88, 0.98],
            ].map(([bx, bz], bIdx) => (
                <mesh key={bIdx} position={[bx, 0.08, bz]} castShadow>
                    <cylinderGeometry args={[0.045, 0.04, 0.16, 12]} />
                    <meshStandardMaterial color="#451a03" />
                </mesh>
            ))}

            {/* NỆM LÒ XO DÀY DẶN BỌC VẢI TRẮNG */}
            <mesh position={[0, 0.33, 0.05]} castShadow receiveShadow>
                <boxGeometry args={[1.78, 0.22, 1.9]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.65} />
            </mesh>

            {/* CHĂN ĐẮP ẤM CÚNG GẤP NẾP PHỦ 2/3 GIƯỜNG */}
            <mesh position={[0, 0.46, 0.25]} castShadow receiveShadow>
                <boxGeometry args={[1.82, 0.08, 1.35]} />
                <meshStandardMaterial color="#4338ca" roughness={0.7} />
            </mesh>

            {/* 2 CHIẾC GỐI NẰM PHỒNG ÊM ÁI */}
            {[-0.45, 0.45].map((px, pIdx) => (
                <mesh key={pIdx} position={[px, 0.48, -0.65]} rotation={[-0.15, 0, 0]} castShadow>
                    <boxGeometry args={[0.62, 0.14, 0.42]} />
                    <meshStandardMaterial color="#ffffff" roughness={0.4} />
                </mesh>
            ))}

            {/* TÁP ĐẦU GIƯỜNG & ĐÈN NGỦ BÊN CẠNH */}
            <group position={[1.25, 0, -0.8]}>
                {/* Tủ gỗ nhỏ */}
                <mesh position={[0, 0.26, 0]} castShadow receiveShadow>
                    <boxGeometry args={[0.45, 0.52, 0.45]} />
                    <meshStandardMaterial color="#78350f" roughness={0.5} />
                </mesh>
                {/* Tay nắm ngăn kéo ánh kim */}
                <mesh position={[0, 0.26, 0.24]}>
                    <sphereGeometry args={[0.03, 12, 12]} />
                    <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
                </mesh>
                {/* Đèn ngủ để bàn */}
                {/* Chân đế đèn */}
                <mesh position={[0, 0.55, 0]}>
                    <cylinderGeometry args={[0.08, 0.1, 0.06, 16]} />
                    <meshStandardMaterial color="#e2e8f0" roughness={0.2} />
                </mesh>
                {/* Thân đèn */}
                <mesh position={[0, 0.64, 0]}>
                    <cylinderGeometry args={[0.02, 0.02, 0.14, 12]} />
                    <meshStandardMaterial color="#fbbf24" metalness={0.7} />
                </mesh>
                {/* Chao đèn nón ấm */}
                <mesh position={[0, 0.74, 0]} castShadow>
                    <cylinderGeometry args={[0.13, 0.18, 0.16, 20]} />
                    <meshStandardMaterial
                        color="#fef08a"
                        emissive="#facc15"
                        emissiveIntensity={0.5}
                        roughness={0.3}
                    />
                </mesh>
                <pointLight position={[0, 0.78, 0]} color="#fef08a" distance={3.5} intensity={1.4} />
            </group>
        </group>
    );
}

// 4. Khu Vực Điểm Mục Tiêu Khám Phá (Futuristic Discovery Beacon)
function RealisticGoalBeacon({ position }: { position: number[] }) {
    return (
        <group position={[position[0], 0, position[1]]}>
            {/* Bệ đá bát giác tương lai */}
            <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.9, 1.1, 0.16, 8]} />
                <meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.5} />
            </mesh>

            {/* Vòng hào quang mặt sàn */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.17, 0]}>
                <ringGeometry args={[0.7, 0.88, 32]} />
                <meshBasicMaterial color="#22c55e" transparent opacity={0.8} />
            </mesh>

            {/* Khối ngọc pha lê phát sáng lơ lửng */}
            <mesh position={[0, 0.85, 0]} castShadow>
                <octahedronGeometry args={[0.42, 0]} />
                <meshStandardMaterial
                    color="#22c55e"
                    emissive="#16a34a"
                    emissiveIntensity={0.8}
                    roughness={0.15}
                    metalness={0.3}
                />
            </mesh>

            {/* Vòng năng lượng neon quay lượn */}
            <mesh position={[0, 0.85, 0]} rotation={[0.6, 0.4, 0]}>
                <torusGeometry args={[0.62, 0.025, 12, 32]} />
                <meshBasicMaterial color="#4ade80" />
            </mesh>

            <pointLight position={[0, 1.1, 0]} color="#22c55e" distance={3.8} intensity={1.6} />
        </group>
    );
}

// 5. Vết Tích Các Vị Trí Tài Nguyên Đã Từng Tìm Thấy (Historical Depleted Spots)
function HistoricalDepletedSpots({ spots }: { spots: { type: string; pos: number[]; step?: number }[] }) {
    if (!spots || spots.length === 0) return null;

    return (
        <group>
            {spots.map((spot, idx) => {
                const isFood = spot.type === "food";
                return (
                    <group key={`hist-${idx}`} position={[spot.pos[0], 0.02, spot.pos[1]]}>
                        {/* Vòng hoa văn sàn thể hiện vị trí lịch sử đã cạn */}
                        <mesh rotation={[-Math.PI / 2, 0, 0]}>
                            <ringGeometry args={[0.75, 0.9, 24]} />
                            <meshBasicMaterial
                                color={isFood ? "#b45309" : "#0284c7"}
                                transparent
                                opacity={0.35}
                            />
                        </mesh>
                        {/* Cột mốc nhỏ đánh dấu vị trí cũ */}
                        <mesh position={[0, 0.12, 0]}>
                            <cylinderGeometry args={[0.08, 0.12, 0.24, 8]} />
                            <meshStandardMaterial color="#475569" roughness={0.8} />
                        </mesh>
                    </group>
                );
            })}
        </group>
    );
}

export default function Goal() {
    const goal = useTrainingStore((s) => s.goal);
    const food = useTrainingStore((s) => s.food);
    const water = useTrainingStore((s) => s.water);
    const bed = useTrainingStore((s) => s.bed);
    const foodCapacity = useTrainingStore((s) => s.foodCapacity);
    const waterCapacity = useTrainingStore((s) => s.waterCapacity);
    const foodTimeLeft = useTrainingStore((s) => s.foodTimeLeft);
    const waterTimeLeft = useTrainingStore((s) => s.waterTimeLeft);
    const foodMaxTime = useTrainingStore((s) => s.foodMaxTime);
    const waterMaxTime = useTrainingStore((s) => s.waterMaxTime);
    const depletedSpots = useTrainingStore((s) => s.depletedSpots);

    return (
        <group>
            {/* 1. Điểm Mục Tiêu Khám Phá */}
            <RealisticGoalBeacon position={goal} />

            {/* 2. Bàn Ăn Bếp Dinh Dưỡng Thực Thụ (kèm Holographic Clock) */}
            <RealisticFoodStation
                position={food}
                capacity={foodCapacity}
                timeLeft={foodTimeLeft}
                maxTime={foodMaxTime}
            />

            {/* 3. Cây Nước Nóng Lạnh Tinh Khiết (kèm Holographic Clock) */}
            <RealisticWaterDispenser
                position={water}
                capacity={waterCapacity}
                timeLeft={waterTimeLeft}
                maxTime={waterMaxTime}
            />

            {/* 4. Giường Ngủ Cao Cấp & Táp Đèn Ngủ */}
            <RealisticBed position={bed} />

            {/* 5. Vết Tích Lịch Sử Vị Trí Đã Từng Tìm Thấy (Depleted Spots Memory) */}
            <HistoricalDepletedSpots spots={depletedSpots} />
        </group>
    );
}
