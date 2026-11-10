/**
 * Thành phần ranh giới bắt lỗi (React Error Boundary Component):
 * Ngăn chặn lỗi JavaScript / React ném ra từ các component con làm sập toàn bộ ứng dụng,
 * hiển thị giao diện thông báo lỗi kỹ thuật và cho phép bấm nút thử tải lại (Reload).
 */

import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    /** Cụm các component con được bọc bên trong */
    children: ReactNode;
    /** Tiêu đề lỗi tùy biến theo ngữ cảnh vùng hiển thị */
    fallbackTitle?: string;
}

interface State {
    /** Cờ đánh dấu có lỗi render hay không */
    hasError: boolean;
    /** Đối tượng ngoại lệ Error bắt được */
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    /**
     * Cập nhật state khi một component con phát sinh ngoại lệ render.
     */
    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    /**
     * Ghi nhận vết lỗi kỹ thuật vào console phục vụ gỡ lỗi.
     */
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[REACT_ERROR_BOUNDARY]', error, errorInfo);
    }

    /**
     * Đặt lại trạng thái lỗi và thử render lại nội dung con.
     */
    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-zinc-950 text-zinc-300 select-none">
                    {/* Biểu tượng cảnh báo lỗi */}
                    <div className="p-3 rounded-full bg-rose-950/60 border border-rose-800/60 mb-3 text-rose-400">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-100 mb-1">
                        {this.props.fallbackTitle || 'Component Render Error'}
                    </h3>
                    <p className="text-xs text-zinc-500 font-mono max-w-md text-center mb-4 truncate">
                        {this.state.error?.message || 'An unexpected rendering exception occurred.'}
                    </p>
                    {/* Nút bấm thử tải lại component */}
                    <button
                        onClick={this.handleReset}
                        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs transition-colors cursor-pointer"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Reload Component</span>
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
