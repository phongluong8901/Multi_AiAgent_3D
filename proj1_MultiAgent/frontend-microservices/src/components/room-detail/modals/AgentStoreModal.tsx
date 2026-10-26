'use client'

import { useState, useEffect } from 'react'
import {
    marketplaceApi,
    AgentProduct,
    UserWallet,
    UserInventoryItem,
} from '@/lib/api/marketplace'
import {
    IconBot,
    IconSearch,
    IconSparkles,
    IconCoins,
    IconZap,
    IconClock,
    IconCheck,
    IconLock,
    IconShoppingBag,
    IconX,
    IconPlus,
    IconStar,
    IconDuck,
    IconAmr,
    IconDrone,
    IconHumanoid,
    IconCpu,
} from '@/components/ui/icons'

function getRobotIcon(form?: string, agentId?: string) {
    const f = form || (agentId?.includes('duck') ? 'duck' : agentId?.includes('amr') ? 'amr' : agentId?.includes('drone') ? 'drone' : 'humanoid')
    switch (f) {
        case 'duck':
            return <IconDuck className="h-6 w-6 text-white" />
        case 'amr':
            return <IconAmr className="h-6 w-6 text-white" />
        case 'drone':
            return <IconDrone className="h-6 w-6 text-white" />
        default:
            return <IconHumanoid className="h-6 w-6 text-white" />
    }
}

interface AgentStoreModalProps {
    isOpen: boolean
    onClose: () => void
    currentUserId: string
    currentUserName: string
    roomId?: string
    onAgentSummoned?: (agentId: string) => void
}

export function AgentStoreModal({
    isOpen,
    onClose,
    currentUserId,
    currentUserName,
    roomId,
    onAgentSummoned,
}: AgentStoreModalProps) {
    const [activeTab, setActiveTab] = useState<'store' | 'inventory'>('store')
    const [products, setProducts] = useState<AgentProduct[]>([])
    const [wallet, setWallet] = useState<UserWallet | null>(null)
    const [inventory, setInventory] = useState<UserInventoryItem[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')

    // State cho Modal xác nhận thuê/mua
    const [rentModalProduct, setRentModalProduct] = useState<AgentProduct | null>(null)
    const [rentalDuration, setRentalDuration] = useState<'hourly' | 'daily' | 'monthly'>('daily')
    const [durationUnits, setDurationUnits] = useState<number>(1)
    const [processing, setProcessing] = useState(false)

    useEffect(() => {
        if (!isOpen) return
        loadData()
    }, [isOpen, currentUserId])

    const loadData = async () => {
        try {
            setLoading(true)
            const [prodsRes, walletRes, invRes] = await Promise.all([
                marketplaceApi.getProducts(),
                currentUserId ? marketplaceApi.getWallet(currentUserId) : Promise.resolve(null),
                currentUserId ? marketplaceApi.getUserInventory(currentUserId) : Promise.resolve(null),
            ])

            if (prodsRes?.success) setProducts(prodsRes.data)
            if (walletRes?.success) setWallet(walletRes.data)
            if (invRes?.success) setInventory(invRes.data)
        } catch (err) {
            console.error('Error loading marketplace data:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleFaucet = async () => {
        if (!currentUserId) return
        try {
            const res = await marketplaceApi.faucetCoin({ userId: currentUserId, amount: 500 })
            if (res.success) {
                setWallet(res.data)
                alert('Đã nạp thành công +500 Coin vào ví của bạn!')
            }
        } catch (err: any) {
            alert('Lỗi nạp coin: ' + err.message)
        }
    }

    const handleBuyNow = async (prod: AgentProduct) => {
        if (!currentUserId) {
            alert('Vui lòng đăng nhập để mua Agent!')
            return
        }

        const confirm = window.confirm(
            `Xác nhận mua đứt vĩnh viễn Agent '${prod.name}' với giá ${prod.pricing.buyPrice} Coin?`
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
                alert(res.message)
                await loadData()
            }
        } catch (err: any) {
            alert(`Mua thất bại: ${err.message}`)
        } finally {
            setProcessing(false)
        }
    }

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
                alert(res.message)
                setRentModalProduct(null)
                await loadData()
            }
        } catch (err: any) {
            alert(`Thuê thất bại: ${err.message}`)
        } finally {
            setProcessing(false)
        }
    }

    if (!isOpen) return null

    const filteredProducts = products.filter((p) => {
        const matchCat = selectedCategory === 'all' || p.category === selectedCategory
        const matchSearch =
            !searchQuery ||
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
        return matchCat && matchSearch
    })

    const categories = [
        { id: 'all', label: 'Tất cả Agent' },
        { id: 'AI Engineering', label: 'AI & Học máy' },
        { id: 'Research & Search', label: 'Tra cứu & Web' },
        { id: 'Data Analytics', label: 'Dữ liệu & Hệ thống' },
        { id: 'Management', label: 'Quản lý & Điều phối' },
        { id: 'Content & Summary', label: 'Tóm tắt & Nội dung' },
        { id: 'DevOps & Cloud', label: 'DevOps & Đám mây' },
    ]

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <div className="relative flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-zinc-700/80 bg-zinc-950/95 shadow-2xl backdrop-blur-xl">
                {/* Header Modal */}
                <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
                            <IconShoppingBag className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                Agent Marketplace & Rental Store
                                <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-400">
                                    Microservice v1.0
                                </span>
                            </h2>
                            <p className="text-xs text-zinc-400">
                                Mua bản quyền vĩnh viễn hoặc thuê Agent theo giờ/ngày phục vụ văn phòng 3D
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Ví Coin */}
                        <div className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-950/40 px-3.5 py-1.5 shadow-inner">
                            <IconCoins className="w-4 h-4 text-amber-400" />
                            <div className="text-left">
                                <span className="block text-[10px] uppercase font-bold text-amber-500">Ví Coin</span>
                                <span className="text-sm font-black text-amber-300">
                                    {wallet ? wallet.balance.toLocaleString() : '1,000'} COIN
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={handleFaucet}
                                title="Nhận thêm 500 Coin thử nghiệm"
                                className="ml-1 flex items-center gap-1 rounded-xl bg-amber-500 px-2 py-1 text-[11px] font-bold text-zinc-950 hover:bg-amber-400"
                            >
                                <IconPlus className="h-3 w-3" />
                                Nạp Free
                            </button>
                        </div>

                        {/* Nút đóng */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                        >
                            <IconX className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Subheader: Tabs & Filters */}
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-zinc-800 bg-zinc-900/30 px-6 py-3">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab('store')}
                            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                                activeTab === 'store'
                                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30'
                                    : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
                            }`}
                        >
                            <IconBot className="h-4 w-4" />
                            Cửa Hàng Agent ({products.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('inventory')}
                            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
                                activeTab === 'inventory'
                                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30'
                                    : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
                            }`}
                        >
                            <IconSparkles className="h-4 w-4" />
                            Agent Của Tôi ({inventory.length})
                        </button>
                    </div>

                    {activeTab === 'store' && (
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <IconSearch className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Tìm Agent, kỹ năng..."
                                    className="w-56 rounded-xl border border-zinc-800 bg-zinc-900/90 py-1.5 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Category Pills (Khi ở tab store) */}
                {activeTab === 'store' && (
                    <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-zinc-800/80 bg-zinc-950 px-6 py-2.5 scrollbar-none">
                        {categories.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => setSelectedCategory(c.id)}
                                className={`shrink-0 rounded-lg px-3 py-1 text-xs font-medium transition ${
                                    selectedCategory === c.id
                                        ? 'border border-indigo-500/40 bg-indigo-600/20 text-indigo-300'
                                        : 'border border-zinc-800/80 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Body Content */}
                <div className="min-h-0 flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-800">
                    {loading ? (
                        <div className="flex h-64 flex-col items-center justify-center gap-3 text-zinc-500">
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                            <span className="text-xs">Đang tải danh mục Agent từ Product Microservice...</span>
                        </div>
                    ) : activeTab === 'store' ? (
                        filteredProducts.length === 0 ? (
                            <div className="py-20 text-center text-zinc-500">
                                Không tìm thấy Agent nào phù hợp với bộ lọc.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                                {filteredProducts.map((prod) => {
                                    const userInv = inventory.find((i) => i.agentId === prod.agentId)
                                    const isOwned = userInv?.ownershipType === 'owned'
                                    const isRented = userInv?.ownershipType === 'rented' && !userInv.isExpired

                                    return (
                                        <div
                                            key={prod._id}
                                            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-5 shadow-xl transition-all hover:border-indigo-500/50 hover:bg-zinc-900/90 hover:shadow-2xl"
                                        >
                                            {/* Top info */}
                                            <div>
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-inner ring-2 ring-white/10"
                                                            style={{ backgroundColor: prod.color || '#76b900' }}
                                                        >
                                                            {getRobotIcon(prod.formType, prod.agentId)}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-white group-hover:text-lime-400 transition text-sm">
                                                                {prod.name}
                                                            </h3>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                <span className="text-[10px] font-mono text-zinc-400">
                                                                    {prod.computeTier || prod.category}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Badge sở hữu / thuê */}
                                                    {isOwned ? (
                                                        <span className="rounded-lg border border-emerald-500/40 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                                                            Đã Sở Hữu
                                                        </span>
                                                    ) : isRented ? (
                                                        <span className="rounded-lg border border-purple-500/40 bg-purple-950/60 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                                                            Đang Thuê ({userInv?.remainingDays}d)
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                                                            <IconStar className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                                            <span>{prod.rating} ({prod.reviewsCount})</span>
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="mt-3 text-xs leading-relaxed text-zinc-300 line-clamp-2">
                                                    {prod.description}
                                                </p>

                                                {/* Kỹ năng */}
                                                <div className="mt-3 flex flex-wrap gap-1.5">
                                                    {prod.skills.slice(0, 3).map((sk, i) => (
                                                        <span
                                                            key={i}
                                                            className="rounded-md border border-zinc-800 bg-zinc-950/80 px-2 py-0.5 text-[10px] font-medium text-zinc-400"
                                                        >
                                                            {sk}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Bottom: Pricing & Actions */}
                                            <div className="mt-5 border-t border-zinc-800/80 pt-4">
                                                <div className="flex items-center justify-between mb-3 text-xs">
                                                    <div>
                                                        <span className="text-[10px] text-zinc-500 block">Thuê từ:</span>
                                                        <span className="font-bold text-indigo-400">
                                                            {prod.pricing.rentDailyRate} COIN / ngày
                                                        </span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[10px] text-zinc-500 block">Mua đứt:</span>
                                                        <span className="font-bold text-amber-400">
                                                            {prod.pricing.buyPrice} COIN
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setRentModalProduct(prod)
                                                            setRentalDuration('daily')
                                                            setDurationUnits(1)
                                                        }}
                                                        disabled={isOwned || processing}
                                                        className="flex items-center justify-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-600/20 py-2 text-xs font-semibold text-indigo-300 transition hover:bg-indigo-600 hover:text-white disabled:opacity-40"
                                                    >
                                                        <IconClock className="h-3.5 w-3.5" />
                                                        {isRented ? 'Gia hạn Thuê' : 'Thuê Agent'}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleBuyNow(prod)}
                                                        disabled={isOwned || processing}
                                                        className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-2 text-xs font-bold text-zinc-950 transition hover:from-amber-400 hover:to-amber-500 disabled:opacity-40"
                                                    >
                                                        <IconZap className="h-3.5 w-3.5" />
                                                        {isOwned ? 'Đã Sở Hữu' : 'Mua Đứt'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    ) : (
                        /* Tab Inventory: Agent của tôi */
                        <div>
                            {inventory.length === 0 ? (
                                <div className="py-20 text-center">
                                    <IconBot className="mx-auto h-12 w-12 text-zinc-600 mb-2" />
                                    <p className="text-sm font-semibold text-zinc-400">Bạn chưa mua hoặc thuê Agent nào</p>
                                    <p className="text-xs text-zinc-500 mt-1">
                                        Hãy ghé tab Cửa Hàng Agent để mở khóa thêm các đồng nghiệp AI thông minh!
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('store')}
                                        className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500"
                                    >
                                        Khám phá Cửa Hàng
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {inventory.map((item) => (
                                        <div
                                            key={item._id}
                                            className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="flex h-11 w-11 items-center justify-center rounded-xl"
                                                        style={{ backgroundColor: item.productId?.color || '#3b82f6' }}
                                                    >
                                                        <IconBot className="h-6 w-6 text-white" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-white">{item.agentName}</h4>
                                                        <span className="text-[11px] text-zinc-400 font-mono">
                                                            @{item.agentId}
                                                        </span>
                                                    </div>
                                                </div>

                                                <span
                                                    className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                                                        item.ownershipType === 'owned'
                                                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                                                            : item.isExpired
                                                            ? 'bg-red-950 text-red-400 border border-red-500/30'
                                                            : 'bg-purple-950 text-purple-300 border border-purple-500/30'
                                                    }`}
                                                >
                                                    {item.ownershipType === 'owned'
                                                        ? 'Sở hữu vĩnh viễn'
                                                        : item.isExpired
                                                        ? 'Đã hết hạn thuê'
                                                        : `Còn ${item.remainingDays} ngày thuê`}
                                                </span>
                                            </div>

                                            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400 space-y-1">
                                                <div className="flex justify-between">
                                                    <span>Hình thức:</span>
                                                    <span className="font-semibold text-white">
                                                        {item.ownershipType === 'owned' ? 'Mua đứt (Full License)' : 'Thuê dịch vụ'}
                                                    </span>
                                                </div>
                                                {item.ownershipType === 'rented' && item.rentExpiresAt && (
                                                    <div className="flex justify-between">
                                                        <span>Hạn dùng đến:</span>
                                                        <span className="font-medium text-amber-300">
                                                            {new Date(item.rentExpiresAt).toLocaleDateString('vi-VN')}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {roomId && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (onAgentSummoned) onAgentSummoned(item.agentId)
                                                        alert(`Đã kích hoạt Agent @${item.agentId} vào phòng 3D!`)
                                                    }}
                                                    className="mt-4 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2 text-xs font-bold text-white hover:opacity-90 flex items-center justify-center gap-1.5"
                                                >
                                                    <IconBot className="w-3.5 h-3.5" />
                                                    <span>Triệu Hồi Vào Phòng 3D Này</span>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Xác Nhận Thuê Agent */}
            {rentModalProduct && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-3xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <IconClock className="h-4 w-4 text-indigo-400" />
                                Thuê Agent: {rentModalProduct.name}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setRentModalProduct(null)}
                                className="text-zinc-500 hover:text-white"
                            >
                                <IconX className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mt-4 space-y-4 text-xs">
                            <div>
                                <label className="block text-[11px] font-semibold text-zinc-400 mb-1.5">
                                    Chọn gói thời gian thuê:
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setRentalDuration('hourly')}
                                        className={`rounded-xl border p-2.5 text-center transition ${
                                            rentalDuration === 'hourly'
                                                ? 'border-indigo-500 bg-indigo-600/30 text-white font-bold'
                                                : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                                        }`}
                                    >
                                        <div>Theo Giờ</div>
                                        <div className="text-[11px] text-indigo-300 font-mono mt-0.5">
                                            {rentModalProduct.pricing.rentHourlyRate} Coin/h
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setRentalDuration('daily')}
                                        className={`rounded-xl border p-2.5 text-center transition ${
                                            rentalDuration === 'daily'
                                                ? 'border-indigo-500 bg-indigo-600/30 text-white font-bold'
                                                : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                                        }`}
                                    >
                                        <div>Theo Ngày</div>
                                        <div className="text-[11px] text-indigo-300 font-mono mt-0.5">
                                            {rentModalProduct.pricing.rentDailyRate} Coin/d
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setRentalDuration('monthly')}
                                        className={`rounded-xl border p-2.5 text-center transition ${
                                            rentalDuration === 'monthly'
                                                ? 'border-indigo-500 bg-indigo-600/30 text-white font-bold'
                                                : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                                        }`}
                                    >
                                        <div>Theo Tháng</div>
                                        <div className="text-[11px] text-indigo-300 font-mono mt-0.5">
                                            {rentModalProduct.pricing.rentMonthlyRate} Coin/m
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-zinc-400 mb-1.5">
                                    Số lượng ({rentalDuration === 'hourly' ? 'giờ' : rentalDuration === 'daily' ? 'ngày' : 'tháng'}):
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max="365"
                                        value={durationUnits}
                                        onChange={(e) => setDurationUnits(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-white font-bold focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Tổng chi phí */}
                            <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/40 p-4 text-xs">
                                <div className="flex justify-between items-center text-zinc-300 mb-1">
                                    <span>Tổng chi phí thuê:</span>
                                    <span className="text-base font-black text-amber-300">
                                        {(
                                            (rentalDuration === 'hourly'
                                                ? rentModalProduct.pricing.rentHourlyRate
                                                : rentalDuration === 'daily'
                                                ? rentModalProduct.pricing.rentDailyRate
                                                : rentModalProduct.pricing.rentMonthlyRate) * durationUnits
                                        ).toLocaleString()}{' '}
                                        COIN
                                    </span>
                                </div>
                                <div className="flex justify-between text-[11px] text-zinc-400">
                                    <span>Số dư ví hiện tại:</span>
                                    <span>{wallet ? wallet.balance.toLocaleString() : '1,000'} COIN</span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleConfirmRent}
                                disabled={processing}
                                className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:opacity-90 disabled:opacity-50"
                            >
                                {processing ? 'Đang xử lý...' : 'Xác Nhận Thuê & Trừ Coin'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
