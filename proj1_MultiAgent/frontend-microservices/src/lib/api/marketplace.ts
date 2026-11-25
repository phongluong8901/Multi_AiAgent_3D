import { request } from "@/lib/client";

export interface AgentProduct {
    _id: string;
    agentId: string;
    name: string;
    title: string;
    description: string;
    avatarUrl?: string;
    color: string;
    category: string;
    formType?: 'duck' | 'amr' | 'humanoid' | 'drone' | string;
    computeTier?: string;
    pricing: {
        buyPrice: number;
        rentHourlyRate: number;
        rentDailyRate: number;
        rentMonthlyRate: number;
    };
    skills: string[];
    tools: string[];
    modelTier: string;
    rating: number;
    reviewsCount: number;
    totalRented: number;
    totalBought: number;
    isFeatured: boolean;
    isAvailableForRent: boolean;
    isAvailableForBuy: boolean;
}

export interface UserWallet {
    _id: string;
    userId: string;
    balance: number;
    transactions: Array<{
        amount: number;
        type: "deposit" | "purchase" | "rental" | "refund";
        description: string;
        createdAt: string;
    }>;
}

export interface UserInventoryItem {
    _id: string;
    userId: string;
    agentId: string;
    agentName: string;
    productId: AgentProduct;
    ownershipType: "owned" | "rented";
    rentExpiresAt?: string | null;
    isExpired: boolean;
    remainingMs: number;
    remainingHours: number;
    remainingDays: number;
}

export const marketplaceApi = {
    // 1. Lấy danh sách sản phẩm Agent
    getProducts: (params?: { category?: string; search?: string; modelTier?: string; sort?: string }) => {
        const q = new URLSearchParams();
        if (params?.category) q.append("category", params.category);
        if (params?.search) q.append("search", params.search);
        if (params?.modelTier) q.append("modelTier", params.modelTier);
        if (params?.sort) q.append("sort", params.sort);
        return request<{ success: boolean; count: number; data: AgentProduct[] }>(`/products?${q.toString()}`);
    },

    // 2. Chi tiết sản phẩm Agent
    getProductById: (id: string) => {
        return request<{ success: boolean; data: AgentProduct }>(`/products/${id}`);
    },

    // 3. Mua đứt Agent
    buyAgent: (data: { userId: string; userName?: string; agentId: string }) => {
        return request<{ success: boolean; message: string; data: any }>("/orders/buy", {
            method: "POST",
            body: JSON.stringify(data),
        });
    },

    // 4. Thuê Agent theo Giờ / Ngày / Tháng
    rentAgent: (data: {
        userId: string;
        userName?: string;
        agentId: string;
        rentalDuration: "hourly" | "daily" | "monthly";
        durationUnits: number;
    }) => {
        return request<{ success: boolean; message: string; data: any }>("/orders/rent", {
            method: "POST",
            body: JSON.stringify(data),
        });
    },

    // 5. Lấy số dư ví Coin
    getWallet: (userId: string) => {
        return request<{ success: boolean; data: UserWallet }>(`/wallet?userId=${userId}`);
    },

    // 6. Nạp Coin thử nghiệm (Faucet)
    faucetCoin: (data: { userId: string; amount?: number }) => {
        return request<{ success: boolean; message: string; data: UserWallet }>("/wallet/faucet", {
            method: "POST",
            body: JSON.stringify(data),
        });
    },

    // 7. Lấy kho Agent của User
    getUserInventory: (userId: string) => {
        return request<{ success: boolean; count: number; data: UserInventoryItem[] }>(`/inventory/user/${userId}`);
    },

    // 8. Lịch sử đơn hàng
    getUserOrders: (userId: string) => {
        return request<{ success: boolean; count: number; data: any[] }>(`/orders/user/${userId}`);
    },
};
