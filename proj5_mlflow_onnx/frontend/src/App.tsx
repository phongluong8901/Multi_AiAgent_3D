import React, { useState } from 'react';
import axios from 'axios';
import { Header } from './components/Header';
import { PresetButtons } from './components/PresetButtons';
import { PredictionForm } from './components/PredictionForm';
import { ResultCard } from './components/ResultCard';
import type { PredictionResponse } from './types';


export default function App() {
  const [features, setFeatures] = useState<string[]>(["0.5", "-1.2", "0.3", "0.8"]);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const presets: Record<string, string[]> = {
    "Mẫu A (Tích cực)": ["1.2", "-0.5", "0.8", "1.5"],
    "Mẫu B (Tiêu cực)": ["-1.1", "1.4", "-0.7", "-0.2"],
    "Mẫu C (Cân bằng)": ["0.0", "0.0", "0.0", "0.0"]
  };

  const handlePreset = (presetValues: string[]) => {
    setFeatures(presetValues);
    setResult(null);
  };

  const handleFeatureChange = (index: number, value: string) => {
    const newFeatures = [...features];
    newFeatures[index] = value;
    setFeatures(newFeatures);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const numericFeatures = features.map(val => parseFloat(val) || 0);

      const response = await axios.post<PredictionResponse>('http://localhost:8000/predict', {
        features: numericFeatures
      });

      setResult(response.data);
    } catch (err) {
      console.error(err);
      setError('Không thể kết nối đến FastAPI backend! Hãy kiểm tra xem server đã chạy chưa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif', padding: '40px 20px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <Header />
        <PresetButtons presets={presets} onSelectPreset={handlePreset} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
          <PredictionForm
            features={features}
            onChangeFeature={handleFeatureChange}
            onSubmit={handleSubmit}
            loading={loading}
          />
          <ResultCard
            result={result}
            loading={loading}
            error={error}
          />
        </div>
      </div>
    </div>
  );
}