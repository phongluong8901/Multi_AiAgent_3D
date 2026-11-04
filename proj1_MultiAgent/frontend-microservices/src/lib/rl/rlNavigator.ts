import * as THREE from 'three'

export type Obstacle2D = {
    x: number
    z: number
    radius: number
    type?: string
}

/**
 * Danh sách toàn bộ bàn ghế, chướng ngại vật và vách ngăn trong Văn phòng 3D (Office Room).
 * Giúp Agent nhận diện không gian xung quanh để né tránh chuẩn xác.
 */
export const OFFICE_OBSTACLES: Obstacle2D[] = [
    // 1. PHÒNG QUẢN LÝ & ĐIỀU HÀNH (Tây Bắc: X < 0, Z < 0)
    { x: -9.5, z: -8.0, radius: 0.95, type: 'desk' },       // Bàn Giám đốc
    { x: -5.5, z: -8.0, radius: 0.95, type: 'desk' },       // Bàn Điều phối
    { x: -9.5, z: -4.0, radius: 0.95, type: 'desk' },       // Bàn Quản lý PM
    { x: -5.5, z: -3.5, radius: 1.3, type: 'roundtable' }, // Bàn họp nhỏ
    { x: -13.2, z: -5.25, radius: 1.0, type: 'cabinet' },  // Tủ tài liệu
    { x: -13.2, z: -9.5, radius: 0.8, type: 'plant' },     // Cây cảnh
    { x: -3.5, z: -9.5, radius: 0.8, type: 'plant' },      // Cây cảnh

    // 2. PHÒNG NGHIÊN CỨU & TÌM KIẾM (Đông Bắc: X > 0, Z < 0)
    { x: 5.5, z: -8.0, radius: 0.95, type: 'desk' },        // Bàn AI Lab
    { x: 9.5, z: -8.0, radius: 0.95, type: 'desk' },        // Bàn Web Crawler
    { x: 5.5, z: -4.0, radius: 0.95, type: 'desk' },        // Bàn Knowledge Graph
    { x: 9.5, z: -4.0, radius: 0.95, type: 'desk' },        // Bàn Data Research
    { x: 13.2, z: -9.0, radius: 0.9, type: 'server' },     // Server Rack 1
    { x: 13.2, z: -6.0, radius: 0.9, type: 'server' },     // Server Rack 2
    { x: 13.2, z: -4.0, radius: 0.9, type: 'server' },     // Server Rack 3
    { x: 3.5, z: -9.5, radius: 0.8, type: 'plant' },       // Cây cảnh
    { x: 13.2, z: -1.2, radius: 0.8, type: 'plant' },      // Cây cảnh

    // 3. PHÒNG PHÂN TÍCH & ĐÁNH GIÁ (Đông Nam: X > 0, Z > 0)
    { x: 5.5, z: 4.0, radius: 0.95, type: 'desk' },         // Bàn Analyst
    { x: 9.5, z: 4.0, radius: 0.95, type: 'desk' },         // Bàn Metric QA
    { x: 5.5, z: 8.0, radius: 0.95, type: 'desk' },         // Bàn Evaluator
    { x: 9.5, z: 8.0, radius: 0.95, type: 'desk' },         // Bàn Audit
    { x: 13.2, z: 2.5, radius: 1.0, type: 'cabinet' },     // Tủ tài liệu
    { x: 3.5, z: 9.5, radius: 0.8, type: 'plant' },        // Cây cảnh
    { x: 13.2, z: 9.5, radius: 0.8, type: 'plant' },       // Cây cảnh

    // 4. KHU VỰC LOUNGE & NGHỈ NGƠI (Tây Nam: X < 0, Z > 0)
    { x: -9.0, z: 4.5, radius: 1.8, type: 'sofa' },        // Ghế Sofa
    { x: -6.0, z: 4.0, radius: 1.5, type: 'roundtable' },  // Bàn tròn hội ý
    { x: -8.5, z: 8.5, radius: 2.1, type: 'pingpong' },    // Bàn bóng bàn
    { x: -3.5, z: 1.5, radius: 1.2, type: 'coffee' },      // Quầy trà cafe
    { x: -13.2, z: 1.5, radius: 0.9, type: 'plant' },      // Cây cảnh
    { x: -13.2, z: 9.5, radius: 0.9, type: 'plant' },      // Cây cảnh

    // 5. TƯỜNG NGĂN VÀ VÁCH KÍNH CÓ CỬA RA VÀO (PARTITIONS & WALLS)
    // Tường ngăn Tây (giữa Quản lý & Lounge)
    { x: -11.5, z: 0.0, radius: 1.2, type: 'wall' },
    { x: -8.25, z: 0.0, radius: 1.2, type: 'wall' },
    { x: -5.0, z: 0.0, radius: 1.2, type: 'wall' },
    // Tường ngăn Đông (giữa Nghiên cứu & Phân tích)
    { x: 5.0, z: 0.0, radius: 1.2, type: 'wall' },
    { x: 8.25, z: 0.0, radius: 1.2, type: 'wall' },
    { x: 11.5, z: 0.0, radius: 1.2, type: 'wall' },
    // Vách kính dọc Tây (chừa cửa tại Z = -2.8 và Z = 1.5)
    { x: -2.5, z: -8.5, radius: 1.1, type: 'partition' },
    { x: -2.5, z: -5.5, radius: 1.1, type: 'partition' },
    { x: -2.5, z: -0.8, radius: 1.0, type: 'partition' },
    { x: -2.5, z: 5.0, radius: 1.1, type: 'partition' },
    { x: -2.5, z: 8.0, radius: 1.1, type: 'partition' },
    // Vách kính dọc Đông (chừa cửa tại Z = -2.8 và Z = 2.8)
    { x: 2.5, z: -8.5, radius: 1.1, type: 'partition' },
    { x: 2.5, z: -5.5, radius: 1.1, type: 'partition' },
    { x: 2.5, z: 0.0, radius: 1.0, type: 'partition' },
    { x: 2.5, z: 6.0, radius: 1.1, type: 'partition' },
    { x: 2.5, z: 9.0, radius: 1.1, type: 'partition' },
]

// Kích thước tường biên văn phòng thật (28x22m)
const ARENA_X_LIMIT = 13.6
const ARENA_Z_LIMIT = 10.6

/**
 * Phân tích không gian văn phòng thành 4 phòng ban và hành lang trung tâm.
 * Tạo chuỗi toạ độ trạm trung chuyển (Waypoints) giúp Agent di chuyển xuyên phòng ban:
 * - Đi qua cửa ra vào của phòng hiện tại
 * - Đi dọc hành lang trung tâm
 * - Đi vào cửa của phòng đích
 * - Đến vị trí đích
 * Nhờ đó Agent không bao giờ đâm đầu vào tường đặc 11.5m ngăn cách giữa các phòng!
 */
export function getOfficeWaypoints(
    start: [number, number, number] | { x: number; z: number },
    target: [number, number, number] | { x: number; z: number }
): [number, number, number][] {
    const sx = 'x' in start ? start.x : start[0]
    const sz = 'z' in start ? start.z : start[2]
    const tx = 'x' in target ? target.x : target[0]
    const tz = 'z' in target ? target.z : target[2]

    // Xác định khu vực hiện tại và khu vực đích:
    // 'nw': Quản lý (x < -2.2, z < 0)
    // 'ne': Nghiên cứu (x > 2.2, z < 0)
    // 'sw': Lounge (x < -2.2, z > 0)
    // 'se': Phân tích (x > 2.2, z > 0)
    // 'corridor': Hành lang (|x| <= 2.2)
    const getZone = (x: number, z: number): 'nw' | 'ne' | 'sw' | 'se' | 'corridor' => {
        if (Math.abs(x) <= 2.2) return 'corridor'
        if (z <= 0) return x < 0 ? 'nw' : 'ne'
        return x < 0 ? 'sw' : 'se'
    }

    const startZone = getZone(sx, sz)
    const targetZone = getZone(tx, tz)

    // Nếu cùng trong 1 phòng ban hoặc cùng trong hành lang -> Đi trực tiếp
    if (startZone === targetZone) {
        return [[tx, 0, tz]]
    }

    // Các điểm nút giao cửa ra vào (Doorway Nodes) và điểm đón hành lang (Hallway Nodes)
    const DOORWAYS = {
        nw: { door: [-3.2, 0, -2.8] as [number, number, number], hall: [0, 0, -2.8] as [number, number, number] },
        ne: { door: [3.2, 0, -2.8] as [number, number, number], hall: [0, 0, -2.8] as [number, number, number] },
        sw: { door: [-3.2, 0, 1.5] as [number, number, number], hall: [0, 0, 1.5] as [number, number, number] },
        se: { door: [3.2, 0, 2.8] as [number, number, number], hall: [0, 0, 2.8] as [number, number, number] },
    }

    const waypoints: [number, number, number][] = []

    // 1. Điểm thoát khỏi phòng xuất phát (nếu đang trong phòng)
    if (startZone !== 'corridor') {
        waypoints.push(DOORWAYS[startZone].door)
        waypoints.push(DOORWAYS[startZone].hall)
    }

    // 2. Đi qua điểm giao trung tâm hành lang nếu phải đổi từ nửa Bắc sang Nam (băng qua Z = 0)
    const startNorth = sz <= 0
    const targetNorth = tz <= 0
    if (startNorth !== targetNorth) {
        waypoints.push([0, 0, 0])
    }

    // 3. Điểm vào phòng đích (nếu phòng đích không phải là hành lang)
    if (targetZone !== 'corridor') {
        waypoints.push(DOORWAYS[targetZone].hall)
        waypoints.push(DOORWAYS[targetZone].door)
    }

    // 4. Điểm đích cuối cùng
    waypoints.push([tx, 0, tz])

    return waypoints
}

/**
 * Thuật toán Điều hướng Tránh né RL (Reinforcement Learning Steering Policy).
 * Thay vì đi thẳng đâm vào bàn ghế, Agent sẽ quét LIDAR xung quanh:
 * - Khi phát hiện bàn ghế trong cự ly nguy hiểm (< 2.2m)
 * - Tự động tính toán vector bẻ lái tiếp tuyến liên tục (không đảo dấu giật cục)
 * - Uốn lượn mượt mà quanh vật thể để đến toạ độ đích.
 */
export function computeRLNavigationVelocity(
    currentPos: { x: number; z: number },
    targetPos: { x: number; z: number },
    currentHeading: number,
    speed: number = 1.4,
    customObstacles: Obstacle2D[] = OFFICE_OBSTACLES
): {
    velocity: { x: number; z: number }
    rotationY: number
    isAvoiding: boolean
    arrived: boolean
} {
    const dx = targetPos.x - currentPos.x
    const dz = targetPos.z - currentPos.z
    const distToGoal = Math.sqrt(dx * dx + dz * dz)

    // Đã tới đích
    if (distToGoal < 0.22) {
        return {
            velocity: { x: 0, z: 0 },
            rotationY: currentHeading,
            isAvoiding: false,
            arrived: true,
        }
    }

    // Vector hướng thẳng tới đích (Goal Attraction Vector)
    const goalDirX = dx / distToGoal
    const goalDirZ = dz / distToGoal

    // Bắn tia LIDAR quét các chướng ngại vật xung quanh Agent
    const DETECTION_RADIUS = 2.0  // Tầm quét cảm biến hợp lý
    let avoidForceX = 0
    let avoidForceZ = 0
    let isAvoiding = false
    let maxThreat = 0

    for (const obs of customObstacles) {
        // Nếu điểm đích nằm ngay tại/rất gần vật cản này (ví dụ Agent đang đi về bàn làm việc của chính mình)
        // thì không tạo lực đẩy cản trở việc tiếp cận đích.
        const distGoalToObs = Math.hypot(targetPos.x - obs.x, targetPos.z - obs.z)
        if (distGoalToObs < obs.radius + 0.3) continue

        const ox = currentPos.x - obs.x
        const oz = currentPos.z - obs.z
        const dist = Math.sqrt(ox * ox + oz * oz)
        const safeDist = obs.radius + 0.45  // Bán kính an toàn bao gồm cả người Agent

        if (dist < safeDist + DETECTION_RADIUS && dist > 0.05) {
            // Vector chuẩn hóa đẩy ra xa tâm vật thể
            const nx = ox / dist
            const nz = oz / dist

            // Kiểm tra xem vật thể có đang chắn đường tiến tới đích không
            const toObsX = -nx
            const toObsZ = -nz
            const dot = goalDirX * toObsX + goalDirZ * toObsZ

            if (dot > -0.15) { // Nằm phía trước hoặc bên hông
                const threat = Math.max(0, 1 - (dist - safeDist) / DETECTION_RADIUS)
                if (threat > 0) {
                    isAvoiding = true
                    maxThreat = Math.max(maxThreat, threat)

                    // Tiếp tuyến hai bên: T1 = (-nz, nx), T2 = (nz, -nx)
                    // Chọn tiếp tuyến hướng thuận theo goalDir (dot > 0), loại bỏ hoàn toàn lật dấu giật cục
                    let tx = -nz
                    let tz = nx
                    if (tx * goalDirX + tz * goalDirZ < 0) {
                        tx = -tx
                        tz = -tz
                    }

                    // Lực né tránh: kết hợp lực trượt tiếp tuyến (tx, tz) và lực đẩy chống đâm (nx, nz)
                    avoidForceX += (tx * 1.8 + nx * 1.5) * threat
                    avoidForceZ += (tz * 1.8 + nz * 1.5) * threat
                }
            }
        }
    }

    // Lực đệm chống va chạm tường biên bao quanh văn phòng 28x22m
    const WALL_MARGIN = 1.4
    if (currentPos.x > ARENA_X_LIMIT - WALL_MARGIN) {
        avoidForceX -= (currentPos.x - (ARENA_X_LIMIT - WALL_MARGIN)) * 2.5
        isAvoiding = true
    } else if (currentPos.x < -ARENA_X_LIMIT + WALL_MARGIN) {
        avoidForceX += (-ARENA_X_LIMIT + WALL_MARGIN - currentPos.x) * 2.5
        isAvoiding = true
    }

    if (currentPos.z > ARENA_Z_LIMIT - WALL_MARGIN) {
        avoidForceZ -= (currentPos.z - (ARENA_Z_LIMIT - WALL_MARGIN)) * 2.5
        isAvoiding = true
    } else if (currentPos.z < -ARENA_Z_LIMIT + WALL_MARGIN) {
        avoidForceZ += (-ARENA_Z_LIMIT + WALL_MARGIN - currentPos.z) * 2.5
        isAvoiding = true
    }

    // Hòa trộn vector mục tiêu và vector né tránh theo trọng số RL mượt mà
    let finalVx: number
    let finalVz: number

    if (isAvoiding) {
        const blendWeight = Math.min(0.75, maxThreat * 0.9)
        const combinedX = goalDirX * (1 - blendWeight) + avoidForceX * blendWeight
        const combinedZ = goalDirZ * (1 - blendWeight) + avoidForceZ * blendWeight
        const len = Math.sqrt(combinedX * combinedX + combinedZ * combinedZ) || 1

        finalVx = (combinedX / len) * speed * 1.3
        finalVz = (combinedZ / len) * speed * 1.3
    } else {
        // Đường đi thoáng đãng: tiến thẳng đến đích với tốc độ ổn định
        finalVx = goalDirX * speed * 1.4
        finalVz = goalDirZ * speed * 1.4
    }

    // Góc quay thân người theo vector vận tốc thực tế
    const targetAngle = Math.atan2(finalVx, finalVz)

    return {
        velocity: { x: finalVx, z: finalVz },
        rotationY: targetAngle,
        isAvoiding,
        arrived: false,
    }
}
