'use client'

import { useEffect, useState } from 'react'
import { useAdmin } from '@/hooks/useAdmin'
import { useConfirm } from '@/context/ConfirmContext'

export default function AdminDashboardPage() {
    const { confirm } = useConfirm()
    const {
        users,
        hardwareNodes,
        loading,
        actionLoading,
        error,
        fetchUsers,
        fetchHardwareNodes,
        updateUserRole,
        deleteUser,
    } = useAdmin()

    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchUsers()
        fetchHardwareNodes()
    }, [fetchUsers, fetchHardwareNodes])

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        fetchUsers({ search: searchTerm.trim() })
    }

    // Lọc danh sách user theo từ khóa tìm kiếm ở local nếu cần
    const filteredUsers = users.filter(
        (u) =>
            u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const totalSellers = users.filter((u) => u.role === 'seller').length
    const totalAdmins = users.filter((u) => u.role === 'admin').length

    return (
        <div className="mx-auto max-w-6xl space-y-8 pb-16">
            {/* Header Banner */}
            <div className="rounded-3xl border border-zinc-800 bg-gradient-to-r from-purple-950/60 via-indigo-950/40 to-zinc-900 p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                            Admin System Portal
                        </span>
                        <h1 className="text-2xl font-bold text-white mt-1">
                            Quản Trị Hệ Thống
                        </h1>
                        <p className="text-xs text-zinc-400 mt-1">
                            Quản lý tài khoản người dùng, phân quyền và giám sát mạng lưới Hardware Nodes.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            fetchUsers()
                            fetchHardwareNodes()
                        }}
                        className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 transition self-start sm:self-auto"
                    >
                        Làm mới dữ liệu
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
                    {error}
                </div>
            )}

            {/* Thống kê tổng quan */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    label="Tổng số Người dùng"
                    value={users.length}
                    color="text-blue-400"
                />
                <StatCard
                    label="Sellers"
                    value={totalSellers}
                    color="text-emerald-400"
                />
                <StatCard
                    label="Quản trị viên (Admins)"
                    value={totalAdmins}
                    color="text-purple-400"
                />
                <StatCard
                    label="Hardware Nodes"
                    value={hardwareNodes.length}
                    color="text-amber-400"
                />
            </div>

            {/* Quản lý Users */}
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800 pb-4">
                    <div>
                        <h2 className="text-base font-bold text-white">
                            Danh Sách Người Dùng ({filteredUsers.length})
                        </h2>
                        <p className="text-xs text-zinc-400">
                            Quản lý thông tin và phân quyền vai trò (Role)
                        </p>
                    </div>

                    <form onSubmit={handleSearch} className="flex gap-2">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm theo tên hoặc email..."
                            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-xs text-white outline-none focus:border-purple-500 w-60"
                        />
                        <button
                            type="submit"
                            className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-500 transition"
                        >
                            Tìm
                        </button>
                    </form>
                </div>

                {loading ? (
                    <p className="text-xs text-zinc-500 py-4 text-center">Đang tải danh sách người dùng...</p>
                ) : filteredUsers.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-4 text-center">Không tìm thấy người dùng nào</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-zinc-300">
                            <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px]">
                                <tr>
                                    <th className="px-4 py-3 rounded-l-xl">Người dùng</th>
                                    <th className="px-4 py-3">Email</th>
                                    <th className="px-4 py-3">Vai trò (Role)</th>
                                    <th className="px-4 py-3 text-right rounded-r-xl">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60">
                                {filteredUsers.map((u) => {
                                    const userId = u.id || u._id
                                    return (
                                        <tr key={userId} className="hover:bg-zinc-950/40 transition">
                                            <td className="px-4 py-3.5 font-medium text-white flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold uppercase">
                                                    {(u.name || u.username || 'U')[0]}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-white">{u.name || u.username || 'N/A'}</p>
                                                    <p className="text-[10px] text-zinc-500 font-mono">{userId}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 text-zinc-400 font-mono">{u.email}</td>
                                            <td className="px-4 py-3.5">
                                                <select
                                                    value={u.role || 'user'}
                                                    disabled={actionLoading}
                                                    onChange={(e) =>
                                                        updateUserRole({ userId, role: e.target.value })
                                                    }
                                                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-white outline-none focus:border-purple-500"
                                                >
                                                    <option value="user">User</option>
                                                    <option value="seller">Seller</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                            </td>
                                            <td className="px-4 py-3.5 text-right">
                                                <button
                                                    type="button"
                                                    disabled={actionLoading}
                                                    onClick={async () => {
                                                        const isConfirmed = await confirm({
                                                            title: 'Xóa người dùng',
                                                            description: `Bạn có chắc chắn muốn xóa user "${u.email}"? Hành động này không thể hoàn tác.`,
                                                            confirmText: 'Xóa user',
                                                            variant: 'danger',
                                                        })
                                                        if (isConfirmed) {
                                                            deleteUser(userId)
                                                        }
                                                    }}
                                                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-400 hover:bg-rose-500/20 transition disabled:opacity-50"
                                                >
                                                    Xóa
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Quản lý Hardware Nodes */}
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6 space-y-6">
                <div className="border-b border-zinc-800 pb-4">
                    <h2 className="text-base font-bold text-white">
                        Mạng Lưới Hardware Nodes ({hardwareNodes.length})
                    </h2>
                    <p className="text-xs text-zinc-400">
                        Danh sách tất cả máy trạm cung cấp tài nguyên phân tán
                    </p>
                </div>

                {hardwareNodes.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-4 text-center">Chưa có Hardware Node nào trong hệ thống</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {hardwareNodes.map((node, index) => (
                            <div
                                key={node.id || node._id || index}
                                className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3"
                            >
                                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                                    <span className="font-bold text-white text-sm">
                                        {node.name || node.nodeName || `Node #${index + 1}`}
                                    </span>
                                    <span
                                        className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${node.status === 'BUSY'
                                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                                : node.status === 'IDLE' || node.status === 'ONLINE'
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                    : 'bg-zinc-800 text-zinc-500 border-zinc-700'
                                            }`}
                                    >
                                        {node.status || 'OFFLINE'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                                    <div>
                                        <span className="text-zinc-500 block text-[10px]">CPU Cores:</span>
                                        <p className="font-semibold text-zinc-200">{node.cpuCores || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <span className="text-zinc-500 block text-[10px]">RAM:</span>
                                        <p className="font-semibold text-zinc-200">{node.deviceMemoryGB || node.ramGB || 'N/A'} GB</p>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-zinc-500 block text-[10px]">GPU:</span>
                                        <p className="font-semibold text-zinc-200">{node.gpuName || 'Không có GPU'}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-1">
            <p className="text-xs text-zinc-400">{label}</p>
            <p className={`text-2xl font-bold tracking-tight ${color}`}>{value}</p>
        </div>
    )
}