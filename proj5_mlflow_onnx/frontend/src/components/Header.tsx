import React from 'react';
import { Cpu, Activity } from 'lucide-react';

export const Header: React.FC = () => {
    return (
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', borderBottom: '1px solid #1e293b', paddingBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#3b82f6', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Cpu color="white" size={28} />
                </div>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, letterSpacing: '-0.5px' }}>ONNX Inference Engine</h1>
                    <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0 0' }}>High-performance Machine Learning serving via FastAPI & ONNX Runtime</p>
                </div>
            </div>
            <div style={{ background: '#1e293b', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #334155' }}>
                <Activity size={14} /> Model Status: Active (Auto-Best)
            </div>
        </header>
    );
};