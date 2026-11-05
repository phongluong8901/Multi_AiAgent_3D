const TOKEN_KEY = 'claw_token'
const USER_KEY = 'claw_user'

export type User = {
    id: string
    name: string
    email: string
    role?: 'admin' | 'seller' | 'user' | 'guest' | string
    avatar?: string
    avatarUrl?: string
}

export function getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(TOKEN_KEY)
}

export function getUser(): User | null {
    if (typeof window === 'undefined') return null
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    try {
        return JSON.parse(raw)
    } catch {
        return null
    }
}

export function setSession(token: string, user: User) {
    if (typeof window === 'undefined') return

    // Xóa sạch dữ liệu cũ trước khi gán session mới
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)

    // Lưu thông tin mới vào localStorage
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))

    // Đồng bộ vào Cookie
    try {
        document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`
        document.cookie = `${USER_KEY}=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=604800; SameSite=Lax`
    } catch {
        // bỏ qua
    }
}

export function clearSession() {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        try {
            document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; SameSite=Lax`
            document.cookie = `${USER_KEY}=; path=/; max-age=0; SameSite=Lax`
        } catch {
            // bỏ qua
        }
    }
}

export function isLoggedIn(): boolean {
    return !!getToken()
}
