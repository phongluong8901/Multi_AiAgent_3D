import { request } from './client'

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

/** Giữ tên authService để useAuth khỏi đổi nhiều */
export const authService = {
    register: (payload: RegisterPayload) =>
        request<any>('/users/register', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    login: (payload: LoginPayload) =>
        request<any>('/users/login', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    verifyOtp: (payload: VerifyOtpPayload) =>
        request<any>('/users/verify-otp', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    resendOtp: (payload: ResendOtpPayload) =>
        request<any>('/users/resend-otp', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    googleAuth: (payload: GoogleAuthPayload) =>
        request<any>('/users/google', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    githubAuth: (payload: GithubAuthPayload) =>
        request<any>('/users/github', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
}