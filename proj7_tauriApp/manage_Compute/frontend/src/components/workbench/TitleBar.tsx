import React, { useState, useEffect } from 'react';
import { Cpu, Minus, Square, Copy, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function TitleBar() {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        let isMounted = true;

        // Kiểm tra trạng thái maximize ban đầu
        invoke<boolean>('app_is_maximized')
            .then((max) => {
                if (isMounted) setIsMaximized(max);
            })
            .catch(() => {
                try {
                    const appWin = getCurrentWindow();
                    appWin?.isMaximized().then((max) => {
                        if (isMounted) setIsMaximized(max);
                    }).catch(() => {});
                } catch {
                    // Ignore in web browser
                }
            });

        // Lắng nghe sự kiện thay đổi kích thước cửa sổ
        try {
            const appWin = getCurrentWindow();
            if (appWin) {
                const unlistenPromise = appWin.onResized(async () => {
                    try {
                        const max = await invoke<boolean>('app_is_maximized');
                        if (isMounted) setIsMaximized(max);
                    } catch {
                        try {
                            const max = await appWin.isMaximized();
                            if (isMounted) setIsMaximized(max);
                        } catch {
                            // Ignore
                        }
                    }
                });

                return () => {
                    isMounted = false;
                    unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
                };
            }
        } catch {
            // Ignore in web browser
        }

        return () => {
            isMounted = false;
        };
    }, []);

    const handleMinimize = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await invoke('app_minimize');
        } catch {
            try {
                const appWin = getCurrentWindow();
                await appWin.minimize();
            } catch (err) {
                console.warn('[WINDOW] Minimize fallback error:', err);
            }
        }
    };

    const handleMaximizeToggle = async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        try {
            const nextMax = await invoke<boolean>('app_toggle_maximize');
            setIsMaximized(nextMax);
        } catch {
            try {
                const appWin = getCurrentWindow();
                await appWin.toggleMaximize();
                const max = await appWin.isMaximized();
                setIsMaximized(max);
            } catch (err) {
                console.warn('[WINDOW] Toggle maximize fallback error:', err);
            }
        }
    };

    const handleClose = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await invoke('app_close');
        } catch {
            try {
                const appWin = getCurrentWindow();
                await appWin.close();
            } catch (err) {
                console.warn('[WINDOW] Close fallback error:', err);
            }
        }
    };

    return (
        <header
            className="h-9 w-full bg-zinc-950 border-b border-zinc-800/80 flex items-center justify-between px-3 select-none text-zinc-300 relative z-50 shrink-0"
        >
            {/* Vùng kéo thả bên trái: Brand Logo & Title */}
            <div
                data-tauri-drag-region
                className="flex items-center gap-2 cursor-default h-full"
            >
                <div className="w-5 h-5 rounded bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center shrink-0 pointer-events-none">
                    <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <span className="text-xs font-semibold tracking-wide text-zinc-200 pointer-events-none whitespace-nowrap">
                    Compute Studio
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/60 pointer-events-none whitespace-nowrap">
                    v0.1.0
                </span>
            </div>

            {/* Vùng kéo thả ở giữa: Tiêu đề ngữ cảnh (click đúp để phóng to/thu nhỏ) */}
            <div
                data-tauri-drag-region
                onDoubleClick={handleMaximizeToggle}
                className="flex-1 h-full flex items-center justify-center mx-4 cursor-default"
            >
                <div
                    data-tauri-drag-region
                    className="flex items-center gap-2 px-3 py-1 rounded bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 font-mono max-w-md truncate pointer-events-none"
                >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span className="truncate">manage_Compute</span>
                    <span className="text-zinc-600">/</span>
                    <span className="text-zinc-300 truncate">DAG Pipeline Workbench</span>
                </div>
            </div>

            {/* Bên phải: Cụm nút điều khiển cửa sổ chuẩn Windows Frameless */}
            <div className="flex items-center -mr-3 h-full z-50 relative shrink-0">
                <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={handleMinimize}
                    title="Minimize"
                    className="h-full w-11 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/90 transition-colors cursor-pointer"
                >
                    <Minus className="w-3.5 h-3.5 pointer-events-none" />
                </button>
                <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={handleMaximizeToggle}
                    title={isMaximized ? "Restore" : "Maximize"}
                    className="h-full w-11 flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/90 transition-colors cursor-pointer"
                >
                    {isMaximized ? (
                        <Copy className="w-3 h-3 rotate-180 pointer-events-none" />
                    ) : (
                        <Square className="w-3 h-3 pointer-events-none" />
                    )}
                </button>
                <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={handleClose}
                    title="Close"
                    className="h-full w-11 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer"
                >
                    <X className="w-4 h-4 pointer-events-none" />
                </button>
            </div>
        </header>
    );
}
