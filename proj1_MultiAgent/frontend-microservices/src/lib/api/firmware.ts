import { request } from '../client'

export interface BoardInfo {
    id: 'esp32' | 'raspberry_pi' | 'jetson'
    name: string
    chip: string
    type: string
    language: string
    connectivity: string
    features: string[]
    recommended_use: string
}

export interface FirmwareGenerateParams {
    board_type: string
    agent_id: string
    agent_name?: string
    wifi_ssid?: string
    wifi_password?: string
    server_url?: string
    baud_rate?: number
    pin_config?: Record<string, any>
}

export interface FirmwareGenerateResult {
    success: boolean
    board_type: string
    filename: string
    code: string
    instructions: string[]
}

export interface RobotAction {
    type: 'FORWARD' | 'BACKWARD' | 'TURN_LEFT' | 'TURN_RIGHT' | 'ROTATE_360' | 'STOP' | 'SCAN' | 'BEEP' | 'LED'
    value: number
    description: string
}

export interface SimulateCommandResult {
    success: boolean
    agent_thought: string
    actions: RobotAction[]
    response_message: string
}

export const firmwareApi = {
    // 1. Lấy danh sách boards hỗ trợ
    getBoards: async (): Promise<BoardInfo[]> => {
        return request<BoardInfo[]>('/firmware/boards')
    },

    // 2. Sinh mã nguồn firmware nạp thật
    generateFirmware: async (params: FirmwareGenerateParams): Promise<FirmwareGenerateResult> => {
        return request<FirmwareGenerateResult>('/firmware/generate', {
            method: 'POST',
            body: JSON.stringify(params),
        })
    },

    // 3. Giả lập thông dịch lệnh hành động robot từ Agent
    simulateCommand: async (params: {
        command: string
        agent_id?: string
        board_type?: string
        obstacle_distance?: number
    }): Promise<SimulateCommandResult> => {
        return request<SimulateCommandResult>('/firmware/simulate-command', {
            method: 'POST',
            body: JSON.stringify(params),
        })
    },
}
