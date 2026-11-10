import bcrypt from 'bcrypt'

const SALT_ROUNDS = 10

/**
 * Mã hóa (hash) một chuỗi văn bản (ví dụ: mật khẩu phòng, mật khẩu user)
 * @param plainText Chuỗi gốc cần hash
 * @returns Chuỗi đã được hash an toàn
 */
export async function hashText(plainText: string): Promise<string> {
    if (!plainText) return ''
    return await bcrypt.hash(plainText, SALT_ROUNDS)
}

/**
 * Kiểm tra xem chuỗi nhập vào có khớp với chuỗi đã hash hay không
 * @param plainText Chuỗi người dùng nhập (ví dụ lúc join phòng)
 * @param hashedText Chuỗi đã hash lưu trong cơ sở dữ liệu
 * @returns true nếu khớp, ngược lại false
 */
export async function compareText(plainText: string, hashedText: string): Promise<boolean> {
    if (!plainText || !hashedText) return false
    return await bcrypt.compare(plainText, hashedText)
}