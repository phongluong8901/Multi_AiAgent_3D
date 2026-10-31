import { useState } from 'react';
import type { FC } from 'react';
import { TabType } from '../types';
import appIcon from '../assets/app-icon.png';
import {
  ActivityIcon,
  PlayIcon,
  PauseIcon,
  ZapIcon,
  MinimizeIcon,
  MaximizeIcon,
  CloseIcon,
  SearchIcon,
  RadioIcon,
  CpuIcon,
  SlidersIcon,
} from './Icons';

interface TitleBarProps {
  wsStatus: string;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  ipcRenderer: any;
  isWorkerRunning: boolean;
  onToggleWorker: () => void;
  onTestPing: () => void;
  pingLatency: number | null;
  isPinging: boolean;
}

export const TitleBar: FC<TitleBarProps> = ({
  wsStatus,
  activeTab,
  setActiveTab,
  ipcRenderer,
  isWorkerRunning,
  onToggleWorker,
  onTestPing,
  pingLatency,
  isPinging,
}) => {
  const [iconError, setIconError] = useState(false);
  const isWsConnected = wsStatus === 'Connected';

  const handleMinimize = () => {
    if (ipcRenderer?.send) ipcRenderer.send('window-minimize');
  };

  const handleMaximize = () => {
    if (ipcRenderer?.send) ipcRenderer.send('window-maximize');
  };

  const handleClose = () => {
    if (ipcRenderer?.send) ipcRenderer.send('window-close');
  };

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'overview', label: 'Tổng Quan', icon: ActivityIcon },
    { id: 'map', label: 'Bản Đồ & Range', icon: RadioIcon },
    { id: 'detail', label: 'Chi Tiết Phần Cứng', icon: CpuIcon },
    { id: 'config', label: 'Cấu Hình & Token', icon: SlidersIcon },
  ];

  return (
    <div className="flex flex-col select-none bg-[#1e1e1e] border-b border-[#2d2d2d] shadow-sm z-50">
      {/* ========================================================
          TIER 1: POSTMAN-STYLE TOP TITLEBAR (AIRY, CLEAN, DRAGGABLE)
          ======================================================== */}
      <div className="h-9 px-3 flex items-center justify-between app-drag border-b border-[#262626]">
        {/* Left: App Brand & Workspace Breadcrumb */}
        <div className="flex items-center space-x-2.5 no-drag">
          {/* Hardware Worker Golden Lightning App Icon */}
          <div className="w-5 h-5 rounded flex items-center justify-center shadow-sm overflow-hidden bg-amber-500/10 border border-amber-500/30 flex-shrink-0">
            {!iconError ? (
              <img
                src={appIcon}
                alt="Hardware Worker Icon"
                className="w-4 h-4 object-contain select-none"
                onError={() => setIconError(true)}
              />
            ) : (
              <ZapIcon className="w-3.5 h-3.5 text-amber-400" />
            )}
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="font-bold text-white tracking-wide">
              HARDWARE WORKER
            </span>
            <span className="text-gray-500 font-mono text-[11px]">/</span>
            <span className="text-gray-400 font-medium text-[11px]">
              My Workspace
            </span>
          </div>
        </div>

        {/* Center: Postman Omni-Search / Node Status Indicator with plenty of drag space */}
        <div className="flex-1 flex justify-center px-4">
          <div className="flex items-center space-x-2 px-3 py-1 rounded bg-[#252525] hover:bg-[#2b2b2b] border border-[#333] text-[11px] text-gray-300 w-64 max-w-sm transition no-drag cursor-pointer">
            <SearchIcon className="w-3 h-3 text-gray-500" />
            <span className="text-gray-400 truncate">Node: local_seller_mesh</span>
            <span className="ml-auto text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#333] text-gray-400 border border-[#444]">
              P2P
            </span>
          </div>
        </div>

        {/* Right: Status Pills & Window Controls */}
        <div className="flex items-center space-x-2 no-drag">
          {/* Worker Daemon Status Pill */}
          <div
            className={`flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${
              isWorkerRunning
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                : 'bg-rose-950/60 text-rose-400 border-rose-800/60'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isWorkerRunning ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            <span>{isWorkerRunning ? 'Worker Live' : 'Stopped'}</span>
          </div>

          {/* WebSocket Status Pill */}
          <div
            className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${
              isWsConnected
                ? 'bg-sky-950/60 text-sky-400 border-sky-800/60'
                : 'bg-amber-950/60 text-amber-400 border-amber-800/60'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isWsConnected ? 'bg-sky-400' : 'bg-amber-400'}`} />
            <span>{isWsConnected ? 'Connected' : 'Offline'}</span>
          </div>

          <div className="h-3.5 w-[1px] bg-[#333] mx-1" />

          {/* Window Control Buttons */}
          <div className="flex items-center space-x-0.5">
            <button
              onClick={handleMinimize}
              className="w-7 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-[#333] transition"
              title="Thu nhỏ"
            >
              <MinimizeIcon className="w-3 h-3" />
            </button>
            <button
              onClick={handleMaximize}
              className="w-7 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-[#333] transition"
              title="Phóng to"
            >
              <MaximizeIcon className="w-3 h-3" />
            </button>
            <button
              onClick={handleClose}
              className="w-7 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-rose-600 transition"
              title="Đóng"
            >
              <CloseIcon className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          TIER 2: POSTMAN WORKSPACE NAVIGATION TABS & ACTION TOOLBAR
          ======================================================== */}
      <div className="h-10 px-3 bg-[#181818] flex items-center justify-between no-drag">
        {/* Navigation Tabs (Postman Tab Style with Orange Accent) */}
        <div className="flex items-center space-x-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded transition ${
                  isActive
                    ? 'bg-[#262626] text-white border-b-2 border-[#ff6c37] font-semibold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#202020]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#ff6c37]' : 'text-gray-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Action Toolbar: Test Ping & Postman Send-style Primary Button */}
        <div className="flex items-center space-x-2">
          {/* Test Ping Action */}
          <button
            onClick={onTestPing}
            disabled={isPinging}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-[#242424] hover:bg-[#2d2d2d] text-gray-300 hover:text-white border border-[#383838] text-[11px] font-mono transition"
            title="Đo độ trễ mạng tới Distributed Server"
          >
            <ZapIcon className={`w-3 h-3 text-[#38bdf8] ${isPinging ? 'animate-spin' : ''}`} />
            <span>
              {isPinging ? 'Ping...' : pingLatency !== null ? `${pingLatency}ms` : 'Ping'}
            </span>
          </button>

          {/* Postman-style Primary Action Button (Vibrant Orange / Emerald) */}
          <button
            onClick={onToggleWorker}
            className={`flex items-center space-x-1.5 px-3.5 py-1 rounded text-xs font-bold transition shadow-sm active:scale-95 ${
              isWorkerRunning
                ? 'bg-[#33221b] hover:bg-[#442c22] text-[#ff7a45] border border-[#ff6c37]/50'
                : 'bg-[#ff6c37] hover:bg-[#ff5722] text-white'
            }`}
          >
            {isWorkerRunning ? (
              <>
                <PauseIcon className="w-3 h-3 fill-current" />
                <span>Tạm Dừng Chia Sẻ</span>
              </>
            ) : (
              <>
                <PlayIcon className="w-3 h-3 fill-current" />
                <span>Bật Kết Nối Ngay</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
