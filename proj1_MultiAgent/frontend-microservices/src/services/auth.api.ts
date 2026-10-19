import axios from 'axios';

// Base URL chỉ trỏ tới API Gateway (Cổng 4000)
const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:4000/api/v1';

const authApi = axios.create({
    baseURL: `${API_GATEWAY_URL}/users`,
    headers: {
        'Content-Type': 'application/json',
    },
});

export interface RegisterPayload {
    username: string;
    email: string;
    password?: string;
}

export interface LoginPayload {
    email: string;
    password?: string;
}

export interface VerifyOtpPayload {
    email: string;
    otp: string;
}

export interface ResendOtpPayload {
    email: string;
}

export interface GoogleAuthPayload {
    idToken: string;
}

export interface GithubAuthPayload {
    code: string
}

export const authService = {
    register: async (payload: RegisterPayload) => {
        const res = await authApi.post('/register', payload);
        return res.data;
    },

    login: async (payload: LoginPayload) => {
        const res = await authApi.post('/login', payload);
        return res.data;
    },

    verifyOtp: async (payload: VerifyOtpPayload) => {
        const res = await authApi.post('/verify-otp', payload);
        return res.data;
    },

    resendOtp: async (payload: ResendOtpPayload) => {
        const res = await authApi.post('/resend-otp', payload);
        return res.data;
    },

    googleAuth: async (payload: GoogleAuthPayload) => {
        const res = await authApi.post('/google', payload);
        return res.data;
    },

    githubAuth: async (payload: GithubAuthPayload) => {
        const res = await authApi.post('/github', payload)
        return res.data
    },
};