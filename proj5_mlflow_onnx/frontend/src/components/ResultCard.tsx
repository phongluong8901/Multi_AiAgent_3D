import React from 'react';
import { BarChart3, Activity, CheckCircle2 } from 'lucide-react';
import type { PredictionResponse } from '../types';


interface ResultCardProps {
    result: PredictionResponse | null;
    loading: boolean;
    error: string | null;
}

export const ResultCard: React.FC<ResultCardProps> = ({ result, loading, error }) => {
    return (
        <div style={{ background: '#1e293b', padding: '24px', borderRadius: '16px', border: '1px solid #334155', minHeight: '340px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <div>
                <h2 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BarChart3 size={18} color="#34d399" /> Kết quả suy luận (Inference Output)
                </h2>

                {error && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px', borderRadius: '8px', fontSize: '13px', marginTop: '12px' }}>
                        {error}
                    </div>
                )}

                {!result && !error && !loading && (
                    <div style={{ textAlign: 'center', color: '#64748b', marginTop: '60px' }}>
                        <Activity size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                        <p style={{ fontSize: '14px', margin: 0 }}>Chưa có dữ liệu dự đoán.<br />Hãy nhập thông số và bấm nút thực hiện.</p>
                    </div>
                )}

                {loading && (
                    <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '70px' }}>
                        <p style={{ fontSize: '14px' }}>Đang xử lý mô hình qua ONNX Runtime...</p>
                    </div>
                )}

                {result && !loading && (
                    <div style={{ marginTop: '16px' }}>
                        <div style={{ background: '#0f172a', padding: '14px 16px', borderRadius: '10px', marginBottom: '12px', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                            <div style={{ minWidth: 0 }}>
                                <span style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>MLflow model</span>
                                <div style={{ color: '#f8fafc', fontSize: '14px', fontWeight: '600', marginTop: '4px', overflowWrap: 'anywhere' }}>{result.model_name}</div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <span style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Accuracy</span>
                                <div style={{ color: '#34d399', fontSize: '18px', fontWeight: '700', marginTop: '4px' }}>{(result.accuracy * 100).toFixed(2)}%</div>
                            </div>
                        </div>

                        <div style={{ background: '#0f172a', padding: '16px', borderRadius: '10px', marginBottom: '12px', border: '1px solid #334155' }}>
                            <span style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Xác suất dự đoán (Probability)</span>
                            <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#38bdf8', marginTop: '4px' }}>
                                {(result.probability * 100).toFixed(2)}%
                            </div>
                            <div style={{ width: '100%', background: '#334155', height: '6px', borderRadius: '3px', marginTop: '10px', overflow: 'hidden' }}>
                                <div style={{ width: `${result.probability * 100}%`, background: '#38bdf8', height: '100%', transition: 'width 0.5s ease' }}></div>
                            </div>
                        </div>

                        <div style={{ background: '#0f172a', padding: '16px', borderRadius: '10px', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <span style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phân loại (Predicted Class)</span>
                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#34d399', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <CheckCircle2 size={18} /> Class {result.class}
                                </div>
                            </div>
                            <div style={{ background: result.class === 1 ? 'rgba(52, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: result.class === 1 ? '#34d399' : '#f87171', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
                                {result.class === 1 ? 'Positive' : 'Negative'}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ borderTop: '1px solid #334155', paddingTop: '12px', fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                <span>Engine: ONNX Runtime</span>
                <span>FastAPI Backend</span>
            </div>
        </div>
    );
};