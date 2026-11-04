// src/components/ui/StatusBadge.tsx
type Status = 'todo' | 'doing' | 'done' | 'blocked'

const STYLES: Record<Status, string> = {
    todo: 'bg-zinc-700 text-zinc-300',
    doing: 'bg-blue-600/30 text-blue-300 border border-blue-500/40',
    done: 'bg-green-600/30 text-green-300 border border-green-500/40',
    blocked: 'bg-red-600/30 text-red-300 border border-red-500/40',
}

const LABELS: Record<Status, string> = {
    todo: 'To do',
    doing: 'Doing',
    done: 'Done',
    blocked: 'Blocked',
}

export default function StatusBadge({ status }: { status: Status }) {
    return (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STYLES[status]}`}>
            {LABELS[status]}
        </span>
    )
}