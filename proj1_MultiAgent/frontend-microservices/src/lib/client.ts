import { getToken, getUser } from '@/lib/auth'

export const API_BASE =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const token = getToken()
    const user = getUser()

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string>),
    }

    // Bơm Token nếu có
    if (token) {
        headers['Authorization'] = `Bearer ${token}`
    }

    // Bơm x-user-id nếu có
    if (user?.id) {
        headers['x-user-id'] = user.id
    }

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    })

    if (!res.ok) {
        const text = await res.text()
        let errorMsg = text
        try {
            const parsed = JSON.parse(text)
            errorMsg = parsed.message || parsed.error || text
        } catch (_) {
            const preMatch = text.match(/<pre>([\s\S]*?)<\/pre>/i)
            if (preMatch && preMatch[1]) {
                const clean = preMatch[1].replace(/<br\s*[\/]?>/gi, ' ').replace(/&nbsp;/gi, ' ').trim()
                errorMsg = clean.split('\n')[0]
            }
        }
        throw new Error(errorMsg || `HTTP ${res.status}`)
    }

    if (res.status === 204) return undefined as T
    return res.json()
}