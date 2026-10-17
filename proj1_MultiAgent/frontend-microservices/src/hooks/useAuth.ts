import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    authService,
    RegisterPayload,
    LoginPayload,
    VerifyOtpPayload,
    ResendOtpPayload,
    GoogleAuthPayload
} from '@/services/auth.api';
import { setSession } from '@/lib/auth';

export function useAuth() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const clearMessages = () => {
        setError(null);
        setMessage(null);
    };

    // Đăng ký tài khoản
    const register = async (payload: RegisterPayload) => {
        clearMessages();
        setLoading(true);
        try {
            const data = await authService.register(payload);
            if (data.success) {
                // Đăng ký xong chuyển sang trang Verify OTP
                router.replace(`/verify-otp?email=${encodeURIComponent(payload.email)}`);
            }
            return data;
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Đăng ký thất bại';
            setError(msg);
            throw new Error(msg);
        } finally {
            setLoading(false);
        }
    };

    // Xác thực mã OTP
    const verifyOtp = async (payload: VerifyOtpPayload) => {
        clearMessages();
        setLoading(true);
        try {
            const data = await authService.verifyOtp(payload);
            if (data.success) {
                setMessage(data.data?.message || 'Xác thực OTP thành công!');
                setTimeout(() => {
                    router.replace('/login');
                }, 1500);
            }
            return data;
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Xác thực OTP thất bại';
            setError(msg);
            throw new Error(msg);
        } finally {
            setLoading(false);
        }
    };

    // Gửi lại mã OTP
    const resendOtp = async (payload: ResendOtpPayload) => {
        clearMessages();
        setLoading(true);
        try {
            const data = await authService.resendOtp(payload);
            if (data.success) {
                setMessage('Mã OTP mới đã được gửi tới email của bạn.');
            }
            return data;
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Không thể gửi lại mã OTP';
            setError(msg);
            throw new Error(msg);
        } finally {
            setLoading(false);
        }
    };

    // Đăng nhập truyền thống
    const login = async (payload: LoginPayload) => {
        clearMessages();
        setLoading(true);
        try {
            const data = await authService.login(payload);
            if (data.success) {
                const { token, user } = data.data;
                setSession(token, {
                    id: user.id,
                    name: user.username,
                    email: user.email,
                });
                router.replace('/dashboard');
            }
            return data;
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Đăng nhập thất bại';
            setError(msg);
            throw new Error(msg);
        } finally {
            setLoading(false);
        }
    };

    // Đăng nhập / Đăng ký qua Google
    const googleLogin = async (payload: GoogleAuthPayload) => {
        clearMessages();
        setLoading(true);
        try {
            const data = await authService.googleAuth(payload);
            if (data.success) {
                const { token, user } = data.data;
                setSession(token, {
                    id: user.id,
                    name: user.username,
                    email: user.email,
                });
                router.replace('/dashboard');
            }
            return data;
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Đăng nhập Google thất bại';
            setError(msg);
            throw new Error(msg);
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        error,
        message,
        register,
        verifyOtp,
        resendOtp,
        login,
        googleLogin,
        clearMessages,
    };
}