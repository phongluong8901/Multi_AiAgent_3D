'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ChatRoomRedirect() {
  const params = useParams()
  const router = useRouter()
  const roomId = String(params.roomId)

  useEffect(() => {
    router.replace(`/rooms/${roomId}`)
  }, [router, roomId])

  return (
    <div className="flex items-center justify-center min-h-[50vh] text-zinc-500 text-sm">
      Đang chuyển hướng tới Phòng Cộng Tác #{roomId}...
    </div>
  )
}
