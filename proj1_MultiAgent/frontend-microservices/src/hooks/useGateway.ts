'use client'

import { useEffect, useState, useRef } from 'react'

export type AgentStatus = 'idle' | 'working' | 'meeting' | 'blocked'

export type AgentState = {
    id: string
    name: string
    color: string
    status: AgentStatus
    speech: string | null
    position: [number, number, number]
}

export type GatewayState = {
    agents: AgentState[]
    updatedAt: number
}

/**
 * Custom Hook ket noi WebSocket voi API Gateway:
 * - Theo doi trang thai toan bo Agent trong the gioi 3D (World State)
 * - Nhan toa do [x, y, z], ma mau va trang thai (idle, working, meeting)
 * - Tu dong ket noi lai (auto-reconnect) sau 2 giay neu dut ket noi
 * 
 * @param url WebSocket URL endpoint
 */
export function useGateway(url = 'ws://localhost:4000/ws') {
    const [state, setState] = useState<GatewayState | null>(null)
    const [connected, setConnected] = useState(false)
    const wsRef = useRef<WebSocket | null>(null)

    useEffect(() => {
        let closed = false
        let retryTimer: ReturnType<typeof setTimeout>

        function connect() {
            const ws = new WebSocket(url)
            wsRef.current = ws

            ws.onopen = () => {
                if (closed) return
                setConnected(true)
                console.log('Gateway connected')
            }

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data)
                    if (msg.type === 'state' || msg.type === 'WORLD_STATE') {
                        setState(msg.payload)
                    }
                } catch (e) {
                    console.error('Invalid message', e)
                }
            }

            ws.onclose = () => {
                setConnected(false)
                if (!closed) {
                    // Tự reconnect sau 2 giây
                    retryTimer = setTimeout(connect, 2000)
                }
            }

            ws.onerror = () => {
                ws.close()
            }
        }

        connect()

        return () => {
            closed = true
            clearTimeout(retryTimer)
            wsRef.current?.close()
        }
    }, [url])

    return { state, connected }
}