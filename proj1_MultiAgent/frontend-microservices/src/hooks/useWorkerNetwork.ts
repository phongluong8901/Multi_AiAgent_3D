'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { distributedApi, PartnerNodeData } from '@/lib/api/distributed'
import { ownerApi, RentalSessionData } from '@/lib/api/owner'

export interface LiveWorkerNode extends PartnerNodeData {
    location?: {
        city: string
        country: string
        lat: number
        lng: number
        ip?: string
        isp?: string
    }
    bandwidthMbps?: number
    latencyMs?: number
}

const DEFAULT_LOCATION = {
    city: 'Hà Nội',
    country: 'Việt Nam',
    lat: 21.0285,
    lng: 105.8542,
}

/**
 * Hook đồng bộ duy nhất giữa trang "Kiểm tra Node AI" (/node-checker) và "Đối tác Mô hình" (/user-models).
 * Quy tắc cốt lõi:
 * - Một máy Seller CHỈ được tính là đang trực tuyến (IDLE/BUSY) và xuất hiện trên mạng lưới 3D
 *   khi ứng dụng Electron Worker (worker.exe / worker.py) đang thực sự chạy và truyền WebSocket.
 * - Khi tắt Electron Worker hoặc bấm Tạm Dừng, cả 2 trang lập tức chuyển trạng thái sang OFFLINE.
 */
export function useWorkerNetwork(currentUser?: { id?: string; name?: string; email?: string }) {
    const [allNodes, setAllNodes] = useState<LiveWorkerNode[]>([])
    const [activeConnections, setActiveConnections] = useState<RentalSessionData[]>([])
    const [loading, setLoading] = useState(true)
    const [wsConnected, setWsConnected] = useState(false)
    const [pingLatency, setPingLatency] = useState<number | null>(null)

    const fetchInitialSnapshot = useCallback(async (isInitial = false) => {
        if (isInitial) setLoading(true)
        const start = Date.now()
        try {
            const [distRes, connRes] = await Promise.all([
                distributedApi.listNodes().catch(() => null),
                ownerApi.getActiveConnections().catch(() => null),
            ])
            const rtt = Math.max(5, Math.round((Date.now() - start) / 2))

            if (connRes?.sessions) {
                setActiveConnections(connRes.sessions)
            } else if ((connRes as any)?.data?.activeRentals) {
                setActiveConnections((connRes as any).data.activeRentals)
            }

            const rawNodes: PartnerNodeData[] = distRes?.nodes || []
            const nowMs = Date.now()

            const normalized: LiveWorkerNode[] = rawNodes
                .filter((n) => n.id !== 'node-hanoi-cluster' && n.id !== 'node-saigon-worker')
                .map((n) => {
                    // Kiểm tra xem node có thực sự vừa gửi telemetry từ Electron Worker trong 15 giây qua không
                    const lastTs = n.lastTelemetry?.timestamp ? new Date(n.lastTelemetry.timestamp).getTime() : 0
                    const isFreshWorker = lastTs > 0 && nowMs - lastTs <= 20000
                    const effectiveStatus =
                        isFreshWorker && (n.status === 'IDLE' || n.status === 'BUSY') ? n.status : 'OFFLINE'

                    return {
                        ...n,
                        status: effectiveStatus,
                        location: DEFAULT_LOCATION,
                        bandwidthMbps: 1200,
                        latencyMs: rtt,
                    }
                })

            setAllNodes(normalized)
            if (normalized.some((n) => n.status === 'IDLE' || n.status === 'BUSY')) {
                setPingLatency(rtt)
            }
        } catch (err) {
            console.error('Lỗi đồng bộ danh sách Worker Node:', err)
        } finally {
            if (isInitial) setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchInitialSnapshot(true)

        let ws: WebSocket | null = null
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null
        let staleTimer: ReturnType<typeof setInterval> | null = null
        let isMounted = true

        const wsCandidates = [
            distributedApi.getDistributedWsUrl('web_listener_sync'),
            'ws://localhost:5010/api/v1/distributed/ws?nodeId=web_listener_sync',
        ]
        let urlIdx = 0

        const connectWs = () => {
            if (!isMounted) return
            const url = wsCandidates[urlIdx % wsCandidates.length]

            try {
                ws = new WebSocket(url)

                ws.onopen = () => {
                    if (!isMounted) return
                    setWsConnected(true)
                }

                ws.onmessage = (event: MessageEvent) => {
                    if (!isMounted) return
                    try {
                        const msg = JSON.parse(event.data)

                        // 1. Snapshot gửi xuống ngay khi mở WebSocket
                        if (msg.type === 'ACTIVE_WORKERS_SNAPSHOT' && Array.isArray(msg.nodes)) {
                            const nowMs = Date.now()
                            setAllNodes(
                                msg.nodes
                                    .filter((n: PartnerNodeData) => n.id !== 'node-hanoi-cluster' && n.id !== 'node-saigon-worker')
                                    .map((n: PartnerNodeData) => {
                                        const lastTs = n.lastTelemetry?.timestamp
                                            ? new Date(n.lastTelemetry.timestamp).getTime()
                                            : 0
                                        const isFresh = lastTs > 0 && nowMs - lastTs <= 20000
                                        return {
                                            ...n,
                                            status: isFresh && (n.status === 'IDLE' || n.status === 'BUSY') ? n.status : 'OFFLINE',
                                            location: DEFAULT_LOCATION,
                                            bandwidthMbps: 1200,
                                            latencyMs: 8,
                                        }
                                    })
                            )
                            return
                        }

                        // 2. Sự kiện Electron Worker ngắt kết nối hoặc tạm dừng chia sẻ
                        if (msg.type === 'WORKER_DISCONNECTED' || msg.type === 'PAUSE_SHARING') {
                            const disconnectedId = String(msg.nodeId || '')
                            setAllNodes((prev) =>
                                prev.map((n) =>
                                    !disconnectedId ||
                                    n.id === disconnectedId ||
                                    disconnectedId.includes(n.id) ||
                                    n.id.includes(disconnectedId)
                                        ? { ...n, status: 'OFFLINE' }
                                        : n
                                )
                            )
                            return
                        }

                        // 3. Sự kiện Electron Worker đang chạy và bắn gói tin SYSTEM_INFO / HARDWARE_STATS
                        if (
                            msg.type === 'SYSTEM_INFO' ||
                            msg.type === 'HARDWARE_STATS' ||
                            msg.cpu_percent !== undefined
                        ) {
                            const serverNode: PartnerNodeData | undefined = msg.node
                            const hostname = msg.os?.hostname || serverNode?.username || 'Seller_PC'
                            const incomingId =
                                serverNode?.id ||
                                (msg.nodeId && !String(msg.nodeId).startsWith('guest_worker_')
                                    ? String(msg.nodeId)
                                    : `worker_${String(hostname).toLowerCase().replace(/\s+/g, '_')}`)

                            const cpuCores =
                                serverNode?.hardware?.cpuCores || msg.hardware?.cpu?.count_logical || 8
                            const ramGB =
                                serverNode?.hardware?.deviceMemoryGB ||
                                (msg.hardware?.memory?.total
                                    ? Math.round(msg.hardware.memory.total / 1024 ** 3)
                                    : 16)
                            const gpuName =
                                serverNode?.hardware?.gpuName || msg.hardware?.gpu?.name || undefined
                            const vramGB =
                                serverNode?.hardware?.vramGB || msg.hardware?.gpu?.vram_gb || undefined
                            const ollamaModels: string[] =
                                Array.isArray(msg.ollama_models) && msg.ollama_models.length > 0
                                    ? msg.ollama_models
                                    : serverNode?.compatibleModels?.length
                                    ? serverNode.compatibleModels
                                    : ['qwen2.5-coder:1.5b']

                            const loc =
                                msg.location && msg.location.lat && msg.location.lon
                                    ? {
                                          city: msg.location.city || 'Hà Nội',
                                          country: msg.location.country || 'Việt Nam',
                                          lat: Number(msg.location.lat),
                                          lng: Number(msg.location.lon),
                                          ip: msg.location.ip,
                                          isp: msg.location.isp,
                                      }
                                    : DEFAULT_LOCATION

                            const isBusy = Boolean(
                                msg.llm_stats?.is_busy ||
                                msg.llm_is_busy ||
                                serverNode?.status === 'BUSY'
                            )

                            const effectiveStatus: 'IDLE' | 'BUSY' | 'OFFLINE' =
                                msg.status === 'OFFLINE' || serverNode?.status === 'OFFLINE'
                                    ? 'OFFLINE'
                                    : (isBusy ? 'BUSY' : 'IDLE')

                            const incomingLLMStats = msg.llm_stats || serverNode?.llmStats || (msg.llm_total_tokens !== undefined ? {
                                total_requests: msg.llm_total_requests || 0,
                                active_requests: msg.llm_active_requests || 0,
                                total_tokens: msg.llm_total_tokens || 0,
                                prompt_tokens: 0,
                                completion_tokens: msg.llm_total_tokens || 0,
                                tokens_per_sec: msg.llm_tokens_per_sec || 0,
                                last_latency_ms: msg.llm_last_latency_ms || 0,
                                current_model: msg.active_model || 'qwen2.5-coder:1.5b',
                                is_busy: isBusy,
                                status: isBusy ? 'INFERENCING' : 'IDLE',
                            } : undefined)

                            const nowIso = new Date().toISOString()
                            const telemetry = {
                                cpu_percent: Number(msg.cpu_percent ?? msg.hardware?.cpu?.percent ?? 0),
                                ram_percent: Number(msg.ram_percent ?? msg.hardware?.memory?.percent ?? 0),
                                disk_percent: Number(
                                    msg.disk_percent ?? msg.hardware?.disk?.[0]?.percent ?? 0
                                ),
                                gpu_percent: Number(
                                    msg.gpu_percent ?? msg.hardware?.gpu?.load_percent ?? 0
                                ),
                                timestamp: nowIso,
                            }

                            setPingLatency(8)

                            setAllNodes((prev) => {
                                // Tìm theo ID hoặc khớp node đã đăng ký của user hiện tại
                                const matchIdx = prev.findIndex(
                                    (n) =>
                                        n.id === incomingId ||
                                        (currentUser?.id && n.userId === currentUser.id) ||
                                        n.username === hostname
                                )

                                if (matchIdx >= 0) {
                                    const existing = prev[matchIdx]
                                    const updated: LiveWorkerNode = {
                                        ...existing,
                                        id: serverNode?.id || existing.id,
                                        username: existing.username || hostname,
                                        status: effectiveStatus,
                                        hardware: {
                                            ...existing.hardware,
                                            cpuCores,
                                            deviceMemoryGB: ramGB,
                                            hasWebGPU: Boolean(gpuName) || existing.hardware.hasWebGPU,
                                            gpuName: gpuName || existing.hardware.gpuName,
                                            vramGB: vramGB || existing.hardware.vramGB,
                                        },
                                        rentConfig: serverNode?.rentConfig || msg.rentConfig || existing.rentConfig,
                                        llmStats: incomingLLMStats || existing.llmStats,
                                        compatibleModels: ollamaModels,
                                        activeModel: ollamaModels[0],
                                        totalCoinsEarned:
                                            serverNode?.totalCoinsEarned ??
                                            Number(((existing.totalCoinsEarned || 0) + (isBusy ? 0.05 : 0.02)).toFixed(2)),
                                        uptimeSeconds: (existing.uptimeSeconds || 0) + 2,
                                        lastTelemetry: telemetry,
                                        location: loc || existing.location || DEFAULT_LOCATION,
                                        bandwidthMbps: 1200,
                                        latencyMs: 8,
                                        updatedAt: nowIso,
                                    }
                                    const copy = [...prev]
                                    copy[matchIdx] = updated
                                    return copy
                                }

                                const newNode: LiveWorkerNode = {
                                    id: incomingId,
                                    userId: currentUser?.id || 'seller_worker',
                                    username: hostname,
                                    email: currentUser?.email || '',
                                    status: effectiveStatus,
                                    hardware: {
                                        cpuCores,
                                        deviceMemoryGB: ramGB,
                                        hasWebGPU: Boolean(gpuName),
                                        gpuName: gpuName || 'CPU Mode',
                                        vramGB,
                                    },
                                    rentConfig: serverNode?.rentConfig || msg.rentConfig || {
                                        allocatedCores: Math.max(2, Math.floor(cpuCores / 2)),
                                        allocatedRAMGB: Math.max(4, Math.floor(ramGB / 2)),
                                        enableGPU: Boolean(gpuName),
                                        gpuSharePercent: 80,
                                        availabilitySchedule: '24/7',
                                        minPricePerHourCoin: 35,
                                        maxTokens: 2048,
                                        contextLength: 4096,
                                        temperature: 0.7,
                                        defaultModel: 'qwen2.5-coder:1.5b',
                                        maxConcurrentTasks: 2,
                                    },
                                    llmStats: incomingLLMStats,
                                    compatibleModels: ollamaModels,
                                    activeModel: ollamaModels[0],
                                    totalCoinsEarned: serverNode?.totalCoinsEarned || 0,
                                    uptimeSeconds: 2,
                                    lastTelemetry: telemetry,
                                    authToken: serverNode?.authToken || '',
                                    createdAt: nowIso,
                                    updatedAt: nowIso,
                                    location: loc,
                                    bandwidthMbps: 1200,
                                    latencyMs: 8,
                                }
                                return [newNode, ...prev]
                            })
                        }
                    } catch {
                        // Bỏ qua gói tin không phải JSON
                    }
                }

                ws.onclose = () => {
                    if (!isMounted) return
                    setWsConnected(false)
                    urlIdx += 1
                    reconnectTimer = setTimeout(connectWs, 3500)
                }

                ws.onerror = () => {
                    // onclose xử lý tự động
                }
            } catch {
                urlIdx += 1
                reconnectTimer = setTimeout(connectWs, 3500)
            }
        }

        connectWs()

        // Bộ kiểm tra timeout cục bộ: nếu quá 12 giây không nhận được gói tin WebSocket nào từ Worker thì tự đánh dấu OFFLINE
        staleTimer = setInterval(() => {
            const nowMs = Date.now()
            setAllNodes((prev) =>
                prev.map((n) => {
                    if (n.status === 'OFFLINE') return n
                    const lastTs = n.lastTelemetry?.timestamp
                        ? new Date(n.lastTelemetry.timestamp).getTime()
                        : 0
                    if (!lastTs || nowMs - lastTs > 12000) {
                        return { ...n, status: 'OFFLINE' }
                    }
                    return n
                })
            )
        }, 4000)

        return () => {
            isMounted = false
            if (reconnectTimer) clearTimeout(reconnectTimer)
            if (staleTimer) clearInterval(staleTimer)
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close()
            }
        }
    }, [fetchInitialSnapshot, currentUser?.id, currentUser?.email])

    // Danh sách các Node ĐANG CHẠY Electron Worker trực tuyến (IDLE hoặc BUSY)
    const onlineNodes = useMemo(
        () => allNodes.filter((n) => n.status === 'IDLE' || n.status === 'BUSY'),
        [allNodes]
    )

    // Node của Seller hiện tại (ưu tiên node đang online qua Electron Worker, tiếp theo là node đã đăng ký cấu hình của user)
    const myNode = useMemo(() => {
        if (onlineNodes.length > 0) {
            if (currentUser?.id) {
                const matchedOnline = onlineNodes.find((n) => n.userId === currentUser.id)
                if (matchedOnline) return matchedOnline
            }
            return onlineNodes[0]
        }
        if (currentUser?.id) {
            return allNodes.find((n) => n.userId === currentUser.id) || null
        }
        return allNodes[0] || null
    }, [allNodes, onlineNodes, currentUser?.id])

    const toggleNodeStatus = useCallback(async (nodeId: string, currentStatus: string) => {
        const isOnline = currentStatus === 'IDLE' || currentStatus === 'BUSY'
        const nextStatus = isOnline ? 'OFFLINE' : 'IDLE'
        const res = await distributedApi.toggleNodeStatus(nodeId, nextStatus)
        if (res.success) {
            const finalStatus = (res.status as any) || nextStatus
            setAllNodes((prev) =>
                prev.map((n) => (n.id === nodeId ? { ...n, status: finalStatus } : n))
            )
        }
        return res
    }, [])

    const upsertRegisteredNode = useCallback((newNode: PartnerNodeData) => {
        // Khi đăng ký trên Web xong nhưng chưa bật Electron Worker -> luôn giữ status OFFLINE cho tới khi Worker kết nối
        const prepared: LiveWorkerNode = {
            ...newNode,
            status: 'OFFLINE',
            location: DEFAULT_LOCATION,
            bandwidthMbps: 1200,
            latencyMs: 12,
        }
        setAllNodes((prev) => {
            const exists = prev.some((n) => n.id === prepared.id)
            if (exists) {
                return prev.map((n) => (n.id === prepared.id ? { ...n, ...prepared, status: n.status } : n))
            }
            return [prepared, ...prev]
        })
    }, [])

    return {
        allNodes,
        onlineNodes,
        myNode,
        activeConnections,
        loading,
        wsConnected,
        pingLatency,
        refreshSnapshot: () => fetchInitialSnapshot(false),
        toggleNodeStatus,
        upsertRegisteredNode,
    }
}

