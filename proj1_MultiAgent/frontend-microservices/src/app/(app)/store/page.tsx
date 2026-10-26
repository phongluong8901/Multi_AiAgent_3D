'use client'

import React, { useState, useEffect } from 'react'
import {
    marketplaceApi,
    AgentProduct,
    UserWallet,
    UserInventoryItem,
} from '@/lib/api/marketplace'
import { getUser } from '@/lib/auth'
import { notify } from '@/lib/toast'
import {
    IconShoppingBag,
    IconSearch,
    IconSparkles,
    IconCoins,
    IconZap,
    IconClock,
    IconCheck,
    IconBot,
    IconPlus,
    IconLock,
    IconX,
    IconArrowRight,
    IconDuck,
    IconAmr,
    IconDrone,
    IconHumanoid,
    IconCpu,
    IconActivity,
    IconStar,
    IconShield,
} from '@/components/ui/icons'
import PlanTasksModal from '@/components/coins/PlanTasksModal'

// Danh mục Robot & Agent theo chuẩn NVIDIA Robotics
const ROBOT_CATEGORIES = [
    { id: 'all', label: 'Tất cả Robot Fleet' },
    { id: 'duck', label: 'MicroDuck (Orin Nano)' },
    { id: 'amr', label: 'Nova Carter AMR' },
    { id: 'humanoid', label: 'GR00T Humanoid' },
    { id: 'drone', label: 'Cyber Drone Falcon' },
    { id: 'engineering', label: 'CUDA & Engineering' },
]

// Dữ liệu robot mặc định phong cách NVIDIA Isaac Sim & Jetson
const DEFAULT_ROBOT_PRODUCTS: AgentProduct[] = [
    {
        _id: 'prod_microduck',
        agentId: 'agent_microduck',
        name: 'NVIDIA MicroDuck Orin',
        title: 'Robot Vịt Vàng Debugger & Phân Tích Logic AST',
        description: 'Robot thông minh cảm hứng Rubber Duck Debugging tích hợp Jetson Orin Nano 40 TOPS. Trang bị thị giác RealSense RGB-D, rà soát bug, phân tích cú pháp AST và đồng hành giải quyết logic phức tạp.',
        color: '#eab308',
        category: 'duck',
        formType: 'duck',
        computeTier: 'Jetson Orin Nano 40 TOPS',
        pricing: {
            buyPrice: 750,
            rentHourlyRate: 8,
            rentDailyRate: 45,
            rentMonthlyRate: 700,
        },
        skills: ['Live Code Debugging', 'AST Analysis', 'Rubber Duck Walkthrough', 'TensorRT Bug Detector'],
        tools: ['calculator_tool', 'web_search_tool'],
        modelTier: 'gemini-2.5-flash-lite',
        rating: 5.0,
        reviewsCount: 230,
        totalRented: 680,
        totalBought: 195,
        isFeatured: true,
        isAvailableForRent: true,
        isAvailableForBuy: true,
    },
    {
        _id: 'prod_amr',
        agentId: 'agent_amr',
        name: 'Nova Carter AMR Industrial',
        title: 'Robot Tự Hành Nhà Kho & Điều Phối Hậu Cần',
        description: 'Robot AMR chuẩn công nghiệp hợp tác NVIDIA & Segway. Trang bị Jetson AGX Orin 275 TOPS, 2 cụm LiDAR 360°, Isaac ROS 2 Nav2, tự động lập bản đồ SLAM và tránh vật cản động.',
        color: '#f97316',
        category: 'amr',
        formType: 'amr',
        computeTier: 'Jetson AGX Orin 275 TOPS',
        pricing: {
            buyPrice: 1350,
            rentHourlyRate: 20,
            rentDailyRate: 110,
            rentMonthlyRate: 1600,
        },
        skills: ['Isaac ROS 2 Nav2', '360° LiDAR SLAM', 'Dynamic Obstacle Avoidance', 'Warehouse Automation'],
        tools: ['system_control_tool', 'calculator_tool'],
        modelTier: 'gemini-2.5-flash-lite',
        rating: 4.9,
        reviewsCount: 185,
        totalRented: 512,
        totalBought: 140,
        isFeatured: true,
        isAvailableForRent: true,
        isAvailableForBuy: true,
    },
    {
        _id: 'prod_gr00t',
        agentId: 'agent_gr00t',
        name: 'Project GR00T Humanoid AI',
        title: 'Robot Người Hai Chân Đa Thể Thức (Isaac GR00T)',
        description: 'Robot hai chân đột phá chạy mô hình nền tảng NVIDIA GR00T. Điều khiển chuyển động toàn thân (whole-body control), thao tác bàn tay khéo léo và tương tác tự nhiên trong văn phòng 3D.',
        color: '#76b900',
        category: 'humanoid',
        formType: 'humanoid',
        computeTier: 'Dual Thor Superchip 2000 TFLOPS',
        pricing: {
            buyPrice: 1800,
            rentHourlyRate: 25,
            rentDailyRate: 140,
            rentMonthlyRate: 2100,
        },
        skills: ['Whole-body Motion Control', 'Dexterous Manipulation', 'Multimodal Reasoning', 'Isaac Lab Training'],
        tools: ['system_control_tool', 'web_search_tool'],
        modelTier: 'gemini-2.5-flash-lite',
        rating: 5.0,
        reviewsCount: 310,
        totalRented: 840,
        totalBought: 260,
        isFeatured: true,
        isAvailableForRent: true,
        isAvailableForBuy: true,
    },
    {
        _id: 'prod_drone',
        agentId: 'agent_drone',
        name: 'Cyber Falcon Patrol Drone',
        title: 'Drone Giám Sát Không Phận & Tuần Tra 3D',
        description: 'Drone 4 cánh quạt carbon siêu nhẹ chạy Jetson Orin NX 100 TOPS, định vị vệ tinh RTK centimet và cảm biến nhiệt hồng ngoại. Tuần tra tự động và vẽ bản đồ không gian.',
        color: '#06b6d4',
        category: 'drone',
        formType: 'drone',
        computeTier: 'Jetson Orin NX 100 TOPS',
        pricing: {
            buyPrice: 950,
            rentHourlyRate: 14,
            rentDailyRate: 75,
            rentMonthlyRate: 1150,
        },
        skills: ['3D Aerial Photogrammetry', 'Centimeter RTK Positioning', 'Thermal Inspection', 'Isaac Perceptor Vision'],
        tools: ['web_search_tool'],
        modelTier: 'gemini-2.5-flash-lite',
        rating: 4.8,
        reviewsCount: 142,
        totalRented: 390,
        totalBought: 98,
        isFeatured: false,
        isAvailableForRent: true,
        isAvailableForBuy: true,
    },
    {
        _id: 'prod_manager',
        agentId: 'agent_manager',
        name: 'DGX Fleet Orchestrator',
        title: 'Node Chỉ Huy & Điều Phối Đa Robot DGX',
        description: 'Trung tâm chỉ huy siêu máy tính NVIDIA DGX. Phân rã bài toán quy mô lớn, điều phối đồng bộ cả phi đội MicroDuck, Nova Carter AMR và Cyber Drone làm việc nhịp nhàng.',
        color: '#3b82f6',
        category: 'engineering',
        formType: 'humanoid',
        computeTier: 'NVIDIA DGX Cluster Node',
        pricing: {
            buyPrice: 1500,
            rentHourlyRate: 22,
            rentDailyRate: 120,
            rentMonthlyRate: 1800,
        },
        skills: ['Multi-Robot Fleet Handoff', 'Hierarchical Task Network', 'Telemetry Stream Sync', 'Consensus Protocol'],
        tools: ['system_control_tool'],
        modelTier: 'gemini-2.5-flash-lite',
        rating: 5.0,
        reviewsCount: 198,
        totalRented: 620,
        totalBought: 175,
        isFeatured: true,
        isAvailableForRent: true,
        isAvailableForBuy: true,
    },
    {
        _id: 'prod_coder',
        agentId: 'agent_coder',
        name: 'TensorRT Code Master',
        title: 'Robot Kỹ Sư Lập Trình & Tối Ưu CUDA/Python',
        description: 'Chuyên gia viết mã ứng dụng robot thông minh, nạp pipeline TensorRT tăng tốc độ suy luận deep learning, tích hợp ROS 2 nodes và kiểm thử tự động.',
        color: '#ec4899',
        category: 'engineering',
        formType: 'humanoid',
        computeTier: 'RTX 6000 Ada Generation',
        pricing: {
            buyPrice: 1100,
            rentHourlyRate: 16,
            rentDailyRate: 85,
            rentMonthlyRate: 1300,
        },
        skills: ['CUDA Kernel Optimization', 'TensorRT Model Quantization', 'ROS 2 C++/Python Nodes', 'GitOps CI/CD'],
        tools: ['calculator_tool', 'web_search_tool'],
        modelTier: 'gemini-2.5-flash-lite',
        rating: 4.9,
        reviewsCount: 165,
        totalRented: 430,
        totalBought: 132,
        isFeatured: false,
        isAvailableForRent: true,
        isAvailableForBuy: true,
    },
    {
        _id: 'prod_search',
        agentId: 'agent_search',
        name: 'Omniverse Data Scout',
        title: 'Robot Trinh Sát Dữ Liệu & RAG Thời Gian Thực',
        description: 'Thu thập tài liệu nghiên cứu robotics, dữ liệu vật lý mô phỏng và cập nhật tri thức mới nhất từ thế giới thực vào kho ngữ cảnh của toàn đội.',
        color: '#8b5cf6',
        category: 'engineering',
        formType: 'humanoid',
        computeTier: 'NVIDIA Cloud SuperNIC',
        pricing: {
            buyPrice: 650,
            rentHourlyRate: 9,
            rentDailyRate: 45,
            rentMonthlyRate: 720,
        },
        skills: ['Autonomous Data Mining', 'RAG Vector Indexing', 'Technical Spec Extraction', 'Realtime Web Feeds'],
        tools: ['web_search_tool'],
        modelTier: 'gemini-2.5-flash-lite',
        rating: 4.8,
        reviewsCount: 120,
        totalRented: 310,
        totalBought: 84,
        isFeatured: false,
        isAvailableForRent: true,
        isAvailableForBuy: true,
    },
]

export default function AgentStorePage() {
    const [activeTab, setActiveTab] = useState<'store' | 'inventory'>('store')
    const [products, setProducts] = useState<AgentProduct[]>(DEFAULT_ROBOT_PRODUCTS)
    const [wallet, setWallet] = useState<UserWallet | null>(null)
    const [inventory, setInventory] = useState<UserInventoryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedCategory, setSelectedCategory] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [planModalOpen, setPlanModalOpen] = useState(false)

    // State cho Modal xác nhận thuê Agent
    const [rentModalProduct, setRentModalProduct] = useState<AgentProduct | null>(null)
    const [rentalDuration, setRentalDuration] = useState<'hourly' | 'daily' | 'monthly'>('daily')
    const [durationUnits, setDurationUnits] = useState<number>(1)
    const [processing, setProcessing] = useState(false)

    const user = getUser()
    const currentUserId = user?.id || ''
    const currentUserName = user?.name || user?.email || 'User'

    useEffect(() => {
        loadData()
    }, [currentUserId])

    const loadData = async () => {
        setLoading(true)
        try {
            const [prodsRes, walletRes, invRes] = await Promise.all([
                marketplaceApi.getProducts().catch(() => null),
                currentUserId ? marketplaceApi.getWallet(currentUserId).catch(() => null) : Promise.resolve(null),
                currentUserId ? marketplaceApi.getUserInventory(currentUserId).catch(() => null) : Promise.resolve(null),
            ])

            if (prodsRes?.success && Array.isArray(prodsRes.data) && prodsRes.data.length > 0) {
                // Hợp nhất sản phẩm từ server với danh sách robot mặc định nếu thiếu
                const serverMap = new Map(prodsRes.data.map((p: AgentProduct) => [p.agentId, p]))
                const merged = DEFAULT_ROBOT_PRODUCTS.map((def) => {
                    const fromServer = serverMap.get(def.agentId)
                    return fromServer ? { ...def, ...fromServer } : def
                })
                // Thêm sản phẩm server khác nếu có
                for (const p of prodsRes.data) {
                    if (!merged.some((m) => m.agentId === p.agentId)) {
                        merged.push(p)
                    }
                }
                setProducts(merged)
            } else {
                setProducts(DEFAULT_ROBOT_PRODUCTS)
            }

            if (walletRes?.success) setWallet(walletRes.data)
            if (invRes?.success && Array.isArray(invRes.data)) setInventory(invRes.data)
        } catch (err: any) {
            console.error('Lỗi tải dữ liệu Agent Store:', err)
            setProducts(DEFAULT_ROBOT_PRODUCTS)
        } finally {
            setLoading(false)
        }
    }

    // Nhận Coin miễn phí (Faucet)
    const handleFaucet = async () => {
        if (!currentUserId) {
            notify.error('Vui lòng đăng nhập để nhận Coin!')
            return
        }
        try {
            const res = await marketplaceApi.faucetCoin({ userId: currentUserId, amount: 500 })
            if (res.success) {
                setWallet(res.data)
                notify.success('Đã nhận thành công +500 Coin vào ví!')
            }
        } catch (err: any) {
            notify.error('Lỗi nhận coin: ' + err.message)
        }
    }

    // Mua đứt Agent vĩnh viễn
    const handleBuyNow = async (prod: AgentProduct) => {
        if (!currentUserId) {
            notify.error('Vui lòng đăng nhập để mua Agent!')
            return
        }

        const confirm = window.confirm(
            `Xác nhận mua đứt bản quyền vĩnh viễn Robot '${prod.name}' với giá ${prod.pricing.buyPrice} Coin?`
        )
        if (!confirm) return

        try {
            setProcessing(true)
            const res = await marketplaceApi.buyAgent({
                userId: currentUserId,
                userName: currentUserName,
                agentId: prod.agentId,
            })
            if (res.success) {
                notify.success(`Chúc mừng bạn đã sở hữu Robot '${prod.name}'!`)
                await loadData()
                setActiveTab('inventory')
            }
        } catch (err: any) {
            notify.error('Giao dịch mua thất bại: ' + err.message)
        } finally {
            setProcessing(false)
        }
    }

    // Mở Modal Thuê Agent
    const handleOpenRentModal = (prod: AgentProduct) => {
        setRentModalProduct(prod)
        setRentalDuration('daily')
        setDurationUnits(1)
    }

    // Xác nhận giao dịch thuê Agent
    const handleConfirmRent = async () => {
        if (!rentModalProduct || !currentUserId) return

        try {
            setProcessing(true)
            const res = await marketplaceApi.rentAgent({
                userId: currentUserId,
                userName: currentUserName,
                agentId: rentModalProduct.agentId,
                rentalDuration,
                durationUnits,
            })
            if (res.success) {
                notify.success(`Đã thuê thành công Robot '${rentModalProduct.name}'!`)
                setRentModalProduct(null)
                await loadData()
                setActiveTab('inventory')
            }
        } catch (err: any) {
            notify.error('Thuê Robot thất bại: ' + err.message)
        } finally {
            setProcessing(false)
        }
    }

    // Tính toán chi phí thuê
    const calculateRentalCost = () => {
        if (!rentModalProduct) return 0
        const rate =
            rentalDuration === 'hourly'
                ? rentModalProduct.pricing.rentHourlyRate
                : rentalDuration === 'daily'
                ? rentModalProduct.pricing.rentDailyRate
                : rentModalProduct.pricing.rentMonthlyRate
        return rate * durationUnits
    }

    // Helper render Robot Chassis Icon
    const renderRobotChassisIcon = (form?: string, color?: string) => {
        const cls = "w-6 h-6 text-white"
        switch (form) {
            case 'duck':
                return <IconDuck className={cls} />
            case 'amr':
                return <IconAmr className={cls} />
            case 'drone':
                return <IconDrone className={cls} />
            default:
                return <IconHumanoid className={cls} />
        }
    }

    // Helper render Badge Hình Thái
    const getFormBadge = (form?: string) => {
        switch (form) {
            case 'duck':
                return { label: 'MicroDuck Orin', bg: 'bg-amber-500/15 text-amber-300 border-amber-500/40' }
            case 'amr':
                return { label: 'Nova Carter AMR', bg: 'bg-orange-500/15 text-orange-300 border-orange-500/40' }
            case 'drone':
                return { label: 'Cyber Falcon', bg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40' }
            default:
                return { label: 'GR00T Biped', bg: 'bg-lime-500/15 text-lime-400 border-lime-500/40' }
        }
    }

    // Lọc sản phẩm
    const filteredProducts = products.filter((p) => {
        const pForm = p.formType || (p.agentId.includes('duck') ? 'duck' : p.agentId.includes('amr') ? 'amr' : p.agentId.includes('drone') ? 'drone' : 'humanoid')
        const matchesCategory =
            selectedCategory === 'all' ||
            p.category === selectedCategory ||
            pForm === selectedCategory ||
            (selectedCategory === 'engineering' && (p.category === 'AI Engineering' || p.category === 'engineering' || p.category === 'Management'))

        const q = searchQuery.toLowerCase()
        const matchesSearch =
            !searchQuery ||
            p.name.toLowerCase().includes(q) ||
            p.title.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            (p.computeTier && p.computeTier.toLowerCase().includes(q)) ||
            p.skills.some((s) => s.toLowerCase().includes(q))

        return matchesCategory && matchesSearch
    })

    return (
        <div className="space-y-6">
            {/* 1. HEADER CHÍNH & VÍ COIN (THEME NVIDIA ROBOTICS) */}
            <div className="border-b border-zinc-800 pb-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-lime-500/15 text-lime-400 border border-lime-500/30 flex items-center gap-1.5 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
                            NVIDIA Isaac & Jetson Robotics Fleet
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/80 font-mono">
                            Isaac Sim · ROS 2
                        </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-white mt-1.5 flex items-center gap-2.5 tracking-tight">
                        <span>Kho Robot Tự Hành & AI Agent</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono">
                            v2.5
                        </span>
                    </h1>
                    <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                        Hệ thống điều phối các dòng Robot cao cấp chuẩn NVIDIA (MicroDuck Orin Nano, Nova Carter AMR, GR00T Humanoid & Cyber Falcon). Thuê hoặc mua bản quyền vĩnh viễn bằng Coin ảo!
                    </p>
                </div>

                {/* Thẻ Ví Coin & Thao tác nhanh */}
                <div className="flex items-center gap-2.5 bg-zinc-900/90 border border-zinc-800 p-2 rounded-2xl shrink-0 backdrop-blur shadow-xl">
                    <div className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-transparent border border-amber-500/30 rounded-xl">
                        <IconCoins className="w-4 h-4 text-amber-400 animate-bounce" />
                        <div>
                            <span className="text-[10px] uppercase font-bold text-zinc-400 block leading-none">Số dư ví</span>
                            <strong className="text-sm font-black text-amber-400 font-mono leading-tight">
                                {wallet ? wallet.balance.toLocaleString() : '500'} <span className="text-[11px] font-normal text-zinc-300">Coin</span>
                            </strong>
                        </div>
                    </div>
                    <button
                        onClick={() => setPlanModalOpen(true)}
                        className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
                        title="Vẽ map và thiết kế để nhận thưởng Coin tự động"
                    >
                        <IconSparkles className="w-3.5 h-3.5" />
                        <span>Plan Tasks</span>
                    </button>
                    <button
                        onClick={handleFaucet}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 text-xs font-black transition flex items-center gap-1 shadow-lg shadow-amber-500/20 active:scale-95"
                        title="Nhận 500 Coin miễn phí vào ví để thuê robot thử nghiệm"
                    >
                        <IconPlus className="w-3.5 h-3.5 stroke-[3]" />
                        <span>+500 Faucet</span>
                    </button>
                </div>
            </div>

            {/* 2. CHUYỂN TAB: CỬA HÀNG / KHO SỞ HỮU */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab('store')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                            activeTab === 'store'
                                ? 'bg-gradient-to-r from-lime-600 to-emerald-600 text-white shadow-lg shadow-lime-900/30 ring-1 ring-lime-500/50'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                        }`}
                    >
                        <IconShoppingBag className="w-4 h-4" />
                        <span>Cửa Hàng Robot Fleet ({products.length})</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('inventory')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                            activeTab === 'inventory'
                                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-900/30 ring-1 ring-blue-500/50'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                        }`}
                    >
                        <IconBot className="w-4 h-4" />
                        <span>Kho Robot Của Tôi ({inventory.length})</span>
                    </button>
                </div>

                {activeTab === 'store' && (
                    <div className="relative w-full sm:w-72">
                        <IconSearch className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm: MicroDuck, LiDAR, Orin..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500 transition"
                        />
                    </div>
                )}
            </div>

            {/* ─── TAB 1: CỬA HÀNG ROBOT (ROBOTICS MARKETPLACE) ───────────────────────── */}
            {activeTab === 'store' && (
                <div className="space-y-5">
                    {/* Danh mục Robot Form Factor */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                        {ROBOT_CATEGORIES.map((c) => {
                            const active = selectedCategory === c.id
                            return (
                                <button
                                    key={c.id}
                                    onClick={() => setSelectedCategory(c.id)}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                                        active
                                            ? 'bg-zinc-800 text-lime-400 border border-lime-500/40 shadow-sm'
                                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80 border border-transparent'
                                    }`}
                                >
                                    {c.id === 'duck' && <IconDuck className="w-3.5 h-3.5 text-amber-400" />}
                                    {c.id === 'amr' && <IconAmr className="w-3.5 h-3.5 text-orange-400" />}
                                    {c.id === 'humanoid' && <IconHumanoid className="w-3.5 h-3.5 text-lime-400" />}
                                    {c.id === 'drone' && <IconDrone className="w-3.5 h-3.5 text-cyan-400" />}
                                    <span>{c.label}</span>
                                </button>
                            )
                        })}
                    </div>

                    {/* Danh sách thẻ sản phẩm Robot */}
                    {loading ? (
                        <div className="py-20 text-center text-xs text-zinc-500">Đang khởi động liên kết cụm Robot...</div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="py-20 text-center border border-zinc-800 rounded-3xl bg-zinc-900/40 text-xs text-zinc-500 space-y-2">
                            <IconBot className="w-10 h-10 text-zinc-600 mx-auto" />
                            <p className="font-semibold text-zinc-300">Không tìm thấy Robot nào thỏa mãn bộ lọc.</p>
                            <button
                                onClick={() => { setSelectedCategory('all'); setSearchQuery('') }}
                                className="text-lime-400 hover:underline text-xs"
                            >
                                Hiển thị lại toàn bộ Robot Fleet
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {filteredProducts.map((prod) => {
                                const form = prod.formType || (prod.agentId.includes('duck') ? 'duck' : prod.agentId.includes('amr') ? 'amr' : prod.agentId.includes('drone') ? 'drone' : 'humanoid')
                                const badge = getFormBadge(form)

                                return (
                                    <div
                                        key={prod._id || prod.agentId}
                                        className="relative rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900/90 via-zinc-950 to-zinc-950 p-5 hover:border-lime-500/40 hover:shadow-2xl hover:shadow-lime-950/20 transition-all duration-300 flex flex-col justify-between group overflow-hidden"
                                    >
                                        {/* Viền neon quét công nghệ trên đỉnh card */}
                                        <div
                                            className="absolute top-0 left-0 right-0 h-1 opacity-70 group-hover:opacity-100 transition"
                                            style={{
                                                background: `linear-gradient(90deg, transparent, ${prod.color || '#76b900'}, transparent)`,
                                            }}
                                        />

                                        <div className="space-y-3.5">
                                            {/* Chassis Visual & Header */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    {/* Robot Chassis Box */}
                                                    <div
                                                        className="w-13 h-13 p-2.5 rounded-2xl flex items-center justify-center shrink-0 shadow-lg relative border border-white/10"
                                                        style={{
                                                            background: `linear-gradient(135deg, ${prod.color || '#76b900'}, #09090b)`,
                                                        }}
                                                    >
                                                        {renderRobotChassisIcon(form, prod.color)}
                                                        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" />
                                                        </div>
                                                    </div>

                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <h3 className="font-extrabold text-sm text-white group-hover:text-lime-400 transition truncate">
                                                                {prod.name}
                                                            </h3>
                                                        </div>
                                                        <p className="text-[11px] text-zinc-400 font-medium truncate mt-0.5">
                                                            {prod.title}
                                                        </p>
                                                    </div>
                                                </div>

                                                <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-full border shrink-0 ${badge.bg}`}>
                                                    {badge.label}
                                                </span>
                                            </div>

                                            {/* Silicon Hardware Spec Pill (NVIDIA Jetson / Thor) */}
                                            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800/80 text-[11px]">
                                                <div className="flex items-center gap-1.5 text-zinc-300">
                                                    <IconCpu className="w-3.5 h-3.5 text-lime-400 shrink-0" />
                                                    <span className="font-mono font-semibold text-[10px] text-zinc-200">
                                                        {prod.computeTier || 'NVIDIA Jetson Orin'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1 text-amber-400 text-[10px] font-bold">
                                                    <IconStar className="w-3 h-3 fill-amber-400" />
                                                    <span>{prod.rating || 5.0}</span>
                                                </div>
                                            </div>

                                            {/* Mô tả tính năng robot */}
                                            <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                                                {prod.description}
                                            </p>

                                            {/* Bộ kỹ năng / Cảm biến (Skills tags) */}
                                            <div className="flex flex-wrap gap-1.5">
                                                {prod.skills.slice(0, 3).map((s) => (
                                                    <span
                                                        key={s}
                                                        className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 font-medium font-mono"
                                                    >
                                                        {s}
                                                    </span>
                                                ))}
                                                {prod.skills.length > 3 && (
                                                    <span className="text-[10px] text-zinc-500 font-mono self-center">
                                                        +{prod.skills.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Giá & Nút Thuê / Mua */}
                                        <div className="pt-3.5 mt-4 border-t border-zinc-800/80 space-y-3">
                                            <div className="flex items-center justify-between text-xs">
                                                <div>
                                                    <span className="text-zinc-500 text-[10px] block font-medium">Gói thuê robot:</span>
                                                    <span className="font-bold text-amber-400 font-mono text-sm">
                                                        {prod.pricing.rentHourlyRate} Coin/h
                                                    </span>
                                                    <span className="text-zinc-500 text-[10px] ml-1">
                                                        ({prod.pricing.rentDailyRate}/ngày)
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-zinc-500 text-[10px] block font-medium">Mua vĩnh viễn:</span>
                                                    <span className="font-black text-lime-400 font-mono text-sm">
                                                        {prod.pricing.buyPrice.toLocaleString()} Coin
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={() => handleOpenRentModal(prod)}
                                                    className="w-full py-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs border border-zinc-700/80 transition flex items-center justify-center gap-1.5 active:scale-95"
                                                >
                                                    <IconClock className="w-3.5 h-3.5 text-amber-400" />
                                                    <span>Thuê Robot</span>
                                                </button>
                                                <button
                                                    onClick={() => handleBuyNow(prod)}
                                                    className="w-full py-2 rounded-xl bg-gradient-to-r from-lime-600 to-emerald-600 hover:from-lime-500 hover:to-emerald-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-lime-900/30 active:scale-95"
                                                >
                                                    <IconZap className="w-3.5 h-3.5" />
                                                    <span>Mua Đứt</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ─── TAB 2: KHO ROBOT SỞ HỮU (MY ROBOT FLEET) ───────────────────── */}
            {activeTab === 'inventory' && (
                <div className="space-y-4">
                    {loading ? (
                        <div className="py-20 text-center text-xs text-zinc-500">Đang đồng bộ đội hình Robot...</div>
                    ) : inventory.length === 0 ? (
                        <div className="py-20 text-center border border-zinc-800 rounded-3xl bg-zinc-900/40 p-8 space-y-4 max-w-lg mx-auto">
                            <div className="w-16 h-16 rounded-3xl bg-zinc-800/60 border border-zinc-700/60 flex items-center justify-center text-zinc-500 mx-auto">
                                <IconBot className="w-8 h-8 text-zinc-400" />
                            </div>
                            <h3 className="text-base font-bold text-white">Kho Robot của bạn đang trống</h3>
                            <p className="text-xs text-zinc-400 leading-relaxed">
                                Bạn chưa sở hữu hay thuê mẫu Robot nào. Hãy chọn một robot từ Cửa Hàng (như MicroDuck Debugger hoặc Nova Carter AMR) để đưa vào Team Room 3D làm việc ngay!
                            </p>
                            <button
                                onClick={() => setActiveTab('store')}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-lime-600 to-emerald-600 hover:from-lime-500 hover:to-emerald-500 text-white text-xs font-bold transition inline-flex items-center gap-2 shadow-lg shadow-lime-900/30 active:scale-95"
                            >
                                <span>Khám phá Cửa Hàng Robot</span>
                                <IconArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {inventory.map((item) => {
                                const prod = item.productId
                                const isOwned = item.ownershipType === 'owned'
                                const form = prod?.formType || (item.agentId.includes('duck') ? 'duck' : item.agentId.includes('amr') ? 'amr' : item.agentId.includes('drone') ? 'drone' : 'humanoid')
                                const badge = getFormBadge(form)

                                return (
                                    <div
                                        key={item._id}
                                        className="p-5 rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900/80 to-zinc-950 flex flex-col justify-between space-y-4 hover:border-blue-500/40 transition shadow-lg"
                                    >
                                        <div className="space-y-3.5">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg relative border border-white/10"
                                                        style={{
                                                            background: `linear-gradient(135deg, ${prod?.color || '#3b82f6'}, #09090b)`,
                                                        }}
                                                    >
                                                        {renderRobotChassisIcon(form, prod?.color)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-extrabold text-sm text-white">{item.agentName}</h4>
                                                        <span className="text-[10px] text-zinc-400 font-medium block">{prod?.title || 'Robot Agent'}</span>
                                                    </div>
                                                </div>

                                                <span
                                                    className={`px-2 py-0.5 text-[9px] font-black rounded-full border uppercase ${
                                                        isOwned
                                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                                    }`}
                                                >
                                                    {isOwned ? 'Sở hữu vĩnh viễn' : 'Đang thuê'}
                                                </span>
                                            </div>

                                            {/* Badge Form & Hardware */}
                                            <div className="flex items-center justify-between text-[11px] px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800">
                                                <span className={`text-[10px] font-bold ${badge.bg} px-2 py-0.5 rounded-md`}>
                                                    {badge.label}
                                                </span>
                                                <span className="text-zinc-400 font-mono text-[10px]">
                                                    {prod?.computeTier || 'NVIDIA Jetson'}
                                                </span>
                                            </div>

                                            {/* Trạng thái thuê / thời hạn */}
                                            <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs space-y-1">
                                                <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                                                    <span>Thời hạn triển khai:</span>
                                                    <strong className={isOwned ? 'text-emerald-400' : 'text-amber-400 font-mono'}>
                                                        {isOwned
                                                            ? 'Vô thời hạn'
                                                            : item.isExpired
                                                            ? 'Đã hết hạn'
                                                            : `${item.remainingDays > 0 ? `${item.remainingDays} ngày ` : ''}${item.remainingHours} giờ`}
                                                    </strong>
                                                </div>
                                                {!isOwned && item.rentExpiresAt && (
                                                    <div className="text-[10px] text-zinc-500 font-mono">
                                                        Hạn: {new Date(item.rentExpiresAt).toLocaleString('vi-VN')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="pt-2">
                                            <a
                                                href="/rooms"
                                                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 active:scale-95"
                                            >
                                                <span>Triển khai vào Team Room 3D</span>
                                                <IconArrowRight className="w-3.5 h-3.5" />
                                            </a>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ─── MODAL XÁC NHẬN THUÊ AGENT ─────────────────────────────────── */}
            {rentModalProduct && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
                            <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                <IconClock className="w-4 h-4 text-amber-400" />
                                <span>Thuê Robot: {rentModalProduct.name}</span>
                            </h3>
                            <button
                                onClick={() => setRentModalProduct(null)}
                                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition"
                            >
                                <IconX className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4 text-xs">
                            <div className="space-y-1.5">
                                <label className="text-zinc-400 font-medium">Chọn gói thời hạn:</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'hourly', label: 'Theo Giờ', rate: rentModalProduct.pricing.rentHourlyRate },
                                        { id: 'daily', label: 'Theo Ngày', rate: rentModalProduct.pricing.rentDailyRate },
                                        { id: 'monthly', label: 'Theo Tháng', rate: rentModalProduct.pricing.rentMonthlyRate },
                                    ].map((dur) => (
                                        <button
                                            key={dur.id}
                                            onClick={() => setRentalDuration(dur.id as any)}
                                            className={`p-2.5 rounded-xl border text-center transition ${
                                                rentalDuration === dur.id
                                                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                                                    : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:text-white'
                                            }`}
                                        >
                                            <div className="font-semibold text-xs">{dur.label}</div>
                                            <div className="text-[11px] font-mono text-amber-400 mt-0.5">
                                                {dur.rate} Coin
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-zinc-400 font-medium">Số lượng thời gian:</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={1}
                                        max={30}
                                        value={durationUnits}
                                        onChange={(e) => setDurationUnits(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono text-sm w-24 text-center focus:outline-none focus:border-amber-500"
                                    />
                                    <span className="text-zinc-400 text-xs">
                                        {rentalDuration === 'hourly' ? 'Giờ' : rentalDuration === 'daily' ? 'Ngày' : 'Tháng'}
                                    </span>
                                </div>
                            </div>

                            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                                <span className="text-zinc-400">Tổng chi phí thanh toán:</span>
                                <strong className="text-base font-black text-amber-400 font-mono">
                                    {calculateRentalCost().toLocaleString()} Coin
                                </strong>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <button
                                    onClick={() => setRentModalProduct(null)}
                                    className="w-1/2 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleConfirmRent}
                                    disabled={processing}
                                    className="w-1/2 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 font-black transition flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20"
                                >
                                    {processing ? 'Đang xử lý...' : 'Xác Nhận Thuê'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Nhiệm vụ Plan Tasks kiếm Coin */}
            <PlanTasksModal
                isOpen={planModalOpen}
                onClose={() => setPlanModalOpen(false)}
                userId={currentUserId}
                userName={currentUserName}
                onWalletUpdate={(w) => setWallet(w as any)}
            />
        </div>
    )
}
