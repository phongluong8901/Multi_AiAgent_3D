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
    {
        type: 'building' as PlaceableItemType,
        name: 'Tòa nhà cao ốc',
        category: 'Kiến trúc',
        icon: '🏢',
        defaultColor: '#64748b',
        defaultSize: { width: 5, height: 11, depth: 5 },
        description: 'Tòa nhà văn phòng hoặc chung cư cao tầng',
    },
    {
        type: 'house' as PlaceableItemType,
        name: 'Nhà dân dụng',
        category: 'Kiến trúc',
        icon: '🏡',
        defaultColor: '#f8fafc',
        defaultSize: { width: 3.5, height: 3.5, depth: 3.5 },
        description: 'Nhà ở thấp tầng mái ngói',
    },
    {
        type: 'industrial' as PlaceableItemType,
        name: 'Nhà máy / Kho',
        category: 'Kiến trúc',
        icon: '🏭',
        defaultColor: '#475569',
        defaultSize: { width: 6, height: 4, depth: 5 },
        description: 'Nhà máy sản xuất có ống khói',
    },
    {
        type: 'road' as PlaceableItemType,
        name: 'Đoạn đường thẳng',
        category: 'Hạ tầng',
        icon: '🛣️',
        defaultColor: '#334155',
        defaultSize: { width: 8, height: 0.1, depth: 20 },
        description: 'Mặt đường nhựa có vạch kẻ',
    },
    {
        type: 'crossroad' as PlaceableItemType,
        name: 'Ngã tư đường',
        category: 'Hạ tầng',
        icon: '➕',
        defaultColor: '#334155',
        defaultSize: { width: 8, height: 0.1, depth: 8 },
        description: 'Giao lộ ngã tư',
    },
    {
        type: 'streetlight' as PlaceableItemType,
        name: 'Đèn đường IoT',
        category: 'Hạ tầng',
        icon: '💡',
        defaultColor: '#1e293b',
        defaultSize: { width: 1, height: 5.5, depth: 1 },
        description: 'Cột đèn thông minh có phát sáng',
    },
    {
        type: 'tree' as PlaceableItemType,
        name: 'Cây xanh công viên',
        category: 'Cảnh quan',
        icon: '🌳',
        defaultColor: '#10b981',
        defaultSize: { width: 2, height: 4, depth: 2 },
        description: 'Cây tán tròn phủ xanh đô thị',
    },
    {
        type: 'bench' as PlaceableItemType,
        name: 'Ghế đá / Gỗ',
        category: 'Cảnh quan',
        icon: '🪑',
        defaultColor: '#b45309',
        defaultSize: { width: 2, height: 1, depth: 0.8 },
        description: 'Ghế ngồi nghỉ bên vỉa hè',
    },
    {
        type: 'desk' as PlaceableItemType,
        name: 'Bàn làm việc Agent',
        category: 'Nội thất',
        icon: '💻',
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
