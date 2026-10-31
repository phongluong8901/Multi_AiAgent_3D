'use client'

import React, { useState, useEffect, useRef } from 'react'
import type LType from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { GeoNode, GeoLink } from './Globe3DView'
import { MapPin, Radio, Layers, Crosshair, Zap, Activity } from 'lucide-react'

interface WorldMap2DViewProps {
    nodes: GeoNode[]
    links: GeoLink[]
    selectedNodeId: string | null
    onSelectNode: (id: string | null) => void
}

export default function WorldMap2DView({
    nodes,
    links,
    selectedNodeId,
    onSelectNode,
}: WorldMap2DViewProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<LType.Map | null>(null)
    const markersRef = useRef<LType.Marker[]>([])
    const circlesRef = useRef<LType.Circle[]>([])
    const linesRef = useRef<LType.Polyline[]>([])

    const [leaflet, setLeaflet] = useState<typeof LType | null>(null)
    const [activeRange, setActiveRange] = useState<'all' | '50' | '150' | '350'>('all')
    const [mapTheme, setMapTheme] = useState<'dark' | 'satellite' | 'light'>('dark')

    // Tải thư viện Leaflet an toàn trên client (tránh lỗi SSR window is not defined)
    useEffect(() => {
        let isMounted = true
        import('leaflet').then((mod) => {
            if (isMounted) {
                setLeaflet(mod.default || mod)
            }
        })
        return () => {
            isMounted = false
        }
    }, [])

    // Xác định node trọng tâm (node được chọn hoặc node đầu tiên trong danh sách)
    const activeNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0]
    const centerLat = activeNode?.lat ?? 21.0285
    const centerLng = activeNode?.lng ?? 105.8542

    // 1. Khởi tạo bản đồ Leaflet
    useEffect(() => {
        if (!leaflet || !mapContainerRef.current) return

        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove()
            mapInstanceRef.current = null
        }

        const map = leaflet.map(mapContainerRef.current, {
            center: [centerLat, centerLng],
            zoom: nodes.length > 1 ? 6 : 8,
            zoomControl: false,
            attributionControl: false,
        })
        mapInstanceRef.current = map

        leaflet.control.zoom({ position: 'topright' }).addTo(map)

        // Cấu hình Tile Layer
        let tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
        let maxZoom = 19
        let subdomains = 'abc'

        if (mapTheme === 'satellite') {
            tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            maxZoom = 18
            subdomains = ''
        }

        const tileLayer = leaflet.tileLayer(tileUrl, {
            maxZoom,
            subdomains,
            attribution: '',
        })
        tileLayer.addTo(map)

        const timer = setTimeout(() => {
            map.invalidateSize()
        }, 150)

        return () => {
            clearTimeout(timer)
            map.remove()
            mapInstanceRef.current = null
        }
    }, [leaflet, mapTheme])

    // 2. Vẽ Markers, Links và Bán kính Range Phủ Sóng
    useEffect(() => {
        const map = mapInstanceRef.current
        if (!map || !leaflet) return

        // Dọn dẹp các lớp vẽ cũ
        markersRef.current.forEach((m) => m.remove())
        markersRef.current = []
        circlesRef.current.forEach((c) => c.remove())
        circlesRef.current = []
        linesRef.current.forEach((l) => l.remove())
        linesRef.current = []

        // A. Vẽ các đường kết nối mạng lưới (Links) giữa các Node
        links.forEach((link) => {
            const isSelected = selectedNodeId === link.from.id || selectedNodeId === link.to.id
            const color = isSelected ? '#38bdf8' : link.type === 'seller-owner' ? '#06b6d4' : '#6366f1'
            const polyline = leaflet.polyline(
                [
                    [link.from.lat, link.from.lng],
                    [link.to.lat, link.to.lng],
                ],
                {
                    color,
                    weight: isSelected ? 2.5 : 1.5,
                    dashArray: '6, 6',
                    opacity: isSelected ? 0.9 : 0.45,
                }
            ).addTo(map)

            polyline.bindTooltip(
                `<div style="font-family: monospace; font-size: 11px;">
                    <strong>${link.type === 'seller-owner' ? 'Streaming' : 'P2P Mesh'}</strong>: ${link.model}<br/>
                    Độ trễ: ${link.latency}ms
                </div>`,
                { className: 'leaflet-range-tooltip' }
            )

            linesRef.current.push(polyline)
        })

        // B. Vẽ các vòng tròn phạm vi (Range Coverage) quanh node trọng tâm
        if (activeNode) {
            const fLat = activeNode.lat
            const fLng = activeNode.lng

            // Range 1: 50 km - Độ trễ < 15ms (Edge AI Low Latency)
            if (activeRange === 'all' || activeRange === '50') {
                const c1 = leaflet.circle([fLat, fLng], {
                    radius: 50000,
                    color: '#ff6c37',
                    weight: 1.5,
                    fillColor: '#ff6c37',
                    fillOpacity: 0.12,
                }).addTo(map)
                c1.bindTooltip('Range 1 (50 km): Cực Thấp < 15ms (Edge AI Inference)', {
                    direction: 'top',
                    className: 'leaflet-range-tooltip',
                })
                circlesRef.current.push(c1)
            }

            // Range 2: 150 km - Độ trễ < 35ms (Regional Cluster)
            if (activeRange === 'all' || activeRange === '150') {
                const c2 = leaflet.circle([fLat, fLng], {
                    radius: 150000,
                    color: '#38bdf8',
                    weight: 1.5,
                    dashArray: '5, 5',
                    fillColor: '#38bdf8',
                    fillOpacity: 0.08,
                }).addTo(map)
                c2.bindTooltip('Range 2 (150 km): Nội Vùng < 35ms (P2P Mesh)', {
                    direction: 'top',
                    className: 'leaflet-range-tooltip',
                })
                circlesRef.current.push(c2)
            }

            // Range 3: 350 km - Độ trễ < 75ms (Extended Batch)
            if (activeRange === 'all' || activeRange === '350') {
                const c3 = leaflet.circle([fLat, fLng], {
                    radius: 350000,
                    color: '#a855f7',
                    weight: 1.5,
                    dashArray: '8, 8',
                    fillColor: '#a855f7',
                    fillOpacity: 0.05,
                }).addTo(map)
                c3.bindTooltip('Range 3 (350 km): Mở Rộng < 75ms (Batch Tasks)', {
                    direction: 'top',
                    className: 'leaflet-range-tooltip',
                })
                circlesRef.current.push(c3)
            }
        }

        // C. Vẽ các Marker Node với hiệu ứng chớp sáng tương tác
        nodes.forEach((node) => {
            const isSelected = selectedNodeId === node.id
            const isBusy = node.status === 'BUSY'
            const primaryColor = isSelected ? '#38bdf8' : isBusy ? '#f59e0b' : '#10b981'

            const customIcon = leaflet.divIcon({
                className: 'custom-node-marker',
                html: `
                    <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                        <div style="position: absolute; width: 32px; height: 32px; background: ${primaryColor}40; border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                        <div style="position: absolute; width: 20px; height: 20px; background: ${primaryColor}70; border-radius: 50%;"></div>
                        <div style="position: relative; width: 12px; height: 12px; background: ${primaryColor}; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 0 10px ${primaryColor};"></div>
                    </div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
            })

            const marker = leaflet.marker([node.lat, node.lng], { icon: customIcon }).addTo(map)

            const popupContent = `
                <div style="font-family: -apple-system, sans-serif; font-size: 12px; padding: 4px; min-width: 190px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                        <strong style="color: ${primaryColor}; font-size: 13px;">${node.name}</strong>
                        <span style="font-size: 9px; padding: 2px 6px; border-radius: 4px; background: ${isBusy ? '#f59e0b30' : '#10b98130'}; color: ${primaryColor}; font-weight: bold;">
                            ${node.status}
                        </span>
                    </div>
                    <div style="color: #a1a1aa; font-size: 11px; margin-bottom: 2px;">
                        <strong>Vị trí:</strong> ${node.city}, ${node.country}
                    </div>
                    <div style="color: #a1a1aa; font-size: 11px; margin-bottom: 2px;">
                        <strong>Phần cứng:</strong> ${node.gpuName || 'CPU'}
                    </div>
                    <div style="color: #a1a1aa; font-size: 11px; margin-bottom: 4px;">
                        <strong>Models:</strong> ${(node.models || []).slice(0, 2).join(', ')}
                    </div>
                    <div style="color: #71717a; font-family: monospace; font-size: 10px; margin-bottom: 6px;">
                        Tọa độ: ${node.lat.toFixed(4)}, ${node.lng.toFixed(4)} &bull; ${node.latencyMs}ms
                    </div>
                    <button id="select-btn-${node.id}" style="width: 100%; padding: 4px 8px; background: #2563eb; color: #ffffff; border: none; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;">
                        ${isSelected ? 'Đang chọn node này' : 'Chọn node này'}
                    </button>
                </div>
            `

            marker.bindPopup(popupContent)

            marker.on('popupopen', () => {
                const btn = document.getElementById(`select-btn-${node.id}`)
                if (btn) {
                    btn.onclick = () => {
                        onSelectNode(node.id)
                    }
                }
            })

            marker.on('click', () => {
                onSelectNode(node.id)
            })

            markersRef.current.push(marker)
        })
    }, [leaflet, nodes, links, selectedNodeId, activeRange, activeNode])

    // Căn giữa bản đồ về Node được chọn hoặc trung tâm các Node
    const handleRecenter = () => {
        if (!mapInstanceRef.current) return
        if (activeNode) {
            mapInstanceRef.current.setView([activeNode.lat, activeNode.lng], 8, { animate: true })
        } else {
            mapInstanceRef.current.setView([21.0285, 105.8542], 6, { animate: true })
        }
    }

    return (
        <div className="w-full h-full flex flex-col bg-[#141416] border border-border rounded-xl overflow-hidden shadow-lg select-none">
            {/* 1. THANH ĐIỀU KHIỂN & BỘ LỌC PHẠM VI (GIỐNG APP ELECTRON) */}
            <div className="px-3.5 py-2.5 bg-[#1a1a1e] border-b border-border/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Thông tin vị trí node trọng tâm */}
                <div className="flex items-center space-x-2.5">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                        <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <div className="flex items-center space-x-2">
                            <strong className="text-white text-xs font-semibold">
                                {activeNode ? `${activeNode.name} (${activeNode.city}, ${activeNode.country})` : 'Mạng Lưới AI Phân Tán'}
                            </strong>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-[#27272a] text-emerald-400 border border-[#3f3f46]">
                                {nodes.length} Nodes Live
                            </span>
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] text-zinc-400 font-mono mt-0.5">
                            <span>Lat: {centerLat.toFixed(4)} | Lng: {centerLng.toFixed(4)}</span>
                            <span>&bull;</span>
                            <span>{links.length} Liên kết P2P/Stream</span>
                        </div>
                    </div>
                </div>

                {/* Bộ lọc phạm vi phủ sóng & Giao diện map */}
                <div className="flex items-center space-x-2 text-[11px] font-mono flex-wrap">
                    <span className="text-zinc-400 flex items-center space-x-1">
                        <Radio className="w-3.5 h-3.5 text-blue-400" />
                        <span>Bán kính:</span>
                    </span>

                    <div className="flex items-center bg-[#121214] p-0.5 rounded-lg border border-[#27272a]">
                        <button
                            type="button"
                            onClick={() => setActiveRange('all')}
                            className={`px-2.5 py-1 rounded transition text-[11px] font-medium ${
                                activeRange === 'all'
                                    ? 'bg-blue-600 text-white font-bold'
                                    : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            Tất cả
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveRange('50')}
                            className={`px-2 py-1 rounded transition text-[11px] flex items-center space-x-1 ${
                                activeRange === '50'
                                    ? 'bg-[#ff6c37] text-white font-bold'
                                    : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#ff6c37]" />
                            <span>50km (&lt;15ms)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveRange('150')}
                            className={`px-2 py-1 rounded transition text-[11px] flex items-center space-x-1 ${
                                activeRange === '150'
                                    ? 'bg-[#38bdf8] text-white font-bold'
                                    : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
                            <span>150km (&lt;35ms)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveRange('350')}
                            className={`px-2 py-1 rounded transition text-[11px] flex items-center space-x-1 ${
                                activeRange === '350'
                                    ? 'bg-[#a855f7] text-white font-bold'
                                    : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7]" />
                            <span>350km (&lt;75ms)</span>
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            if (mapTheme === 'dark') setMapTheme('satellite')
                            else if (mapTheme === 'satellite') setMapTheme('light')
                            else setMapTheme('dark')
                        }}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#242428] hover:bg-[#2e2e34] text-zinc-300 hover:text-white border border-[#383840] transition"
                        title="Đổi kiểu bản đồ: Tối / Vệ Tinh / Sáng"
                    >
                        <Layers className="w-3.5 h-3.5 text-blue-400" />
                        <span>
                            {mapTheme === 'dark' ? 'Dark Map' : mapTheme === 'satellite' ? 'Vệ Tinh' : 'Light Map'}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={handleRecenter}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#242428] hover:bg-[#2e2e34] text-zinc-300 hover:text-white border border-[#383840] transition"
                        title="Căn giữa về node trọng tâm"
                    >
                        <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Tâm Node</span>
                    </button>
                </div>
            </div>

            {/* 2. KHUNG HIỂN THỊ BẢN ĐỒ LEAFLET THỰC TẾ VỚI NỀN TỐI (DARK TILE FILTER) */}
            <div className="flex-1 w-full relative min-h-[420px] bg-[#0c0d10]">
                <div
                    ref={mapContainerRef}
                    className={`w-full h-full ${
                        mapTheme === 'dark' ? 'dark-map' : mapTheme === 'satellite' ? 'satellite-map' : 'light-map'
                    }`}
                    style={{ minHeight: '420px' }}
                />

                {/* Bảng chú giải nổi góc dưới bên trái (Legend) */}
                <div className="absolute bottom-3 left-3 z-[500] bg-[#141416]/95 backdrop-blur-md border border-[#2d2d32] rounded-xl p-3 text-[11px] font-mono text-zinc-300 space-y-1.5 shadow-2xl max-w-xs pointer-events-auto">
                    <div className="font-bold text-white text-xs border-b border-[#2d2d32] pb-1 flex items-center justify-between">
                        <span>Phạm Vi Phủ Sóng & Độ Trễ</span>
                        <span className="text-[10px] text-blue-400">P2P Mesh</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#ff6c37] shrink-0" />
                        <span>Range 50 km: Cực Nhanh (&lt; 15ms Edge)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8] shrink-0" />
                        <span>Range 150 km: Cụm Nội Vùng (&lt; 35ms)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7] shrink-0" />
                        <span>Range 350 km: Queue Mở Rộng (&lt; 75ms)</span>
                    </div>
                    <div className="pt-1 border-t border-[#2d2d32] flex items-center justify-between text-[10px] text-zinc-400">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Sẵn sàng
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-400" /> Đang suy luận
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-400" /> Đang chọn
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
