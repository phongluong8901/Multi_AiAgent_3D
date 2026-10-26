'use client'

import React, { useState, useMemo } from 'react'

export interface ChartDataset {
    label: string
    data: number[]
    borderColor?: string
    backgroundColor?: string
}

export interface ChartConfig {
    title: string
    chart_type?: 'line' | 'bar' | 'pie' | 'doughnut' | 'area'
    unit?: string
    labels: string[]
    datasets: ChartDataset[]
    summary?: string
}

interface InteractiveChartRendererProps {
    config: ChartConfig
}

export default function InteractiveChartRenderer({ config }: InteractiveChartRendererProps) {
    const {
        title,
        chart_type = 'line',
        unit = '',
        labels = [],
        datasets = [],
        summary = '',
    } = config

    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    const [activeDatasetIndex, setActiveDatasetIndex] = useState<number | null>(null)

    // Tính toán min / max của toàn bộ số liệu
    const allValues = useMemo(() => {
        const vals: number[] = []
        datasets.forEach((ds) => {
            ds.data.forEach((v) => {
                if (typeof v === 'number' && !isNaN(v)) vals.push(v)
            })
        })
        return vals.length > 0 ? vals : [0]
    }, [datasets])

    const rawMin = Math.min(...allValues)
    const rawMax = Math.max(...allValues)
    const range = rawMax - rawMin === 0 ? 1 : rawMax - rawMin
    const paddingVal = range * 0.12
    const yMin = Math.max(0, Math.floor(rawMin - paddingVal))
    const yMax = Math.ceil(rawMax + paddingVal)

    // SVG Layout Dimensions
    const svgWidth = 560
    const svgHeight = 220
    const margin = { top: 25, right: 30, bottom: 40, left: 55 }
    const plotWidth = svgWidth - margin.left - margin.right
    const plotHeight = svgHeight - margin.top - margin.bottom

    const numPoints = labels.length > 0 ? labels.length : 1
    const xStep = numPoints > 1 ? plotWidth / (numPoints - 1) : plotWidth / 2

    // Helper tính tọa độ X, Y
    const getX = (index: number) => {
        if (numPoints === 1) return margin.left + plotWidth / 2
        return margin.left + index * xStep
    }

    const getY = (val: number) => {
        const ratio = (val - yMin) / (yMax - yMin)
        return margin.top + plotHeight - ratio * plotHeight
    }

    // Màu sắc mặc định
    const defaultColors = ['#eab308', '#38bdf8', '#10b981', '#ec4899', '#a855f7', '#f97316']

    return (
        <div className="my-3 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/90 shadow-2xl backdrop-blur transition-all duration-300 hover:border-zinc-700">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 bg-zinc-900/60 px-4 py-3">
                <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                    </span>
                    <div>
                        <h4 className="text-xs font-bold tracking-wide text-zinc-100">{title}</h4>
                        {unit && <span className="text-[10px] font-mono text-zinc-400">Đơn vị: {unit}</span>}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="rounded-md border border-zinc-700/80 bg-zinc-900 px-2 py-0.5 text-[10px] font-mono uppercase text-zinc-300">
                        {chart_type} chart
                    </span>
                </div>
            </div>

            {/* SVG Chart Canvas */}
            <div className="relative p-2">
                <svg
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="w-full h-auto overflow-visible select-none"
                >
                    <defs>
                        {datasets.map((ds, idx) => {
                            const color = ds.borderColor || defaultColors[idx % defaultColors.length]
                            return (
                                <linearGradient
                                    key={`grad-${idx}`}
                                    id={`area-grad-${idx}`}
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                                    <stop offset="100%" stopColor={color} stopOpacity="0.0" />
                                </linearGradient>
                            )
                        })}
                    </defs>

                    {/* Lưới ngang Grid lines & Trục Y labels */}
                    {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
                        const yVal = yMin + r * (yMax - yMin)
                        const yPos = margin.top + plotHeight - r * plotHeight
                        return (
                            <g key={i}>
                                <line
                                    x1={margin.left}
                                    y1={yPos}
                                    x2={margin.left + plotWidth}
                                    y2={yPos}
                                    stroke="rgba(255,255,255,0.06)"
                                    strokeDasharray="4 4"
                                />
                                <text
                                    x={margin.left - 8}
                                    y={yPos + 3}
                                    textAnchor="end"
                                    fill="#71717a"
                                    fontSize="9"
                                    fontFamily="monospace"
                                >
                                    {yVal >= 1000 ? `${(yVal / 1000).toFixed(1)}k` : yVal.toFixed(yVal % 1 === 0 ? 0 : 1)}
                                </text>
                            </g>
                        )
                    })}

                    {/* Dựng biểu đồ BAR */}
                    {chart_type === 'bar' && (
                        <g>
                            {labels.map((lbl, i) => {
                                const groupX = margin.left + (i * plotWidth) / numPoints
                                const groupWidth = plotWidth / numPoints
                                const barWidth = Math.max(8, (groupWidth * 0.7) / datasets.length)

                                return (
                                    <g key={i}>
                                        {datasets.map((ds, dsIdx) => {
                                            const val = ds.data[i] || 0
                                            const barH = ((val - yMin) / (yMax - yMin)) * plotHeight
                                            const barX = groupX + groupWidth * 0.15 + dsIdx * barWidth
                                            const barY = margin.top + plotHeight - Math.max(2, barH)
                                            const color = ds.borderColor || defaultColors[dsIdx % defaultColors.length]
                                            const isHov = hoveredIndex === i

                                            return (
                                                <rect
                                                    key={dsIdx}
                                                    x={barX}
                                                    y={barY}
                                                    width={barWidth - 2}
                                                    height={Math.max(2, barH)}
                                                    rx="3"
                                                    fill={color}
                                                    opacity={isHov ? 1 : 0.85}
                                                    className="transition-all duration-200 cursor-pointer"
                                                    onMouseEnter={() => setHoveredIndex(i)}
                                                    onMouseLeave={() => setHoveredIndex(null)}
                                                />
                                            )
                                        })}
                                    </g>
                                )
                            })}
                        </g>
                    )}

                    {/* Dựng biểu đồ LINE / AREA */}
                    {chart_type !== 'bar' &&
                        datasets.map((ds, dsIdx) => {
                            if (activeDatasetIndex !== null && activeDatasetIndex !== dsIdx) return null
                            const color = ds.borderColor || defaultColors[dsIdx % defaultColors.length]
                            const points = ds.data.map((val, i) => `${getX(i)},${getY(val)}`)
                            const pathData = `M ${points.join(' L ')}`

                            // Khu vực tô màu Gradient Area
                            const areaPoints = [
                                `${getX(0)},${margin.top + plotHeight}`,
                                ...points,
                                `${getX(ds.data.length - 1)},${margin.top + plotHeight}`,
                            ]
                            const areaPath = `M ${areaPoints.join(' L ')} Z`

                            return (
                                <g key={dsIdx}>
                                    <path d={areaPath} fill={`url(#area-grad-${dsIdx})`} />
                                    <path
                                        d={pathData}
                                        fill="none"
                                        stroke={color}
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="transition-all duration-300 drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]"
                                    />
                                    {/* Điểm nhấn (Data point dots) */}
                                    {ds.data.map((val, i) => {
                                        const cx = getX(i)
                                        const cy = getY(val)
                                        const isHov = hoveredIndex === i

                                        return (
                                            <g key={i}>
                                                <circle
                                                    cx={cx}
                                                    cy={cy}
                                                    r={isHov ? 5.5 : 3.5}
                                                    fill={isHov ? '#ffffff' : color}
                                                    stroke={color}
                                                    strokeWidth={isHov ? 3 : 1.5}
                                                    className="cursor-pointer transition-all duration-200"
                                                    onMouseEnter={() => setHoveredIndex(i)}
                                                    onMouseLeave={() => setHoveredIndex(null)}
                                                />
                                            </g>
                                        )
                                    })}
                                </g>
                            )
                        })}

                    {/* Nhãn trục X */}
                    {labels.map((lbl, i) => {
                        const x = getX(i)
                        const isHov = hoveredIndex === i
                        return (
                            <text
                                key={i}
                                x={x}
                                y={margin.top + plotHeight + 20}
                                textAnchor="middle"
                                fill={isHov ? '#f4f4f5' : '#a1a1aa'}
                                fontSize="10"
                                fontWeight={isHov ? 'bold' : 'normal'}
                                className="cursor-pointer transition-colors"
                                onMouseEnter={() => setHoveredIndex(i)}
                                onMouseLeave={() => setHoveredIndex(null)}
                            >
                                {lbl}
                            </text>
                        )
                    })}
                </svg>

                {/* Tooltip Hover Bubble */}
                {hoveredIndex !== null && labels[hoveredIndex] && (
                    <div className="pointer-events-none absolute bottom-12 left-1/2 -translate-x-1/2 rounded-xl border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-xs shadow-2xl backdrop-blur">
                        <div className="font-bold text-zinc-200 text-center mb-1">
                            {labels[hoveredIndex]}
                        </div>
                        <div className="space-y-0.5">
                            {datasets.map((ds, idx) => {
                                const val = ds.data[hoveredIndex]
                                const color = ds.borderColor || defaultColors[idx % defaultColors.length]
                                return (
                                    <div key={idx} className="flex items-center gap-2 text-[11px]">
                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                                        <span className="text-zinc-400">{ds.label}:</span>
                                        <span className="font-mono font-bold text-white">
                                            {val !== undefined ? val.toLocaleString() : '-'} {unit}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Legend & Summary Footer */}
            <div className="border-t border-zinc-800/80 bg-zinc-900/40 px-4 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    {/* Danh sách Legends */}
                    <div className="flex flex-wrap items-center gap-3">
                        {datasets.map((ds, idx) => {
                            const color = ds.borderColor || defaultColors[idx % defaultColors.length]
                            const isActive = activeDatasetIndex === null || activeDatasetIndex === idx
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() =>
                                        setActiveDatasetIndex((prev) => (prev === idx ? null : idx))
                                    }
                                    className={`flex items-center gap-1.5 transition ${isActive ? 'opacity-100 font-semibold' : 'opacity-40'}`}
                                >
                                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                                    <span className="text-zinc-300 text-[11px]">{ds.label}</span>
                                </button>
                            )
                        })}
                    </div>

                    {summary && (
                        <p className="w-full text-[11px] leading-relaxed text-amber-300/90 font-medium bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                            💡 <span className="font-bold">Đánh giá nhanh:</span> {summary}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}

/**
 * Hàm phân tích văn bản Markdown chứa ````chart_json ... ````
 * và bóc tách thành các đoạn text và các đối tượng ChartConfig.
 */
export function parseContentWithCharts(content: string): Array<{ type: 'text' | 'chart'; text?: string; chartConfig?: ChartConfig }> {
    if (!content) return [{ type: 'text', text: '' }]

    const regex = /```chart_json\s*([\s\S]*?)\s*```/g
    const segments: Array<{ type: 'text' | 'chart'; text?: string; chartConfig?: ChartConfig }> = []
    let lastIndex = 0
    let match

    while ((match = regex.exec(content)) !== null) {
        const textBefore = content.substring(lastIndex, match.index)
        if (textBefore.trim()) {
            segments.push({ type: 'text', text: textBefore })
        }

        try {
            const chartData = JSON.parse(match[1]) as ChartConfig
            segments.push({ type: 'chart', chartConfig: chartData })
        } catch {
            // Nếu parse JSON lỗi thì giữ lại text gốc
            segments.push({ type: 'text', text: match[0] })
        }

        lastIndex = regex.lastIndex
    }

    const textRemaining = content.substring(lastIndex)
    if (textRemaining.trim()) {
        segments.push({ type: 'text', text: textRemaining })
    }

    return segments.length > 0 ? segments : [{ type: 'text', text: content }]
}
