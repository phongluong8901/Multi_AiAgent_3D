import { getToken, getUser } from '@/lib/auth'

/**
 * Địa chỉ gốc của API Gateway (mặc định trỏ về cổng 4000 `/api/v1`).
 */
export const API_BASE =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

/**
 * Hàm gọi HTTP REST API trung tâm cho toàn bộ Frontend Microservices.
 * Tự động đính kèm JWT Bearer Token, `x-user-id` header và chuẩn hóa thông báo lỗi JSON/HTML.
 *
 * @param path Đường dẫn endpoint (ví dụ: `/agents` hoặc `/rooms/user-user`)
 * @param options Cấu hình `RequestInit` tùy chọn của Fetch API
 * @returns Dữ liệu phản hồi đã được giải mã JSON theo kiểu `T`
 */
export async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const token = getToken()
    const user = getUser()

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string>),
    }

    // Tự động đính kèm Bearer Token xác thực nếu người dùng đã đăng nhập
    if (token) {
        headers['Authorization'] = `Bearer ${token}`
    }

    // Đính kèm định danh người dùng hỗ trợ phân quyền tại tầng Gateway / Microservices
    if (user?.id) {
        headers['x-user-id'] = user.id
    }

    // Chuẩn hóa đường dẫn: Nếu API_BASE đã có `/api/v1` mà path truyền vào cũng bắt đầu bằng `/api/v1`, loại bỏ tiền tố thừa
    const normalizedPath = path.startsWith('/api/v1') ? path.replace(/^\/api\/v1/, '') : path
    const url = `${API_BASE}${normalizedPath.startsWith('/') ? normalizedPath : '/' + normalizedPath}`

    const res = await fetch(url, {
        ...options,
        headers,
    })

    // Xử lý và bóc tách thông điệp lỗi chi tiết khi HTTP status không nằm trong dải 2xx
    if (!res.ok) {
        const text = await res.text()
        let errorMsg = text
        try {
            const parsed = JSON.parse(text)
            errorMsg = parsed.message || parsed.detail || parsed.error || text
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
