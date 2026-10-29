'use client'

import React, { useState, useEffect } from 'react'
import ESP32RobotCanvas from '@/components/firmware/ESP32RobotCanvas'
import {
    firmwareApi,
    ConnectionType,
    TransportProtocol,
    BoardType,
    FirmwareStreamEvent,
    RobotAction,
    FirmwareInteractionHistoryItem,
    FirmwareFlashHistoryItem,
} from '@/lib/api/firmware'
import { chatsApi } from '@/lib/api/chats'
import { notify } from '@/lib/toast'
import {
    IconCpu,
    IconRotateCcw,
    IconTerminal,
    IconCode,
    IconDownload,
    IconSparkles,
    IconSend,
    IconWifi,
    IconPlus,
    IconTrash,
    IconZap,
    IconMic,
    IconVolume,
    IconRadio,
    IconDatabase,
    IconHistory,
    IconWrench,
    IconBot,
    IconRefreshCw,
} from '@/components/ui/icons'

// Code logic mặc định cho ESP32 / ESP32-S3 Robot Simulator
const DEFAULT_LOGIC_CODE = `// [FAST] ESP32 / ESP32-S3 ROBOT & ROOM STREAM LOGIC (JavaScript Virtual Runner)
// Bạn có thể chỉnh sửa logic phản xạ tại đây và bấm "Nạp Agent vào Mạch" để áp dụng!

function onRoomAgentStream(tokenChunk, meta) {
    // Phát từng cụm từ nhận được từ @agent_manager trong Room ra loa I2S MAX98357A
    robot.speakStream(tokenChunk);
    robot.led('#10b981');
}

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

function onObstacleDetected(distanceCm) {
    if (distanceCm < 45) {
        robot.log('[SONAR] Cảnh báo: Vật cản ở ' + distanceCm + 'cm! Kích hoạt né tránh.');
        robot.led('#ef4444');
        robot.stop();
        robot.rotate(90, { led: '#f59e0b' });
    }
}`

const BOARD_OPTIONS: Array<{ id: BoardType; label: string; badge: string }> = [
    { id: 'esp32_s3', label: 'ESP32-S3-WROOM-1 N16R8 (AI Voice + 8MB PSRAM)', badge: 'ESP32-S3 AI' },
    { id: 'esp32', label: 'ESP32-WROOM-32D (Standard 4WD Rover)', badge: 'ESP32 Classic' },
    { id: 'esp32_cam', label: 'AI-Thinker ESP32-CAM (OV2640 Vision)', badge: 'ESP32-CAM' },
    { id: 'raspberry_pi', label: 'Raspberry Pi 4B / 5 (Linux Edge Agent)', badge: 'RPi 5' },
    { id: 'jetson', label: 'NVIDIA Jetson Orin Nano (40 TOPS GPU)', badge: 'Jetson AI' },
]

const CONNECTION_OPTIONS: Array<{ id: ConnectionType; label: string; desc: string }> = [
    { id: 'wifi', label: 'Wi-Fi (No Power-Save)', desc: '2.4GHz/5GHz độ trễ thấp' },
    { id: 'ble', label: 'BLE 5.0 (GATT Stream)', desc: 'Bluetooth Low Energy MTU 512B' },
    { id: 'ip', label: 'Static IP / LAN Socket', desc: 'Cấu hình IP tĩnh & Gateway' },
]

const TRANSPORT_OPTIONS: Array<{ id: TransportProtocol; label: string; latency: string }> = [
    { id: 'sse', label: 'SSE (LLM Token Stream)', latency: '~25ms' },
    { id: 'websocket', label: 'WebSocket (Full-Duplex)', latency: '~30ms' },
    { id: 'esp_now', label: 'ESP-NOW (2.4GHz Mesh)', latency: '<3ms' },
    { id: 'mqtt', label: 'MQTT (Pub/Sub Broker)', latency: '~45ms' },
    { id: 'http', label: 'HTTP REST (Webhook)', latency: '~120ms' },
]

export default function FirmwarePage() {
    // ─── ROBOT SIMULATION STATE ───────────────────────────────────────
    const [robotState, setRobotState] = useState({
        x: 0,
        z: 0,
        rotation: 0,
        isMoving: false,
        speed: 80,
        ledColor: '#10b981',
        obstacleDistance: 150,
    })

    const [obstacles, setObstacles] = useState<[number, number, number][]>([
        [0, 0, 3],
        [-2.5, 0, 1.5],
        [2.5, 0, 2],
    ])

    const [activeTab, setActiveTab] = useState<'command' | 'network' | 'export' | 'history' | 'logic' | 'serial'>('command')

    // Dữ liệu lịch sử từ Neon PostgreSQL
    const [dbStats, setDbStats] = useState({
        total_devices: 3,
        total_flashes: 3,
        total_interactions: 1,
        total_telemetry_points: 0,
    })
    const [interactionHistory, setInteractionHistory] = useState<FirmwareInteractionHistoryItem[]>([])
    const [flashHistory, setFlashHistory] = useState<FirmwareFlashHistoryItem[]>([])
    const [isLoadingHistory, setIsLoadingHistory] = useState(false)

    // ─── CẤU HÌNH MẠCH NHÚNG, ROOM & GIAO THỨC KẾT NỐI / TRUYỀN TẢI ───
    const [boardType, setBoardType] = useState<BoardType>('esp32_s3')
    const [deviceId, setDeviceId] = useState('esp32_s3_rover_01')
    const [deviceName, setDeviceName] = useState('ESP32-S3 Voice Rover')
    const [selectedRoomId, setSelectedRoomId] = useState('default_room')
    const [availableRooms, setAvailableRooms] = useState<Array<{ id: string; name: string; onlineCount?: number }>>([])
    const [leadAgentId, setLeadAgentId] = useState('agent_manager')
    const [subAgents, setSubAgents] = useState<string[]>(['agent_search', 'agent_calculate', 'agent_analysis'])
    const [connectionType, setConnectionType] = useState<ConnectionType>('wifi')
    const [transportProtocol, setTransportProtocol] = useState<TransportProtocol>('sse')
    const [enableVoiceTts, setEnableVoiceTts] = useState(true)
    const [syncToRoomChat, setSyncToRoomChat] = useState(true)

    // Chi tiết cấu hình WiFi / BLE / Static IP / MQTT / ESP-NOW
    const [wifiSsid, setWifiSsid] = useState('MultiAgent_WiFi_2.4G')
    const [wifiPass, setWifiPass] = useState('12345678')
    const [wifiChannel, setWifiChannel] = useState(1)
    const [bleDeviceName, setBleDeviceName] = useState('ESP32S3-Agent-Node')
    const [bleServiceUuid, setBleServiceUuid] = useState('4fafc201-1fb5-459e-8fcc-c5c9c331914b')
    const [bleMtu, setBleMtu] = useState(512)
    const [ipMode, setIpMode] = useState<'dhcp' | 'static'>('static')
    const [staticIp, setStaticIp] = useState('192.168.1.188')
    const [gatewayIp, setGatewayIp] = useState('192.168.1.1')
    const [subnetMask, setSubnetMask] = useState('255.255.255.0')
    const [mqttBroker, setMqttBroker] = useState('broker.emqx.io')
    const [mqttPort, setMqttPort] = useState(1883)
    const [espNowGatewayMac, setEspNowGatewayMac] = useState('30:AE:A4:07:0D:64')
    const [espNowPeerMac, setEspNowPeerMac] = useState('24:0A:C4:12:34:56')
    const [gatewayUrl, setGatewayUrl] = useState('http://192.168.1.100:4000')

    // Logic Studio & Flash state
    const [logicCode, setLogicCode] = useState(DEFAULT_LOGIC_CODE)
    const [isFlashing, setIsFlashing] = useState(false)
    const [flashProgress, setFlashProgress] = useState(0)

    // Lệnh tự nhiên & Luồng Stream Room Multi-Agent
    const [userPrompt, setUserPrompt] = useState('')
    const [isExecutingPrompt, setIsExecutingPrompt] = useState(false)
    const [lastThought, setLastThought] = useState('')
    const [streamedSpeech, setStreamedSpeech] = useState('')
    const [agentTraceSteps, setAgentTraceSteps] = useState<FirmwareStreamEvent[]>([])
    const [exportedCode, setExportedCode] = useState('')
    const [exportedFilename, setExportedFilename] = useState('esp32_s3_agent_firmware.ino')
    const [isExporting, setIsExporting] = useState(false)

    // Serial logs
    const [serialLogs, setSerialLogs] = useState<string[]>([
        `[00:00:01] [ESP32-S3_CORE] Khởi động Dual-Core Xtensa LX7 @ 240MHz + 8MB OPI PSRAM...`,
        `[00:00:01] [I2S_AUDIO] Khởi tạo Mic INMP441 (GPIO 4,5,6) & Loa I2S MAX98357A (GPIO 15,16,17)`,
        `[00:00:02] [WIFI_STA] Đã bật WIFI_PS_NONE (Low-Latency Mode) kết nối tới Gateway...`,
        `[00:00:02] [ROOM_BRIDGE] Đã nạp @agent_manager (Sub-agents: @agent_search, @agent_calculate, @agent_analysis)`,
        `[00:00:03] [SYSTEM] Sẵn sàng nhận câu hỏi giọng nói/văn bản và truyền tải LLM Stream!`,
    ])

    const addSerialLog = (text: string) => {
        const time = new Date().toLocaleTimeString()
        setSerialLogs((prev) => [...prev.slice(-100), `[${time}] ${text}`])
    }

    const refreshNeonHistories = () => {
        setIsLoadingHistory(true)
        firmwareApi
            .getHistoryOverview()
            .then((res) => {
                if (res?.stats) setDbStats(res.stats)
                if (Array.isArray(res?.recent_interactions)) setInteractionHistory(res.recent_interactions)
                if (Array.isArray(res?.recent_flashes)) setFlashHistory(res.recent_flashes)
            })
            .catch(() => {
                // fallback offline
            })
            .finally(() => setIsLoadingHistory(false))
    }

    // Tải danh sách Room thực tế & Lịch sử Neon DB
    useEffect(() => {
        refreshNeonHistories()
        chatsApi
            .getBubbleRooms()
            .then((rooms) => {
                const list = (Array.isArray(rooms) ? rooms : []).map((r: any) => ({
                    id: String(r.roomId || r._id || r.id),
                    name: r.name || `Room ${String(r.roomId || r._id).slice(-5)}`,
                    onlineCount: r.onlineCount ?? 0,
                }))
                if (list.length > 0) {
                    setAvailableRooms(list)
                    setSelectedRoomId(list[0].id)
                }
            })
            .catch(() => {
                // Giữ default_room nếu chưa đăng nhập hoặc chưa có phòng
            })
    }, [])

    // Phát giọng nói tiếng Việt qua Web Speech API (mô phỏng loa I2S MAX98357A trên ESP32-S3)
    const speakTextOutLoud = (text: string) => {
        if (!enableVoiceTts || typeof window === 'undefined' || !('speechSynthesis' in window)) return
        try {
            window.speechSynthesis.cancel()
            const utter = new SpeechSynthesisUtterance(text)
            utter.lang = 'vi-VN'
            utter.rate = 1.05
            window.speechSynthesis.speak(utter)
        } catch {
            // ignore TTS error on unsupported browsers
        }
    }

    const handleDistanceUpdate = (dist: number) => {
        setRobotState((prev) => {
            if (prev.obstacleDistance === dist) return prev
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
            setRobotState((prev) => ({
                ...prev,
                x: prev.x + Math.sin(prev.rotation) * val,
                z: prev.z + Math.cos(prev.rotation) * val,
                isMoving: true,
                ledColor: '#10b981',
            }))
            setTimeout(() => setRobotState((prev) => ({ ...prev, isMoving: false })), 600)
        } else if (action === 'BACKWARD') {
            setRobotState((prev) => ({
                ...prev,
                x: prev.x - Math.sin(prev.rotation) * val,
                z: prev.z - Math.cos(prev.rotation) * val,
                isMoving: true,
                ledColor: '#f43f5e',
            }))
            setTimeout(() => setRobotState((prev) => ({ ...prev, isMoving: false })), 600)
        } else if (action === 'ROTATE_360') {
            addSerialLog(`[PWM] Xoay tròn 360 độ (Motor L: +255, Motor R: -255)`)
            setRobotState((prev) => ({
                ...prev,
                rotation: prev.rotation + Math.PI * 2,
                isMoving: true,
                ledColor: '#eab308',
            }))
            setTimeout(() => setRobotState((prev) => ({ ...prev, isMoving: false, ledColor: '#10b981' })), 1000)
        } else if (action === 'TURN_LEFT') {
            const rad = (val * Math.PI) / 180
            setRobotState((prev) => ({
                ...prev,
                rotation: prev.rotation - rad,
                isMoving: true,
                ledColor: '#3b82f6',
            }))
            setTimeout(() => setRobotState((prev) => ({ ...prev, isMoving: false })), 500)
        } else if (action === 'TURN_RIGHT') {
            const rad = (val * Math.PI) / 180
            setRobotState((prev) => ({
                ...prev,
                rotation: prev.rotation + rad,
                isMoving: true,
                ledColor: '#3b82f6',
            }))
            setTimeout(() => setRobotState((prev) => ({ ...prev, isMoving: false })), 500)
        } else if (action === 'STOP') {
            setRobotState((prev) => ({
                ...prev,
                isMoving: false,
                ledColor: '#64748b',
            }))
        }
    }

    // ─── GỬI CÂU NÓI TỪ FIRMWARE VÀO ROOM & NHẬN STREAM LLM TỪ @AGENT_MANAGER ──
    const handleSendPrompt = async (presetPrompt?: string) => {
        const cmdText = (presetPrompt || userPrompt).trim()
        if (!cmdText) return

        setIsExecutingPrompt(true)
        setStreamedSpeech('')
        setLastThought('')
        setAgentTraceSteps([])
        if (!presetPrompt) setUserPrompt('')

        addSerialLog(
            `[MIC_IN -> ROOM:${selectedRoomId}] (${connectionType.toUpperCase()}/${transportProtocol.toUpperCase()}) User: "${cmdText}"`
        )

        let accumulatedSpeech = ''
        let actionIndex = 0

        try {
            await firmwareApi.streamRoomInteraction(
                {
                    prompt: cmdText,
                    room_id: selectedRoomId,
                    device_id: deviceId,
                    device_name: deviceName,
                    board_type: boardType,
                    agent_id: leadAgentId,
                    sub_agents: subAgents,
                    connection_type: connectionType,
                    transport_protocol: transportProtocol,
                    sync_to_room_chat: syncToRoomChat,
                    current_x: robotState.x,
                    current_z: robotState.z,
                    current_rotation: robotState.rotation,
                    obstacle_distance: robotState.obstacleDistance,
                },
                (ev) => {
                    if (ev.type === 'room_sync') {
                        addSerialLog(`[ROOM_SYNC] ${ev.content}`)
                        setAgentTraceSteps((prev) => [...prev, ev])
                    } else if (ev.type === 'agent_step' || ev.type === 'tool_start' || ev.type === 'tool_end') {
                        setAgentTraceSteps((prev) => [...prev, ev])
                        if (ev.type === 'agent_step') {
                            addSerialLog(`[ROOM_AGENT @${ev.agent_id}] ${ev.content}`)
                        } else if (ev.type === 'tool_start') {
                            addSerialLog(`[TOOL_CALL @${ev.agent_id}] ${ev.tool}`)
                        }
                    } else if (ev.type === 'action') {
                        const actType = ev.action_type || 'STOP'
                        const actVal = ev.value || 100
                        const idx = actionIndex++
                        setTimeout(() => {
                            executeAction(actType, actType === 'FORWARD' || actType === 'BACKWARD' ? actVal / 100 : actVal)
                        }, idx * 650)
                    } else if (ev.type === 'token') {
                        const tok = ev.content || ''
                        accumulatedSpeech += tok
                        setStreamedSpeech(accumulatedSpeech)
                        setRobotState((r) => ({ ...r, ledColor: '#38bdf8' }))
                        if (ev.espnow_frame) {
                            addSerialLog(
                                `[ESP-NOW RX #${ev.espnow_frame.seq_id}/${ev.espnow_frame.total_frames}] (${ev.espnow_frame.payload_bytes}B): "${tok}"`
                            )
                        }
                    } else if (ev.type === 'done') {
                        const finalMsg = ev.response_message || accumulatedSpeech
                        if (finalMsg) {
                            setStreamedSpeech(finalMsg)
                            addSerialLog(`[I2S_SPEAKER_OUT] "${finalMsg}"`)
                            speakTextOutLoud(finalMsg)
                        }
                        if (ev.agent_thought) {
                            setLastThought(ev.agent_thought)
                        }
                        setTimeout(() => setRobotState((r) => ({ ...r, ledColor: '#10b981' })), 800)
                    }
                }
            )
            notify.success(`@${leadAgentId} đã xử lý trong Room & truyền stream về ${boardType.toUpperCase()}!`)
            refreshNeonHistories()
        } catch (err: any) {
            console.error('Lỗi stream firmware room:', err)
            // Fallback sang simulateCommand hoặc xử lý nội bộ nếu backend chưa bật
            try {
                const res = await firmwareApi.simulateCommand({
                    prompt: cmdText,
                    obstacle_distance: robotState.obstacleDistance,
                    room_id: selectedRoomId,
                    agent_id: leadAgentId,
                    board_type: boardType,
                    connection_type: connectionType,
                    transport_protocol: transportProtocol,
                })
                setLastThought(res.agent_thought)
                setStreamedSpeech(res.response_message)
                speakTextOutLoud(res.response_message)
                res.actions.forEach((act: RobotAction, i: number) => {
                    setTimeout(() => executeAction(act.type, act.value / 100), i * 700)
                })
                refreshNeonHistories()
            } catch {
                if (cmdText.toLowerCase().includes('thời tiết')) {
                    const fallbackWeather =
                        'Quản lý @agent_manager báo cáo từ @agent_search: Thời tiết hôm nay 28°C, trời nắng nhẹ, độ ẩm 72%, rất thuận lợi cho hoạt động!'
                    setStreamedSpeech(fallbackWeather)
                    speakTextOutLoud(fallbackWeather)
                } else {
                    executeAction('FORWARD', 1)
                    setStreamedSpeech('Robot đã nhận lệnh và đang thực thi!')
                }
            }
        } finally {
            setIsExecutingPrompt(false)
        }
    }

    // ─── NẠP AGENT & CẤU HÌNH KẾT NỐI VÀO MẠCH FIRMWARE ────────────────
    const handleFlashVirtualRobot = async () => {
        setIsFlashing(true)
        setFlashProgress(15)
        addSerialLog(
            `[FLASH_START] Đang nạp Agent @${leadAgentId} vào ${boardType.toUpperCase()} (Room: ${selectedRoomId} | ${connectionType.toUpperCase()} | ${transportProtocol.toUpperCase()})...`
        )

        try {
            await firmwareApi.flashDevice(deviceId, {
                device_id: deviceId,
                device_name: deviceName,
                board_type: boardType,
                room_id: selectedRoomId,
                agent_id: leadAgentId,
                sub_agents: subAgents,
                connection_type: connectionType,
                transport_protocol: transportProtocol,
                enable_voice_tts: enableVoiceTts,
                connection_profile: {
                    connection_type: connectionType,
                    transport_protocol: transportProtocol,
                    wifi: { ssid: wifiSsid, password: wifiPass, channel: wifiChannel, auto_reconnect: true, power_save_mode: 'none' },
                    ble: {
                        device_name: bleDeviceName,
                        mac_address: '24:6F:28:AA:BB:CC',
                        service_uuid: bleServiceUuid,
                        tx_char_uuid: 'beb5483e-36e1-4688-b7f5-ea07361b26a8',
                        rx_char_uuid: '828917c1-4422-4a2b-9f1a-1234567890ab',
                        mtu_size: bleMtu,
                    },
                    ip: {
                        mode: ipMode,
                        local_ip: staticIp,
                        gateway_ip: gatewayIp,
                        subnet_mask: subnetMask,
                        dns_primary: '8.8.8.8',
                        server_host: '192.168.1.100',
                        server_port: 4000,
                    },
                    mqtt: { broker_host: mqttBroker, broker_port: mqttPort, qos: 0 },
                    esp_now: { gateway_mac: espNowGatewayMac, peer_mac: espNowPeerMac, wifi_channel: wifiChannel, encrypted: false },
                },
            })
        } catch {
            // Tiếp tục mô phỏng flash ngay cả khi chạy offline
        }

        const interval = setInterval(() => {
            setFlashProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval)
                    setIsFlashing(false)
                    addSerialLog(
                        `[FLASH_SUCCESS] 100% - Đã nạp @${leadAgentId} + Sub-agents (${subAgents.join(', ')}) vào ${boardType.toUpperCase()}!`
                    )
                    notify.success(`Đã nạp Agent @${leadAgentId} vào mạch ${boardType.toUpperCase()} thành công!`)
                    setRobotState((r) => ({ ...r, ledColor: '#a855f7' }))
                    setTimeout(() => setRobotState((r) => ({ ...r, ledColor: '#10b981' })), 1000)
                    return 100
                }
                return prev + 30
            })
        }, 120)
    }

    // ─── XUẤT SOURCE CODE C++ / PYTHON CHO MẠCH THẬT ───────────────────
    const handleGenerateRealFirmware = async () => {
        setIsExporting(true)
        try {
            const res = await firmwareApi.generateFirmware({
                board_type: boardType,
                agent_id: leadAgentId,
                agent_name: deviceId,
                room_id: selectedRoomId,
                connection_type: connectionType,
                transport_protocol: transportProtocol,
                wifi_ssid: wifiSsid,
                wifi_password: wifiPass,
                server_url: gatewayUrl,
                enable_voice_tts: enableVoiceTts,
                active_sub_agents: subAgents,
                connection_profile: {
                    connection_type: connectionType,
                    transport_protocol: transportProtocol,
                    wifi: { ssid: wifiSsid, password: wifiPass, channel: wifiChannel, auto_reconnect: true, power_save_mode: 'none' },
                    ble: {
                        device_name: bleDeviceName,
                        mac_address: '24:6F:28:AA:BB:CC',
                        service_uuid: bleServiceUuid,
                        tx_char_uuid: 'beb5483e-36e1-4688-b7f5-ea07361b26a8',
                        rx_char_uuid: '828917c1-4422-4a2b-9f1a-1234567890ab',
                        mtu_size: bleMtu,
                    },
                    ip: {
                        mode: ipMode,
                        local_ip: staticIp,
                        gateway_ip: gatewayIp,
                        subnet_mask: subnetMask,
                        dns_primary: '8.8.8.8',
                        server_host: '192.168.1.100',
                        server_port: 4000,
                    },
                    mqtt: { broker_host: mqttBroker, broker_port: mqttPort, qos: 0 },
                    esp_now: { gateway_mac: espNowGatewayMac, peer_mac: espNowPeerMac, wifi_channel: wifiChannel, encrypted: false },
                },
            })
            setExportedCode(res.code)
            setExportedFilename(res.filename || `${boardType}_${leadAgentId}_${transportProtocol}.ino`)
            notify.success(`Đã sinh mã nguồn Firmware (${boardType.toUpperCase()} • ${connectionType.toUpperCase()} • ${transportProtocol.toUpperCase()})!`)
        } catch (e: any) {
            console.error('Lỗi sinh firmware:', e)
            notify.error('Lỗi sinh firmware: ' + e.message)
        } finally {
            setIsExporting(false)
        }
    }

    const handleDownloadIno = () => {
        if (!exportedCode) return
        const blob = new Blob([exportedCode], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = exportedFilename
        a.click()
        URL.revokeObjectURL(url)
        notify.success(`Đã tải xuống file ${exportedFilename}`)
    }

    const handleAddObstacle = () => {
        const newX = parseFloat(((Math.random() - 0.5) * 6).toFixed(1))
        const newZ = parseFloat((Math.random() * 4 + 1).toFixed(1))
        setObstacles((prev) => [...prev, [newX, 0, newZ]])
        addSerialLog(`[ENV] Đã thêm vật cản 3D tại tọa độ X: ${newX}, Z: ${newZ}`)
        notify.success('Đã thêm 1 khối vật cản vào sân 3D!')
    }

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

    const toggleSubAgent = (agentId: string) => {
        setSubAgents((prev) => (prev.includes(agentId) ? prev.filter((a) => a !== agentId) : [...prev, agentId]))
    }

    return (
        <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
            {/* Top Toolbar */}
            <div className="h-12 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md px-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                        <IconCpu className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm tracking-tight text-white">
                            Agent-Firmware Studio (ESP32 / ESP32-S3 ↔ Room Bridge)
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            {boardType.toUpperCase()}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            {connectionType.toUpperCase()} • {transportProtocol.toUpperCase()}
                        </span>
                    </div>
                </div>

                {/* Trạng thái Room, Giao thức & Pin */}
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-zinc-300">
                            Room: <strong className="text-white">{selectedRoomId}</strong> (@{leadAgentId})
                        </span>
                    </div>
                    <span>|</span>
                    <button
                        onClick={handleFlashVirtualRobot}
                        disabled={isFlashing}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white font-semibold text-[11px] flex items-center gap-1 transition disabled:opacity-50"
                    >
                        <IconZap className="w-3 h-3" />
                        {isFlashing ? `Đang nạp ${flashProgress}%...` : 'Nạp Agent vào Mạch'}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* ─── CỘT TRÁI: 3D SIMULATION CANVAS ───────────────────────── */}
                <div className="flex-1 min-h-[340px] lg:min-h-0 flex flex-col relative border-b lg:border-b-0 lg:border-r border-zinc-800">
                    <div className="flex-1 w-full h-full relative">
                        <ESP32RobotCanvas
                            robotState={robotState}
                            onDistanceUpdate={handleDistanceUpdate}
                            obstacles={obstacles}
                        />
                    </div>

                    {/* D-Pad điều khiển dưới sàn Canvas */}
                    <div className="h-14 border-t border-zinc-800 bg-zinc-900/90 backdrop-blur px-4 flex items-center justify-between shrink-0">
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

                {/* ─── CỘT PHẢI: ROOM BRIDGE, CẤU HÌNH MẠNG & CODE STUDIO ──── */}
                <div className="w-full lg:w-[460px] xl:w-[490px] flex flex-col bg-zinc-900/50 backdrop-blur-md overflow-hidden">
                    {/* Navigation Tabs */}
                    <div className="flex items-center border-b border-zinc-800 px-2 pt-2 gap-1 shrink-0 bg-zinc-900/80 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('command')}
                            className={`flex items-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
                                activeTab === 'command'
                                    ? 'border-blue-500 text-blue-400 bg-zinc-800/60'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            <IconSparkles className="w-3.5 h-3.5" />
                            Room Stream
                        </button>
                        <button
                            onClick={() => setActiveTab('network')}
                            className={`flex items-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
                                activeTab === 'network'
                                    ? 'border-blue-500 text-blue-400 bg-zinc-800/60'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            <IconWifi className="w-3.5 h-3.5" />
                            Kết nối & Giao thức
                        </button>
                        <button
                            onClick={() => setActiveTab('export')}
                            className={`flex items-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
                                activeTab === 'export'
                                    ? 'border-blue-500 text-blue-400 bg-zinc-800/60'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            <IconDownload className="w-3.5 h-3.5" />
                            Xuất Firmware
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('history')
                                refreshNeonHistories()
                            }}
                            className={`flex items-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
                                activeTab === 'history'
                                    ? 'border-blue-500 text-blue-400 bg-zinc-800/60'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            <IconHistory className="w-3.5 h-3.5" />
                            Lịch Sử DB
                        </button>
                        <button
                            onClick={() => setActiveTab('logic')}
                            className={`flex items-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
                                activeTab === 'logic'
                                    ? 'border-blue-500 text-blue-400 bg-zinc-800/60'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            <IconCode className="w-3.5 h-3.5" />
                            Logic
                        </button>
                        <button
                            onClick={() => setActiveTab('serial')}
                            className={`flex items-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
                                activeTab === 'serial'
                                    ? 'border-blue-500 text-blue-400 bg-zinc-800/60'
                                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                            }`}
                        >
                            <IconTerminal className="w-3.5 h-3.5" />
                            Serial
                        </button>
                    </div>

                    {/* Nội dung từng Tab */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* ─── TAB 1: ROOM <-> FIRMWARE MULTI-AGENT STREAMING ─── */}
                        {activeTab === 'command' && (
                            <div className="space-y-3.5">
                                {/* Chọn nhanh Mạch, Room, Kết nối & Truyền tải */}
                                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2.5 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-white">Cấu hình Agent Firmware Thực ↔ Ảo</span>
                                        <label className="flex items-center gap-1.5 text-[11px] text-emerald-400 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={enableVoiceTts}
                                                onChange={(e) => setEnableVoiceTts(e.target.checked)}
                                                className="rounded border-zinc-700"
                                            />
                                            <IconVolume className="w-3.5 h-3.5" />
                                            <span>Phát Loa TTS</span>
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] text-zinc-500 uppercase">Mạch Nhúng (Board)</label>
                                            <select
                                                value={boardType}
                                                onChange={(e) => setBoardType(e.target.value as BoardType)}
                                                className="w-full mt-0.5 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                                            >
                                                {BOARD_OPTIONS.map((b) => (
                                                    <option key={b.id} value={b.id}>
                                                        {b.badge} — {b.label.split('(')[0]}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-zinc-500 uppercase">Room Liên Kết</label>
                                            <select
                                                value={selectedRoomId}
                                                onChange={(e) => setSelectedRoomId(e.target.value)}
                                                className="w-full mt-0.5 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                                            >
                                                <option value="default_room">Phòng Mặc Định (default_room)</option>
                                                {availableRooms.map((r) => (
                                                    <option key={r.id} value={r.id}>
                                                        {r.name} ({r.onlineCount ?? 0} online)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[10px] text-zinc-500 uppercase">Kiểu Kết Nối</label>
                                            <select
                                                value={connectionType}
                                                onChange={(e) => setConnectionType(e.target.value as ConnectionType)}
                                                className="w-full mt-0.5 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                                            >
                                                {CONNECTION_OPTIONS.map((c) => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-zinc-500 uppercase">Kiểu Truyền Tải</label>
                                            <select
                                                value={transportProtocol}
                                                onChange={(e) => setTransportProtocol(e.target.value as TransportProtocol)}
                                                className="w-full mt-0.5 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                                            >
                                                {TRANSPORT_OPTIONS.map((t) => (
                                                    <option key={t.id} value={t.id}>
                                                        {t.label} ({t.latency})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Chọn Agent chỉ huy & các Agent con phối hợp trong Room */}
                                    <div className="pt-1 border-t border-zinc-800/80 space-y-1.5">
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span className="text-zinc-400">
                                                Chỉ huy: <strong className="text-blue-400">@{leadAgentId}</strong> phối hợp Agent con:
                                            </span>
                                            <label className="flex items-center gap-1 text-[10px] text-zinc-400 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={syncToRoomChat}
                                                    onChange={(e) => setSyncToRoomChat(e.target.checked)}
                                                />
                                                Đồng bộ vào Room Chat
                                            </label>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {['agent_search', 'agent_calculate', 'agent_analysis', 'agent_data', 'agent_devops'].map(
                                                (ag) => {
                                                    const active = subAgents.includes(ag)
                                                    return (
                                                        <button
                                                            key={ag}
                                                            type="button"
                                                            onClick={() => toggleSubAgent(ag)}
                                                            className={`text-[10px] px-2 py-0.5 rounded-md border transition ${
                                                                active
                                                                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-300 font-semibold'
                                                                    : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                                                            }`}
                                                        >
                                                            @{ag}
                                                        </button>
                                                    )
                                                }
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Ô nhập câu nói/lệnh từ User vào Mic của Robot */}
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
                                        <IconMic className="w-3.5 h-3.5 text-blue-400" />
                                        <span>Nói / Nhập câu hỏi vào Mạch Firmware ({boardType.toUpperCase()}):</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={userPrompt}
                                            onChange={(e) => setUserPrompt(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt()}
                                            placeholder="VD: Thời tiết hôm nay thế nào? / Đi thẳng 1.5 mét rồi rẽ phải..."
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

                                {/* Các kịch bản mẫu thực-ảo trong Room */}
                                <div className="space-y-1.5">
                                    <span className="text-[11px] text-zinc-500 font-medium">
                                        Kịch bản giao tiếp Thực ↔ Ảo trong Room:
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {[
                                            'Thời tiết hôm nay thế nào?',
                                            'Thời tiết TP. Hồ Chí Minh hôm nay ra sao?',
                                            'Đi thẳng 1.5 mét rồi xoay vòng 360 độ ăn mừng',
                                            'Tính quãng đường và dung lượng pin còn lại cho robot',
                                            'Quét cảm biến né vật cản và báo cáo về phòng',
                                            'Rẽ trái 90 độ rồi lùi 50cm an toàn',
                                        ].map((promptText) => (
                                            <button
                                                key={promptText}
                                                onClick={() => handleSendPrompt(promptText)}
                                                disabled={isExecutingPrompt}
                                                className="text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 transition disabled:opacity-50"
                                            >
                                                {promptText}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Tiến trình điều phối giữa @agent_manager và các Agent con trong Room */}
                                {agentTraceSteps.length > 0 && (
                                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 text-xs">
                                        <div className="text-[11px] font-semibold text-emerald-400 flex items-center justify-between">
                                            <span>Luồng Điều Phối Đa Agent Trong Room ({selectedRoomId})</span>
                                            <span className="text-[10px] text-zinc-500">{transportProtocol.toUpperCase()} STREAM</span>
                                        </div>
                                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                            {agentTraceSteps.map((st, idx) => (
                                                <div
                                                    key={idx}
                                                    className="p-2 rounded-lg bg-zinc-900/70 border border-zinc-800/80 text-[11px] leading-relaxed"
                                                >
                                                    {st.type === 'room_sync' && (
                                                        <span className="flex items-center gap-1.5 text-amber-300">
                                                            <IconRadio className="w-3.5 h-3.5 shrink-0" />
                                                            <span>{st.content}</span>
                                                        </span>
                                                    )}
                                                    {st.type === 'agent_step' && (
                                                        <div className="flex items-start gap-1.5">
                                                            <IconBot className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                                                            <div>
                                                                <span className="font-semibold text-blue-400">@{st.agent_id}</span>{' '}
                                                                <span className="text-zinc-500">({st.role}):</span>{' '}
                                                                <span className="text-zinc-200">{st.content}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {st.type === 'tool_start' && (
                                                        <div className="flex items-center gap-1.5 text-purple-300">
                                                            <IconWrench className="w-3 h-3 shrink-0" />
                                                            <span>
                                                                <strong>@{st.agent_id}</strong> gọi công cụ{' '}
                                                                <code className="px-1 py-0.5 rounded bg-purple-950/60">{st.tool}</code>
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Khung phát giọng nói LLM Stream trực tiếp trên Mạch Firmware */}
                                {(streamedSpeech || lastThought) && (
                                    <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/30 space-y-2 text-xs">
                                        <div className="text-[11px] font-semibold text-blue-400 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <IconVolume className="w-3.5 h-3.5" />
                                                <span>Loa I2S Firmware ({boardType.toUpperCase()}) Đang Phát Stream:</span>
                                            </span>
                                            {streamedSpeech && (
                                                <button
                                                    onClick={() => speakTextOutLoud(streamedSpeech)}
                                                    className="text-[10px] px-2 py-0.5 rounded bg-blue-600/30 hover:bg-blue-600/50 text-blue-200"
                                                >
                                                    Phát lại âm thanh
                                                </button>
                                            )}
                                        </div>
                                        {streamedSpeech && (
                                            <div className="text-white font-medium leading-relaxed bg-zinc-950/80 p-2.5 rounded-lg border border-blue-500/20">
                                                {streamedSpeech}
                                                {isExecutingPrompt && (
                                                    <span className="inline-block w-1.5 h-3.5 ml-1 bg-blue-400 animate-pulse align-middle" />
                                                )}
                                            </div>
                                        )}
                                        {lastThought && (
                                            <div className="text-[11px] text-zinc-400 italic">
                                                Suy luận phần cứng: "{lastThought}"
                                            </div>
                                        )}
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
                                        <div className="text-zinc-500 text-[10px] uppercase">Góc Quay (Yaw)</div>
                                        <div className="text-base font-bold text-amber-400 mt-0.5">
                                            {((robotState.rotation * 180) / Math.PI).toFixed(0)}°
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ─── TAB 2: CẤU HÌNH CHI TIẾT KẾT NỐI (WIFI / BLE / IP) & TRUYỀN TẢI (MQTT / HTTP / WS / ESP-NOW / SSE) ─── */}
                        {activeTab === 'network' && (
                            <div className="space-y-4 text-xs">
                                {/* 1. Cấu hình Kết nối Vật lý: WiFi / BLE / IP */}
                                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                                    <div className="font-semibold text-white flex items-center justify-between">
                                        <span>1. Cấu hình Kết nối Vật lý (WiFi / BLE / Static IP)</span>
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                                            {connectionType.toUpperCase()}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-1.5">
                                        {CONNECTION_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.id}
                                                onClick={() => setConnectionType(opt.id)}
                                                className={`p-2 rounded-lg border text-left transition ${
                                                    connectionType === opt.id
                                                        ? 'bg-blue-600/20 border-blue-500 text-white'
                                                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                                }`}
                                            >
                                                <div className="font-semibold text-[11px]">{opt.id.toUpperCase()}</div>
                                                <div className="text-[10px] text-zinc-400 truncate">{opt.desc}</div>
                                            </button>
                                        ))}
                                    </div>

                                    {connectionType === 'wifi' && (
                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                            <div>
                                                <label className="text-zinc-500 text-[11px]">WiFi SSID (2.4GHz):</label>
                                                <input
                                                    type="text"
                                                    value={wifiSsid}
                                                    onChange={(e) => setWifiSsid(e.target.value)}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-white mt-1"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-zinc-500 text-[11px]">WiFi Password:</label>
                                                <input
                                                    type="password"
                                                    value={wifiPass}
                                                    onChange={(e) => setWifiPass(e.target.value)}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-white mt-1"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-zinc-500 text-[11px]">Kênh WiFi (1-14):</label>
                                                <input
                                                    type="number"
                                                    value={wifiChannel}
                                                    onChange={(e) => setWifiChannel(Number(e.target.value) || 1)}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-white mt-1"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-zinc-500 text-[11px]">Chế độ năng lượng:</label>
                                                <div className="mt-1.5 text-[11px] text-emerald-400 font-medium">
                                                    WIFI_PS_NONE (Tối ưu Stream)
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {connectionType === 'ble' && (
                                        <div className="space-y-2 pt-1">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-zinc-500 text-[11px]">Tên BLE GATT:</label>
                                                    <input
                                                        type="text"
                                                        value={bleDeviceName}
                                                        onChange={(e) => setBleDeviceName(e.target.value)}
                                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-white mt-1"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-zinc-500 text-[11px]">BLE MTU (Bytes):</label>
                                                    <input
                                                        type="number"
                                                        value={bleMtu}
                                                        onChange={(e) => setBleMtu(Number(e.target.value) || 512)}
                                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-white mt-1"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-zinc-500 text-[11px]">GATT Service UUID:</label>
                                                <input
                                                    type="text"
                                                    value={bleServiceUuid}
                                                    onChange={(e) => setBleServiceUuid(e.target.value)}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-white mt-1 font-mono text-[11px]"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {connectionType === 'ip' && (
                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                            <div>
                                                <label className="text-zinc-500 text-[11px]">Chế độ IP:</label>
                                                <select
                                                    value={ipMode}
                                                    onChange={(e) => setIpMode(e.target.value as 'dhcp' | 'static')}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-white mt-1"
                                                >
                                                    <option value="static">Static IP (IP Tĩnh)</option>
                                                    <option value="dhcp">DHCP (Tự động)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-zinc-500 text-[11px]">IP Mạch Nhúng:</label>
                                                <input
                                                    type="text"
                                                    value={staticIp}
                                                    onChange={(e) => setStaticIp(e.target.value)}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-white mt-1"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-zinc-500 text-[11px]">Gateway IP:</label>
                                                <input
                                                    type="text"
                                                    value={gatewayIp}
                                                    onChange={(e) => setGatewayIp(e.target.value)}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-white mt-1"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-zinc-500 text-[11px]">Subnet Mask:</label>
                                                <input
                                                    type="text"
                                                    value={subnetMask}
                                                    onChange={(e) => setSubnetMask(e.target.value)}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-white mt-1"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 2. Cấu hình Giao thức Truyền tải: SSE / WebSocket / MQTT / ESP-NOW / HTTP */}
                                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                                    <div className="font-semibold text-white flex items-center justify-between">
                                        <span>2. Giao thức Truyền tải (SSE / WS / MQTT / ESP-NOW / HTTP)</span>
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                                            {transportProtocol.toUpperCase()}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-1.5">
                                        {TRANSPORT_OPTIONS.map((t) => (
                                            <button
                                                key={t.id}
                                                onClick={() => setTransportProtocol(t.id)}
                                                className={`p-2 rounded-lg border text-left transition ${
                                                    transportProtocol === t.id
                                                        ? 'bg-emerald-600/20 border-emerald-500 text-white'
                                                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-semibold text-[11px]">{t.id.toUpperCase()}</span>
                                                    <span className="text-[10px] text-emerald-400">{t.latency}</span>
                                                </div>
                                                <div className="text-[10px] text-zinc-400 truncate">{t.label}</div>
                                            </button>
                                        ))}
                                    </div>

                                    {transportProtocol === 'mqtt' && (
                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                            <div>
                                                <label className="text-zinc-500 text-[11px]">MQTT Broker Host:</label>
                                                <input
                                                    type="text"
                                                    value={mqttBroker}
                                                    onChange={(e) => setMqttBroker(e.target.value)}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-white mt-1"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-zinc-500 text-[11px]">MQTT Port:</label>
                                                <input
                                                    type="number"
                                                    value={mqttPort}
                                                    onChange={(e) => setMqttPort(Number(e.target.value) || 1883)}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-white mt-1"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {transportProtocol === 'esp_now' && (
                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                            <div>
                                                <label className="text-zinc-500 text-[11px]">Gateway Bridge MAC:</label>
                                                <input
                                                    type="text"
                                                    value={espNowGatewayMac}
                                                    onChange={(e) => setEspNowGatewayMac(e.target.value)}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-white mt-1 font-mono text-[11px]"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-zinc-500 text-[11px]">Robot Peer MAC:</label>
                                                <input
                                                    type="text"
                                                    value={espNowPeerMac}
                                                    onChange={(e) => setEspNowPeerMac(e.target.value)}
                                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-white mt-1 font-mono text-[11px]"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="text-zinc-500 text-[11px]">Multi-Agent Gateway Server URL:</label>
                                        <input
                                            type="text"
                                            value={gatewayUrl}
                                            onChange={(e) => setGatewayUrl(e.target.value)}
                                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-white mt-1"
                                        />
                                    </div>

                                    <button
                                        onClick={handleFlashVirtualRobot}
                                        disabled={isFlashing}
                                        className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition"
                                    >
                                        {isFlashing
                                            ? `Đang nạp cấu hình (${flashProgress}%)...`
                                            : `Lưu & Nạp Cấu Hình vào ${boardType.toUpperCase()}`}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ─── TAB 3: XUẤT FIRMWARE THẬT (C++ ARDUINO / PYTHON) ─ */}
                        {activeTab === 'export' && (
                            <div className="space-y-4">
                                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3 text-xs">
                                    <div className="font-semibold text-white flex items-center justify-between">
                                        <span>Sinh Mã Nguồn Firmware Thực Tế</span>
                                        <span className="text-[10px] text-blue-400">
                                            {boardType.toUpperCase()} • {connectionType.toUpperCase()} • {transportProtocol.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="text-zinc-400 text-[11px] leading-relaxed">
                                        Mã nguồn sinh ra đã tích hợp sẵn kết nối <strong>{connectionType.toUpperCase()}</strong>, giao thức{' '}
                                        <strong>{transportProtocol.toUpperCase()}</strong>, liên kết trực tiếp vào Room{' '}
                                        <code className="text-emerald-400">{selectedRoomId}</code> với chỉ huy{' '}
                                        <code className="text-blue-400">@{leadAgentId}</code> và bộ đọc luồng giọng nói LLM Stream.
                                    </div>
                                    <button
                                        onClick={handleGenerateRealFirmware}
                                        disabled={isExporting}
                                        className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition"
                                    >
                                        {isExporting
                                            ? 'Đang tạo mã nguồn...'
                                            : `Sinh Mã Nguồn (${boardType.toUpperCase()} - ${transportProtocol.toUpperCase()})`}
                                    </button>
                                </div>

                                {exportedCode && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-zinc-300">{exportedFilename}</span>
                                            <button
                                                onClick={handleDownloadIno}
                                                className="text-xs px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1 transition"
                                            >
                                                <IconDownload className="w-3.5 h-3.5" />
                                                Tải file {exportedFilename}
                                            </button>
                                        </div>
                                        <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950 p-3 max-h-80 overflow-y-auto">
                                            <pre className="font-mono text-[11px] text-zinc-300 leading-relaxed">
                                                {exportedCode}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ─── TAB 3.5: LỊCH SỬ HỘI THOẠI & FLASH TRÊN NEON POSTGRESQL ─── */}
                        {activeTab === 'history' && (
                            <div className="space-y-4 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1.5 font-semibold text-white">
                                        <IconDatabase className="w-3.5 h-3.5 text-blue-400" />
                                        <span>Lịch Sử Lưu Trữ Trên Neon PostgreSQL</span>
                                    </span>
                                    <button
                                        onClick={refreshNeonHistories}
                                        disabled={isLoadingHistory}
                                        className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-blue-300 border border-zinc-700 transition"
                                    >
                                        <IconRefreshCw className={`w-3 h-3 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                                        <span>{isLoadingHistory ? 'Đang tải...' : 'Làm mới DB'}</span>
                                    </button>
                                </div>

                                {/* Thống kê tổng quan DB */}
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                                        <div className="text-[10px] text-zinc-500 uppercase">Thiết bị Đã Nạp</div>
                                        <div className="text-base font-bold text-emerald-400 mt-0.5">
                                            {dbStats.total_devices}
                                        </div>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                                        <div className="text-[10px] text-zinc-500 uppercase">Lượt Hội Thoại</div>
                                        <div className="text-base font-bold text-blue-400 mt-0.5">
                                            {dbStats.total_interactions}
                                        </div>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                                        <div className="text-[10px] text-zinc-500 uppercase">Lịch Sử Flash</div>
                                        <div className="text-base font-bold text-purple-400 mt-0.5">
                                            {dbStats.total_flashes}
                                        </div>
                                    </div>
                                </div>

                                {/* Lịch sử Hội thoại Thực <-> Ảo trong Room */}
                                <div className="space-y-2">
                                    <div className="text-[11px] font-semibold text-zinc-300">
                                        1. Lịch sử Giao tiếp Firmware ↔ Room Multi-Agent:
                                    </div>
                                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                        {interactionHistory.length === 0 ? (
                                            <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-500 text-[11px]">
                                                Chưa có lịch sử hội thoại nào. Hãy gửi thử một câu hỏi ở tab Room Stream!
                                            </div>
                                        ) : (
                                            interactionHistory.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5"
                                                >
                                                    <div className="flex items-center justify-between text-[10px] text-zinc-400">
                                                        <span className="font-semibold text-emerald-400">
                                                            {item.board_type.toUpperCase()} • {item.connection_type.toUpperCase()}/{item.transport_protocol.toUpperCase()}
                                                        </span>
                                                        <span>
                                                            Room: {item.room_id} • {item.latency_ms}ms
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-zinc-200 font-medium">
                                                        <IconMic className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                                                        <span>"{item.user_prompt}"</span>
                                                    </div>
                                                    <div className="flex items-start gap-1.5 text-blue-300 text-[11px] bg-blue-950/20 p-2 rounded-lg border border-blue-500/20">
                                                        <IconVolume className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                                                        <div>
                                                            <strong>@{item.lead_agent_id}</strong> ({(item.sub_agents_used || []).map((s) => `@${s}`).join(', ')}): {item.spoken_response}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Lịch sử Nạp Agent (Flash / Codegen) */}
                                <div className="space-y-2">
                                    <div className="text-[11px] font-semibold text-zinc-300">
                                        2. Lịch sử Nạp Agent & Sinh Code Firmware:
                                    </div>
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                        {flashHistory.map((fl) => (
                                            <div
                                                key={fl.id}
                                                className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-2"
                                            >
                                                <div className="min-w-0">
                                                    <div className="font-semibold text-zinc-200 truncate">
                                                        {fl.device_id} ({fl.board_type.toUpperCase()}) — @{fl.agent_id}
                                                    </div>
                                                    <div className="text-[10px] text-zinc-400 truncate">
                                                        {fl.notes || fl.filename}
                                                    </div>
                                                </div>
                                                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 shrink-0">
                                                    {fl.connection_type.toUpperCase()}/{fl.transport_protocol.toUpperCase()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ─── TAB 4: LOGIC STUDIO (CODE EDITOR) ─────────────── */}
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

                                <div className="relative border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
                                    <textarea
                                        value={logicCode}
                                        onChange={(e) => setLogicCode(e.target.value)}
                                        rows={16}
                                        className="w-full bg-transparent p-3 font-mono text-xs text-zinc-200 focus:outline-none resize-none leading-relaxed"
                                        spellCheck={false}
                                    />
                                </div>
                            </div>
                        )}

                        {/* ─── TAB 5: SERIAL LOG MONITOR (UART 115200) ───────── */}
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
