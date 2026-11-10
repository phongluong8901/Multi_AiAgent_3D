'use client'

import Scene from '@/components/Scene'
import TaskPanel from '@/components/ui/TaskPanel'
import { useGateway } from '@/hooks/useGateway'

export default function Home() {
  const { state, connected } = useGateway()

  return (
    <div className="relative w-full h-screen">
      <Scene agents={state?.agents ?? []} />

      {/* Task panel */}
      <TaskPanel />

      {/* Trạng thái kết nối */}
      <div className="absolute top-4 left-4 bg-black/70 text-white text-xs px-3 py-1.5 rounded-lg">
        Gateway: {connected ? 'Connected' : 'Disconnected'}
      </div>
    </div>
  )
}