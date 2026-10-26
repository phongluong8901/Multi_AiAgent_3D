import { request } from '../client'

export type RegisterPayload = {
    username: string
    email: string
    password?: string
}

export type LoginPayload = {
    email: string
    password?: string
}

export type VerifyOtpPayload = {
    email: string
    otp: string
}

export type ResendOtpPayload = {
    email: string
}

export type GoogleAuthPayload = {
    idToken: string
}

export type GithubAuthPayload = {
    code: string
}

export type HuggingfaceAuthPayload = {
    code: string
    redirectUri?: string
}

/** Giữ tên authService để useAuth khỏi đổi nhiều */
export const authService = {
    register: (payload: RegisterPayload) =>
        request<any>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    login: (payload: LoginPayload) =>
        request<any>('/auth/login', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    verifyOtp: (payload: VerifyOtpPayload) =>
        request<any>('/auth/verify-otp', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    resendOtp: (payload: ResendOtpPayload) =>
        request<any>('/auth/resend-otp', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    googleAuth: (payload: GoogleAuthPayload) =>
        request<any>('/auth/google', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    githubAuth: (payload: GithubAuthPayload) =>
        request<any>('/auth/github', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    huggingfaceAuth: (payload: HuggingfaceAuthPayload) =>
        request<any>('/auth/huggingface', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
}