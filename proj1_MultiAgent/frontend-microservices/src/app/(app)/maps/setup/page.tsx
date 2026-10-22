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
} from '@/components/ui/icons'

const LOCAL_STORAGE_KEY = 'agent_custom_map_designs_v1'

export default function MapSetupPage() {
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

    const handleSaveLocalStorage = () => {
        try {
            const updated = {
                ...mapDesign,
                updatedAt: new Date().toISOString(),
            }
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated))
            setMapDesign(updated)
            alert('Đã lưu bản đồ vào trình duyệt thành công!')
        } catch (e) {
            alert('Lỗi lưu bản đồ!')
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
            alert('Đã nhập dữ liệu bản đồ thành công!')
        } catch (err: any) {
            alert(`Lỗi cú pháp JSON: ${err.message}`)
        }
    }

    const categories = ['Tất cả', 'Kiến trúc', 'Hạ tầng', 'Cảnh quan', 'Nội thất']
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
                        <span className="text-xl">🗺️</span>
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
                                🏙️ Smart City IoT
                            </option>
                            <option value="empty_canvas" className="bg-zinc-900">
                                ⬜ Mặt bằng trống
                            </option>
                        </select>
                    </div>

                    <button
                        onClick={handleSaveLocalStorage}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-medium text-white transition flex items-center gap-1.5 shadow"
                    >
                        <IconSave className="w-3.5 h-3.5" />
                        <span>Lưu thay đổi</span>
                    </button>

                    <button
                        onClick={handleOpenExportJson}
                        className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-medium transition flex items-center gap-1.5"
                    >
                        <span>JSON Data</span>
                    </button>

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
                                    <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xl shrink-0 shadow-inner">
                                        {catItem.icon}
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
                        <div className="font-semibold text-zinc-300">💡 Mẹo thao tác:</div>
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

                    {/* Thống kê số lượng vật thể */}
                    <div className="absolute top-3 left-3 pointer-events-none bg-black/70 backdrop-blur border border-zinc-800 px-3 py-1.5 rounded-xl text-xs text-zinc-300 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>{mapDesign.items.length} vật thể trên bản đồ</span>
                        <span className="text-zinc-600">|</span>
                        <span className="text-zinc-400">Lưới snap: 2.0m</span>
                    </div>
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
                            <span className="text-3xl mb-2">🎯</span>
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
                                <span className="text-cyan-400 text-lg">📄</span>
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
        </div>
    )
}
