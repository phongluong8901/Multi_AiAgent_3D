import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    authService,
    RegisterPayload,
    LoginPayload,
    VerifyOtpPayload,
    ResendOtpPayload,
    GoogleAuthPayload,
    GithubAuthPayload,
    HuggingfaceAuthPayload,
} from '@/lib/api'
import { setSession } from '@/lib/auth'
import { notify } from '@/lib/toast'

function pickTokenAndUser(data: any) {
    const payload = data?.data ?? data
    const token = payload?.accessToken || payload?.token || payload?.access_token
    const user = payload?.user
    if (!token || !user) {
        throw new Error('Response thiếu accessToken hoặc user')
    }
    return {
        token,
        user: {
            id: String(user.id || user._id),
            name: user.username || user.name || user.email,
            email: user.email,
            role: user.role || 'user', // 👈 Bổ sung dòng này để bắt role từ lúc đăng nhập!
            avatar: user.avatarUrl || user.avatar || '',
            avatarUrl: user.avatarUrl || user.avatar || '',
            status: user.status || 'online',
            bio: user.bio || '',
            ownedAgentIds: user.ownedAgentIds || [],
        },
    }
}

function errMsg(err: unknown, fallback: string) {
    if (err instanceof Error && err.message) return err.message
    return fallback
}

export function useAuth() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)

    const clearMessages = () => {
        setError(null)
        setMessage(null)
    }

    const register = async (payload: RegisterPayload) => {
        clearMessages()
        setLoading(true)
        try {
            const data = await authService.register(payload)
            if (data.success) {
                notify.success('Đăng ký thành công', {
                    description: 'Vui lòng kiểm tra email để lấy mã OTP',
                })
                router.replace(`/verify-otp?email=${encodeURIComponent(payload.email)}`)
            }
            return data
        } catch (err) {
            const msg = errMsg(err, 'Đăng ký thất bại')
            setError(msg)
            notify.error('Đăng ký thất bại', { description: msg })
            throw new Error(msg)
        } finally {
            setLoading(false)
        }
    }

    const verifyOtp = async (payload: VerifyOtpPayload) => {
        clearMessages()
        setLoading(true)
        try {
            const data = await authService.verifyOtp(payload)
            if (data.success) {
                const okMsg =
                    data.data?.message || 'Xác thực OTP thành công! Bạn có thể đăng nhập.'
                setMessage(okMsg)
                notify.success('Xác thực thành công', {
                    description: 'Chuyển sang trang đăng nhập...',
                })
                setTimeout(() => router.replace('/login'), 1200)
            }
            return data
        } catch (err) {
            const msg = errMsg(err, 'Xác thực OTP thất bại')
            setError(msg)
            notify.error('OTP không hợp lệ', { description: msg })
            throw new Error(msg)
        } finally {
            setLoading(false)
        }
    }

    const resendOtp = async (payload: ResendOtpPayload) => {
        clearMessages()
        setLoading(true)
        try {
            const data = await authService.resendOtp(payload)
            if (data.success) {
                setMessage('Mã OTP mới đã được gửi tới email của bạn.')
                notify.success('Đã gửi lại OTP', { description: payload.email })
            }
            return data
        } catch (err) {
            const msg = errMsg(err, 'Không thể gửi lại mã OTP')
            setError(msg)
            notify.error('Gửi OTP thất bại', { description: msg })
            throw new Error(msg)
        } finally {
            setLoading(false)
        }
    }

    const login = async (payload: LoginPayload) => {
        clearMessages()
        setLoading(true)
        try {
            const data = await authService.login(payload)
            if (data.success) {
                const { token, user } = pickTokenAndUser(data)
                setSession(token, user)
                notify.success('Đăng nhập thành công', {
                    description: `Xin chào, ${user.name}`,
                })
                router.replace('/dashboard')
            }
            return data
        } catch (err) {
            const msg = errMsg(err, 'Đăng nhập thất bại')
            setError(msg)
            notify.error('Đăng nhập thất bại', { description: msg })
            throw new Error(msg)
        } finally {
            setLoading(false)
        }
    }

    const googleLogin = async (payload: GoogleAuthPayload) => {
        clearMessages()
        setLoading(true)
        try {
            const data = await authService.googleAuth(payload)
            if (data.success) {
                const { token, user } = pickTokenAndUser(data)
                setSession(token, user)
                notify.success('Đăng nhập Google thành công', {
                    description: `Xin chào, ${user.name}`,
                })
                router.replace('/dashboard')
            }
            return data
        } catch (err) {
            const msg = errMsg(err, 'Đăng nhập Google thất bại')
            setError(msg)
            notify.error('Google login thất bại', { description: msg })
            throw new Error(msg)
        } finally {
            setLoading(false)
        }
    }

    const startGithubLogin = () => {
        const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID
        if (!clientId) {
            const msg = 'Thiếu NEXT_PUBLIC_GITHUB_CLIENT_ID'
            setError(msg)
            notify.error(msg)
            return
        }
        const redirectUri = `${window.location.origin}/auth/github/callback`
        const scope = 'read:user user:email'
        const url =
            `https://github.com/login/oauth/authorize` +
            `?client_id=${encodeURIComponent(clientId)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=${encodeURIComponent(scope)}`
        notify.info('Chuyển tới GitHub...')
        window.location.href = url
    }

    const githubLogin = async (payload: GithubAuthPayload) => {
        clearMessages()
        setLoading(true)
        try {
            const data = await authService.githubAuth(payload)
            if (data.success) {
                const { token, user } = pickTokenAndUser(data)
                setSession(token, user)
                notify.success('Đăng nhập GitHub thành công', {
                    description: `Xin chào, ${user.name}`,
                })
                router.replace('/dashboard')
            }
            return data
        } catch (err) {
            const msg = errMsg(err, 'Đăng nhập GitHub thất bại')
            setError(msg)
            notify.error('GitHub login thất bại', { description: msg })
            throw new Error(msg)
        } finally {
            setLoading(false)
        }
    }

    const startHuggingfaceLogin = () => {
        const clientId = process.env.NEXT_PUBLIC_HUGGINGFACE_CLIENT_ID
        if (!clientId) {
            const msg = 'Thiếu NEXT_PUBLIC_HUGGINGFACE_CLIENT_ID'
            setError(msg)
            notify.error(msg)
            return
        }
        const redirectUri = `${window.location.origin}/auth/huggingface/callback`
        const scope = 'openid profile email'
        const state = Math.random().toString(36).substring(2)
        const url =
            `https://huggingface.co/oauth/authorize` +
            `?response_type=code` +
            `&client_id=${encodeURIComponent(clientId)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=${encodeURIComponent(scope)}` +
            `&state=${encodeURIComponent(state)}`
        notify.info('Chuyển tới Hugging Face...')
        window.location.href = url
    }

    const huggingfaceLogin = async (payload: HuggingfaceAuthPayload) => {
        clearMessages()
        setLoading(true)
        try {
            const redirectUri = typeof window !== 'undefined' ? `${window.location.origin}/auth/huggingface/callback` : undefined
            const data = await authService.huggingfaceAuth({ ...payload, redirectUri: payload.redirectUri || redirectUri })
            if (data.success) {
                const { token, user } = pickTokenAndUser(data)
                setSession(token, user)
                notify.success('Đăng nhập Hugging Face thành công', {
                    description: `Xin chào, ${user.name}`,
                })
                router.replace('/dashboard')
            }
            return data
        } catch (err) {
            const msg = errMsg(err, 'Đăng nhập Hugging Face thất bại')
            setError(msg)
            notify.error('Hugging Face login thất bại', { description: msg })
            throw new Error(msg)
        } finally {
            setLoading(false)
        }
    }

    return {
        loading,
        error,
        message,
        register,
        verifyOtp,
        resendOtp,
        login,
        googleLogin,
        startGithubLogin,
        githubLogin,
        startHuggingfaceLogin,
        huggingfaceLogin,
        clearMessages,
    }
}