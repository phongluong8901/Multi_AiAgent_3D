// src/app/admin/page.tsx
'use client'

import { useEffect } from 'react'
import { useAdmin } from '@/hooks/useAdmin'

export default function AdminPage() {
    const { users, hardwareNodes, fetchUsers, fetchHardwareNodes, updateUserRole, deleteUser, loading, actionLoading } = useAdmin()

    useEffect(() => {
        fetchUsers()
        fetchHardwareNodes()
    }, [fetchUsers, fetchHardwareNodes])

    const handleRoleChange = async (userId: string, newRole: string) => {
        try {
            await updateUserRole({ userId, role: newRole })
        } catch {
            // Lỗi đã được xử lý bên trong hook bằng toast
        }
    }

    const handleDelete = async (userId: string) => {
        if (confirm('Bạn có chắc chắn muốn xóa người dùng này không?')) {
            await deleteUser(userId)
        }
    }

    return (
        <div className="p-8 max-w-6xl mx-auto text-white">
            <h1 className="text-2xl font-bold mb-2">Bảng điều khiển Quản trị viên (Admin Dashboard)</h1>
            <p className="text-zinc-400 text-sm mb-6">Quản lý tài khoản người dùng, phân quyền hệ thống và giám sát nút phần cứng.</p>

            {loading ? (
                <div className="text-zinc-500 text-sm">Đang tải dữ liệu hệ thống...</div>
            ) : (
                <div className="space-y-8">
                    {/* Danh sách người dùng */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-zinc-800 font-semibold text-sm">Quản lý Người dùng ({users.length})</div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800">
                                    <tr>
                                        <th className="p-3">Tên</th>
                                        <th className="p-3">Email</th>
                                        <th className="p-3">Quyền hạn (Role)</th>
                                        <th className="p-3 text-right">Hành động</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/60">
                                    {users.map((u: any) => {
                                        const uid = u.id || u._id
                                        return (
                                            <tr key={uid} className="hover:bg-zinc-800/40">
                                                <td className="p-3 font-medium">{u.name || u.username}</td>
                                                <td className="p-3 text-zinc-400">{u.email}</td>
                                                <td className="p-3">
                                                    <select
                                                        value={u.role || 'user'}
                                                        disabled={actionLoading}
                                                        onChange={(e) => handleRoleChange(uid, e.target.value)}
                                                        className="bg-zinc-950 border border-zinc-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                                                    >
                                                        <option value="admin">admin</option>
                                                        <option value="seller">seller</option>
                                                        <option value="user">user</option>
                                                        <option value="guest">guest</option>
                                                    </select>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <button
                                                        onClick={() => handleDelete(uid)}
                                                        disabled={actionLoading}
                                                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1 rounded text-xs transition-colors border border-red-500/20"
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
                    </div>

                    {/* Danh sách Hardware Nodes */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                        <h2 className="text-lg font-semibold mb-4 text-blue-400">Danh sách Hardware Nodes trong hệ thống ({hardwareNodes.length})</h2>
                        <pre className="bg-zinc-950 p-4 rounded-lg text-xs text-zinc-300 overflow-x-auto border border-zinc-800">
                            {JSON.stringify(hardwareNodes, null, 2)}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    )
}