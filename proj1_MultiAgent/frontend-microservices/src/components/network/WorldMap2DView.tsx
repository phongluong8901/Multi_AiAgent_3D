'use client'

import React, { useMemo } from 'react'
import { GeoNode, GeoLink } from './Globe3DView'

export default function WorldMap2DView({
    nodes,
    links,
    selectedNodeId,
    onSelectNode,
}: {
    nodes: GeoNode[]
    links: GeoLink[]
    selectedNodeId: string | null
    onSelectNode: (id: string | null) => void
}) {
    const width = 960
    const height = 480

    // Chuyển đổi tọa độ Lat/Lng sang tọa độ X/Y trên khung phẳng Equirectangular
    const project = (lat: number, lng: number) => {
        const x = ((lng + 180) / 360) * width
        const y = ((90 - lat) / 180) * height
        return { x, y }
    }

    const projectedNodes = useMemo(() => {
        return nodes.map((n) => {
            const { x, y } = project(n.lat, n.lng)
            return { ...n, px: x, py: y }
        })
    }, [nodes])

    return (
        <div className="w-full h-full relative bg-zinc-950 overflow-hidden select-none">
            {/* Overlay thông số */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-3 bg-zinc-900/80 backdrop-blur px-3 py-1.5 rounded-xl border border-zinc-800 text-xs text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-white">2D Geospatial AI Mesh</span>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-400">{nodes.length} Nút phân tán trên toàn cầu</span>
            </div>

            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
                <defs>
                    {/* Gradient đường kết nối dữ liệu */}
                    <linearGradient id="link-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0.8" />
                    </linearGradient>

                    {/* Lưới tọa độ bản đồ phẳng */}
                    <pattern id="world-grid" width="60" height="60" patternUnits="userSpaceOnUse">
                        <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                    </pattern>
                </defs>

                {/* Nền bản đồ */}
                <rect width="100%" height="100%" fill="#090d16" />
                <rect width="100%" height="100%" fill="url(#world-grid)" />

                {/* Các lục địa giả lập công nghệ cao (Lục địa Châu Á, Âu, Mỹ, Phi, Úc) */}
                <g fill="#182234" opacity="0.45">
                    {/* Châu Á & Đông Nam Á */}
                    <path d="M 540 120 Q 660 90 760 140 T 840 220 Q 780 290 680 300 T 570 240 Z" />
                    <path d="M 680 260 Q 720 280 730 320 T 690 350 Z" />
                    {/* Châu Âu */}
                    <path d="M 440 90 Q 510 80 540 130 T 470 190 T 420 140 Z" />
                    {/* Bắc Mỹ */}
                    <path d="M 140 80 Q 260 70 300 140 T 260 250 T 160 180 Z" />
                    {/* Nam Mỹ */}
                    <path d="M 260 260 Q 320 290 310 380 T 250 440 T 230 320 Z" />
                    {/* Châu Phi */}
                    <path d="M 460 200 Q 540 210 530 320 T 470 410 T 430 260 Z" />
                    {/* Châu Úc */}
                    <path d="M 750 330 Q 840 330 840 400 T 750 410 Z" />
                </g>

                {/* Các đường liên kết (Links) */}
                {links.map((link, idx) => {
                    const fromPos = project(link.from.lat, link.from.lng)
                    const toPos = project(link.to.lat, link.to.lng)
                    const isSelected = selectedNodeId === link.from.id || selectedNodeId === link.to.id

                    // Vẽ đường cong Bezier mềm mại giữa 2 tọa độ
                    const midX = (fromPos.x + toPos.x) / 2
                    const midY = (fromPos.y + toPos.y) / 2 - 35 // võng lên phía trên

                    return (
                        <g key={idx}>
                            <path
                                d={`M ${fromPos.x} ${fromPos.y} Q ${midX} ${midY} ${toPos.x} ${toPos.y}`}
                                fill="none"
                                stroke={isSelected ? '#38bdf8' : 'url(#link-grad)'}
                                strokeWidth={isSelected ? 2 : 1.2}
                                strokeOpacity={isSelected ? 0.9 : 0.35}
                                strokeDasharray={isSelected ? '6 3' : undefined}
                                className={isSelected ? 'animate-pulse' : ''}
                            />
                        </g>
                    )
                })}

                {/* Các điểm nút (Nodes) */}
                {projectedNodes.map((n) => {
                    const isSelected = selectedNodeId === n.id
                    const color = n.status === 'BUSY' ? '#f59e0b' : n.status === 'IDLE' ? '#10b981' : '#64748b'

                    return (
                        <g
                            key={n.id}
                            transform={`translate(${n.px}, ${n.py})`}
                            onClick={() => onSelectNode(n.id)}
                            className="cursor-pointer group"
                        >
                            {/* Vòng lan tỏa tín hiệu */}
                            <circle
                                r="16"
                                fill="none"
                                stroke={color}
                                strokeWidth="1"
                                opacity="0.3"
                                className="animate-ping"
                                style={{ animationDuration: '3s' }}
                            />

                            {/* Nút chính */}
                            <circle
                                r={isSelected ? 9 : 7}
                                fill="#090d16"
                                stroke={color}
                                strokeWidth="2.5"
                                className="transition-all"
                            />

                            {/* Chấm tâm */}
                            <circle r="3" fill={color} />

                            {/* Tên thành phố & Quốc gia */}
                            <text
                                textAnchor="middle"
                                y="20"
                                fontSize="10"
                                fontWeight="bold"
                                fill={isSelected ? '#38bdf8' : '#e2e8f0'}
                                className="font-mono transition-colors"
                            >
                                {n.city}
                            </text>
                            <text
                                textAnchor="middle"
                                y="31"
                                fontSize="8.5"
                                fill="#94a3b8"
                            >
                                {n.name}
                            </text>
                        </g>
                    )
                })}
            </svg>
        </div>
    )
}
