'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

export type Language = 'vi' | 'en'

export interface Translations {
    common: {
        loading: string
        save: string
        saving: string
        cancel: string
        delete: string
        edit: string
        create: string
        search: string
        filter: string
        close: string
        refresh: string
        back: string
        actions: string
        status: string
        online: string
        offline: string
        busy: string
        connected: string
        disconnected: string
        all: string
        yes: string
        no: string
        logout: string
    }
    nav: {
        dashboard: string
        workspaces: string
        teamRooms: string
        teamRoomsDesc: string
        office3D: string
        office3DDesc: string
        centralChat: string
        centralChatDesc: string
        agentStore: string
        agentStoreDesc: string
        studios: string
        firmware: string
        firmwareDesc: string
        agentLab: string
        agentLabDesc: string
        rlTraining: string
        rlTrainingDesc: string
        rlLocomotion: string
        rlLocomotionDesc: string
        mapStudio: string
        mapStudioDesc: string
        agentBodyStudio: string
        agentBodyStudioDesc: string
        games3D: string
        games3DDesc: string
        aiConfig: string
        agents: string
        agentsDesc: string
        prompts: string
        promptsDesc: string
        tools: string
        toolsDesc: string
        models: string
        modelsDesc: string
        profile: string
        profileDesc: string
        sellerProfile: string
        sellerProfileDesc: string
        adminDashboard: string
        adminDashboardDesc: string
        nodeChecker: string
        userModels: string
        sellerManage: string
        ownerRent: string
        systemAdmin: string
    }
    theme: {
        themeTitle: string
        dark: string
        light: string
        cyberpunk: string
        system: string
    }
    lang: {
        languageTitle: string
        vietnamese: string
        english: string
    }
}

const DICTIONARIES: Record<Language, Translations> = {
    vi: {
        common: {
            loading: 'Đang tải...',
            save: 'Lưu thay đổi',
            saving: 'Đang lưu...',
            cancel: 'Hủy',
            delete: 'Xóa',
            edit: 'Chỉnh sửa',
            create: 'Tạo mới',
            search: 'Tìm kiếm...',
            filter: 'Lọc',
            close: 'Đóng',
            refresh: 'Làm mới',
            back: 'Quay lại',
            actions: 'Thao tác',
            status: 'Trạng thái',
            online: 'Online',
            offline: 'Offline',
            busy: 'Bận',
            connected: 'Đã kết nối',
            disconnected: 'Mất kết nối',
            all: 'Tất cả',
            yes: 'Có',
            no: 'Không',
            logout: 'Đăng xuất tài khoản',
        },
        nav: {
            dashboard: 'Tổng Quan',
            workspaces: 'Không Gian & Phòng',
            teamRooms: 'Team Rooms',
            teamRoomsDesc: 'Phòng họp nhóm & điều phối đa Agent',
            office3D: '3D Office',
            office3DDesc: 'Không gian văn phòng 3D trực quan',
            centralChat: 'Chat Trung Tâm',
            centralChatDesc: 'Nhắn tin trực tiếp & lịch sử hội thoại',
            agentStore: 'Agent Store',
            agentStoreDesc: 'Chợ mua bán & thuê nhân sự AI',
            studios: '3D Studio & Nhúng',
            firmware: 'Firmware 3D (ESP32)',
            firmwareDesc: 'Nạp Agent vào ESP32/ESP32-S3 & Stream Room',
            agentLab: 'Agent Lab 3D',
            agentLabDesc: 'Phòng thí nghiệm sinh code & kiểm thử',
            rlTraining: 'RL Training 3D',
            rlTrainingDesc: 'Huấn luyện học tăng cường né vật cản',
            rlLocomotion: 'RL Locomotion 3D',
            rlLocomotionDesc: 'Dạy robot 4 chân / custom body tập bước đi',
            mapStudio: 'Map Studio 3D',
            mapStudioDesc: 'Thiết kế bản đồ & bố trí vật thể 3D',
            agentBodyStudio: 'Agent Body Studio',
            agentBodyStudioDesc: 'Thiết kế thân robot, khớp nối huấn luyện',
            games3D: 'Agent Games 3D',
            games3DDesc: 'Đấu trường mô phỏng & tương tác 3D',
            aiConfig: 'Cấu Hình AI',
            agents: 'Agents',
            agentsDesc: 'Quản lý danh sách & vai trò AI Agent',
            prompts: 'Prompts',
            promptsDesc: 'Thiết lập System Prompt & chỉ dẫn',
            tools: 'Tools',
            toolsDesc: 'Kho công cụ thực thi & tích hợp API',
            models: 'Models',
            modelsDesc: 'Cấu hình Gemini, OpenAI, Claude & Ollama',
            profile: 'Hồ Sơ Cá Nhân',
            profileDesc: 'Thông tin tài khoản & bảo mật',
            sellerProfile: 'Hồ Sơ Seller (Host GPU)',
            sellerProfileDesc: 'Quản lý trạm cho thuê mô hình AI cục bộ',
            adminDashboard: 'Admin Dashboard',
            adminDashboardDesc: 'Giám sát toàn bộ hệ thống Microservices',
            nodeChecker: 'Kiểm tra Node AI',
            userModels: 'Đối tác Mô hình',
            sellerManage: 'Quản lý Cho Thuê (Seller)',
            ownerRent: 'Thuê AI Cho Agent (Owner)',
            systemAdmin: 'Quản trị Hệ thống',
        },
        theme: {
            themeTitle: 'Giao Diện Theme',
            dark: 'Tối (Dark)',
            light: 'Sáng (Light)',
            cyberpunk: 'Neon Cyberpunk',
            system: 'Hệ thống (System)',
        },
        lang: {
            languageTitle: 'Ngôn Ngữ (Language)',
            vietnamese: 'Tiếng Việt',
            english: 'English',
        },
    },
    en: {
        common: {
            loading: 'Loading...',
            save: 'Save Changes',
            saving: 'Saving...',
            cancel: 'Cancel',
            delete: 'Delete',
            edit: 'Edit',
            create: 'Create New',
            search: 'Search...',
            filter: 'Filter',
            close: 'Close',
            refresh: 'Refresh',
            back: 'Back',
            actions: 'Actions',
            status: 'Status',
            online: 'Online',
            offline: 'Offline',
            busy: 'Busy',
            connected: 'Connected',
            disconnected: 'Disconnected',
            all: 'All',
            yes: 'Yes',
            no: 'No',
            logout: 'Log Out Account',
        },
        nav: {
            dashboard: 'Dashboard',
            workspaces: 'Spaces & Rooms',
            teamRooms: 'Team Rooms',
            teamRoomsDesc: 'Multi-agent room collaboration & coordination',
            office3D: '3D Office',
            office3DDesc: 'Immersive spatial 3D virtual workspace',
            centralChat: 'Central Chat',
            centralChatDesc: 'Direct messaging & conversation history',
            agentStore: 'Agent Store',
            agentStoreDesc: 'Marketplace to buy & rent AI personnel',
            studios: '3D Studios & Embedded',
            firmware: '3D Firmware (ESP32)',
            firmwareDesc: 'Flash Agent to ESP32/ESP32-S3 & Stream Room',
            agentLab: 'Agent Lab 3D',
            agentLabDesc: 'Laboratory for code generation & testing',
            rlTraining: '3D RL Training',
            rlTrainingDesc: 'Reinforcement learning obstacle avoidance',
            rlLocomotion: '3D RL Locomotion',
            rlLocomotionDesc: 'Teach quadruped & custom bodies to walk',
            mapStudio: '3D Map Studio',
            mapStudioDesc: 'Design maps & arrange 3D environmental assets',
            agentBodyStudio: 'Agent Body Studio',
            agentBodyStudioDesc: 'Design robot bodies and articulate joints',
            games3D: '3D Agent Games',
            games3DDesc: 'Simulation arena & 3D interaction',
            aiConfig: 'AI Configuration',
            agents: 'Agents',
            agentsDesc: 'Manage AI agent rosters and role assignments',
            prompts: 'Prompts',
            promptsDesc: 'Configure system prompts & directives',
            tools: 'Tools',
            toolsDesc: 'Execution tool registry & API integrations',
            models: 'Models',
            modelsDesc: 'Configure Gemini, OpenAI, Claude & Ollama',
            profile: 'User Profile',
            profileDesc: 'Account credentials & security settings',
            sellerProfile: 'Seller Profile (Host GPU)',
            sellerProfileDesc: 'Manage local GPU AI node hosting',
            adminDashboard: 'Admin Dashboard',
            adminDashboardDesc: 'System-wide microservices telemetry & health',
            nodeChecker: 'Check AI Node',
            userModels: 'Model Partners',
            sellerManage: 'Lease Management (Seller)',
            ownerRent: 'Rent AI for Agent (Owner)',
            systemAdmin: 'System Administration',
        },
        theme: {
            themeTitle: 'Theme Appearance',
            dark: 'Dark Mode',
            light: 'Light Mode',
            cyberpunk: 'Neon Cyberpunk',
            system: 'System Default',
        },
        lang: {
            languageTitle: 'Language',
            vietnamese: 'Tiếng Việt (VI)',
            english: 'English (EN)',
        },
    },
}

interface LanguageContextType {
    language: Language
    setLanguage: (lang: Language) => void
    t: Translations
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguageState] = useState<Language>('vi')
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        const saved = (localStorage.getItem('app-language') as Language) || 'vi'
        if (saved === 'vi' || saved === 'en') {
            setLanguageState(saved)
        }
        setMounted(true)
    }, [])

    const setLanguage = (newLang: Language) => {
        setLanguageState(newLang)
        if (typeof window !== 'undefined') {
            localStorage.setItem('app-language', newLang)
            document.documentElement.lang = newLang
        }
    }

    const t = DICTIONARIES[language]

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    )
}

export function useLanguage() {
    const context = useContext(LanguageContext)
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider')
    }
    return context
}

