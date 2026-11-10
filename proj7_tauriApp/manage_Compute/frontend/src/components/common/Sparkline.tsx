/**
 * Biểu đồ xu hướng nhỏ gọn dạng sóng (Sparkline SVG Component):
 * Vẽ đường xu hướng thời gian thực (CPU, RAM, GPU, Net) kèm vùng chuyển sắc gradient
 * và chấm tròn nhấp nháy phát sáng tại điểm dữ liệu mới nhất.
 */

import { useId } from 'react';

/** Bảng màu hỗ trợ cho biểu đồ sparkline */
export type SparklineColor = 'emerald' | 'blue' | 'purple' | 'amber' | 'rose' | string;

interface SparklineProps {
    /** Mảng dữ liệu chuỗi số đo lường */
    data: number[];
    /** Màu chủ đạo của biểu đồ (emerald, blue, purple, amber, rose hoặc mã hex) */
    color?: SparklineColor;
    /** Chiều cao hiển thị của biểu đồ tính bằng pixel */
    height?: number;
    /** Lớp tùy biến giao diện CSS Tailwind */
    className?: string;
    /** Giá trị trần tối đa dự kiến của thang đo (mặc định 100) */
    max?: number;
}

// Bảng ánh xạ màu sắc nét vẽ, dải dải gradient và chấm tròn
const colorMap: Record<string, { stroke: string; fillStart: string; dot: string }> = {
    emerald: {
        stroke: '#10b981',
        fillStart: '#10b981',
        dot: '#34d399',
    },
    blue: {
        stroke: '#3b82f6',
        fillStart: '#3b82f6',
        dot: '#60a5fa',
    },
    purple: {
        stroke: '#a855f7',
        fillStart: '#a855f7',
        dot: '#c084fc',
    },
    amber: {
        stroke: '#f59e0b',
        fillStart: '#f59e0b',
        dot: '#fbbf24',
    },
    rose: {
        stroke: '#f43f5e',
        fillStart: '#f43f5e',
        dot: '#fb7185',
    },
};

export function Sparkline({
    data,
    color = 'emerald',
    height = 36,
    className = '',
    max = 100,
}: SparklineProps) {
    const id = useId();
    const config = colorMap[color] || {
        stroke: color,
        fillStart: color,
        dot: color,
    };

    // Nếu không có đủ 2 điểm dữ liệu, hiển thị placeholder rỗng
    if (!data || data.length < 2) {
        return <div style={{ height }} className="w-full bg-zinc-900/40 rounded" />;
    }

    const effectiveMax = Math.max(max, ...data, 1);
    const width = 100; // Tọa độ tương đối của SVG viewBox (0 đến 100)
    const step = width / (data.length - 1);

    // Tính toán tọa độ (x, y) chuẩn hóa cho từng điểm đo
    const points = data.map((val, idx) => {
        const x = idx * step;
        const normalized = Math.min(Math.max(val / effectiveMax, 0), 1);
        const y = height - normalized * (height - 6) - 3;
        return { x, y };
    });

    // Tạo đường SVG Path cho nét vẽ xu hướng
    const linePath = points.reduce((acc, pt, i) => {
        return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');

    // Tạo vùng khép kín cho dải chuyển sắc gradient dưới đáy
    const areaPath = `${linePath} L 100 ${height} L 0 ${height} Z`;

    const lastPoint = points[points.length - 1];

    return (
        <svg
            viewBox={`0 0 100 ${height}`}
            preserveAspectRatio="none"
            className={`w-full overflow-visible ${className}`}
            style={{ height }}
        >
            <defs>
                <linearGradient id={`spark-grad-${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={config.fillStart} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={config.fillStart} stopOpacity="0.0" />
                </linearGradient>
            </defs>

            {/* Vùng bóng mờ gradient chuyển sắc */}
            <path d={areaPath} fill={`url(#spark-grad-${id})`} />

            {/* Đường nét chính biểu diễn xu hướng */}
            <path
                d={linePath}
                fill="none"
                stroke={config.stroke}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Chấm tròn nhấp nháy phát sáng tại điểm đo mới nhất */}
            {lastPoint && (
                <circle
                    cx={lastPoint.x}
                    cy={lastPoint.y}
                    r="2.5"
                    fill={config.dot}
                    className="animate-pulse"
                />
            )}
        </svg>
    );
}
