import { toast } from 'sonner'

/**
 * Tuy chon bo sung cho thong bao toast
 */
type Opts = {
    description?: string
    duration?: number
}

/**
 * Tien ich hien thi thong bao he thong (Toast Notification) su dung sonner:
 * - success: Thong bao hanh dong thanh cong
 * - error: Thong bao that bai hoac loi ngoai le
 * - info: Thong bao thong tin hoac huong dan
 * - loading: Thong bao dang xu ly tien trinh
 * - promise: Tu dong cap nhat trang thai tu Promise (loading -> success/error)
 */
export const notify = {
    success: (title: string, opts?: Opts) =>
        toast.success(title, {
            description: opts?.description,
            duration: opts?.duration ?? 3000,
        }),

    error: (title: string, opts?: Opts) =>
        toast.error(title, {
            description: opts?.description,
            duration: opts?.duration ?? 4000,
        }),

    info: (title: string, opts?: Opts) =>
        toast.message(title, {
            description: opts?.description,
            duration: opts?.duration ?? 3000,
        }),

    loading: (title: string) => toast.loading(title),

    dismiss: (id?: string | number) => toast.dismiss(id),

    promise: <T,>(
        p: Promise<T>,
        messages: {
            loading: string
            success: string
            error: string
        }
    ) => toast.promise(p, messages),
}
