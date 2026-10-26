// src/lib/maps/mapEditorTypes.ts
export type PlaceableItemType =
    | 'building'
    | 'house'
    | 'industrial'
    | 'road'
    | 'crossroad'
    | 'streetlight'
    | 'desk'
    | 'bench'
    | 'tree'
    // --- Công nghiệp & Robotics (Industrial) ---
    | 'robot_arm'
    | 'robot_prototype'
    | 'industrial_lamp'
    | 'industrial_fan'
    | 'cctv_camera'
    | 'conveyor'
    // --- Nhà thông minh (Smart Home IoT) ---
    | 'smart_led'
    | 'water_sprinkler'
    | 'smart_curtain'
    | 'air_conditioner'
    | 'smart_door'
    // --- AI Agents & Robot Sinh thái (NVIDIA Fleet) ---
    | 'agent_gr00t'
    | 'agent_duck'
    | 'agent_amr'
    | 'agent_drone'

export interface MapObjectItem {
    id: string
    type: PlaceableItemType
    name: string
    position: [number, number, number]
    rotation: number // degrees (0, 90, 180, 270)
    width?: number
    height?: number
    depth?: number
    color?: string
}

export interface CustomMapDesign {
    id: string
    name: string
    description?: string
    skyPreset: 'city' | 'outdoor' | 'office'
    groundColor: string
    groundSize: [number, number]
    items: MapObjectItem[]
    updatedAt: string
}

export const ITEM_CATALOG = [
    // --- KIẾN TRÚC ---
    {
        type: 'building' as PlaceableItemType,
        name: 'Tòa nhà cao ốc',
        category: 'Kiến trúc',
        icon: 'building',
        defaultColor: '#64748b',
        defaultSize: { width: 5, height: 11, depth: 5 },
        description: 'Tòa nhà văn phòng hoặc chung cư cao tầng',
    },
    {
        type: 'house' as PlaceableItemType,
        name: 'Nhà dân dụng',
        category: 'Kiến trúc',
        icon: 'house',
        defaultColor: '#f8fafc',
        defaultSize: { width: 3.5, height: 3.5, depth: 3.5 },
        description: 'Nhà ở thấp tầng mái ngói',
    },
    {
        type: 'industrial' as PlaceableItemType,
        name: 'Nhà máy / Kho',
        category: 'Kiến trúc',
        icon: 'industrial',
        defaultColor: '#475569',
        defaultSize: { width: 6, height: 4, depth: 5 },
        description: 'Nhà máy sản xuất có ống khói',
    },

    // --- NVIDIA ROBOTICS FLEET ---
    {
        type: 'agent_gr00t' as PlaceableItemType,
        name: 'Robot Humanoid GR00T',
        category: 'NVIDIA Fleet',
        icon: 'agent_gr00t',
        defaultColor: '#76b900',
        defaultSize: { width: 1.2, height: 1.8, depth: 1.2 },
        description: 'Robot hình người 2 chân Project GR00T (Jetson Thor)',
    },
    {
        type: 'agent_amr' as PlaceableItemType,
        name: 'Nova Carter AMR',
        category: 'NVIDIA Fleet',
        icon: 'agent_amr',
        defaultColor: '#f97316',
        defaultSize: { width: 1.3, height: 1.0, depth: 1.6 },
        description: 'Xe tự hành công nghiệp 360° LiDAR & 4x RealSense D455',
    },
    {
        type: 'agent_duck' as PlaceableItemType,
        name: 'MicroDuck Bipedal Robot',
        category: 'NVIDIA Fleet',
        icon: 'agent_duck',
        defaultColor: '#7dd3fc',
        defaultSize: { width: 0.8, height: 1.1, depth: 0.8 },
        description: 'Robot vịt 2 chân bipedal MicroDuck với servo đa trục',
    },
    {
        type: 'agent_drone' as PlaceableItemType,
        name: 'Cyber Falcon Drone',
        category: 'NVIDIA Fleet',
        icon: 'agent_drone',
        defaultColor: '#06b6d4',
        defaultSize: { width: 1.4, height: 1.2, depth: 1.4 },
        description: 'Drone tuần tra 4 cánh quạt định vị RTK GNSS',
    },

    // --- CÔNG NGHIỆP & ROBOTICS ---
    {
        type: 'robot_arm' as PlaceableItemType,
        name: 'Cánh tay Robot 6 trục',
        category: 'Công nghiệp',
        icon: 'robot_arm',
        defaultColor: '#eab308',
        defaultSize: { width: 1.5, height: 2.8, depth: 1.5 },
        description: 'Cánh tay robot hàn, gắp sản phẩm công nghiệp KUKA/Fanuc',
    },
    {
        type: 'robot_prototype' as PlaceableItemType,
        name: 'Mẫu Prototype Robot AGV',
        category: 'Công nghiệp',
        icon: 'robot_prototype',
        defaultColor: '#f97316',
        defaultSize: { width: 1.3, height: 1.0, depth: 1.6 },
        description: 'Robot tự hành chở hàng Nova Carter AMR LiDAR',
    },
    {
        type: 'industrial_lamp' as PlaceableItemType,
        name: 'Đèn xưởng High-Bay',
        category: 'Công nghiệp',
        icon: 'industrial_lamp',
        defaultColor: '#f59e0b',
        defaultSize: { width: 1.2, height: 4.5, depth: 1.2 },
        description: 'Đèn treo nhà xưởng chiếu rọi quang phổ lớn',
    },
    {
        type: 'industrial_fan' as PlaceableItemType,
        name: 'Quạt thông gió công nghiệp',
        category: 'Công nghiệp',
        icon: 'industrial_fan',
        defaultColor: '#64748b',
        defaultSize: { width: 1.5, height: 2.2, depth: 0.8 },
        description: 'Quạt hút lưu thông khí tươi và làm mát nhà xưởng',
    },
    {
        type: 'cctv_camera' as PlaceableItemType,
        name: 'Camera an ninh CCTV 3D',
        category: 'Công nghiệp',
        icon: 'cctv_camera',
        defaultColor: '#e2e8f0',
        defaultSize: { width: 0.8, height: 2.5, depth: 0.8 },
        description: 'Camera AI nhận diện xâm nhập có đèn hồng ngoại',
    },
    {
        type: 'conveyor' as PlaceableItemType,
        name: 'Băng chuyền sản xuất',
        category: 'Công nghiệp',
        icon: 'conveyor',
        defaultColor: '#334155',
        defaultSize: { width: 2, height: 0.8, depth: 6 },
        description: 'Băng tải chuyển hàng hóa tự động liên tục',
    },

    // --- NHÀ THÔNG MINH (SMART HOME IOT) ---
    {
        type: 'smart_led' as PlaceableItemType,
        name: 'Đèn LED Thông Minh RGB',
        category: 'Nhà thông minh',
        icon: 'smart_led',
        defaultColor: '#a855f7',
        defaultSize: { width: 0.8, height: 1.8, depth: 0.8 },
        description: 'Đèn LED 16 triệu màu điều khiển qua WiFi/Zigbee',
    },
    {
        type: 'water_sprinkler' as PlaceableItemType,
        name: 'Vòi tưới nước tự động',
        category: 'Nhà thông minh',
        icon: 'water_sprinkler',
        defaultColor: '#06b6d4',
        defaultSize: { width: 0.8, height: 0.9, depth: 0.8 },
        description: 'Vòi phun xoay 360 độ tưới cây vườn thông minh',
    },
    {
        type: 'smart_curtain' as PlaceableItemType,
        name: 'Rèm cửa tự động thông minh',
        category: 'Nhà thông minh',
        icon: 'smart_curtain',
        defaultColor: '#cbd5e1',
        defaultSize: { width: 3.2, height: 2.8, depth: 0.3 },
        description: 'Rèm điện tự đóng mở theo cảm biến ánh sáng',
    },
    {
        type: 'air_conditioner' as PlaceableItemType,
        name: 'Điều hòa không khí Inverter',
        category: 'Nhà thông minh',
        icon: 'air_conditioner',
        defaultColor: '#f8fafc',
        defaultSize: { width: 2.2, height: 0.8, depth: 0.6 },
        description: 'Máy lạnh thông minh tự điều chỉnh nhiệt độ',
    },
    {
        type: 'smart_door' as PlaceableItemType,
        name: 'Cửa thông minh vân tay / FaceID',
        category: 'Nhà thông minh',
        icon: 'smart_door',
        defaultColor: '#1e293b',
        defaultSize: { width: 1.8, height: 2.6, depth: 0.3 },
        description: 'Cửa khóa từ tự động kết nối app điện thoại',
    },

    // --- HẠ TẦNG & GIAO THÔNG ---
    {
        type: 'road' as PlaceableItemType,
        name: 'Đoạn đường thẳng',
        category: 'Hạ tầng',
        icon: 'road',
        defaultColor: '#334155',
        defaultSize: { width: 8, height: 0.1, depth: 20 },
        description: 'Mặt đường nhựa có vạch kẻ',
    },
    {
        type: 'crossroad' as PlaceableItemType,
        name: 'Ngã tư đường',
        category: 'Hạ tầng',
        icon: 'crossroad',
        defaultColor: '#334155',
        defaultSize: { width: 8, height: 0.1, depth: 8 },
        description: 'Giao lộ ngã tư',
    },
    {
        type: 'streetlight' as PlaceableItemType,
        name: 'Đèn đường IoT',
        category: 'Hạ tầng',
        icon: 'streetlight',
        defaultColor: '#1e293b',
        defaultSize: { width: 1, height: 5.5, depth: 1 },
        description: 'Cột đèn thông minh có phát sáng',
    },

    // --- CẢNH QUAN & NỘI THẤT ---
    {
        type: 'tree' as PlaceableItemType,
        name: 'Cây xanh công viên',
        category: 'Cảnh quan',
        icon: 'tree',
        defaultColor: '#10b981',
        defaultSize: { width: 2, height: 4, depth: 2 },
        description: 'Cây tán tròn phủ xanh đô thị',
    },
    {
        type: 'bench' as PlaceableItemType,
        name: 'Ghế đá / Gỗ',
        category: 'Cảnh quan',
        icon: 'bench',
        defaultColor: '#b45309',
        defaultSize: { width: 2, height: 1, depth: 0.8 },
        description: 'Ghế ngồi nghỉ bên vỉa hè',
    },
    {
        type: 'desk' as PlaceableItemType,
        name: 'Bàn làm việc Agent',
        category: 'Nội thất',
        icon: 'desk',
        defaultColor: '#3b82f6',
        defaultSize: { width: 2, height: 1.2, depth: 1.2 },
        description: 'Bàn làm việc kèm laptop cho Agent',
    },

]

// Preset mẫu có sẵn ban đầu
export const DEFAULT_MAP_PRESETS: Record<string, CustomMapDesign> = {
    smart_city: {
        id: 'smart_city',
        name: 'Đô thị Smart City IoT',
        description: 'Bản đồ đô thị kết nối thiết bị IoT, đường sá và các khu chức năng.',
        skyPreset: 'city',
        groundColor: '#1e293b',
        groundSize: [90, 90],
        updatedAt: new Date().toISOString(),
        items: [
            // Trục đường chính
            { id: 'road-main', type: 'road', name: 'Đại lộ trung tâm', position: [0, 0.02, 0], rotation: 0, width: 9, depth: 80 },
            { id: 'road-h1', type: 'road', name: 'Đường ngang Bắc', position: [0, 0.02, 14], rotation: 90, width: 7, depth: 50 },
            { id: 'road-h2', type: 'road', name: 'Đường ngang Nam', position: [0, 0.02, -14], rotation: 90, width: 7, depth: 50 },
            // Khu dân cư
            { id: 'h-1', type: 'house', name: 'Nhà dân số 1', position: [-16, 0, -10], rotation: 0, color: '#f1f5f9' },
            { id: 'h-2', type: 'house', name: 'Nhà dân số 2', position: [-16, 0, -2], rotation: 0, color: '#e2e8f0' },
            { id: 'h-3', type: 'house', name: 'Nhà dân số 3', position: [-22, 0, -6], rotation: 0, color: '#f8fafc' },
            { id: 'h-4', type: 'house', name: 'Nhà dân số 4', position: [-16, 0, 8], rotation: 0, color: '#f1f5f9' },
            // Tòa nhà cao ốc
            { id: 'b-1', type: 'building', name: 'Trụ sở trung tâm', position: [14, 0, -12], rotation: 0, width: 5, height: 11, depth: 5, color: '#64748b' },
            { id: 'b-2', type: 'building', name: 'Tòa tài chính', position: [22, 0, -8], rotation: 0, width: 4.5, height: 9, depth: 4.5, color: '#475569' },
            { id: 'b-3', type: 'building', name: 'Tháp công nghệ', position: [18, 0, 6], rotation: 0, width: 6, height: 14, depth: 5, color: '#334155' },
            { id: 'b-4', type: 'building', name: 'Khối dịch vụ', position: [12, 0, 16], rotation: 0, width: 5, height: 10, depth: 5, color: '#64748b' },
            // Khu công nghiệp
            { id: 'ind-1', type: 'industrial', name: 'Nhà máy chế tạo 1', position: [8, 0, 22], rotation: 0 },
            { id: 'ind-2', type: 'industrial', name: 'Nhà máy phụ trợ 2', position: [18, 0, 24], rotation: 0 },
            // Đèn đường thông minh
            { id: 'sl-1', type: 'streetlight', name: 'Đèn số 1', position: [-6, 0, -18], rotation: 0 },
            { id: 'sl-2', type: 'streetlight', name: 'Đèn số 2', position: [6, 0, -18], rotation: 180 },
            { id: 'sl-3', type: 'streetlight', name: 'Đèn số 3', position: [-6, 0, -4], rotation: 0 },
            { id: 'sl-4', type: 'streetlight', name: 'Đèn số 4', position: [6, 0, -4], rotation: 180 },
            { id: 'sl-5', type: 'streetlight', name: 'Đèn số 5', position: [-6, 0, 10], rotation: 0 },
            { id: 'sl-6', type: 'streetlight', name: 'Đèn số 6', position: [6, 0, 10], rotation: 180 },
            { id: 'sl-7', type: 'streetlight', name: 'Đèn số 7', position: [-6, 0, 22], rotation: 0 },
            { id: 'sl-8', type: 'streetlight', name: 'Đèn số 8', position: [6, 0, 22], rotation: 180 },
        ],
    },

    // --- BỐI CẢNH 1: NHÀ MÁY & KHO BÃI CÔNG NGHIỆP 4.0 (INDUSTRIAL FACTORY) ---
    industrial_factory: {
        id: 'industrial_factory',
        name: 'Nhà máy Công nghiệp 4.0 & Robotics',
        description: 'Khu xưởng chế tạo tự động hóa với cánh tay robot, băng chuyền, xe AGV, đèn rọi, quạt thông gió và camera an ninh.',
        skyPreset: 'city',
        groundColor: '#18181b',
        groundSize: [70, 70],
        updatedAt: new Date().toISOString(),
        items: [
            // Nhà xưởng chính
            { id: 'factory-main', type: 'industrial', name: 'Phân xưởng Lắp ráp A', position: [-14, 0, -10], rotation: 0, color: '#3f3f46' },
            { id: 'factory-storage', type: 'industrial', name: 'Kho Chứa Linh Kiện B', position: [-14, 0, 14], rotation: 0, color: '#52525b' },
            
            // Dây chuyền băng tải & Cánh tay robot
            { id: 'conv-1', type: 'conveyor', name: 'Băng tải Dây chuyền 1', position: [2, 0, -10], rotation: 0 },
            { id: 'conv-2', type: 'conveyor', name: 'Băng tải Dây chuyền 2', position: [2, 0, 10], rotation: 0 },
            { id: 'arm-1', type: 'robot_arm', name: 'Robot Hàn Tự động #1', position: [5, 0, -10], rotation: 180, color: '#eab308' },
            { id: 'arm-2', type: 'robot_arm', name: 'Robot Gắp Phôi #2', position: [5, 0, 10], rotation: 180, color: '#eab308' },
            
            // ĐỘI HÌNH ROBOT NVIDIA FLEET
            { id: 'groot-lead', type: 'agent_gr00t', name: 'NVIDIA GR00T Biped Lead', position: [8, 0, 0], rotation: 270, color: '#76b900' },
            { id: 'duck-qa', type: 'agent_duck', name: 'MicroDuck Bipedal KCS', position: [10, 0, 6], rotation: 225, color: '#7dd3fc' },
            { id: 'amr-carter', type: 'agent_amr', name: 'Nova Carter AMR Tự Hành', position: [10, 0, -2], rotation: 90, color: '#f97316' },
            { id: 'drone-falcon', type: 'agent_drone', name: 'Cyber Falcon Tuần Tra', position: [0, 0, 0], rotation: 0, color: '#06b6d4' },
            
            // Hệ thống Đèn xưởng High-Bay
            { id: 'lamp-1', type: 'industrial_lamp', name: 'Đèn High-Bay Xưởng 1', position: [0, 0, -16], rotation: 0, color: '#f59e0b' },
            { id: 'lamp-2', type: 'industrial_lamp', name: 'Đèn High-Bay Xưởng 2', position: [0, 0, 0], rotation: 0, color: '#f59e0b' },
            { id: 'lamp-3', type: 'industrial_lamp', name: 'Đèn High-Bay Xưởng 3', position: [0, 0, 16], rotation: 0, color: '#f59e0b' },
            
            // Quạt thông gió công nghiệp
            { id: 'fan-1', type: 'industrial_fan', name: 'Quạt hút Công nghiệp 1', position: [-22, 0, -10], rotation: 90, color: '#71717a' },
            { id: 'fan-2', type: 'industrial_fan', name: 'Quạt hút Công nghiệp 2', position: [-22, 0, 14], rotation: 90, color: '#71717a' },
            
            // Camera an ninh giám sát CCTV
            { id: 'cctv-1', type: 'cctv_camera', name: 'CCTV Giám sát Cổng Kho', position: [-2, 0, -24], rotation: 0 },
            { id: 'cctv-2', type: 'cctv_camera', name: 'CCTV Giám sát Dây chuyền', position: [12, 0, -18], rotation: 45 },
            { id: 'cctv-3', type: 'cctv_camera', name: 'CCTV Giám sát Bãi xe AGV', position: [18, 0, 18], rotation: 135 },
            
            // Bàn điều khiển trung tâm
            { id: 'desk-control', type: 'desk', name: 'Bàn Điều Khiển SCADA', position: [16, 0, -10], rotation: 270, color: '#2563eb' },
        ],
    },

    // --- BỐI CẢNH 2: NHÀ THÔNG MINH SMARTHOME IOT ---
    smarthome_iot: {
        id: 'smarthome_iot',
        name: 'Biệt thự Smart Home IoT & Sân Vườn',
        description: 'Không gian sống thông minh với đèn LED RGB, vòi tưới tự động, rèm cửa điện tử, điều hòa Inverter và cửa nhận diện.',
        skyPreset: 'outdoor',
        groundColor: '#131b24',
        groundSize: [60, 60],
        updatedAt: new Date().toISOString(),
        items: [
            // Nhà chính
            { id: 'home-main', type: 'house', name: 'Gian nhà chính', position: [0, 0, 0], rotation: 0, color: '#f8fafc' },
            
            // Cửa thông minh
            { id: 'door-front', type: 'smart_door', name: 'Cửa Chính Vân tay / FaceID', position: [0, 0, 2.5], rotation: 0 },
            
            // Đèn LED thông minh RGB
            { id: 'led-living', type: 'smart_led', name: 'Đèn LED Smart Phòng khách', position: [-4, 0, 1], rotation: 0, color: '#a855f7' },
            { id: 'led-garden', type: 'smart_led', name: 'Đèn LED Chiếu sân vườn', position: [6, 0, 4], rotation: 0, color: '#06b6d4' },
            
            // Rèm cửa thông minh
            { id: 'curtain-1', type: 'smart_curtain', name: 'Rèm Cửa Sổ Tự Động', position: [-3, 0, -2.5], rotation: 180, color: '#e2e8f0' },
            
            // Điều hòa máy lạnh Inverter
            { id: 'ac-1', type: 'air_conditioner', name: 'Điều hòa Smart Inverter', position: [3, 0, -2.2], rotation: 180, color: '#f1f5f9' },
            
            // Vòi tưới nước tự động trong sân vườn
            { id: 'sprinkler-1', type: 'water_sprinkler', name: 'Vòi Tưới Cỏ Tự Động #1', position: [-8, 0, 8], rotation: 0, color: '#0284c7' },
            { id: 'sprinkler-2', type: 'water_sprinkler', name: 'Vòi Tưới Cây Cảnh #2', position: [8, 0, 8], rotation: 0, color: '#0284c7' },
            
            // Cây xanh sân vườn
            { id: 'tree-1', type: 'tree', name: 'Cây Cảnh Trước Nhà', position: [-12, 0, 10], rotation: 0, color: '#10b981' },
            { id: 'tree-2', type: 'tree', name: 'Cây Tùng Sân Vườn', position: [12, 0, 10], rotation: 0, color: '#059669' },
            { id: 'bench-garden', type: 'bench', name: 'Ghế Nghỉ Thư Giãn', position: [0, 0, 12], rotation: 180 },
            
            // Camera an ninh cổng chính
            { id: 'cam-gate', type: 'cctv_camera', name: 'Camera AI Cổng Nhà', position: [8, 0, 16], rotation: 180 },
        ],
    },

    empty_canvas: {
        id: 'empty_canvas',
        name: 'Mặt bằng trống (Blank Canvas)',
        description: 'Lưới không gian trống 60x60 để bạn tự do sáng tạo.',
        skyPreset: 'city',
        groundColor: '#0f172a',
        groundSize: [60, 60],
        updatedAt: new Date().toISOString(),
        items: [],
    },
}
