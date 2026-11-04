import { useId } from 'react';

export type SparklineColor = 'emerald' | 'blue' | 'purple' | 'amber' | 'rose' | string;

interface SparklineProps {
    data: number[];
    color?: SparklineColor;
    height?: number;
    className?: string;
    max?: number;
}

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

    if (!data || data.length < 2) {
        return <div style={{ height }} className="w-full bg-zinc-900/40 rounded" />;
    }

    const effectiveMax = Math.max(max, ...data, 1);
    const width = 100; // SVG viewBox coordinates (0 to 100)
    const step = width / (data.length - 1);

    const points = data.map((val, idx) => {
        const x = idx * step;
        const normalized = Math.min(Math.max(val / effectiveMax, 0), 1);
        const y = height - normalized * (height - 6) - 3;
        return { x, y };
    });

    const linePath = points.reduce((acc, pt, i) => {
        return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');

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

            {/* Gradient fill underneath */}
            <path d={areaPath} fill={`url(#spark-grad-${id})`} />

            {/* Main trend line */}
            <path
                d={linePath}
                fill="none"
                stroke={config.stroke}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Live pulsating dot at the latest point */}
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
