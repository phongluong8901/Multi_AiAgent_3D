'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useEffect, useState, useRef } from 'react'
import { clearSession, getUser, isLoggedIn, User } from '@/lib/auth'
import { notify } from '@/lib/toast'
import Sidebar from './Siderbar'
import FloatingRoomChatBubble from '@/components/chat/FloatingRoomChatBubble'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { Menu, X } from 'lucide-react'
import {
    IconActivity,
    IconBuilding,
    IconMessageSquare,
    IconShoppingBag,
    IconCpu,
    IconSparkles,
    IconTarget,
    IconMap,
    IconGameController,
    IconBot,
    IconFileText,
    IconWrench,
    IconLayers,
    IconUser,
    IconServer,
    IconShield,
    IconLogOut,
    IconChevronDown,
    IconZap,
    IconUsers,
} from '@/components/ui/icons'

interface NavItem {
    href: string
    label: string
    desc: string
    badge?: string
    icon: React.ComponentType<{ className?: string }>
}

interface NavGroup {
    id: string
    label: string
    icon: React.ComponentType<{ className?: string }>
    items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
    {
        id: 'workspaces',
        label: 'Không Gian & Phòng',
        icon: IconBuilding,
        items: [
            {
                href: '/rooms',
                label: 'Team Rooms',
                desc: 'Phòng họp nhóm & điều phối đa Agent',
                badge: 'Live',
                icon: IconUsers,
            },
            {
                href: '/office',
                label: '3D Office',
                desc: 'Không gian văn phòng 3D trực quan',
                icon: IconBuilding,
            },
            {
                href: '/chat',
                label: 'Chat Trung Tâm',
                desc: 'Nhắn tin trực tiếp & lịch sử hội thoại',
                icon: IconMessageSquare,
            },
            {
                href: '/store',
                label: 'Agent Store',
                desc: 'Chợ mua bán & thuê nhân sự AI',
                badge: 'Shop',
                icon: IconShoppingBag,
            },
        ],
    },
    {
        id: 'studios',
        label: '3D Studio & Nhúng',
        icon: IconCpu,
        items: [
            {
                href: '/firmware',
                label: 'Firmware 3D (ESP32)',
                desc: 'Nạp Agent vào ESP32/ESP32-S3 & Stream Room',
                badge: 'IoT AI',
                icon: IconCpu,
            },
            {
                href: '/lab',
                label: 'Agent Lab 3D',
                desc: 'Phòng thí nghiệm sinh code & kiểm thử',
                icon: IconSparkles,
            },
            {
                href: '/training',
                label: 'RL Training 3D',
                desc: 'Huấn luyện học tăng cường PPO / DQN / SAC né vật cản',
                icon: IconTarget,
            },
            {
                href: '/training/body',
                label: 'RL Locomotion 3D',
                desc: 'Dạy robot 4 chân / custom body tập đứng & bước đi',
                badge: 'Body AI',
                icon: IconBot,
            },
            {
                href: '/maps/setup',
                label: 'Map Studio 3D',
                desc: 'Thiết kế bản đồ & bố trí vật thể 3D',
                icon: IconMap,
            },
            {
                href: '/agent-body-studio',
                label: 'Agent Body Studio',
                desc: 'Thiết kế thân robot, khớp nối để huấn luyện',
                badge: 'Joints',
                icon: IconBot,
            },
            {
                href: '/games',
                label: 'Agent Games 3D',
                desc: 'Đấu trường mô phỏng & tương tác 3D',
                icon: IconGameController,
            },
        ],
    },
    {
        id: 'ai_core',
        label: 'Cấu Hình AI',
        icon: IconBot,
        items: [
            {
                href: '/agents',
                label: 'Agents',
                desc: 'Quản lý danh sách & vai trò AI Agent',
                icon: IconBot,
            },
            {
                href: '/prompts',
                label: 'Prompts',
                desc: 'Thiết lập System Prompt & chỉ dẫn chuyên môn',
                icon: IconFileText,
            },
            {
                href: '/tools',
                label: 'Tools',
                desc: 'Kho công cụ thực thi & tích hợp API',
                icon: IconWrench,
            },
            {
                href: '/models',
                label: 'Models',
                desc: 'Cấu hình Gemini, OpenAI, Claude & Local Ollama',
                icon: IconLayers,
            },
        ],
    },
]

const ACCOUNT_ITEMS: NavItem[] = [
    {
        href: '/profile',
        label: 'Hồ Sơ Cá Nhân',
        desc: 'Thông tin tài khoản & bảo mật',
        icon: IconUser,
    },
    {
        href: '/seller-profile',
        label: 'Hồ Sơ Seller (Host GPU)',
        desc: 'Quản lý trạm cho thuê mô hình AI cục bộ',
        icon: IconServer,
    },
    {
        href: '/admin-dashboard',
        label: 'Admin Dashboard',
        desc: 'Giám sát toàn bộ hệ thống Microservices',
        icon: IconShield,
    },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [ready, setReady] = useState(false)
    const [openGroupId, setOpenGroupId] = useState<string | null>(null)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const navRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!isLoggedIn()) {
            router.replace('/login')
            return
        }
        setUser(getUser())
        setReady(true)
    }, [router])

    // Đóng menu dropdown & mobile drawer khi chuyển đường dẫn
    useEffect(() => {
        setOpenGroupId(null)
        setMobileMenuOpen(false)
    }, [pathname])

    // Đóng menu khi click ra ngoài
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(e.target as Node)) {
                setOpenGroupId(null)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    function logout() {
        clearSession()
        notify.success('Đã đăng xuất')
        router.replace('/login')
    }

    if (!ready) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm font-medium">
                Loading...
            </div>
        )
    }

    const isItemActive = (href: string) =>
        pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors duration-200">
            {/* Top Header Ngang Gọn Gàng Theo Cụm Chức Năng */}
            <header className="h-14 border-b border-border/80 bg-card/85 backdrop-blur-xl sticky top-0 z-50">
                <div
                    ref={navRef}
                    className="h-full max-w-7xl mx-auto px-4 flex items-center justify-between gap-4"
                >
                    {/* Cột Trái: Logo + Cụm Điều Hướng Phân Nhóm */}
                    <div className="flex items-center gap-5">
                        <Link
                            href="/dashboard"
                            className="font-semibold tracking-tight flex items-center gap-2.5 shrink-0 group"
                        >
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600/30 to-indigo-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-sm group-hover:border-blue-400 transition">
                                <IconZap className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-foreground leading-none">
                                    Multi-Agent OS
                                </span>
                                <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
                                    3D Room & Embedded AI
                                </span>
                            </div>
                        </Link>

                        <div className="h-4 w-px bg-border hidden sm:block" />

                        <nav className="hidden md:flex items-center gap-1.5">
                            {/* Nút Dashboard đơn lẻ */}
                            <Link
                                href="/dashboard"
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                                    pathname === '/dashboard'
                                        ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/70 border border-transparent'
                                }`}
                            >
                                <IconActivity className="w-3.5 h-3.5" />
                                <span>Tổng Quan</span>
                            </Link>

                            {/* Các cụm nhóm chức năng (Dropdown) */}
                            {NAV_GROUPS.map((group) => {
                                const GroupIcon = group.icon
                                const activeChild = group.items.find((i) => isItemActive(i.href))
                                const isOpen = openGroupId === group.id

                                return (
                                    <div key={group.id} className="relative">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setOpenGroupId((prev) => (prev === group.id ? null : group.id))
                                            }
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                                                activeChild
                                                    ? 'bg-primary/15 text-primary border-primary/30 shadow-sm'
                                                    : isOpen
                                                    ? 'bg-secondary text-foreground border-border'
                                                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/70 border-transparent'
                                            }`}
                                        >
                                            <GroupIcon className="w-3.5 h-3.5" />
                                            <span>{group.label}</span>
                                            {activeChild && (
                                                <span className="px-1.5 py-0.5 rounded-md bg-primary/20 text-[10px] text-primary font-medium">
                                                    {activeChild.label}
                                                </span>
                                            )}
                                            <IconChevronDown
                                                className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-150 ${
                                                    isOpen ? 'rotate-180 text-foreground' : ''
                                                }`}
                                            />
                                        </button>

                                        {isOpen && (
                                            <div className="absolute left-0 top-full mt-2 w-72 rounded-2xl border border-border bg-card/95 backdrop-blur-xl p-2 shadow-2xl z-50">
                                                <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                    {group.label}
                                                </div>
                                                <div className="mt-1 space-y-1">
                                                    {group.items.map((item) => {
                                                        const ItemIcon = item.icon
                                                        const active = isItemActive(item.href)
                                                        return (
                                                            <Link
                                                                key={item.href}
                                                                href={item.href}
                                                                className={`flex items-start gap-3 p-2.5 rounded-xl transition ${
                                                                    active
                                                                        ? 'bg-primary/15 border border-primary/30 text-primary'
                                                                        : 'hover:bg-secondary text-foreground/80 hover:text-foreground border border-transparent'
                                                                }`}
                                                            >
                                                                <div
                                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${
                                                                        active
                                                                            ? 'bg-primary/20 border-primary/40 text-primary'
                                                                            : 'bg-secondary border-border text-muted-foreground'
                                                                    }`}
                                                                >
                                                                    <ItemIcon className="w-4 h-4" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <span className="text-xs font-semibold text-foreground truncate">
                                                                            {item.label}
                                                                        </span>
                                                                        {item.badge && (
                                                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                                                                                {item.badge}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                                                                        {item.desc}
                                                                    </p>
                                                                </div>
                                                            </Link>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </nav>
                    </div>

                    {/* Cột Phải: Truy cập nhanh Team Rooms + Menu Tài Khoản & Quản Trị */}
                    <div className="flex items-center gap-2.5">
                        <Link
                            href="/rooms"
                            className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                                pathname.startsWith('/rooms')
                                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                    : 'bg-secondary hover:bg-secondary/80 border-border text-foreground'
                            }`}
                        >
                            <IconUsers className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Phòng Họp</span>
                        </Link>

                        <Link
                            href="/firmware"
                            className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                                pathname.startsWith('/firmware')
                                    ? 'bg-primary/20 border-primary/40 text-primary'
                                    : 'bg-secondary hover:bg-secondary/80 border-border text-foreground'
                            }`}
                        >
                            <IconCpu className="w-3.5 h-3.5 text-primary" />
                            <span>Firmware</span>
                        </Link>

                        {/* Theme Switcher Toggle */}
                        <ThemeToggle />

                        {/* Dropdown Tài khoản, Seller & Admin */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() =>
                                    setOpenGroupId((prev) => (prev === 'account' ? null : 'account'))
                                }
                                className="flex items-center gap-2 bg-secondary/80 hover:bg-secondary border border-border px-3 py-1.5 rounded-xl text-xs text-foreground transition"
                            >
                                <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
                                    <IconUser className="w-3 h-3" />
                                </div>
                                <span className="font-medium max-w-[110px] sm:max-w-[130px] truncate">
                                    {user?.name ?? user?.email}
                                </span>
                                <IconChevronDown
                                    className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${
                                        openGroupId === 'account' ? 'rotate-180 text-foreground' : ''
                                    }`}
                                />
                            </button>

                            {openGroupId === 'account' && (
                                <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-border bg-card/95 backdrop-blur-xl p-2 shadow-2xl z-50">
                                    <div className="px-2.5 py-1.5 border-b border-border/80 mb-1">
                                        <div className="text-xs font-semibold text-foreground truncate">
                                            {user?.name || 'Thành viên'}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground truncate">
                                            {user?.email}
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        {ACCOUNT_ITEMS.map((item) => {
                                            const ItemIcon = item.icon
                                            const active = isItemActive(item.href)
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs transition ${
                                                        active
                                                            ? 'bg-primary/15 text-primary font-semibold'
                                                            : 'text-foreground/80 hover:bg-secondary hover:text-foreground'
                                                    }`}
                                                >
                                                    <ItemIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                                                    <div className="min-w-0">
                                                        <div className="truncate font-medium">{item.label}</div>
                                                        <div className="text-[10px] text-muted-foreground truncate">
                                                            {item.desc}
                                                        </div>
                                                    </div>
                                                </Link>
                                            )
                                        })}
                                    </div>

                                    <div className="mt-1.5 pt-1.5 border-t border-border/80">
                                        <button
                                            type="button"
                                            onClick={logout}
                                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 transition"
                                        >
                                            <IconLogOut className="w-4 h-4" />
                                            <span>Đăng xuất tài khoản</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Hamburger Button trên Mobile */}
                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen(true)}
                            className="md:hidden w-8 h-8 rounded-xl bg-secondary/80 hover:bg-secondary border border-border text-foreground flex items-center justify-center transition"
                            aria-label="Menu"
                        >
                            <Menu className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Drawer Navigation (Side-over Sheet) */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-50 md:hidden flex">
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
                        onClick={() => setMobileMenuOpen(false)}
                    />

                    {/* Drawer Content */}
                    <div className="relative ml-auto w-full max-w-xs bg-card border-l border-border h-full flex flex-col p-4 z-10 shadow-2xl overflow-y-auto">
                        <div className="flex items-center justify-between pb-3 border-b border-border">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
                                    <IconZap className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-foreground">Multi-Agent OS</span>
                            </div>
                            <button
                                onClick={() => setMobileMenuOpen(false)}
                                className="w-7 h-7 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground flex items-center justify-center"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Theme Toggle & User Info */}
                        <div className="py-3 border-b border-border flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Chủ đề:</span>
                            <ThemeToggle />
                        </div>

                        {/* Navigation Groups */}
                        <div className="py-3 space-y-4 flex-1">
                            {/* Dashboard */}
                            <Link
                                href="/dashboard"
                                onClick={() => setMobileMenuOpen(false)}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold ${
                                    pathname === '/dashboard' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-foreground/80 hover:bg-secondary'
                                }`}
                            >
                                <IconActivity className="w-4 h-4" />
                                <span>Tổng Quan (Dashboard)</span>
                            </Link>

                            {NAV_GROUPS.map((group) => (
                                <div key={group.id} className="space-y-1">
                                    <div className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                        {group.label}
                                    </div>
                                    {group.items.map((item) => {
                                        const ItemIcon = item.icon
                                        const active = isItemActive(item.href)
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                onClick={() => setMobileMenuOpen(false)}
                                                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs ${
                                                    active ? 'bg-primary/20 text-primary font-semibold' : 'text-foreground/80 hover:bg-secondary'
                                                }`}
                                            >
                                                <ItemIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
                                                <span className="flex-1 truncate">{item.label}</span>
                                                {item.badge && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-mono">
                                                        {item.badge}
                                                    </span>
                                                )}
                                            </Link>
                                        )
                                    })}
                                </div>
                            ))}

                            {/* AI Node Network Links */}
                            <div className="space-y-1 pt-2 border-t border-border">
                                <div className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                    Mạng Lưới AI Node
                                </div>
                                <Link
                                    href="/node-checker"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs ${
                                        pathname.startsWith('/node-checker') ? 'bg-primary/20 text-primary font-semibold' : 'text-foreground/80 hover:bg-secondary'
                                    }`}
                                >
                                    <IconServer className="w-4 h-4 shrink-0 text-primary" />
                                    <span>Kiểm Tra Node AI</span>
                                </Link>
                                <Link
                                    href="/user-models"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs ${
                                        pathname.startsWith('/user-models') ? 'bg-primary/20 text-primary font-semibold' : 'text-foreground/80 hover:bg-secondary'
                                    }`}
                                >
                                    <IconSparkles className="w-4 h-4 shrink-0 text-indigo-400" />
                                    <span>Đối Tác Mô Hình (3D)</span>
                                </Link>
                                <Link
                                    href="/seller"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs ${
                                        pathname.startsWith('/seller') ? 'bg-primary/20 text-primary font-semibold' : 'text-foreground/80 hover:bg-secondary'
                                    }`}
                                >
                                    <IconShoppingBag className="w-4 h-4 shrink-0 text-amber-400" />
                                    <span>Quản Lý Cho Thuê (Seller)</span>
                                </Link>
                                <Link
                                    href="/owner"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs ${
                                        pathname.startsWith('/owner') ? 'bg-primary/20 text-primary font-semibold' : 'text-foreground/80 hover:bg-secondary'
                                    }`}
                                >
                                    <IconCpu className="w-4 h-4 shrink-0 text-emerald-400" />
                                    <span>Thuê AI Cho Agent (Owner)</span>
                                </Link>
                            </div>
                        </div>

                        {/* Footer Logout */}
                        <div className="pt-3 border-t border-border">
                            <button
                                onClick={logout}
                                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-destructive/15 border border-destructive/25 text-destructive text-xs font-semibold hover:bg-destructive/25 transition"
                            >
                                <IconLogOut className="w-4 h-4" />
                                <span>Đăng Xuất</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Layout chính kết hợp Sidebar dọc và Main Content */}
            <div className="flex flex-1">
                <Sidebar />
                <main
                    className={`flex-1 pb-16 md:pb-0 ${
                        pathname.startsWith('/office') ||
                        pathname.startsWith('/maps/setup') ||
                        pathname.startsWith('/agent-body-studio') ||
                        pathname.startsWith('/firmware') ||
                        pathname.startsWith('/store') ||
                        pathname.includes('/rooms/')
                            ? ''
                            : 'max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6'
                    }`}
                >
                    {children}
                </main>
            </div>

            {/* Mobile Bottom Quick Navigation Bar */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border px-2 py-1 flex items-center justify-around text-[10px]">
                <Link
                    href="/dashboard"
                    className={`flex flex-col items-center py-1 px-2 rounded-lg transition ${
                        pathname === '/dashboard' ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <IconActivity className="w-4 h-4" />
                    <span className="mt-0.5">Tổng quan</span>
                </Link>

                <Link
                    href="/rooms"
                    className={`flex flex-col items-center py-1 px-2 rounded-lg transition ${
                        pathname.startsWith('/rooms') ? 'text-emerald-500 font-semibold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <IconUsers className="w-4 h-4" />
                    <span className="mt-0.5">Phòng họp</span>
                </Link>

                <Link
                    href="/store"
                    className={`flex flex-col items-center py-1 px-2 rounded-lg transition ${
                        pathname.startsWith('/store') ? 'text-amber-500 font-semibold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <IconShoppingBag className="w-4 h-4" />
                    <span className="mt-0.5">Store</span>
                </Link>

                <Link
                    href="/node-checker"
                    className={`flex flex-col items-center py-1 px-2 rounded-lg transition ${
                        pathname.startsWith('/node-checker') ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <IconServer className="w-4 h-4" />
                    <span className="mt-0.5">Node AI</span>
                </Link>

                <button
                    type="button"
                    onClick={() => setMobileMenuOpen(true)}
                    className="flex flex-col items-center py-1 px-2 rounded-lg text-muted-foreground hover:text-foreground transition"
                >
                    <Menu className="w-4 h-4" />
                    <span className="mt-0.5">Menu</span>
                </button>
            </nav>

            {/* Nút Bubble Float Chat toàn cục giúp chat trực tiếp với mọi Room ngay từ bên ngoài */}
            <FloatingRoomChatBubble />
        </div>
    )
}
