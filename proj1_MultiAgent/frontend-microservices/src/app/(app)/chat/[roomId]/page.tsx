'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { agentsApi } from '@/lib/api'

type Message = {
  id: string
  from: string
  text: string
  at: string
}

export default function ChatRoomPage() {
  const params = useParams()
  const roomId = String(params.roomId)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      from: 'system',
      text: `Room #${roomId} — chat qua POST /agents/{id}/chat`,
      at: new Date().toLocaleTimeString(),
    },
  ])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const text = input.trim()
    setInput('')
    setMessages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        from: 'you',
        text,
        at: new Date().toLocaleTimeString(),
      },
    ])

    // room general: không gọi agent cụ thể
    if (roomId === 'general') {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          from: 'system',
          text: 'Chọn room theo agent id để chat với BE.',
          at: new Date().toLocaleTimeString(),
        },
      ])
      return
    }

    setLoading(true)
    try {
      const res = await agentsApi.chat(roomId, text, roomId)
      const reply = res.success
        ? res.answer ?? '(empty answer)'
        : res.error ?? 'Chat failed'
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 2),
          from: roomId,
          text: reply,
          at: new Date().toLocaleTimeString(),
        },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 3),
          from: 'system',
          text: err instanceof Error ? err.message : 'Error',
          at: new Date().toLocaleTimeString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">#{roomId}</h1>
          <p className="text-xs text-zinc-400">Agents Service chat</p>
        </div>
        <Link href="/chat" className="text-sm text-blue-400 hover:underline">
          ← Rooms
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className="text-sm">
            <span className="text-zinc-500 text-xs mr-2">{m.at}</span>
            <span className="font-medium text-zinc-300">{m.from}: </span>
            <span>{m.text}</span>
          </div>
        ))}
      </div>

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhập tin nhắn..."
          disabled={loading}
          className="flex-1 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 py-2.5 text-sm transition"
        >
          {loading ? '...' : 'Gửi'}
        </button>
      </form>
    </div>
  )
}