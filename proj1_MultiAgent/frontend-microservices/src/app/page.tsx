'use client'

import { useEffect } from 'react'
import { isLoggedIn } from '@/lib/auth'

export default function RootPage() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (isLoggedIn()) {
        window.location.replace('/dashboard')
      } else {
        window.location.replace('/login')
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-3 text-zinc-400 text-sm">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <span>Đang điều hướng...</span>
    </div>
  )
}
