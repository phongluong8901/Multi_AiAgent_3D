import React from 'react';
import { Sliders } from 'lucide-react';

interface PresetButtonsProps {
    presets: Record<string, string[]>;
    onSelectPreset: (values: string[]) => void;
}

export const PresetButtons: React.FC<PresetButtonsProps> = ({ presets, onSelectPreset }) => {
    return (
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sliders size={14} /> Nạp dữ liệu nhanh:
            </span>
            {Object.entries(presets).map(([name, values], idx) => (
                <button
                    key={idx}
                    type="button"
                    onClick={() => onSelectPreset(values)}
                    style={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseOver={(e) => (e.currentTarget.style.background = '#334155')}
                    onMouseOut={(e) => (e.currentTarget.style.background = '#1e293b')}
                >
                    {name}
                </button>
            ))}
        </div>
    );
};