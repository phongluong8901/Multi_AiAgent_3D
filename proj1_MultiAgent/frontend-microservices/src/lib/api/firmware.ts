import { request, API_BASE } from '../client'

export type ConnectionType = 'wifi' | 'ble' | 'ip'
export type TransportProtocol = 'sse' | 'websocket' | 'mqtt' | 'esp_now' | 'http'
export type BoardType = 'esp32_s3' | 'esp32' | 'esp32_cam' | 'raspberry_pi' | 'jetson'

export interface BoardInfo {
    id: string
    name: string
    architecture: string
    ram_kb: number
    psram_mb?: number
    flash_mb: number
    connectivity: string[]
    transports?: string[]
    language: string
    audio_hardware?: string
    description: string
}

export interface ConnectionProfile {
    connection_type: ConnectionType
    transport_protocol: TransportProtocol
    wifi?: {
        ssid: string
        password: string
        band?: string
        channel?: number
        auto_reconnect?: boolean
        power_save_mode?: 'none' | 'min_modem' | 'max_modem'
    }
    ble?: {
        device_name: string
        mac_address: string
        service_uuid: string
        tx_char_uuid: string
        rx_char_uuid: string
        mtu_size: number
    }
    ip?: {
        mode: 'dhcp' | 'static'
        local_ip: string
        gateway_ip: string
        subnet_mask: string
        dns_primary: string
        server_host: string
        server_port: number
    }
    mqtt?: {
        broker_host: string
        broker_port: number
        username?: string
        password?: string
        qos?: number
        topic_prompt?: string
        topic_stream?: string
        topic_action?: string
    }
    esp_now?: {
        gateway_mac: string
        peer_mac: string
        wifi_channel: number
        encrypted: boolean
        pmk_key?: string
        max_frame_bytes?: number
    }
}

export interface GenerateFirmwarePayload {
    board_type: string
    agent_id: string
    agent_name: string
    room_id?: string
    connection_type?: ConnectionType
    transport_protocol?: TransportProtocol
    wifi_ssid: string
    wifi_password: string
    server_url: string
    enable_voice_tts?: boolean
    active_sub_agents?: string[]
    connection_profile?: ConnectionProfile
}

export interface GenerateFirmwareResponse {
    board_type: string
    agent_id: string
    agent_name: string
    room_id?: string
    connection_type?: ConnectionType
    transport_protocol?: TransportProtocol
    language: string
    filename: string
    code: string
    instructions: string[]
}

export interface RobotAction {
    type: 'FORWARD' | 'BACKWARD' | 'TURN_LEFT' | 'TURN_RIGHT' | 'ROTATE_360' | 'STOP' | 'SCAN' | 'LED_COLOR'
    value: number
    unit: string
    description: string
}

export interface RobotCommandPayload {
    command?: string
    prompt?: string
    current_x?: number
    current_z?: number
    current_rotation?: number
    obstacle_distance?: number
    room_id?: string
    agent_id?: string
    device_id?: string
    board_type?: string
    connection_type?: ConnectionType
    transport_protocol?: TransportProtocol
}

export interface RobotCommandResponse {
    prompt: string
    agent_thought: string
    actions: RobotAction[]
    response_message: string
}

export interface RoomFirmwareStreamPayload {
    prompt: string
    room_id: string
    device_id: string
    device_name: string
    board_type: string
    agent_id: string
    sub_agents?: string[]
    connection_type: ConnectionType
    transport_protocol: TransportProtocol
    sender_id?: string
    sender_name?: string
    sync_to_room_chat?: boolean
    current_x?: number
    current_z?: number
    current_rotation?: number
    obstacle_distance?: number
}

export interface FirmwareStreamEvent {
    type: 'room_sync' | 'agent_step' | 'tool_start' | 'tool_end' | 'token' | 'action' | 'done' | 'error'
    step?: number
    seq_id?: number
    total_chunks?: number
    room_id?: string
    device_id?: string
    agent_id?: string
    role?: string
    tool?: string
    result?: string
    content?: string
    action_type?: string
    value?: number
    unit?: string
    description?: string
    response_message?: string
    agent_thought?: string
    sub_agents_used?: string[]
    actions?: RobotAction[]
    espnow_frame?: {
        seq_id: number
        total_frames: number
        frame_type: number
        payload_bytes: number
    }
    mqtt_topic?: string
}

export interface FirmwareInteractionHistoryItem {
    id: number
    device_id: string
    device_name: string
    board_type: string
    room_id: string
    lead_agent_id: string
    sub_agents_used: string[]
    connection_type: string
    transport_protocol: string
    user_prompt: string
    agent_thought: string
    spoken_response: string
    hardware_actions: RobotAction[]
    obstacle_distance_cm: number
    synced_to_room: boolean
    latency_ms: number
    created_at: string
}

export interface FirmwareFlashHistoryItem {
    id: number
    device_id: string
    board_type: string
    room_id: string
    agent_id: string
    sub_agents: string[]
    connection_type: string
    transport_protocol: string
    firmware_version: string
    action_type: string
    filename?: string
    status: string
    notes?: string
    created_at: string
}

export const firmwareApi = {
    getBoards: () =>
        request<{
            boards: BoardInfo[]
            connections?: Array<{ id: ConnectionType; name: string; description: string }>
            transports?: Array<{ id: TransportProtocol; name: string; latency: string; description: string }>
        }>('/firmware/boards'),

    getDevices: (roomId?: string) =>
        request<{ success: boolean; devices: any[] }>(
            `/firmware/devices${roomId ? `?room_id=${encodeURIComponent(roomId)}` : ''}`
        ),

    flashDevice: (deviceId: string, payload: any) =>
        request<{ success: boolean; message: string; device: any; flash_history?: FirmwareFlashHistoryItem }>(
            `/firmware/devices/${encodeURIComponent(deviceId)}/flash`,
            {
                method: 'POST',
                body: JSON.stringify(payload),
            }
        ),

    generateFirmware: (payload: GenerateFirmwarePayload) =>
        request<GenerateFirmwareResponse>('/firmware/generate', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    simulateCommand: (payload: RobotCommandPayload) =>
        request<RobotCommandResponse>('/firmware/simulate-command', {
            method: 'POST',
            body: JSON.stringify({
                ...payload,
                prompt: payload.prompt || payload.command || '',
            }),
        }),

    getHistoryOverview: (roomId?: string) =>
        request<{
            success: boolean
            stats: {
                total_devices: number
                total_flashes: number
                total_interactions: number
                total_telemetry_points: number
            }
            recent_interactions: FirmwareInteractionHistoryItem[]
            recent_flashes: FirmwareFlashHistoryItem[]
        }>(`/firmware/histories/overview${roomId ? `?room_id=${encodeURIComponent(roomId)}` : ''}`),

    getInteractionHistories: (roomId?: string, deviceId?: string) =>
        request<{ success: boolean; count: number; interactions: FirmwareInteractionHistoryItem[] }>(
            `/firmware/histories/interactions?limit=40${roomId ? `&room_id=${encodeURIComponent(roomId)}` : ''}${
                deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : ''
            }`
        ),

    getFlashHistories: (roomId?: string, deviceId?: string) =>
        request<{ success: boolean; count: number; flashes: FirmwareFlashHistoryItem[] }>(
            `/firmware/histories/flashes?limit=30${roomId ? `&room_id=${encodeURIComponent(roomId)}` : ''}${
                deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : ''
            }`
        ),

    streamRoomInteraction: async (
        payload: RoomFirmwareStreamPayload,
        onEvent: (ev: FirmwareStreamEvent) => void
    ): Promise<void> => {
        const res = await fetch(`${API_BASE}/firmware/room-stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'text/event-stream',
            },
            body: JSON.stringify(payload),
        })

        if (!res.ok || !res.body) {
            throw new Error(`Không thể mở luồng SSE Firmware (${res.status})`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''

        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const rawLine of lines) {
                const line = rawLine.trim()
                if (!line.startsWith('data:')) continue
                const jsonStr = line.slice(5).trim()
                if (!jsonStr) continue
                try {
                    const parsed = JSON.parse(jsonStr) as FirmwareStreamEvent
                    onEvent(parsed)
                } catch {
                    // ignore malformed line
                }
            }
        }
    },
}
