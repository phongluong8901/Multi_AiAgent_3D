import { useState, useEffect, useRef } from 'react';
import type { FC } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocationInfo } from '../types';
import { RadioIcon, MapPinIcon, LayersIcon } from './Icons';

interface MapTabProps {
  location: LocationInfo | null;
}

export const MapTab: FC<MapTabProps> = ({ location }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const circlesRef = useRef<L.Circle[]>([]);
  const markerRef = useRef<L.Marker | null>(null);

  // Active range filter: 'all' | '50' | '150' | '350'
  const [activeRange, setActiveRange] = useState<'all' | '50' | '150' | '350'>('all');
  const [mapTheme, setMapTheme] = useState<'dark' | 'light' | 'satellite'>('dark');

  // Coordinates fallback if IP lookup is pending or private network
  const effectiveLat = location?.lat && location.lat !== 0 ? location.lat : 21.0285;
  const effectiveLon = location?.lon && location.lon !== 0 ? location.lon : 105.8542;
  const isDefaultCoord = !location?.lat || location.lat === 0;

  // Initialize and update Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Cleanup previous instance if exists
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [effectiveLat, effectiveLon],
      zoom: 8,
      zoomControl: false,
      attributionControl: false,
    });
    mapInstanceRef.current = map;

    // Add navigation controls at top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Completely free, reliable tile providers with NO API Key or watermark requirements
    let tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    let maxZoom = 19;
    let subdomains = 'abc';

    if (mapTheme === 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      maxZoom = 18;
      subdomains = '';
    }

    const tileLayer = L.tileLayer(tileUrl, {
      maxZoom,
      subdomains,
      attribution: '',
    });
    tileLayer.addTo(map);

    // Custom Postman Orange Pulsing Node Marker
    const customIcon = L.divIcon({
      className: 'custom-postman-node-marker',
      html: `
        <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 28px; height: 28px; background: rgba(255, 108, 55, 0.35); border-radius: 50%; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: absolute; width: 18px; height: 18px; background: rgba(255, 108, 55, 0.6); border-radius: 50%;"></div>
          <div style="position: relative; width: 10px; height: 10px; background: #ff6c37; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 0 10px rgba(255, 108, 55, 0.9);"></div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const marker = L.marker([effectiveLat, effectiveLon], { icon: customIcon }).addTo(map);
    markerRef.current = marker;

    marker.bindPopup(`
      <div style="font-family: -apple-system, sans-serif; font-size: 12px; color: #1e1e1e; padding: 4px;">
        <strong style="color: #ff6c37; font-size: 13px;">AI Compute Worker Node</strong><br/>
        <strong>Vị trí:</strong> ${location?.city || 'Hà Nội'}, ${location?.country || 'Việt Nam'}<br/>
        <strong>IP:</strong> ${location?.ip || '127.0.0.1 (Local Mesh)'}<br/>
        <strong>Tọa độ:</strong> ${effectiveLat.toFixed(4)}, ${effectiveLon.toFixed(4)}
      </div>
    `);

    // Invalidate size to ensure clean render
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [effectiveLat, effectiveLon, mapTheme]);

  // Update Range Circles when range filter changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old circles
    circlesRef.current.forEach((c) => c.remove());
    circlesRef.current = [];

    const newCircles: L.Circle[] = [];

    // Range 1: 50 km - Độ trễ < 15ms (Edge AI Low Latency)
    if (activeRange === 'all' || activeRange === '50') {
      const c1 = L.circle([effectiveLat, effectiveLon], {
        radius: 50000,
        color: '#ff6c37',
        weight: 1.5,
        fillColor: '#ff6c37',
        fillOpacity: 0.12,
      }).addTo(map);
      c1.bindTooltip('Range 1 (50 km): Cực Thấp < 15ms (Edge AI Inference)', {
        direction: 'top',
        className: 'leaflet-range-tooltip',
      });
      newCircles.push(c1);
    }

    // Range 2: 150 km - Độ trễ < 35ms (Regional Compute Cluster)
    if (activeRange === 'all' || activeRange === '150') {
      const c2 = L.circle([effectiveLat, effectiveLon], {
        radius: 150000,
        color: '#38bdf8',
        weight: 1.5,
        dashArray: '5, 5',
        fillColor: '#38bdf8',
        fillOpacity: 0.07,
      }).addTo(map);
      c2.bindTooltip('Range 2 (150 km): Nội Vùng < 35ms (P2P Cluster)', {
        direction: 'top',
        className: 'leaflet-range-tooltip',
      });
      newCircles.push(c2);
    }

    // Range 3: 350 km - Độ trễ < 75ms (Extended Buffer / Batch Queue)
    if (activeRange === 'all' || activeRange === '350') {
      const c3 = L.circle([effectiveLat, effectiveLon], {
        radius: 350000,
        color: '#a855f7',
        weight: 1.5,
        dashArray: '8, 8',
        fillColor: '#a855f7',
        fillOpacity: 0.04,
      }).addTo(map);
      c3.bindTooltip('Range 3 (350 km): Mở Rộng < 75ms (Batch Tasks)', {
        direction: 'top',
        className: 'leaflet-range-tooltip',
      });
      newCircles.push(c3);
    }

    circlesRef.current = newCircles;
  }, [activeRange, effectiveLat, effectiveLon]);

  const handleCenterNode = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([effectiveLat, effectiveLon], 8, { animate: true });
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] border border-[#303030] rounded-xl overflow-hidden shadow-lg">
      {/* 1. Postman-style Location & Range Control Toolbar */}
      <div className="px-4 py-2.5 bg-[#252525] border-b border-[#303030] flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Node Location Identity */}
        <div className="flex items-center space-x-2.5">
          <div className="w-6 h-6 rounded bg-[#ff6c37]/15 border border-[#ff6c37]/30 flex items-center justify-center text-[#ff6c37]">
            <MapPinIcon className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <strong className="text-white text-xs font-semibold">
                {location?.city ? `${location.city}, ${location.region || ''} ${location.country}` : 'Cục Bộ / Mạng Nội Bộ (Hà Nội, VN)'}
              </strong>
              {isDefaultCoord && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-[#333] text-gray-400 border border-[#444]">
                  Tọa độ mặc định
                </span>
              )}
            </div>
            <div className="flex items-center space-x-3 text-[11px] text-gray-400 font-mono mt-0.5">
              <span>IP: {location?.ip || '127.0.0.1'}</span>
              <span>•</span>
              <span>Lat: {effectiveLat.toFixed(4)} | Lon: {effectiveLon.toFixed(4)}</span>
              {location?.isp && (
                <>
                  <span>•</span>
                  <span>ISP: {location.isp}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Range Coverage Filters & Theme Toggle */}
        <div className="flex items-center space-x-2 text-[11px] font-mono">
          <span className="text-gray-400 flex items-center space-x-1">
            <RadioIcon className="w-3.5 h-3.5 text-[#ff6c37]" />
            <span>Phạm vi:</span>
          </span>

          <div className="flex items-center bg-[#1c1c1c] p-0.5 rounded-lg border border-[#383838]">
            <button
              onClick={() => setActiveRange('all')}
              className={`px-2.5 py-1 rounded transition text-[11px] ${
                activeRange === 'all'
                  ? 'bg-[#ff6c37] text-white font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setActiveRange('50')}
              className={`px-2 py-1 rounded transition text-[11px] flex items-center space-x-1 ${
                activeRange === '50'
                  ? 'bg-[#ff6c37] text-white font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff6c37]" />
              <span>50km (&lt;15ms)</span>
            </button>
            <button
              onClick={() => setActiveRange('150')}
              className={`px-2 py-1 rounded transition text-[11px] flex items-center space-x-1 ${
                activeRange === '150'
                  ? 'bg-[#38bdf8] text-white font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
              <span>150km (&lt;35ms)</span>
            </button>
            <button
              onClick={() => setActiveRange('350')}
              className={`px-2 py-1 rounded transition text-[11px] flex items-center space-x-1 ${
                activeRange === '350'
                  ? 'bg-[#a855f7] text-white font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7]" />
              <span>350km (&lt;75ms)</span>
            </button>
          </div>

          <button
            onClick={() => {
              if (mapTheme === 'dark') setMapTheme('light');
              else if (mapTheme === 'light') setMapTheme('satellite');
              else setMapTheme('dark');
            }}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-[#2d2d2d] hover:bg-[#383838] text-gray-300 hover:text-white border border-[#404040] transition"
            title="Đổi giao diện Bản đồ: Tối / Sáng / Vệ Tinh (Hoàn toàn miễn phí, không cần API Key)"
          >
            <LayersIcon className="w-3 h-3 text-[#ff6c37]" />
            <span>
              {mapTheme === 'dark' ? 'Dark Map' : mapTheme === 'light' ? 'Light Map' : 'Vệ Tinh'}
            </span>
          </button>

          <button
            onClick={handleCenterNode}
            className="px-2.5 py-1 rounded-md bg-[#2d2d2d] hover:bg-[#383838] text-gray-300 hover:text-white border border-[#404040] transition"
            title="Định vị về máy trạm hiện tại"
          >
            Tâm Node
          </button>
        </div>
      </div>

      {/* 2. Interactive Leaflet Map Container with Range Overlays */}
      <div className="flex-1 w-full relative min-h-[420px] bg-[#121212]">
        <div
          ref={mapContainerRef}
          className={`w-full h-full ${
            mapTheme === 'dark' ? 'dark-map' : mapTheme === 'satellite' ? 'satellite-map' : 'light-map'
          }`}
          style={{ minHeight: '420px' }}
        />

        {/* Legend Overlay (Floating at Bottom-Left like Postman status) */}
        <div className="absolute bottom-4 left-4 z-[500] bg-[#1e1e1e]/90 backdrop-blur-md border border-[#383838] rounded-lg p-3 text-[11px] font-mono text-gray-300 space-y-1.5 shadow-xl max-w-xs pointer-events-auto">
          <div className="font-bold text-white text-xs border-b border-[#333] pb-1 flex items-center justify-between">
            <span>Bán Kính Phủ Sóng & Độ Trễ (P2P Mesh)</span>
            <span className="text-[10px] text-[#ff6c37]">Live</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff6c37] shrink-0" />
            <span>Range 50 km: AI Inference Cực Nhanh (&lt; 15ms)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8] shrink-0" />
            <span>Range 150 km: Cụm P2P Nội Vùng (&lt; 35ms)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7] shrink-0" />
            <span>Range 350 km: Queue Huấn Luyện Mở Rộng (&lt; 75ms)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
