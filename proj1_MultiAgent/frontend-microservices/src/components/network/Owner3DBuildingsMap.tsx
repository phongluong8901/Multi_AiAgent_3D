'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import type MapLibreGL from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { SellerNodeData } from '@/lib/api/seller'
import {
    Building2,
    Compass,
    Crosshair,
    Layers,
    RotateCcw,
    Zap,
    MapPin,
    Server,
    CheckCircle2,
    Activity,
    Eye,
} from 'lucide-react'

interface Owner3DBuildingsMapProps {
    userLocation: {
        name: string
        lat?: number
        lng?: number
        radiusKm?: number
    }
    nodes: SellerNodeData[]
    selectedNodeId?: string | null
    onSelectNode?: (nodeId: string) => void
    onRentNode?: (node: SellerNodeData) => void
}

// Hàm sinh lưới khối tòa nhà 3D quanh một tọa độ tâm
function generateBuildingBlocksAround(
    centerLat: number,
    centerLng: number,
    hubName: string,
    isNodeHub = false
) {
    const features: any[] = []
    const gridSize = 4
    const offsetStep = 0.0018 // ~200 mét mỗi khối

    // Khối tháp trung tâm (Data Center / AI Hub Tower)
    const centerHalf = 0.0006
    features.push({
        type: 'Feature',
        properties: {
            name: `${hubName} - AI Datacenter Tower`,
            height: isNodeHub ? 280 : 180,
            min_height: 0,
            color: isNodeHub ? '#0284c7' : '#10b981',
            isNodeHub,
        },
        geometry: {
            type: 'Polygon',
            coordinates: [[
                [centerLng - centerHalf, centerLat - centerHalf],
                [centerLng + centerHalf, centerLat - centerHalf],
                [centerLng + centerHalf, centerLat + centerHalf],
                [centerLng - centerHalf, centerLat + centerHalf],
                [centerLng - centerHalf, centerLat - centerHalf],
            ]],
        },
    })

    // Các khối nhà cao tầng xung quanh (Văn phòng, Tech Park, Server Racks)
    for (let dx = -gridSize; dx <= gridSize; dx++) {
        for (let dy = -gridSize; dy <= gridSize; dy++) {
            if (dx === 0 && dy === 0) continue

            // Xác suất xuất hiện tòa nhà
            const rand = Math.sin(centerLat * 100 + dx * 13 + dy * 19)
            if (rand < -0.3) continue

            const bLng = centerLng + dx * offsetStep + (rand * 0.0003)
            const bLat = centerLat + dy * offsetStep + (Math.cos(rand) * 0.0003)
            const distFromCenter = Math.sqrt(dx * dx + dy * dy)

            // Độ cao tòa nhà: ở gần tâm thì cao hơn (tháp chọc trời), xa dần thì thấp
            const baseH = Math.max(30, Math.floor(160 - distFromCenter * 25 + Math.abs(rand) * 60))
            const w = 0.00045 + Math.abs(rand) * 0.0002
            const h = 0.00045 + Math.abs(rand) * 0.0002

            const buildingColors = [
                '#1e293b', // slate-800
                '#0f172a', // slate-900
                '#1e3a5f', // deep cyber navy
                '#162a45', // dark steel
                '#25354e', // tech glass
            ]
            const color = buildingColors[Math.abs(Math.floor(rand * 10)) % buildingColors.length]

            features.push({
                type: 'Feature',
                properties: {
                    name: `Khu Đô Thị & Tòa Nhà Thông Minh #${Math.abs(dx * 10 + dy)}`,
                    height: baseH,
                    min_height: 0,
                    color,
                    isNodeHub: false,
                },
                geometry: {
                    type: 'Polygon',
                    coordinates: [[
                        [bLng - w, bLat - h],
                        [bLng + w, bLat - h],
                        [bLng + w, bLat + h],
                        [bLng - w, bLat + h],
                        [bLng - w, bLat - h],
                    ]],
                },
            })
        }
    }

    return features
}

export default function Owner3DBuildingsMap({
    userLocation,
    nodes,
    selectedNodeId,
    onSelectNode,
    onRentNode,
}: Owner3DBuildingsMapProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<MapLibreGL.Map | null>(null)
    const markersRef = useRef<MapLibreGL.Marker[]>([])
    const isRotatingRef = useRef(false)
    const animFrameRef = useRef<number | null>(null)

    const [maplibregl, setMaplibregl] = useState<typeof MapLibreGL | null>(null)
    const [is3DMode, setIs3DMode] = useState(true)
    const [isAutoRotating, setIsAutoRotating] = useState(false)
    const [mapTheme, setMapTheme] = useState<'dark' | 'satellite'>('dark')
    const [activeBuildingInfo, setActiveBuildingInfo] = useState<{
        name: string
        height: number
        isNodeHub: boolean
    } | null>(null)

    // Tải MapLibre GL an toàn trên Client (tránh lỗi SSR window is not defined)
    useEffect(() => {
        let isMounted = true
        import('maplibre-gl').then((mod) => {
            if (isMounted) {
                setMaplibregl(mod.default || mod)
            }
        })
        return () => {
            isMounted = false
        }
    }, [])

    const userLat = userLocation.lat ?? 21.0333
    const userLng = userLocation.lng ?? 105.7828

    // Chuẩn bị danh sách tọa độ máy tính Seller
    const nodeLocations = useMemo(() => {
        return nodes.map((n) => {
            let lat = userLat
            let lng = userLng

            if (n.locationName?.includes('Hồ Chí Minh') || n.locationName?.includes('Quận 1')) {
                lat = 10.7769
                lng = 106.6992
            } else if (n.locationName?.includes('Đà Nẵng')) {
                lat = 16.0678
                lng = 108.2208
            } else if (n.locationName?.includes('Cần Thơ')) {
                lat = 10.0452
                lng = 105.7838
            } else if (n.locationName?.includes('Cầu Giấy') || n.locationName?.includes('Hà Nội')) {
                lat = 21.0333
                lng = 105.7828
            }

            return {
                ...n,
                computedLat: lat,
                computedLng: lng,
            }
        })
    }, [nodes, userLat, userLng])

    // Sinh GeoJSON khối tòa nhà 3D quanh các cụm tính toán
    const buildingsGeoJSON = useMemo(() => {
        const allFeatures: any[] = []

        // Sinh tòa nhà quanh vị trí Owner
        allFeatures.push(
            ...generateBuildingBlocksAround(userLat, userLng, `${userLocation.name} (Vị trí của bạn)`, false)
        )

        // Sinh tòa nhà quanh từng máy Seller
        nodeLocations.forEach((n) => {
            allFeatures.push(
                ...generateBuildingBlocksAround(n.computedLat, n.computedLng, n.nodeName, true)
            )
        })

        return {
            type: 'FeatureCollection',
            features: allFeatures,
        }
    }, [userLat, userLng, userLocation.name, nodeLocations])

    // 1. Khởi tạo bản đồ MapLibre GL 3D
    useEffect(() => {
        if (!maplibregl || !mapContainerRef.current) return

        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove()
            mapInstanceRef.current = null
        }

        const darkTileUrl =
            mapTheme === 'satellite'
                ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                : 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'

        const customStyle: any = {
            version: 8,
            sources: {
                'base-raster-tiles': {
                    type: 'raster',
                    tiles: [darkTileUrl],
                    tileSize: 256,
                    attribution: '© OpenStreetMap contributors, © CARTO / Esri',
                },
            },
            layers: [
                {
                    id: 'base-tiles-layer',
                    type: 'raster',
                    source: 'base-raster-tiles',
                    minzoom: 0,
                    maxzoom: 20,
                },
            ],
        }

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: customStyle,
            center: [userLng, userLat],
            zoom: 15.2,
            pitch: is3DMode ? 60 : 0,
            bearing: -20,
            antialias: true,
            attributionControl: false,
        })
        mapInstanceRef.current = map

        map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right')

        map.on('load', () => {
            // Nạp nguồn dữ liệu khối nhà 3D GeoJSON
            map.addSource('3d-buildings-source', {
                type: 'geojson',
                data: buildingsGeoJSON as any,
            })

            // Thêm lớp vẽ 3D Fill-Extrusion với hiệu ứng ánh sáng
            map.addLayer({
                id: '3d-buildings-extrusion-layer',
                source: '3d-buildings-source',
                type: 'fill-extrusion',
                paint: {
                    'fill-extrusion-color': ['get', 'color'],
                    'fill-extrusion-height': ['get', 'height'],
                    'fill-extrusion-base': ['get', 'min_height'],
                    'fill-extrusion-opacity': 0.88,
                },
            })

            // Tương tác nhấp chuột vào tòa nhà 3D
            map.on('click', '3d-buildings-extrusion-layer', (e) => {
                if (e.features && e.features[0]) {
                    const props = e.features[0].properties
                    setActiveBuildingInfo({
                        name: props.name || 'Tòa nhà thông minh',
                        height: props.height || 60,
                        isNodeHub: Boolean(props.isNodeHub),
                    })
                }
            })

            map.on('mouseenter', '3d-buildings-extrusion-layer', () => {
                map.getCanvas().style.cursor = 'pointer'
            })
            map.on('mouseleave', '3d-buildings-extrusion-layer', () => {
                map.getCanvas().style.cursor = ''
            })

            setTimeout(() => {
                map.resize()
            }, 200)
        })

        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current)
            }
            map.remove()
            mapInstanceRef.current = null
        }
    }, [maplibregl, mapTheme])

    // 2. Cập nhật dữ liệu khối tòa nhà 3D khi danh sách node thay đổi
    useEffect(() => {
        const map = mapInstanceRef.current
        if (!map) return
        const source: any = map.getSource('3d-buildings-source')
        if (source && source.setData) {
            source.setData(buildingsGeoJSON)
        }
    }, [buildingsGeoJSON])

    // 3. Đặt các Marker 3D cho Vị trí của Bạn và các máy tính Seller
    useEffect(() => {
        const map = mapInstanceRef.current
        if (!map || !maplibregl) return

        markersRef.current.forEach((m) => m.remove())
        markersRef.current = []

        // Marker vị trí Owner (Bạn)
        const userEl = document.createElement('div')
        userEl.className = 'custom-user-pin'
        userEl.innerHTML = `
            <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                <div style="position: absolute; width: 32px; height: 32px; background: rgba(16, 185, 129, 0.35); border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                <div style="position: absolute; width: 22px; height: 22px; background: rgba(16, 185, 129, 0.6); border-radius: 50%;"></div>
                <div style="position: relative; width: 12px; height: 12px; background: #10b981; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 0 12px #10b981;"></div>
            </div>
        `

        const userMarker = new maplibregl.Marker({ element: userEl })
            .setLngLat([userLng, userLat])
            .setPopup(
                new maplibregl.Popup({ offset: 25 }).setHTML(`
                    <div style="font-family: -apple-system, sans-serif; font-size: 12px; color: #f4f4f5; padding: 4px;">
                        <strong style="color: #10b981; font-size: 13px;">Vị Trí Của Bạn (Owner)</strong><br/>
                        <span>${userLocation.name}</span><br/>
                        <span style="font-family: monospace; font-size: 10px; color: #a1a1aa;">${userLat.toFixed(4)}, ${userLng.toFixed(4)}</span>
                    </div>
                `)
            )
            .addTo(map)

        markersRef.current.push(userMarker)

        // Markers cho các máy Seller
        nodeLocations.forEach((node) => {
            const isSelected = selectedNodeId === (node.id || node.nodeId)
            const isOnline = node.status === 'ONLINE'
            const pinColor = isSelected ? '#38bdf8' : isOnline ? '#0284c7' : '#71717a'

            const nodeEl = document.createElement('div')
            nodeEl.className = 'custom-seller-pin'
            nodeEl.innerHTML = `
                <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                    <div style="position: absolute; width: 36px; height: 36px; background: ${pinColor}40; border-radius: 50%; animation: ping 2.2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                    <div style="position: absolute; width: 24px; height: 24px; background: ${pinColor}80; border-radius: 50%;"></div>
                    <div style="position: relative; width: 14px; height: 14px; background: ${pinColor}; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 0 12px ${pinColor};"></div>
                </div>
            `

            const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
                <div style="font-family: -apple-system, sans-serif; font-size: 12px; color: #f4f4f5; padding: 4px; min-width: 190px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                        <strong style="color: ${pinColor}; font-size: 13px;">${node.nodeName}</strong>
                        <span style="font-size: 9px; padding: 2px 6px; border-radius: 4px; background: rgba(2, 132, 199, 0.2); color: ${pinColor}; font-weight: bold;">
                            ${node.status}
                        </span>
                    </div>
                    <div style="color: #a1a1aa; font-size: 11px; margin-bottom: 2px;">
                        <strong>Mô hình:</strong> ${node.modelDisplayName}
                    </div>
                    <div style="color: #a1a1aa; font-size: 11px; margin-bottom: 2px;">
                        <strong>Phần cứng:</strong> ${node.gpuName || 'CPU'} (${node.cpuCores} Cores, ${node.ramGB}GB RAM)
                    </div>
                    <div style="color: #38bdf8; font-size: 11px; margin-bottom: 4px;">
                        <strong>Khoảng cách:</strong> ${node.distanceKm !== undefined ? `${node.distanceKm} km` : 'Gần bạn'} &bull; Giá: ${node.coinsPerHour || node.pricing?.coinsPerHour || 30} Coins/h
                    </div>
                    <button id="rent-btn-${node.id || node.nodeId}" style="width: 100%; padding: 5px 8px; background: #2563eb; color: #ffffff; border: none; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer; transition: background 0.15s;">
                        Thuê Ngay Máy Trạm Này
                    </button>
                </div>
            `)

            const marker = new maplibregl.Marker({ element: nodeEl })
                .setLngLat([node.computedLng, node.computedLat])
                .setPopup(popup)
                .addTo(map)

            popup.on('open', () => {
                const btn = document.getElementById(`rent-btn-${node.id || node.nodeId}`)
                if (btn) {
                    btn.onclick = () => {
                        if (onRentNode) onRentNode(node)
                    }
                }
            })

            nodeEl.onclick = () => {
                if (onSelectNode) onSelectNode(node.id || node.nodeId || '')
            }

            markersRef.current.push(marker)
        })
    }, [maplibregl, userLat, userLng, userLocation.name, nodeLocations, selectedNodeId])

    // 4. Chuyển đổi góc nghiêng Camera 3D (Pitch 60° ⇄ 0°)
    const handleToggle3D = () => {
        const map = mapInstanceRef.current
        if (!map) return
        const next3D = !is3DMode
        setIs3DMode(next3D)
        map.easeTo({
            pitch: next3D ? 60 : 0,
            bearing: next3D ? -20 : 0,
            duration: 1000,
        })
    }

    // 5. Tính năng tự động xoay Camera 3D quanh thành phố (Auto Orbit)
    const handleToggleAutoRotate = () => {
        const map = mapInstanceRef.current
        if (!map) return

        if (isAutoRotating) {
            isRotatingRef.current = false
            setIsAutoRotating(false)
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        } else {
            isRotatingRef.current = true
            setIsAutoRotating(true)

            const rotateStep = () => {
                if (!isRotatingRef.current || !mapInstanceRef.current) return
                const currentBearing = mapInstanceRef.current.getBearing()
                mapInstanceRef.current.setBearing(currentBearing + 0.3)
                animFrameRef.current = requestAnimationFrame(rotateStep)
            }
            animFrameRef.current = requestAnimationFrame(rotateStep)
        }
    }

    // 6. Căn giữa về vị trí của Bạn
    const handleFlyToUser = () => {
        const map = mapInstanceRef.current
        if (!map) return
        map.flyTo({
            center: [userLng, userLat],
            zoom: 15.6,
            pitch: is3DMode ? 60 : 0,
            bearing: -20,
            duration: 1500,
        })
    }

    // 7. Xem toàn cảnh các máy tính đối tác
    const handleFlyToOverview = () => {
        const map = mapInstanceRef.current
        if (!map) return
        map.flyTo({
            center: [106.0, 16.0],
            zoom: 5.8,
            pitch: 40,
            bearing: 0,
            duration: 2000,
        })
    }

    return (
        <div className="w-full flex flex-col bg-[#141416] border border-border rounded-2xl overflow-hidden shadow-xl">
            {/* Header Toolbar */}
            <div className="px-4 py-3 bg-[#18181c] border-b border-border/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                        <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-foreground text-xs tracking-wide">
                                Bản Đồ Không Gian 3D MapLibre &middot; Tòa Nhà &amp; Máy Trạm AI
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                                3D Extrusion Engine
                            </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Trực quan hóa độ cao tòa nhà, định tuyến khoảng cách thực tế và gán model trực tiếp vào Agent.
                        </p>
                    </div>
                </div>

                {/* Các nút điều khiển góc quay 3D */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                    <button
                        type="button"
                        onClick={handleToggle3D}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 ${
                            is3DMode
                                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                                : 'bg-secondary text-foreground border-border hover:bg-secondary/80'
                        }`}
                        title="Bật / Tắt góc nhìn nghiêng 3D"
                    >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{is3DMode ? '3D Tilted (60°)' : '2D Mặt Phẳng'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleToggleAutoRotate}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition flex items-center gap-1.5 ${
                            isAutoRotating
                                ? 'bg-amber-600 text-white border-amber-500 animate-pulse'
                                : 'bg-secondary text-foreground border-border hover:bg-secondary/80'
                        }`}
                        title="Tự động quay camera 360 độ quanh thành phố"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{isAutoRotating ? 'Dừng Xoay' : 'Xoay 3D'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleFlyToUser}
                        className="px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border border-border font-semibold transition flex items-center gap-1.5"
                        title="Bay tới vị trí của bạn"
                    >
                        <Crosshair className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Vị Trí Của Bạn</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleFlyToOverview}
                        className="px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border border-border font-semibold transition flex items-center gap-1.5"
                        title="Xem toàn cảnh toàn quốc"
                    >
                        <Compass className="w-3.5 h-3.5 text-blue-500" />
                        <span>Toàn Cảnh</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setMapTheme(mapTheme === 'dark' ? 'satellite' : 'dark')}
                        className="px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border border-border font-semibold transition flex items-center gap-1.5"
                        title="Đổi kiểu bản đồ tối hoặc vệ tinh"
                    >
                        <Layers className="w-3.5 h-3.5 text-purple-400" />
                        <span>{mapTheme === 'dark' ? 'Dark Map' : 'Vệ Tinh'}</span>
                    </button>
                </div>
            </div>

            {/* Container MapLibre 3D */}
            <div className="relative w-full h-[460px] bg-[#090b10]">
                <div ref={mapContainerRef} className="w-full h-full" />

                {/* Floating HUD: Chú giải & Độ trễ */}
                <div className="absolute bottom-4 left-4 z-10 bg-[#141416]/95 backdrop-blur-md border border-border rounded-xl p-3 text-[11px] font-mono text-zinc-300 space-y-1.5 shadow-2xl max-w-xs pointer-events-auto">
                    <div className="font-bold text-foreground text-xs border-b border-border/80 pb-1 flex items-center justify-between">
                        <span>Hệ Thống Tòa Nhà &amp; Node AI</span>
                        <span className="text-[10px] text-blue-400 font-bold">MapLibre GL</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#0284c7] shrink-0 shadow-[0_0_8px_#0284c7]" />
                        <span>Tháp AI Datacenter (Seller Compute Hub)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#10b981] shrink-0 shadow-[0_0_8px_#10b981]" />
                        <span>Khu Vực Máy Của Bạn (Owner Node)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#1e293b] shrink-0" />
                        <span>Tòa Nhà Văn Phòng &amp; Tech Park</span>
                    </div>
                    <div className="pt-1 border-t border-border/80 text-[10px] text-muted-foreground flex items-center justify-between">
                        <span>Độ trễ nội vùng: &lt; 15ms</span>
                        <span>{nodeLocations.length} Node trực tuyến</span>
                    </div>
                </div>

                {/* Card thông tin tòa nhà khi click */}
                {activeBuildingInfo && (
                    <div className="absolute top-4 right-4 z-10 bg-[#141416]/95 backdrop-blur-md border border-blue-500/40 rounded-xl p-3 text-xs text-foreground shadow-2xl max-w-xs animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-border/80 pb-1.5 mb-1.5">
                            <span className="font-bold text-blue-400 flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5" />
                                <span>{activeBuildingInfo.name}</span>
                            </span>
                            <button
                                type="button"
                                onClick={() => setActiveBuildingInfo(null)}
                                className="text-muted-foreground hover:text-foreground text-[10px]"
                            >
                                Đóng
                            </button>
                        </div>
                        <div className="space-y-1 text-[11px] text-muted-foreground">
                            <div>Độ cao kiến trúc: <strong className="text-foreground">{activeBuildingInfo.height}m</strong></div>
                            <div>
                                Loại công trình: <strong className="text-foreground">{activeBuildingInfo.isNodeHub ? 'Trạm Điện Toán AI Local' : 'Công Trình Đô Thị'}</strong>
                            </div>
                            {activeBuildingInfo.isNodeHub && (
                                <p className="text-[10px] text-emerald-400 mt-1">
                                    Trang bị hệ thống GPU chuyên dụng và đường truyền tốc độ cao phục vụ Agent.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
