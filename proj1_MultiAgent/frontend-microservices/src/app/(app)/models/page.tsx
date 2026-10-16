'use client'

import { useEffect, useState } from 'react'
import { listModels, AIModel } from '@/lib/api'

export default function ModelsPage() {
    const [models, setModels] = useState<AIModel[]>([])
    const [loading, setLoading] = useState(true)
    const [fromApi, setFromApi] = useState(false)

    useEffect(() => {
        listModels()
            .then((data) => {
                setModels(data)
                // Nếu không phải fallback cứng hoàn toàn — có thể check length/source sau
                setFromApi(true)
            })
            .finally(() => setLoading(false))
    }, [])

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-semibold">AI Models</h1>
                <p className="text-sm text-zinc-400 mt-1">
                    Model hiện có (từ API `/models` hoặc danh sách mặc định phía FE).
                    Gắn vào agent khi BE hỗ trợ field model.
                </p>
            </div>

            {loading && <p className="text-zinc-500 text-sm">Loading...</p>}

            <div className="grid sm:grid-cols-2 gap-3">
                {models.map((m) => (
                    <div
                        key={m.id}
                        className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="font-medium">{m.name}</h2>
                            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                                {m.provider}
                            </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">{m.id}</p>
                        <p className="text-sm text-zinc-400 mt-2">
                            {m.description || '—'}
                        </p>
                    </div>
                ))}
            </div>

            <p className="text-xs text-zinc-600">
                {fromApi
                    ? 'Đã load list models (API hoặc fallback).'
                    : ''}
            </p>
        </div>
    )
}