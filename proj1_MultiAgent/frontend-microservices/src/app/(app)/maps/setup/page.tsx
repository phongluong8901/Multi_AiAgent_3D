'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    MapObjectItem,
    PlaceableItemType,
    CustomMapDesign,
    ITEM_CATALOG,
    DEFAULT_MAP_PRESETS,
} from '@/lib/maps/mapEditorTypes'
import { MapEditorCanvas } from '@/components/maps/MapEditorCanvas'
import {
    IconArrowLeft,
    IconSave,
    IconTrash,
    IconCopy,
    IconCheck,
    IconLayers,
    IconSettings,
    IconSparkles,
    IconMap,
    IconTarget,
    IconLightbulb,
    IconFileText,
    IconBuilding,
    IconTent,
    IconBoxes,
    IconTrees,
    IconArmchair,
    IconLaptop,
    IconPlus,
    IconDownload,
    IconCoins,
    IconDuck,
    IconAmr,
    IconDrone,
    IconHumanoid,
} from '@/components/ui/icons'
import { mapsApi, CloudMapDesign } from '@/lib/api/maps'
import { notify } from '@/lib/toast'
import { getUser } from '@/lib/auth'
import { coinsApi, UserWallet } from '@/lib/api/coins'
import PlanTasksModal from '@/components/coins/PlanTasksModal'
import { useConfirm } from '@/context/ConfirmContext'

function renderCatalogIcon(type: PlaceableItemType | string) {
    switch (type) {
        case 'building':
            return <IconBuilding className="w-5 h-5 text-blue-400" />
        case 'house':
            return <IconTent className="w-5 h-5 text-amber-400" />
        case 'industrial':
            return <IconBoxes className="w-5 h-5 text-orange-400" />
        case 'road':
            return <IconMap className="w-5 h-5 text-slate-400" />
        case 'crossroad':
            return <IconPlus className="w-5 h-5 text-zinc-300" />
        case 'streetlight':
            return <IconLightbulb className="w-5 h-5 text-yellow-300" />
        case 'tree':
            return <IconTrees className="w-5 h-5 text-emerald-400" />
        case 'bench':
            return <IconArmchair className="w-5 h-5 text-amber-600" />
        case 'desk':
            return <IconLaptop className="w-5 h-5 text-indigo-400" />

        // --- NVIDIA ROBOTICS FLEET ---
        case 'agent_gr00t':
            return <IconHumanoid className="w-5 h-5 text-[#76b900]" />
        case 'agent_amr':
            return <IconAmr className="w-5 h-5 text-orange-400" />
        case 'agent_duck':
            return <IconDuck className="w-5 h-5 text-amber-400" />
        case 'agent_drone':
            return <IconDrone className="w-5 h-5 text-cyan-400" />

        // --- CÔNG NGHIỆP & ROBOTICS ---
        case 'robot_arm':
            return (
                <svg className="w-5 h-5 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="6" r="3" />
                    <path d="M8.5 16l7-7" />
                    <path d="M14 6h4v4" />
                </svg>
            )
        case 'robot_prototype':
            return (
                <svg className="w-5 h-5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <circle cx="12" cy="5" r="2" />
                    <path d="M12 7v4" />
                    <line x1="8" y1="16" x2="8.01" y2="16" />
                    <line x1="16" y1="16" x2="16.01" y2="16" />
                </svg>
            )
        case 'industrial_lamp':
            return (
                <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v6" />
                    <path d="M7 8h10l2 6H5l2-6z" />
                    <path d="M9 14v4a3 3 0 0 0 6 0v-4" />
                </svg>
            )
        case 'industrial_fan':
            return (
                <svg className="w-5 h-5 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 12c-2-2-4-2-4 0s2 4 4 4 4-2 4-4-2-2-4 0z" />
                    <circle cx="12" cy="12" r="2" />
                </svg>
            )
        case 'cctv_camera':
            return (
                <svg className="w-5 h-5 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 10l13-5 5 5-13 5z" />
                    <path d="M7 16v5" />
                    <path d="M5 21h4" />
                    <circle cx="17" cy="11" r="2" />
                </svg>
            )
        case 'conveyor':
            return (
                <svg className="w-5 h-5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="8" width="20" height="8" rx="4" />
                    <circle cx="6" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="18" cy="12" r="2" />
                    <line x1="4" y1="16" x2="2" y2="21" />
                    <line x1="20" y1="16" x2="22" y2="21" />
                </svg>
            )

        // --- NHÀ THÔNG MINH (SMART HOME IOT) ---
        case 'smart_led':
            return (
                <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2" />
                    <path d="M12 20v2" />
                    <path d="M4.93 4.93l1.41 1.41" />
                    <path d="M17.66 17.66l1.41 1.41" />
                    <path d="M2 12h2" />
                    <path d="M20 12h2" />
                    <path d="M6.34 17.66l-1.41 1.41" />
                    <path d="M19.07 4.93l-1.41 1.41" />
                </svg>
            )
        case 'water_sprinkler':
            return (
                <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22V12" />
                    <path d="M8 12h8" />
                    <path d="M7 7l5 5 5-5" />
                    <circle cx="12" cy="6" r="2" />
                    <path d="M5 3l2 2" />
                    <path d="M19 3l-2 2" />
                </svg>
            )
        case 'smart_curtain':
            return (
                <svg className="w-5 h-5 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="3" rx="1" />
                    <path d="M4 6v14" />
                    <path d="M8 6v14" />
                    <path d="M16 6v14" />
                    <path d="M20 6v14" />
                </svg>
            )
        case 'air_conditioner':
            return (
                <svg className="w-5 h-5 text-teal-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="5" width="20" height="10" rx="2" />
                    <line x1="6" y1="12" x2="18" y2="12" />
                    <path d="M7 19c2-1 3-2 3-4" />
                    <path d="M12 19c2-1 3-2 3-4" />
                </svg>
            )
        case 'smart_door':
            return (
                <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16" />
                    <path d="M14 12v.01" />
                    <path d="M4 21h16" />
                </svg>
            )
        case 'duck':
            return (
                <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="15.5" cy="8.5" r="3.5" />
                    <path d="M19 8.5h2.5c.5 0 .8.5.5.9l-1.5 2.1c-.3.4-.8.5-1.2.3l-.3-.1" />
                    <circle cx="16.5" cy="7.5" r=".7" fill="currentColor" />
                    <path d="M14 11.5c-2.5 1-4.5 3-5 5.5-1 0-3-1-4-2.5-.5-.8-.5-1.8 0-2.5 1.2-1.8 3.5-2.8 6-2.5" />
                    <path d="M9 17c1.5 2 4 3 7 3 3 0 5-2 5-5 0-1-.3-2-.8-2.8" />
                </svg>
            )
        case 'amr':
            return (
                <svg className="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="6" rx="2" />
                    <circle cx="7" cy="19" r="2" />
                    <circle cx="17" cy="19" r="2" />
                    <path d="M7 11V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4" />
                    <line x1="12" y1="5" x2="12" y2="2" />
                    <circle cx="12" cy="2" r="1" fill="currentColor" />
                </svg>
            )
        case 'drone':
            return (
                <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="m5 5 4 4" />
                    <path d="m19 5-4 4" />
                    <path d="m5 19 4-4" />
                    <path d="m19 19-4-4" />
                    <circle cx="4" cy="4" r="2" />
                    <circle cx="20" cy="4" r="2" />
                    <circle cx="4" cy="20" r="2" />
                    <circle cx="20" cy="20" r="2" />
                </svg>
            )

        default:
            return <IconBoxes className="w-5 h-5 text-zinc-400" />
    }
}

const LOCAL_STORAGE_KEY = 'agent_custom_map_designs_v1'

export default function MapSetupPage() {
    const { confirm } = useConfirm()
    const [mapDesign, setMapDesign] = useState<CustomMapDesign>(DEFAULT_MAP_PRESETS.smart_city)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [activeTool, setActiveTool] = useState<PlaceableItemType | null>(null)
    const [copiedJson, setCopiedJson] = useState(false)
    const [jsonModalOpen, setJsonModalOpen] = useState(false)
    const [rawJsonText, setRawJsonText] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả')

    // Load from LocalStorage if available
    useEffect(() => {
        try {
            const saved = localStorage.getItem(LOCAL_STORAGE_KEY)
            if (saved) {
                const parsed = JSON.parse(saved)
                if (parsed?.items && Array.isArray(parsed.items)) {
                    setMapDesign(parsed)
                }
            }
        } catch (e) {
            console.error('Failed to load saved map', e)
        }
    }, [])

    const selectedItem = mapDesign.items.find((i) => i.id === selectedId) || null

    const handleSelectPreset = (key: string) => {
        const preset = DEFAULT_MAP_PRESETS[key]
        if (preset) {
            setMapDesign(JSON.parse(JSON.stringify(preset)))
            setSelectedId(null)
            setActiveTool(null)
        }
    }

    // Cloud MapDraw & SaveCoin States
    const [cloudMaps, setCloudMaps] = useState<CloudMapDesign[]>([])
    const [cloudModalOpen, setCloudModalOpen] = useState(false)
    const [saveCloudModalOpen, setSaveCloudModalOpen] = useState(false)
    const [cloudMapTitle, setCloudMapTitle] = useState(mapDesign.name || 'Bản đồ 3D Mới')
    const [cloudMapDesc, setCloudMapDesc] = useState('')
    const [isSavingCloud, setIsSavingCloud] = useState(false)
    const [isLoadingCloud, setIsLoadingCloud] = useState(false)
    const [userWallet, setUserWallet] = useState<UserWallet | null>(null)
    const [planTasksModalOpen, setPlanTasksModalOpen] = useState(false)

    // Tải số dư ví Coin khi vào trang
    useEffect(() => {
        const user = getUser()
        if (user?.id) {
            coinsApi.getWallet(user.id, user.name || user.email).then((w) => {
                if (w) setUserWallet(w)
            })
        }
    }, [])

    // Tải danh sách bản đồ từ Cloud (mapdraw-service)
    const handleFetchCloudMaps = async () => {
        setIsLoadingCloud(true)
        try {
            const user = getUser()
            const res = await mapsApi.getMaps({ userId: user?.id })
            if (res?.data) {
                setCloudMaps(res.data)
            }
        } catch (e: any) {
            console.error('Lỗi tải bản đồ Cloud:', e)
            notify.error('Không thể kết nối mapdraw-service: ' + e.message)
        } finally {
            setIsLoadingCloud(false)
        }
    }

    // Mở modal quản lý Cloud Maps
    const handleOpenCloudModal = () => {
        setCloudModalOpen(true)
        handleFetchCloudMaps()
    }

    // Mở modal lưu lên Cloud
    const handleOpenSaveCloudModal = () => {
        setCloudMapTitle(mapDesign.name || 'Bản đồ 3D Mới')
        setSaveCloudModalOpen(true)
    }

    // Thực hiện lưu lên Cloud & Nhận thưởng Coin PlanTask
    const handleConfirmSaveCloud = async () => {
        if (!cloudMapTitle.trim()) {
            notify.error('Vui lòng nhập tên bản đồ!')
            return
        }

        setIsSavingCloud(true)
        try {
            const user = getUser()
            const res = await mapsApi.saveMap({
                mapId: mapDesign.id || `map_${Date.now()}`,
                name: cloudMapTitle.trim(),
                description: cloudMapDesc.trim(),
                skyPreset: mapDesign.skyPreset,
                groundColor: mapDesign.groundColor,
                groundSize: mapDesign.groundSize,
                items: mapDesign.items,
                userId: user?.id || 'anonymous',
                userName: user?.name || user?.email || 'Thành viên',
            })

            if (res?.success) {
                const reward = (res as any).reward
                if (reward?.earnedCoins) {
                    notify.success(`Đã lưu bản đồ & nhận thưởng +${reward.earnedCoins} Coins!`)
                    if (reward.details && Array.isArray(reward.details)) {
                        reward.details.forEach((d: string) => notify.info(d))
                    }
                } else {
                    notify.success('Đã lưu bản đồ thành công lên Cloud!')
                }

                if (reward?.wallet) {
                    setUserWallet(reward.wallet)
                } else if (user?.id) {
                    coinsApi.getWallet(user.id).then((w) => w && setUserWallet(w))
                }

                setMapDesign((prev) => ({
                    ...prev,
                    id: res.data.mapId,
                    name: res.data.name,
                }))
                if (typeof window !== 'undefined') {
                    localStorage.setItem(`map_name:${res.data.mapId}`, res.data.name)
                    window.dispatchEvent(
                        new CustomEvent('map-created', {
                            detail: {
                                map: res.data,
                            },
                        })
                    )
                }
                setSaveCloudModalOpen(false)
            }
        } catch (e: any) {
            console.error('Lỗi lưu bản đồ lên Cloud:', e)
            notify.error('Lỗi lưu Cloud: ' + e.message)
        } finally {
            setIsSavingCloud(false)
        }
    }

    // Tải 1 bản đồ từ Cloud vào editor
    const handleLoadCloudMap = (map: CloudMapDesign) => {
        setMapDesign({
            id: map.mapId,
            name: map.name,
            description: map.description,
            skyPreset: (map.skyPreset as any) || 'city',
            groundColor: map.groundColor || '#18181b',
            groundSize: map.groundSize || [60, 60],
            items: map.items || [],
            updatedAt: map.updatedAt || new Date().toISOString(),
        })
        setSelectedId(null)
        setActiveTool(null)
        setCloudModalOpen(false)
        notify.success(`Đã nạp bản đồ '${map.name}' (${map.items.length} vật thể) từ Cloud!`)
    }

    // Xóa bản đồ trên Cloud
    const handleDeleteCloudMap = async (mapId: string, mapName: string) => {
        const isConfirmed = await confirm({
            title: 'Xóa bản đồ Cloud',
            description: `Bạn có chắc muốn xóa bản đồ '${mapName}' trên Cloud không? Hành động này không thể hoàn tác.`,
            confirmText: 'Xóa bản đồ',
            variant: 'danger',
        })
        if (!isConfirmed) return

        try {
            await mapsApi.deleteMap(mapId)
            notify.success(`Đã xóa bản đồ '${mapName}' thành công.`)
            setCloudMaps((prev) => prev.filter((m) => m.mapId !== mapId))
        } catch (e: any) {
            notify.error('Lỗi xóa bản đồ: ' + e.message)
        }
    }

    const handleSaveLocalStorage = () => {
        try {
            const updated = {
                ...mapDesign,
                updatedAt: new Date().toISOString(),
            }
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated))
            setMapDesign(updated)
            notify.success('Đã lưu bản đồ vào bộ nhớ máy (Local Storage)!')
        } catch (e) {
            notify.error('Lỗi lưu bản đồ vào máy!')
        }
    }

    const handlePlaceItem = (point: [number, number, number]) => {
        if (!activeTool) return
        const catalogItem = ITEM_CATALOG.find((c) => c.type === activeTool)
        const newItemId = `${activeTool}-${Date.now()}`
        const newItem: MapObjectItem = {
            id: newItemId,
            type: activeTool,
            name: `${catalogItem?.name || activeTool} #${mapDesign.items.length + 1}`,
            position: point,
            rotation: 0,
            width: catalogItem?.defaultSize.width,
            height: catalogItem?.defaultSize.height,
            depth: catalogItem?.defaultSize.depth,
            color: catalogItem?.defaultColor,
        }

        setMapDesign((prev) => ({
            ...prev,
            items: [...prev.items, newItem],
        }))
        setSelectedId(newItemId)
    }

    const handleUpdateSelectedItem = (updates: Partial<MapObjectItem>) => {
        if (!selectedId) return
        setMapDesign((prev) => ({
            ...prev,
            items: prev.items.map((it) => (it.id === selectedId ? { ...it, ...updates } : it)),
        }))
    }

    const handleDeleteItem = (id: string) => {
        setMapDesign((prev) => ({
            ...prev,
            items: prev.items.filter((it) => it.id !== id),
        }))
        if (selectedId === id) setSelectedId(null)
    }

    const handleDuplicateItem = (item: MapObjectItem) => {
        const copy: MapObjectItem = {
            ...item,
            id: `${item.type}-${Date.now()}`,
            name: `${item.name} (Copy)`,
            position: [item.position[0] + 2, item.position[1], item.position[2] + 2],
        }
        setMapDesign((prev) => ({
            ...prev,
            items: [...prev.items, copy],
        }))
        setSelectedId(copy.id)
    }

    const handleOpenExportJson = () => {
        setRawJsonText(JSON.stringify(mapDesign, null, 2))
        setJsonModalOpen(true)
    }

    const handleApplyImportJson = () => {
        try {
            const parsed = JSON.parse(rawJsonText)
            if (!parsed.items || !Array.isArray(parsed.items)) {
                throw new Error('Dữ liệu JSON không hợp lệ (cần trường items là mảng).')
            }
            setMapDesign(parsed)
            setSelectedId(null)
            setJsonModalOpen(false)
            notify.success('Đã nhập dữ liệu bản đồ thành công!')
        } catch (err: any) {
            notify.error(`Lỗi cú pháp JSON: ${err.message}`)
        }
    }

    const categories = ['Tất cả', 'AI Agent & Robot', 'Công nghiệp', 'Nhà thông minh', 'Kiến trúc', 'Hạ tầng', 'Cảnh quan', 'Nội thất']
    const filteredCatalog = ITEM_CATALOG.filter(
        (c) => selectedCategory === 'Tất cả' || c.category === selectedCategory
    )

    return (
        <div className="relative flex flex-col h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-zinc-950 text-white font-sans">
            {/* ===== THANH CÔNG CỤ TRÊN (TOP BAR) ===== */}
            <header className="h-14 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur px-4 flex items-center justify-between gap-4 shrink-0 z-20">
                <div className="flex items-center gap-3">
                    <Link
                        href="/rooms"
                        className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition text-xs font-medium flex items-center gap-1.5"
                    >
                        <IconArrowLeft className="w-4 h-4" />
                        <span>Quay lại</span>
                    </Link>

                    <div className="h-4 w-px bg-zinc-800" />

                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center">
                            <IconMap className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div>
                            <h1 className="font-bold text-sm tracking-tight flex items-center gap-2">
                                <span>3D Map Studio & Setup</span>
                                <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded font-mono">
                                    Interactive
                                </span>
                            </h1>
                            <p className="text-[11px] text-zinc-400">
                                Thiết kế, vẽ và bố trí vật thể 3D cho các phòng làm việc & đô thị
                            </p>
                        </div>
                    </div>
                </div>

                {/* Các nút thao tác chung: Mẫu, Lưu, JSON, Quay lại phòng */}
                <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-1">
                        <span className="text-zinc-500 text-[11px]">Mẫu preset:</span>
                        <select
                            onChange={(e) => handleSelectPreset(e.target.value)}
                            defaultValue="smart_city"
                            className="bg-transparent text-zinc-200 outline-none cursor-pointer font-medium text-xs"
                        >
                            <option value="smart_city" className="bg-zinc-900">
                                Smart City IoT
                            </option>
                            <option value="industrial_factory" className="bg-zinc-900">
                                Nhà máy Công nghiệp 4.0 & Robotics
                            </option>
                            <option value="smarthome_iot" className="bg-zinc-900">
                                Biệt thự Smart Home IoT
                            </option>
                            <option value="empty_canvas" className="bg-zinc-900">
                                Mặt bằng trống
                            </option>
                        </select>
                    </div>

                    {/* Huy hiệu Coin & Nút Plan Tasks kiếm Coin */}
                    <button
                        onClick={() => setPlanTasksModalOpen(true)}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/20 border border-amber-500/40 text-amber-300 hover:text-amber-200 hover:border-amber-400 font-medium transition flex items-center gap-2 shadow-sm group"
                        title="Nhiệm vụ Plan Tasks & Cơ chế kiếm Coin ảo"
                    >
                        <IconCoins className="w-4 h-4 text-amber-400" />
                        <span className="font-mono font-bold text-xs">
                            {userWallet?.balance?.toLocaleString() ?? '500'}
                        </span>
                        <span className="text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-300 font-bold group-hover:bg-amber-500 group-hover:text-black transition">
                            Plan Tasks
                        </span>
                    </button>

                    <button
                        onClick={handleOpenCloudModal}
                        className="px-3 py-1.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-500/30 font-medium transition flex items-center gap-1.5"
                    >
                        <IconLayers className="w-3.5 h-3.5" />
                        <span>Bản đồ Cloud</span>
                    </button>

                    <button
                        onClick={handleOpenSaveCloudModal}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-medium text-white transition flex items-center gap-1.5 shadow"
                    >
                        <IconSave className="w-3.5 h-3.5" />
                        <span>Lưu lên Cloud</span>
                    </button>

                    <button
                        onClick={handleSaveLocalStorage}
                        className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 font-medium transition flex items-center gap-1.5"
                        title="Lưu tạm vào LocalStorage của trình duyệt"
                    >
                        <span>Lưu Local</span>
                    </button>

                    <button
                        onClick={handleOpenExportJson}
                        className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-medium transition flex items-center gap-1.5"
                    >
                        <span>JSON</span>
                    </button>

                    <Link
                        href="/agent-body-studio"
                        className="px-3 py-1.5 rounded-xl bg-violet-950/80 hover:bg-violet-900/80 text-violet-300 border border-violet-500/30 font-medium transition flex items-center gap-1.5"
                    >
                        <span>Agent Body Studio →</span>
                    </Link>

                    <Link
                        href="/office"
                        className="px-3 py-1.5 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 text-white font-medium transition flex items-center gap-1.5"
                    >
                        <span>Xem Office 3D →</span>
                    </Link>
                </div>
            </header>

            {/* ===== KHU VỰC CHÍNH (3 CỘT: THƯ VIỆN, CANVAS 3D, INSPECTOR) ===== */}
            <div className="flex flex-1 min-h-0 relative">
                {/* 1. CỘT TRÁI: THƯ VIỆN ĐỐI TƯỢNG (ITEM LIBRARY) */}
                <aside className="w-72 border-r border-zinc-800 bg-zinc-900/50 backdrop-blur flex flex-col shrink-0 z-10">
                    <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                            <IconLayers className="w-3.5 h-3.5 text-cyan-400" />
                            Thư viện vật thể
                        </span>
                        {activeTool && (
                            <button
                                onClick={() => setActiveTool(null)}
                                className="text-[10px] text-rose-400 hover:underline"
                            >
                                Hủy chọn
                            </button>
                        )}
                    </div>

                    {/* Bộ lọc phân loại */}
                    <div className="p-2 border-b border-zinc-800/80 flex items-center gap-1 overflow-x-auto scrollbar-none">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`text-[11px] px-2 py-1 rounded-lg shrink-0 transition ${
                                    selectedCategory === cat
                                        ? 'bg-cyan-600 text-white font-medium'
                                        : 'text-zinc-400 hover:bg-zinc-800'
                                }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Danh sách thẻ items */}
                    <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                        {filteredCatalog.map((catItem) => {
                            const isCurrentTool = activeTool === catItem.type
                            return (
                                <div
                                    key={catItem.type}
                                    onClick={() =>
                                        setActiveTool(isCurrentTool ? null : catItem.type)
                                    }
                                    className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center gap-3 ${
                                        isCurrentTool
                                            ? 'bg-cyan-950/60 border-cyan-400 text-white ring-1 ring-cyan-400'
                                            : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700 text-zinc-300 hover:text-white'
                                    }`}
                                >
                                    <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 shadow-inner">
                                        {renderCatalogIcon(catItem.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-bold truncate flex items-center justify-between">
                                            <span>{catItem.name}</span>
                                            <span className="text-[10px] text-zinc-500 font-normal">
                                                {catItem.category}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">
                                            {catItem.description}
                                        </p>
                                    </div>
                                    {isCurrentTool && (
                                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Hướng dẫn nhanh */}
                    <div className="p-3 border-t border-zinc-800 bg-zinc-950/40 text-[11px] text-zinc-400 space-y-1">
                        <div className="font-semibold text-zinc-300 flex items-center gap-1.5">
                            <IconLightbulb className="w-3.5 h-3.5 text-amber-400" />
                            <span>Mẹo thao tác:</span>
                        </div>
                        <div>1. Chọn 1 vật thể ở trên để bật chế độ đặt.</div>
                        <div>2. Click chuột vào mặt sàn 3D để thả vật thể.</div>
                        <div>3. Click vào vật thể để xoay, đổi màu, kéo thả.</div>
                    </div>
                </aside>

                {/* 2. KHU VỰC Ở GIỮA: 3D CANVAS KHÔNG GIAN BẢN ĐỒ */}
                <div className="flex-1 relative min-w-0 min-h-0">
                    <MapEditorCanvas
                        items={mapDesign.items}
                        selectedId={selectedId}
                        onSelectId={setSelectedId}
                        activeTool={activeTool}
                        onPlaceItem={handlePlaceItem}
                        groundColor={mapDesign.groundColor}
                        groundSize={mapDesign.groundSize}
                        skyPreset={mapDesign.skyPreset}
                    />
                </div>

                {/* 3. CỘT PHẢI: BẢNG INSPECTOR ĐIỀU CHỈNH THÔNG SỐ VẬT THỂ */}
                <aside className="w-80 border-l border-zinc-800 bg-zinc-900/50 backdrop-blur flex flex-col shrink-0 z-10">
                    <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                            <IconSettings className="w-3.5 h-3.5 text-blue-400" />
                            Thuộc tính đối tượng
                        </span>
                        {selectedItem && (
                            <button
                                onClick={() => setSelectedId(null)}
                                className="text-[10px] text-zinc-400 hover:text-white"
                            >
                                Đóng
                            </button>
                        )}
                    </div>

                    {selectedItem ? (
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                            {/* Tên & Loại */}
                            <div className="space-y-1">
                                <label className="text-[11px] text-zinc-400">Tên hiển thị:</label>
                                <input
                                    type="text"
                                    value={selectedItem.name}
                                    onChange={(e) =>
                                        handleUpdateSelectedItem({ name: e.target.value })
                                    }
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-cyan-500"
                                />
                            </div>

                            {/* Tọa độ X, Z (snap) */}
                            <div className="space-y-2">
                                <label className="text-[11px] text-zinc-400">Tọa độ trên mặt sàn (X, Z):</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1">
                                        <span className="text-zinc-500 font-mono">X:</span>
                                        <input
                                            type="number"
                                            step={2}
                                            value={selectedItem.position[0]}
                                            onChange={(e) =>
                                                handleUpdateSelectedItem({
                                                    position: [
                                                        parseFloat(e.target.value) || 0,
                                                        selectedItem.position[1],
                                                        selectedItem.position[2],
                                                    ],
                                                })
                                            }
                                            className="w-full bg-transparent text-white outline-none font-mono"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1">
                                        <span className="text-zinc-500 font-mono">Z:</span>
                                        <input
                                            type="number"
                                            step={2}
                                            value={selectedItem.position[2]}
                                            onChange={(e) =>
                                                handleUpdateSelectedItem({
                                                    position: [
                                                        selectedItem.position[0],
                                                        selectedItem.position[1],
                                                        parseFloat(e.target.value) || 0,
                                                    ],
                                                })
                                            }
                                            className="w-full bg-transparent text-white outline-none font-mono"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Xoay góc (0, 90, 180, 270) */}
                            <div className="space-y-2">
                                <label className="text-[11px] text-zinc-400">
                                    Góc quay: {selectedItem.rotation || 0}°
                                </label>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {[0, 90, 180, 270].map((deg) => (
                                        <button
                                            key={deg}
                                            onClick={() =>
                                                handleUpdateSelectedItem({ rotation: deg })
                                            }
                                            className={`py-1 rounded-lg border text-center transition font-mono ${
                                                (selectedItem.rotation || 0) === deg
                                                    ? 'bg-cyan-600 text-white border-cyan-400'
                                                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                                            }`}
                                        >
                                            {deg}°
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Kích thước (nếu là Tòa nhà hoặc Đường) */}
                            {(selectedItem.type === 'building' || selectedItem.type === 'road') && (
                                <div className="space-y-2 border-t border-zinc-800 pt-3">
                                    <label className="text-[11px] text-zinc-400 font-bold uppercase">
                                        Kích thước tùy biến:
                                    </label>
                                    {selectedItem.type === 'building' && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-zinc-400">Chiều cao:</span>
                                                <span className="font-mono text-cyan-400">
                                                    {selectedItem.height || 11}m
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min={4}
                                                max={30}
                                                step={1}
                                                value={selectedItem.height || 11}
                                                onChange={(e) =>
                                                    handleUpdateSelectedItem({
                                                        height: parseInt(e.target.value),
                                                    })
                                                }
                                                className="w-full accent-cyan-500"
                                            />
                                        </div>
                                    )}

                                    {selectedItem.type === 'road' && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-zinc-400">Độ dài đường:</span>
                                                <span className="font-mono text-cyan-400">
                                                    {selectedItem.depth || 20}m
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min={10}
                                                max={100}
                                                step={5}
                                                value={selectedItem.depth || 20}
                                                onChange={(e) =>
                                                    handleUpdateSelectedItem({
                                                        depth: parseInt(e.target.value),
                                                    })
                                                }
                                                className="w-full accent-cyan-500"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Màu sắc vật thể */}
                            {selectedItem.color !== undefined && (
                                <div className="space-y-2 border-t border-zinc-800 pt-3">
                                    <label className="text-[11px] text-zinc-400 font-bold uppercase">
                                        Màu sắc vật liệu:
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={selectedItem.color || '#64748b'}
                                            onChange={(e) =>
                                                handleUpdateSelectedItem({ color: e.target.value })
                                            }
                                            className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                                        />
                                        <input
                                            type="text"
                                            value={selectedItem.color || '#64748b'}
                                            onChange={(e) =>
                                                handleUpdateSelectedItem({ color: e.target.value })
                                            }
                                            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-white font-mono text-xs uppercase"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Nút hành động Nhân bản / Xóa */}
                            <div className="pt-4 border-t border-zinc-800 flex items-center gap-2">
                                <button
                                    onClick={() => handleDuplicateItem(selectedItem)}
                                    className="flex-1 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition font-medium flex items-center justify-center gap-1.5"
                                >
                                    <IconCopy className="w-3.5 h-3.5" />
                                    <span>Nhân bản</span>
                                </button>
                                <button
                                    onClick={() => handleDeleteItem(selectedItem.id)}
                                    className="py-1.5 px-3 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 text-rose-300 transition font-medium flex items-center justify-center gap-1.5"
                                >
                                    <IconTrash className="w-3.5 h-3.5" />
                                    <span>Xóa</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500 text-xs">
                            <IconTarget className="w-10 h-10 text-zinc-600 mb-2 stroke-1" />
                            <div className="font-semibold text-zinc-400">Chưa chọn đối tượng nào</div>
                            <p className="mt-1 text-[11px]">
                                Click trực tiếp vào một vật thể bất kỳ trên khung nhìn 3D để xem và chỉnh sửa thông số.
                            </p>
                        </div>
                    )}
                </aside>
            </div>

            {/* ===== MODAL NHẬP / XUẤT JSON DATA ===== */}
            {jsonModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <IconFileText className="w-4 h-4 text-cyan-400" />
                                <h3 className="font-bold text-sm text-white">
                                    Dữ liệu Bản đồ 3D (JSON Format)
                                </h3>
                            </div>
                            <button
                                onClick={() => setJsonModalOpen(false)}
                                className="text-zinc-400 hover:text-white text-xs"
                            >
                                Đóng
                            </button>
                        </div>

                        <div className="p-4 flex-1 overflow-hidden flex flex-col">
                            <p className="text-xs text-zinc-400 mb-2">
                                Bạn có thể sao chép chuỗi JSON dưới đây để lưu vào file hoặc paste JSON mới để tải vào bản đồ.
                            </p>
                            <textarea
                                value={rawJsonText}
                                onChange={(e) => setRawJsonText(e.target.value)}
                                className="flex-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 font-mono text-xs text-zinc-300 outline-none focus:border-cyan-500 resize-none"
                                rows={14}
                            />
                        </div>

                        <div className="p-4 border-t border-zinc-800 bg-zinc-950/40 flex items-center justify-between">
                            <button
                                onClick={async () => {
                                    await navigator.clipboard.writeText(rawJsonText)
                                    setCopiedJson(true)
                                    setTimeout(() => setCopiedJson(false), 2000)
                                }}
                                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 transition flex items-center gap-1.5"
                            >
                                {copiedJson ? (
                                    <>
                                        <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>Đã chép</span>
                                    </>
                                ) : (
                                    <>
                                        <IconCopy className="w-3.5 h-3.5" />
                                        <span>Sao chép JSON</span>
                                    </>
                                )}
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setJsonModalOpen(false)}
                                    className="px-3 py-1.5 rounded-xl text-zinc-400 hover:text-white text-xs"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleApplyImportJson}
                                    className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition"
                                >
                                    Áp dụng JSON vào bản đồ
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL LƯU BẢN ĐỒ LÊN CLOUD (MAPDRAW-SERVICE) ===== */}
            {saveCloudModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                            <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                <IconSave className="w-4 h-4 text-blue-400" />
                                <span>Lưu Bản Đồ lên Cloud (mapdraw-service)</span>
                            </h3>
                            <button
                                onClick={() => setSaveCloudModalOpen(false)}
                                className="text-zinc-400 hover:text-white text-xs"
                            >
                                Đóng
                            </button>
                        </div>

                        <div className="p-4 space-y-3 text-xs">
                            <div>
                                <label className="text-zinc-400 font-medium mb-1 block">Tên bản đồ:</label>
                                <input
                                    type="text"
                                    value={cloudMapTitle}
                                    onChange={(e) => setCloudMapTitle(e.target.value)}
                                    placeholder="Nhập tên bản đồ (ví dụ: Smart City Zone 1)..."
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="text-zinc-400 font-medium mb-1 block">Mô tả bản đồ (tùy chọn):</label>
                                <textarea
                                    value={cloudMapDesc}
                                    onChange={(e) => setCloudMapDesc(e.target.value)}
                                    placeholder="Ghi chú về bản đồ hoặc vị trí của các agent..."
                                    rows={3}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-blue-500 resize-none"
                                />
                            </div>

                            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
                                <span>Tổng số vật thể: <strong className="text-white">{mapDesign.items.length}</strong></span>
                                <span>Kích thước sàn: <strong className="text-white">{mapDesign.groundSize[0]}x{mapDesign.groundSize[1]}m</strong></span>
                            </div>
                        </div>

                        <div className="p-4 border-t border-zinc-800 bg-zinc-950/40 flex items-center justify-end gap-2">
                            <button
                                onClick={() => setSaveCloudModalOpen(false)}
                                className="px-3 py-1.5 rounded-xl text-zinc-400 hover:text-white text-xs"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleConfirmSaveCloud}
                                disabled={isSavingCloud || !cloudMapTitle.trim()}
                                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition disabled:opacity-50 flex items-center gap-1.5"
                            >
                                <IconSave className="w-3.5 h-3.5" />
                                <span>{isSavingCloud ? 'Đang lưu Cloud...' : 'Xác nhận Lưu'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL DANH SÁCH BẢN ĐỒ TRÊN CLOUD ===== */}
            {cloudModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                    <IconLayers className="w-4 h-4 text-cyan-400" />
                                    <span>Bản Đồ Của Người Dùng (mapdraw-service)</span>
                                </h3>
                                <p className="text-[11px] text-zinc-400 mt-0.5">
                                    Danh sách các bản đồ không gian 3D được lưu trữ trên Cloud MongoDB Atlas
                                </p>
                            </div>
                            <button
                                onClick={() => setCloudModalOpen(false)}
                                className="text-zinc-400 hover:text-white text-xs"
                            >
                                Đóng
                            </button>
                        </div>

                        <div className="p-4 flex-1 overflow-y-auto space-y-3">
                            {isLoadingCloud ? (
                                <div className="py-12 text-center text-xs text-zinc-500">
                                    Đang tải danh sách bản đồ từ Cloud...
                                </div>
                            ) : cloudMaps.length === 0 ? (
                                <div className="py-12 text-center space-y-2">
                                    <IconMap className="w-8 h-8 text-zinc-600 mx-auto" />
                                    <p className="text-xs text-zinc-400 font-medium">Chưa có bản đồ nào được lưu trên Cloud.</p>
                                    <p className="text-[11px] text-zinc-500">Hãy vẽ bản đồ và bấm "Lưu lên Cloud" để lưu trữ lâu dài!</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {cloudMaps.map((cm) => (
                                        <div
                                            key={cm.mapId}
                                            className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-cyan-500/50 transition flex flex-col justify-between group"
                                        >
                                            <div className="space-y-1.5">
                                                <div className="flex items-start justify-between gap-2">
                                                    <h4 className="font-semibold text-xs text-white group-hover:text-cyan-300 transition truncate">
                                                        {cm.name}
                                                    </h4>
                                                    <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-500/30 px-1.5 py-0.5 rounded font-mono shrink-0">
                                                        {cm.items?.length || 0} items
                                                    </span>
                                                </div>
                                                {cm.description && (
                                                    <p className="text-[11px] text-zinc-400 line-clamp-2">
                                                        {cm.description}
                                                    </p>
                                                )}
                                                <div className="text-[10px] text-zinc-500 flex items-center gap-2">
                                                    <span>Bởi: {cm.userName || 'Ẩn danh'}</span>
                                                    <span>•</span>
                                                    <span>Sàn: {cm.groundSize?.[0] || 60}x{cm.groundSize?.[1] || 60}m</span>
                                                </div>
                                            </div>

                                            <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between">
                                                <button
                                                    onClick={() => handleDeleteCloudMap(cm.mapId, cm.name)}
                                                    className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 transition"
                                                    title="Xóa bản đồ này trên Cloud"
                                                >
                                                    <IconTrash className="w-3.5 h-3.5" />
                                                </button>

                                                <button
                                                    onClick={() => handleLoadCloudMap(cm)}
                                                    className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition flex items-center gap-1 shadow-sm"
                                                >
                                                    <span>Mở trên 3D Editor</span>
                                                    <span>→</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-3 border-t border-zinc-800 bg-zinc-950/40 flex items-center justify-between text-xs text-zinc-400">
                            <span>Tổng số bản đồ: <strong className="text-white">{cloudMaps.length}</strong></span>
                            <button
                                onClick={handleFetchCloudMaps}
                                className="text-xs text-cyan-400 hover:underline"
                            >
                                Làm mới danh sách
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== MODAL NHIỆM VỤ PLANTASKS & KIẾM COIN ẢO (SAVECOIN-SERVICE) ===== */}
            <PlanTasksModal
                isOpen={planTasksModalOpen}
                onClose={() => setPlanTasksModalOpen(false)}
                userId={getUser()?.id || 'anonymous'}
                userName={getUser()?.name || getUser()?.email}
                onWalletUpdate={(w) => setUserWallet(w)}
            />
        </div>
    )
}
