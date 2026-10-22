// src/lib/maps/mapRegistry.ts
import { OFFICE_ACTION_SPOTS, OFFICE_DESK_SLOTS } from '@/components/office/Room'
import { OUTDOOR_ACTION_SPOTS } from '@/components/outdoor/OutdoorPark'

export type MapType = 'office' | 'outdoor' | 'iot'

export interface MapMetadata {
    id: MapType
    name: string
    shortName: string
    description: string
    badgeColor: string
    themeColor: string
    cameraPosition: [number, number, number]
    fov: number
    minDistance: number
    maxDistance: number
    skyPreset: 'office' | 'outdoor' | 'city'
}

export const MAP_CONFIGS: Record<MapType, MapMetadata> = {
    office: {
        id: 'office',
        name: 'Văn phòng số (Virtual Office)',
        shortName: 'Office',
        description: 'Môi trường văn phòng làm việc với bàn làm việc, phòng họp, sofa thư giãn và bàn bóng bàn.',
        badgeColor: 'text-blue-400 bg-blue-950/60 border-blue-500/30',
        themeColor: '#3b82f6',
        cameraPosition: [16, 16, 16],
        fov: 40,
        minDistance: 8,
        maxDistance: 40,
        skyPreset: 'office',
    },
    outdoor: {
        id: 'outdoor',
        name: 'Khuôn viên ngoài trời (Outdoor Campus)',
        shortName: 'Outdoor',
        description: 'Công viên mở sinh thái với thảm cỏ, đài phun nước, chòi nghỉ ngơi và khu dã ngoại.',
        badgeColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30',
        themeColor: '#10b981',
        cameraPosition: [18, 18, 18],
        fov: 45,
        minDistance: 8,
        maxDistance: 40,
        skyPreset: 'outdoor',
    },
    iot: {
        id: 'iot',
        name: 'Đô thị thông minh (Smart City / IoT)',
        shortName: 'Smart City',
        description: 'Mô phỏng đô thị 3D quy mô lớn với cao ốc, nhà ở, nhà máy, đường giao thông và đèn đường thông minh.',
        badgeColor: 'text-cyan-400 bg-cyan-950/60 border-cyan-500/30',
        themeColor: '#06b6d4',
        cameraPosition: [28, 22, 28],
        fov: 42,
        minDistance: 12,
        maxDistance: 60,
        skyPreset: 'city',
    },
}

// Tọa độ các điểm hành động trong Đô thị thông minh (Smart City IoT)
export const SMART_CITY_ACTION_SPOTS: Record<string, [number, number, number]> = {
    building: [14, 0, -12],     // Trụ sở cao ốc
    house: [-16, 0, -2],        // Khu dân cư
    industry: [8, 0, 22],       // Khu công nghiệp
    crossroad: [0, 0, 0],       // Giao lộ ngã tư
    streetlight: [6, 0, 10],    // Trạm đèn thông minh
    patrol: [0, 0, -20],        // Tuyến đường tuần tra
}

/**
 * Hàm điều hướng tọa độ hành động chuẩn hóa DUY NHẤT cho toàn bộ hệ thống
 * Giúp mở rộng map mới mà không phải sửa if/else rải rác nhiều file
 */
export function resolveTargetPositionForAction(
    mapType: MapType,
    action: string,
    agentIndex: number = 0
): [number, number, number] {
    if (mapType === 'office') {
        if (action === 'sofa') return OFFICE_ACTION_SPOTS.sofa
        if (action === 'roundtable') return OFFICE_ACTION_SPOTS.roundtable
        if (action === 'pingpong') return OFFICE_ACTION_SPOTS.pingpong
        if (action === 'coffee') return OFFICE_ACTION_SPOTS.coffee
        if (action === 'desk') {
            return OFFICE_DESK_SLOTS[agentIndex % OFFICE_DESK_SLOTS.length]
        }
        if (action === 'roam') return [Math.random() * 8 - 4, 0, Math.random() * 8 - 4]
    } else if (mapType === 'outdoor') {
        if (action === 'picnic') return OUTDOOR_ACTION_SPOTS.picnic1
        if (action === 'bench') return OUTDOOR_ACTION_SPOTS.bench1
        if (action === 'gazebo') return OUTDOOR_ACTION_SPOTS.gazebo
        if (action === 'fountain') return OUTDOOR_ACTION_SPOTS.fountain
        if (action === 'coffee') return OUTDOOR_ACTION_SPOTS.coffee
        if (action === 'roam') return [Math.random() * 20 - 10, 0, Math.random() * 20 - 10]
    } else if (mapType === 'iot') {
        if (action === 'building') return SMART_CITY_ACTION_SPOTS.building
        if (action === 'house') return SMART_CITY_ACTION_SPOTS.house
        if (action === 'industry') return SMART_CITY_ACTION_SPOTS.industry
        if (action === 'crossroad') return SMART_CITY_ACTION_SPOTS.crossroad
        if (action === 'streetlight') return SMART_CITY_ACTION_SPOTS.streetlight
        if (action === 'patrol') return SMART_CITY_ACTION_SPOTS.patrol
        if (action === 'roam') return [0, 0, Math.random() * 40 - 20]
    }

    return [0, 0, 0]
}
