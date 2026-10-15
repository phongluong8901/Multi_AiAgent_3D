'use client'

import { useEffect, useState } from 'react'
import Scene from '@/components/Scene'
import TaskPanel from '@/components/ui/TaskPanel'

export default function Home() {
  const [backendStatus, setBackendStatus] = useState('Đang kiểm tra...')

  useEffect(() => {
    fetch('http://localhost:4000/api/health')
      .then(res => res.json())
      .then(data => {
        setBackendStatus(data.message)
      })
      .catch(() => {
        setBackendStatus('Không kết nối được Backend')
      })
  }, [])

  return (
    <div className="relative w-full h-screen">
      {/* 3D Scene */}
      <Scene />
      <TaskPanel />

      {/* Overlay trạng thái Backend */}
      <div className="absolute top-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg text-sm">
        Backend: {backendStatus}
      </div>
    </div>
  )
}