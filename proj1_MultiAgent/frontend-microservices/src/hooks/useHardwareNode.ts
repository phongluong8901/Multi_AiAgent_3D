'use client'

import { useState, useEffect } from 'react'
import { HardwareReport, hardwareApi } from '@/lib/api/hardware'
import { HARDWARE_RAM_TIERS } from '@/constants/hardware'

/**
 * Hook kiểm định cấu hình phần cứng trình duyệt/máy trạm cục bộ (CPU, RAM, WebGPU)
 * và quản lý trạng thái đăng ký Worker Node với hệ thống.
 */
export function useHardwareNode() {
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [report, setReport] = useState<HardwareReport | null>(null)
    // Trạng thái kiểm tra thiết bị đã đăng ký làm Node trên server chưa
    const [isRegistered, setIsRegistered] = useState(false)

    useEffect(() => {
        /**
         * Quét thông số phần cứng thông qua Web APIs (navigator.hardwareConcurrency, deviceMemory, WebGPU)
         * và đồng bộ trạng thái node đã lưu từ backend.
         */
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
                    registeredFlag = true // Đã có thông tin đăng ký trên server
                }
            } catch {
                // Người dùng chưa từng đăng ký node trước đó
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

    /**
     * Đăng ký thông số phần cứng hiện tại làm nút tính toán (Worker Node).
     */
    const registerNode = async () => {
        if (!report) return { success: false, error: 'Không có dữ liệu phần cứng' }
        setSubmitting(true)
        try {
            const res = await hardwareApi.registerNode(report)
            setIsRegistered(true) // Cập nhật lại cờ sau khi đăng ký thành công
            setReport((prev) => (prev ? { ...prev, status: 'IDLE' } : null))
            setSubmitting(false)
            return { success: true, data: res }
        } catch (err: any) {
            setSubmitting(false)
            return { success: false, error: err.message || 'Lỗi đăng ký nút' }
        }
    }

    /**
     * Hủy kích hoạt và gỡ đăng ký nút phần cứng khỏi hệ thống.
     */
    const unregisterNode = async () => {
        setSubmitting(true)
        try {
            await hardwareApi.deleteNode()
            setIsRegistered(false)
            setReport((prev) => (prev ? { ...prev, status: 'OFFLINE' } : null))
            setSubmitting(false)
            return { success: true }
        } catch (err: any) {
            setSubmitting(false)
            return { success: false, error: err.message || 'Lỗi hủy kích hoạt nút' }
        }
    }

    return { loading, submitting, report, isRegistered, registerNode, unregisterNode }
}
