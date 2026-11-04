import { toast } from 'sonner'

type Opts = {
    description?: string
    duration?: number
}

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