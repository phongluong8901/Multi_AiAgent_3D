export interface RegisterInput {
    username: string;
    email: string;
    password: string;
    role?: "admin" | "employee" | "guest";
}

export interface LoginInput {
    email: string;
    password: string;
}

export interface UpdateProfileInput {
    username?: string;
    name?: string;
    avatarUrl?: string;
    bio?: string;
}

export interface GooglePayloadUser {
    googleId: string;
    email: string;
    name: string;
    avatarUrl: string;
}