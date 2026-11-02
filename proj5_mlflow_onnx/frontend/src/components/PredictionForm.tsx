import React from 'react';
import { Layers, Send, RefreshCw } from 'lucide-react';

interface PredictionFormProps {
    features: string[];
    onChangeFeature: (index: number, value: string) => void;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    loading: boolean;
}

export const PredictionForm: React.FC<PredictionFormProps> = ({
    features,
    onChangeFeature,
    onSubmit,
    loading
}) => {
    return (
        <div style={{ background: '#1e293b', padding: '24px', borderRadius: '16px', border: '1px solid #334155', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} color="#38bdf8" /> Thông số đầu vào (Features)
            </h2>

            <form onSubmit={onSubmit}>
                {features.map((val, idx) => (
                    <div key={idx} style={{ marginBottom: '14px' }}>
                        <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px', fontWeight: '500' }}>
                            Feature #{idx + 1} <span style={{ color: '#64748b', fontWeight: 'normal' }}>(Float)</span>
                        </label>
                        <input
                            type="number"
                            step="any"
                            value={val}
                            onChange={(e) => onChangeFeature(idx, e.target.value)}
                            style={{ width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #475569', borderRadius: '8px', color: 'white', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = '#38bdf8')}
                            onBlur={(e) => (e.currentTarget.style.borderColor = '#475569')}
                        />
                    </div>
                ))}

                <button
                    type="submit"
                    disabled={loading}
                    style={{ width: '100%', marginTop: '8px', padding: '12px', background: loading ? '#475569' : '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.2s' }}
                >
                    {loading ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
                    {loading ? 'Đang tính toán suy luận...' : 'Thực hiện Inference'}
                </button>
            </form>
        </div>
    );
};