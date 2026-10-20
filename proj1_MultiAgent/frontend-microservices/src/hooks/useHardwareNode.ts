'use client'

import { useState, useEffect } from 'react'
import { HardwareReport, hardwareApi } from '@/lib/api/hardware'
import { HARDWARE_RAM_TIERS } from '@/constants/hardware'

export function useHardwareNode() {
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [report, setReport] = useState<HardwareReport | null>(null)
    const [isRegistered, setIsRegistered] = useState(false) // 👉 Thêm trạng thái kiểm tra đã đăng ký chưa

    useEffect(() => {
        async function inspectHardware() {
            setLoading(true)

            const cpuCores = navigator.hardwareConcurrency || 2
            const deviceMemoryGB = (navigator as any).deviceMemory || 4

            let hasWebGPU = false
            let gpuName = 'Không khả dụng'

            if ('gpu' in navigator) {
                try {
                    const adapter = await (navigator as any).gpu.requestAdapter()
                    if (adapter) {
                        hasWebGPU = true
                        const info = await adapter.requestAdapterInfo?.()
                        gpuName = info?.description || info?.vendor || 'WebGPU Supported'
                    }
                } catch {
                    // Bỏ qua nếu trình duyệt không hỗ trợ WebGPU
                }
            }

            const tier = HARDWARE_RAM_TIERS.find((t) => deviceMemoryGB >= t.minRAM)
            const canRunAI = !!tier
            const recommendedModels = tier ? [...tier.models] : []

            let savedStatus: 'IDLE' | 'BUSY' | 'OFFLINE' = 'IDLE'
            let lastSeen = new Date().toISOString()
            let registeredFlag = false

            try {
                const res = await hardwareApi.getNode()
                // Kiểm tra xem backend đã có dữ liệu hardwareNode thực tế chưa
                const nodeData = res?.data ?? res
                if (nodeData && nodeData.canRunAI !== undefined) {
                    savedStatus = nodeData.status || 'IDLE'
                    if (nodeData.lastSeen) lastSeen = nodeData.lastSeen
                    registeredFlag = true // 👉 Đã có thông tin đăng ký trên server
                }
            } catch {
                // User chưa từng đăng ký node trước đó
            }

            setReport({
                cpuCores,
                deviceMemoryGB,
                hasWebGPU,
                gpuName,
                recommendedModels,
                canRunAI,
                status: savedStatus,
                lastSeen,
            })
            setIsRegistered(registeredFlag)
            setLoading(false)
        }

        inspectHardware()
    }, [])

    const registerNode = async () => {
        if (!report) return { success: false, error: 'Không có dữ liệu phần cứng' }
        setSubmitting(true)
        try {
            const res = await hardwareApi.registerNode(report)
            setIsRegistered(true) // Cập nhật lại cờ sau khi đăng ký thành công
            setSubmitting(false)
            return { success: true, data: res }
        } catch (err: any) {
            setSubmitting(false)
            return { success: false, error: err.message || 'Lỗi đăng ký nút' }
        }
    }

    return { loading, submitting, report, isRegistered, registerNode }
}