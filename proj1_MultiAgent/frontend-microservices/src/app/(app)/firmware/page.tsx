'use client'

import React, { useState, useRef, useEffect } from 'react'
import ESP32RobotCanvas from '@/components/firmware/ESP32RobotCanvas'
import { firmwareApi, BoardInfo, RobotAction } from '@/lib/api/firmware'
import { notify } from '@/lib/toast'
import {
    IconCpu,
    IconPlay,
    IconRotateCcw,
    IconTerminal,
    IconCode,
    IconDownload,
    IconSparkles,
    IconSend,
    IconWifi,
    IconPlus,
    IconTrash,
    IconCheck,
    IconLayers,
    IconZap,
} from '@/components/ui/icons'

// Code logic mặc định cho ESP32 Robot Simulator
const DEFAULT_LOGIC_CODE = `// ⚡ ESP32 ROBOT VIRTUAL LOGIC (JavaScript Runner)
// Bạn có thể sửa trực tiếp logic này và bấm "Nạp vào Robot 3D" để test ngay!

function onCommand(cmd, val) {
    if (cmd === 'FORWARD') {
        robot.move(val || 1.0, { speed: 80, led: '#10b981' });
    } else if (cmd === 'BACKWARD') {
        robot.move(-(val || 1.0), { speed: 60, led: '#f43f5e' });
    } else if (cmd === 'ROTATE_360') {
        robot.rotate(360, { led: '#eab308' });
        robot.log('[EVENT] Xoay 360 độ ăn mừng hoàn tất!');
    } else if (cmd === 'TURN_LEFT') {
        robot.rotate(-(val || 90), { led: '#3b82f6' });
    } else if (cmd === 'TURN_RIGHT') {
        robot.rotate(val || 90, { led: '#3b82f6' });
    } else if (cmd === 'STOP') {
        robot.stop();
        robot.led('#64748b');
    }
}

// Hàm phản xạ khi cảm biến siêu âm phát hiện chướng ngại vật
function onObstacleDetected(distanceCm) {
    if (distanceCm < 45) {
        robot.log('[SONAR] Cảnh báo: Vật cản ở ' + distanceCm + 'cm! Kích hoạt né tránh.');
        robot.led('#ef4444');
        robot.stop();
        robot.rotate(90, { led: '#f59e0b' });
    }
}`

export default function FirmwarePage() {
    // ─── ROBOT SIMULATION STATE ───────────────────────────────────────
    const [robotState, setRobotState] = useState({
        x: 0,
        z: 0,
        rotation: 0,
        isMoving: false,
        speed: 80,
        ledColor: '#10b981', // xanh lục
        obstacleDistance: 150,
    })

    // Danh sách chướng ngại vật mặc định [x, y, z]
    const [obstacles, setObstacles] = useState<[number, number, number][]>([
        [0, 0, 3],
        [-2.5, 0, 1.5],
        [2.5, 0, 2],
    ])

    // Tabs trong Studio: 'logic' | 'command' | 'export' | 'serial'
    const [activeTab, setActiveTab] = useState<'logic' | 'command' | 'export' | 'serial'>('command')

    // Code Logic trong editor
    const [logicCode, setLogicCode] = useState(DEFAULT_LOGIC_CODE)
    const [isFlashing, setIsFlashing] = useState(false)
    const [flashProgress, setFlashProgress] = useState(0)

    // Lệnh tự nhiên
    const [userPrompt, setUserPrompt] = useState('')
    const [isExecutingPrompt, setIsExecutingPrompt] = useState(false)
    const [lastThought, setLastThought] = useState('')
    const [lastReply, setLastReply] = useState('')

    // Serial logs
    const [serialLogs, setSerialLogs] = useState<string[]>([
        `[00:00:01] [ESP32_CORE] Khởi động hệ điều hành FreeRTOS trên ESP32...`,
        `[00:00:02] [SONAR_HCSR04] Khởi tạo chân TRIG=5, ECHO=17. Đo khoảng cách: 150cm`,
        `[00:00:02] [MOTOR_PWM] Khởi tạo PWM 20kHz cho Driver động cơ L298N (Pins 18, 19, 22, 23)`,
        `[00:00:03] [WS_CLIENT] Đã kết nối Agent Gateway ws://localhost:4000/ws/agent (Agent: Embodied_Robot)`,
        `[00:00:03] [SYSTEM] Sẵn sàng nhận lệnh điều khiển 3D!`,
    ])

    // Cấu hình xuất Firmware thật
    const [wifiSsid, setWifiSsid] = useState('MyHome_WiFi')
    const [wifiPass, setWifiPass] = useState('password123')
    const [gatewayUrl, setGatewayUrl] = useState('ws://192.168.1.100:4000/ws/agent')
    const [exportedCode, setExportedCode] = useState('')
    const [isExporting, setIsExporting] = useState(false)

    // Ghi log vào Serial Monitor
    const addSerialLog = (text: string) => {
        const time = new Date().toLocaleTimeString()
        setSerialLogs((prev) => [...prev.slice(-80), `[${time}] ${text}`])
    }

    // Cập nhật khoảng cách đo được từ Canvas
    const handleDistanceUpdate = (dist: number) => {
        setRobotState((prev) => {
            if (prev.obstacleDistance === dist) return prev
            // Kích hoạt logic né tránh nếu vật cản gần
            if (dist < 40 && prev.isMoving) {
                addSerialLog(`[SONAR_TRIGGER] Phát hiện chướng ngại vật cách ${dist}cm! Tự động phanh.`)
                return {
                    ...prev,
                    obstacleDistance: dist,
                    isMoving: false,
                    ledColor: '#ef4444',
                }
            }
            return { ...prev, obstacleDistance: dist }
        })
    }

    // ─── THỰC THI CÁC ĐỘNG TÁC ROBOT TRỰC QUAN ────────────────────────
    const executeAction = (action: string, val: number = 1.0) => {
        addSerialLog(`[ACTION_EXEC] ${action} (value=${val})`)

        if (action === 'FORWARD') {
            const distance = val
            setRobotState((prev) => {
                const nextZ = prev.z + Math.cos(prev.rotation) * distance
                const nextX = prev.x + Math.sin(prev.rotation) * distance
                return {
                    ...prev,
                    x: nextX,
                    z: nextZ,
                    isMoving: true,
                    ledColor: '#10b981',
                }
            })
            setTimeout(() => {
                setRobotState((prev) => ({ ...prev, isMoving: false }))
            }, 600)
        } else if (action === 'BACKWARD') {
            const distance = val
            setRobotState((prev) => {
                const nextZ = prev.z - Math.cos(prev.rotation) * distance
                const nextX = prev.x - Math.sin(prev.rotation) * distance
                return {
                    ...prev,
                    x: nextX,
                    z: nextZ,
                    isMoving: true,
                    ledColor: '#f43f5e',
                }
            })
            setTimeout(() => {
                setRobotState((prev) => ({ ...prev, isMoving: false }))
            }, 600)
        } else if (action === 'ROTATE_360') {
            addSerialLog(`[PWM] Xoay tròn 360 độ (Motor L: +255, Motor R: -255)`)
            setRobotState((prev) => ({
                ...prev,
                rotation: prev.rotation + Math.PI * 2,
                isMoving: true,
                ledColor: '#eab308',
            }))
            setTimeout(() => {
                setRobotState((prev) => ({ ...prev, isMoving: false, ledColor: '#10b981' }))
            }, 1000)
        } else if (action === 'TURN_LEFT') {
            const rad = (val * Math.PI) / 180
            setRobotState((prev) => ({
                ...prev,
                rotation: prev.rotation - rad,
                isMoving: true,
                ledColor: '#3b82f6',
            }))
            setTimeout(() => {
                setRobotState((prev) => ({ ...prev, isMoving: false }))
            }, 500)
        } else if (action === 'TURN_RIGHT') {
            const rad = (val * Math.PI) / 180
            setRobotState((prev) => ({
                ...prev,
                rotation: prev.rotation + rad,
                isMoving: true,
                ledColor: '#3b82f6',
            }))
            setTimeout(() => {
                setRobotState((prev) => ({ ...prev, isMoving: false }))
            }, 500)
        } else if (action === 'STOP') {
            setRobotState((prev) => ({
                ...prev,
                isMoving: false,
                ledColor: '#64748b',
            }))
        } else if (action === 'SCAN') {
            addSerialLog(`[HC-SR04] Quét cảm biến khoảng cách: ${robotState.obstacleDistance}cm`)
        }
    }

    // ─── RA LỆNH TỰ NHIÊN (NATURAL LANGUAGE) ───────────────────────────
    const handleSendPrompt = async (presetPrompt?: string) => {
        const cmdText = (presetPrompt || userPrompt).trim()
        if (!cmdText) return

        setIsExecutingPrompt(true)
        addSerialLog(`[USER_CMD] "${cmdText}"`)

        try {
            // Gọi backend phân tích
            const res = await firmwareApi.simulateCommand({
                command: cmdText,
                obstacle_distance: robotState.obstacleDistance,
            })

            setLastThought(res.agent_thought)
            setLastReply(res.response_message)
            addSerialLog(`[AGENT_THOUGHT] ${res.agent_thought}`)

            // Tuần tự thực thi từng hành động
            for (let i = 0; i < res.actions.length; i++) {
                const act = res.actions[i]
                setTimeout(() => {
                    executeAction(act.type, act.value / 100) // chuyển cm sang đơn vị 3D
                }, i * 700)
            }

            if (!presetPrompt) setUserPrompt('')
            notify.success('Robot đã nhận lệnh và đang thực thi!')
        } catch (err: any) {
            console.error('Lỗi gửi lệnh robot:', err)
            // Fallback xử lý offline nếu backend bận
            if (cmdText.includes('360') || cmdText.includes('xoay tròn')) {
                executeAction('ROTATE_360')
                setLastReply('Robot đang thực hiện xoay tròn 360 độ tại chỗ!')
            } else if (cmdText.includes('trái')) {
                executeAction('TURN_LEFT', 90)
                setLastReply('Robot đang rẽ trái 90 độ.')
            } else if (cmdText.includes('phải')) {
                executeAction('TURN_RIGHT', 90)
                setLastReply('Robot đang rẽ phải 90 độ.')
            } else if (cmdText.includes('lùi')) {
                executeAction('BACKWARD', 1)
                setLastReply('Robot đang lùi lại.')
            } else {
                executeAction('FORWARD', 1)
                setLastReply('Robot đang tiến thẳng.')
            }
        } finally {
            setIsExecutingPrompt(false)
        }
    }

    // ─── NẠP LOGIC VÀO BOARD ẢO (FLASH LOGIC TO 3D ROBOT) ──────────────
    const handleFlashVirtualRobot = () => {
        setIsFlashing(true)
        setFlashProgress(10)
        addSerialLog('[FLASH_START] Đang biên dịch mã JavaScript Virtual Logic...')

        const interval = setInterval(() => {
            setFlashProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval)
                    setIsFlashing(false)
                    addSerialLog('[FLASH_SUCCESS] 100% - Đã nạp thành công logic vào Board ảo!')
                    notify.success('Đã nạp Logic mới vào Robot ESP32 3D thành công!')
                    // Đèn LED nhấp nháy tím chào mừng
                    setRobotState((r) => ({ ...r, ledColor: '#a855f7' }))
                    setTimeout(() => setRobotState((r) => ({ ...r, ledColor: '#10b981' })), 1000)
                    return 100
                }
                return prev + 30
            })
        }, 150)
    }

    // ─── XUẤT SOURCE CODE C++ THẬT (EXPORT ESP32 INO) ───────────────────
    const handleGenerateRealFirmware = async () => {
        setIsExporting(true)
        try {
            const res = await firmwareApi.generateFirmware({
                board_type: 'esp32',
                agent_id: 'esp32_embodied_robot',
                agent_name: 'ESP32_3D_Rover',
                wifi_ssid: wifiSsid,
                wifi_password: wifiPass,
                server_url: gatewayUrl,
            })
            setExportedCode(res.code)
            notify.success('Đã sinh mã nguồn ESP32 C++ thành công!')
        } catch (e: any) {
            console.error('Lỗi sinh firmware:', e)
            notify.error('Lỗi sinh firmware: ' + e.message)
        } finally {
            setIsExporting(false)
        }
    }

    // Tải file .ino về máy
    const handleDownloadIno = () => {
        if (!exportedCode) return
        const blob = new Blob([exportedCode], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'esp32_agent_firmware.ino'
        a.click()
        URL.revokeObjectURL(url)
        notify.success('Đã tải xuống file esp32_agent_firmware.ino')
    }

    // Thêm vật cản ngẫu nhiên
    const handleAddObstacle = () => {
        const newX = parseFloat(((Math.random() - 0.5) * 6).toFixed(1))
        const newZ = parseFloat((Math.random() * 4 + 1).toFixed(1))
        setObstacles((prev) => [...prev, [newX, 0, newZ]])
        addSerialLog(`[ENV] Đã thêm vật cản 3D tại tọa độ X: ${newX}, Z: ${newZ}`)
        notify.success('Đã thêm 1 khối vật cản vào sân 3D!')
    }

    // Reset vị trí Robot
    const handleResetPosition = () => {
        setRobotState({
            x: 0,
            z: 0,
            rotation: 0,
            isMoving: false,
            speed: 80,
            ledColor: '#10b981',
            obstacleDistance: 150,
        })
        addSerialLog('[RESET] Đã đưa Robot về tọa độ ban đầu (0, 0, 0°)')
        notify.success('Đã đặt lại vị trí Robot')
    }

    return (
        <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
            {/* Top Toolbar */}
            <div className="h-12 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                        <IconCpu className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm tracking-tight text-white">ESP32 3D Robot Simulator & Firmware Studio</span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                EMBODIED AI
                            </span>
                        </div>
                    </div>
                </div>

                {/* Trạng thái pin & tín hiệu */}
                <div className="flex items-center gap-4 text-xs text-zinc-400">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-zinc-300">WebSocket Connected</span>
                    </div>
                    <span>|</span>
                    <div className="flex items-center gap-1">
                        <IconZap className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-zinc-300 font-medium">Pin: 92% (7.4V LiPo)</span>
                    </div>
                </div>
            </div>

            {/* Main Content: Chia làm 2 cột (Cột Trái: Canvas 3D | Cột Phải: Studio Điều Khiển & Code) */}
            <div className="flex-1 flex overflow-hidden">
                {/* ─── CỘT TRÁI: 3D SIMULATION CANVAS ───────────────────────── */}
                <div className="flex-1 flex flex-col relative border-r border-zinc-800">
                    {/* Khu vực Canvas 3D */}
                    <div className="flex-1 w-full h-full relative">
                        <ESP32RobotCanvas
                            robotState={robotState}
                            onDistanceUpdate={handleDistanceUpdate}
                            obstacles={obstacles}
                        />
                    </div>

                    {/* D-Pad điều khiển và công cụ nhanh dưới sàn Canvas */}
                    <div className="h-14 border-t border-zinc-800 bg-zinc-900/90 backdrop-blur px-4 flex items-center justify-between shrink-0">
                        {/* D-pad tương tác */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => executeAction('FORWARD', 1.0)}
                                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white border border-zinc-700 transition"
                            >
                                Tiến ↑
                            </button>
                            <button
                                onClick={() => executeAction('BACKWARD', 1.0)}
                                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white border border-zinc-700 transition"
                            >
                                Lùi ↓
                            </button>
                            <button
                                onClick={() => executeAction('TURN_LEFT', 90)}
                                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white border border-zinc-700 transition"
                            >
                                Rẽ Trái 90° ↶
                            </button>
                            <button
                                onClick={() => executeAction('TURN_RIGHT', 90)}
                                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white border border-zinc-700 transition"
                            >
                                Rẽ Phải 90° ↷
                            </button>
                            <button
                                onClick={() => executeAction('ROTATE_360')}
                                className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-xs font-semibold text-amber-300 border border-amber-500/30 transition flex items-center gap-1"
                            >
                                <IconRotateCcw className="w-3 h-3" />
                                Xoay 360°
                            </button>
                            <button
                                onClick={() => executeAction('STOP')}
                                className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-xs font-semibold text-rose-300 border border-rose-500/30 transition"
                            >
                                Phanh Dừng
                            </button>
                        </div>

                        {/* Thao tác môi trường 3D */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleAddObstacle}
                                className="text-xs px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center gap-1.5 border border-zinc-700 transition"
                            >
                                <IconPlus className="w-3.5 h-3.5 text-blue-400" />
                                Thêm Vật Cản
                            </button>
                            <button
                                onClick={() => {
                                    setObstacles([])
                                    addSerialLog('[ENV] Đã xóa toàn bộ vật cản trên sân')
                                }}
                                className="text-xs px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-rose-400 border border-zinc-700 transition"
                                title="Xóa hết vật cản"
                            >
                                <IconTrash className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={handleResetPosition}
                                className="text-xs px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center gap-1 border border-zinc-700 transition"
                            >
                                <IconRotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                                Reset
                            </button>
                        </div>
                    </div>
                </div>

                {/* ─── CỘT PHẢI: STUDIO ĐIỀU KHIỂN & CODE LOGIC ──────────────── */}
                <div className="w-[460px] flex flex-col bg-zinc-900/50 backdrop-blur-md">
                    {/* Navigation Tabs */}
                    <div className="flex items-center border-b border-zinc-800 px-2 pt-2 gap-1 shrink-0 bg-zinc-900/80">
                        <button
                            onClick={() => setActiveTab('command')}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 ${
                                activeTab === 'command'
                                    ? 'border-blue-500 text-blue-400 bg-zinc-800/60'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            <IconSparkles className="w-3.5 h-3.5" />
                            Lệnh Tự Nhiên
                        </button>
                        <button
                            onClick={() => setActiveTab('logic')}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 ${
                                activeTab === 'logic'
                                    ? 'border-blue-500 text-blue-400 bg-zinc-800/60'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            <IconCode className="w-3.5 h-3.5" />
                            Logic Studio
                        </button>
                        <button
                            onClick={() => setActiveTab('export')}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 ${
                                activeTab === 'export'
                                    ? 'border-blue-500 text-blue-400 bg-zinc-800/60'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            <IconDownload className="w-3.5 h-3.5" />
                            Xuất C++
                        </button>
                        <button
                            onClick={() => setActiveTab('serial')}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 ${
                                activeTab === 'serial'
                                    ? 'border-blue-500 text-blue-400 bg-zinc-800/60'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            <IconTerminal className="w-3.5 h-3.5" />
                            Serial Log
                        </button>
                    </div>

                    {/* Nội dung từng Tab */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* ─── TAB 1: LỆNH TỰ NHIÊN (ROOM COMMAND PROMPTING) ─── */}
                        {activeTab === 'command' && (
                            <div className="space-y-4">
                                <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs text-blue-300">
                                    <div className="font-semibold text-white mb-1">Giao tiếp Agent & Robot Vật lý</div>
                                    Bạn có thể ra lệnh bằng ngôn ngữ tự nhiên như đang chat trong Room. Agent sẽ phân tích thành hành động điều khiển động cơ và cảm biến!
                                </div>

                                {/* Ô nhập lệnh */}
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-zinc-400">Nhập khẩu lệnh cho Robot:</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={userPrompt}
                                            onChange={(e) => setUserPrompt(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt()}
                                            placeholder="Ví dụ: Đi thẳng 1.5 mét rồi rẽ phải 90 độ..."
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 pr-10"
                                        />
                                        <button
                                            onClick={() => handleSendPrompt()}
                                            disabled={isExecutingPrompt || !userPrompt.trim()}
                                            className="absolute right-2 top-2 p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition"
                                        >
                                            <IconSend className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Các lệnh mẫu nhanh */}
                                <div className="space-y-1.5">
                                    <span className="text-[11px] text-zinc-500 font-medium">Lệnh mẫu nhanh:</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {[
                                            'Đi thẳng 1 mét',
                                            'Xoay vòng 360 độ ăn mừng',
                                            'Rẽ trái 90 độ',
                                            'Rẽ phải 90 độ',
                                            'Quét cảm biến né vật cản',
                                            'Lùi 50cm an toàn',
                                        ].map((promptText) => (
                                            <button
                                                key={promptText}
                                                onClick={() => handleSendPrompt(promptText)}
                                                className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition"
                                            >
                                                {promptText}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Khung phản hồi suy luận của Agent */}
                                {(lastThought || lastReply) && (
                                    <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 text-xs">
                                        <div className="text-[11px] font-semibold text-blue-400 flex items-center gap-1.5">
                                            <IconSparkles className="w-3.5 h-3.5" />
                                            Suy Luận Của Embodied Agent:
                                        </div>
                                        {lastThought && (
                                            <div className="text-zinc-400 italic bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/80">
                                                "{lastThought}"
                                            </div>
                                        )}
                                        {lastReply && <div className="text-zinc-200 font-medium">{lastReply}</div>}
                                    </div>
                                )}

                                {/* Thống kê cảm biến thời gian thực */}
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                                        <div className="text-zinc-500 text-[10px] uppercase">Khoảng Cách Vật Cản</div>
                                        <div
                                            className={`text-base font-bold mt-0.5 ${
                                                robotState.obstacleDistance < 50
                                                    ? 'text-rose-400'
                                                    : robotState.obstacleDistance < 100
                                                    ? 'text-amber-400'
                                                    : 'text-emerald-400'
                                            }`}
                                        >
                                            {robotState.obstacleDistance} cm
                                        </div>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                                        <div className="text-zinc-500 text-[10px] uppercase">Hướng Di Chuyển (Yaw)</div>
                                        <div className="text-base font-bold text-amber-400 mt-0.5">
                                            {((robotState.rotation * 180) / Math.PI).toFixed(0)}°
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ─── TAB 2: LOGIC STUDIO (CODE EDITOR) ─────────────── */}
                        {activeTab === 'logic' && (
                            <div className="space-y-3 flex flex-col h-full">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-zinc-300">Virtual Logic Script (JS/Python)</span>
                                    <button
                                        onClick={handleFlashVirtualRobot}
                                        disabled={isFlashing}
                                        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                                    >
                                        <IconZap className="w-3.5 h-3.5" />
                                        {isFlashing ? `Đang Nạp ${flashProgress}%...` : 'Nạp vào Robot 3D'}
                                    </button>
                                </div>

                                {/* Code Editor */}
                                <div className="relative border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
                                    <textarea
                                        value={logicCode}
                                        onChange={(e) => setLogicCode(e.target.value)}
                                        rows={16}
                                        className="w-full bg-transparent p-3 font-mono text-xs text-zinc-200 focus:outline-none resize-none leading-relaxed"
                                        spellCheck={false}
                                    />
                                </div>

                                <div className="text-[11px] text-zinc-500">
                                    Hàm <code className="text-blue-400">onCommand(cmd, val)</code> và{' '}
                                    <code className="text-blue-400">onObstacleDetected(distanceCm)</code> được gọi tự động khi robot nhận lệnh hoặc gặp vật cản.
                                </div>
                            </div>
                        )}

                        {/* ─── TAB 3: XUẤT FIRMWARE THẬT (C++ ARDUINO / ESP32) ─ */}
                        {activeTab === 'export' && (
                            <div className="space-y-4">
                                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                                    <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                                        <IconWifi className="w-4 h-4 text-blue-400" />
                                        Cấu hình WiFi & Server cho ESP32 Thật
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <label className="text-zinc-500 text-[11px]">WiFi SSID:</label>
                                            <input
                                                type="text"
                                                value={wifiSsid}
                                                onChange={(e) => setWifiSsid(e.target.value)}
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-white mt-1 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-zinc-500 text-[11px]">WiFi Password:</label>
                                            <input
                                                type="password"
                                                value={wifiPass}
                                                onChange={(e) => setWifiPass(e.target.value)}
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-white mt-1 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-zinc-500 text-[11px]">Agent Gateway WebSocket URL:</label>
                                        <input
                                            type="text"
                                            value={gatewayUrl}
                                            onChange={(e) => setGatewayUrl(e.target.value)}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-white mt-1 focus:outline-none"
                                        />
                                    </div>
                                    <button
                                        onClick={handleGenerateRealFirmware}
                                        disabled={isExporting}
                                        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition"
                                    >
                                        {isExporting ? 'Đang tạo mã nguồn...' : 'Sinh Mã Nguồn C++ Arduino (ESP32)'}
                                    </button>
                                </div>

                                {exportedCode && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-zinc-300">Mã nguồn sẵn sàng nạp (.ino):</span>
                                            <button
                                                onClick={handleDownloadIno}
                                                className="text-xs px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1 transition"
                                            >
                                                <IconDownload className="w-3.5 h-3.5" />
                                                Tải file .ino
                                            </button>
                                        </div>
                                        <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950 p-3 max-h-60 overflow-y-auto">
                                            <pre className="font-mono text-[11px] text-zinc-300 leading-relaxed">
                                                {exportedCode}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ─── TAB 4: SERIAL LOG MONITOR (UART 115200) ───────── */}
                        {activeTab === 'serial' && (
                            <div className="space-y-2 flex flex-col h-full">
                                <div className="flex items-center justify-between text-xs text-zinc-400">
                                    <span>UART Serial Console (115200 baud)</span>
                                    <button
                                        onClick={() => setSerialLogs([])}
                                        className="text-[11px] text-zinc-500 hover:text-zinc-300"
                                    >
                                        Xóa Log
                                    </button>
                                </div>
                                <div className="flex-1 bg-black border border-zinc-800 rounded-xl p-3 font-mono text-[11px] text-emerald-400/90 overflow-y-auto space-y-1 max-h-[500px]">
                                    {serialLogs.map((line, idx) => (
                                        <div key={idx} className="leading-relaxed">
                                            {line}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
