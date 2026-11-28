export type NodeTier = 'START' | 'MIDDLE' | 'END';

export const NODE_TIERS: Record<string, NodeTier> = {
    schedule_trigger: 'START',
    process_node: 'START',
    metric_trigger: 'START',
    condition_node: 'MIDDLE',
    logic_gate: 'MIDDLE',
    resource_quota: 'MIDDLE',
    service_action: 'END',
    automation_node: 'END',
    webhook_node: 'END',
};

export interface ConnectionValidationResult {
    isValid: boolean;
    reason?: string;
    sourceTier?: NodeTier;
    targetTier?: NodeTier;
}

/**
 * Kiểm định tính hợp lệ của liên kết giữa 2 node theo kiến trúc luồng dữ liệu DAG:
 * Quy tắc: START -> MIDDLE -> END.
 * Chặn các trường hợp nối ngược (END -> START, END -> MIDDLE, MIDDLE -> START) hoặc nối vào Schedule Trigger.
 */
export function validateNodeConnection(
    sourceNode: { id: string; type?: string; data?: any } | undefined,
    targetNode: { id: string; type?: string; data?: any } | undefined
): ConnectionValidationResult {
    if (!sourceNode || !targetNode) {
        return { isValid: false, reason: 'Không tìm thấy thông tin của node nguồn hoặc node đích.' };
    }

    if (sourceNode.id === targetNode.id) {
        return { isValid: false, reason: 'Không thể nối một node với chính nó (Self-loop error).' };
    }

    const sourceType = sourceNode.type || 'unknown';
    const targetType = targetNode.type || 'unknown';

    // Schedule Trigger là Source tuyệt đối, không được có bất kỳ kết nối input nào vào nó
    if (targetType === 'schedule_trigger') {
        return {
            isValid: false,
            reason: 'Schedule Trigger là điểm phát xung nhịp đầu vào (Pure Source), không thể nhận tín hiệu từ node khác.',
            sourceTier: NODE_TIERS[sourceType] || 'START',
            targetTier: 'START',
        };
    }

    const sourceTier = NODE_TIERS[sourceType] || 'START';
    const targetTier = NODE_TIERS[targetType] || 'END';

    const sourceLabel = sourceNode.data?.name || sourceNode.data?.title || sourceType;
    const targetLabel = targetNode.data?.name || targetNode.data?.title || targetType;

    // Chặn nối ngược từ END về START
    if (sourceTier === 'END' && targetTier === 'START') {
        return {
            isValid: false,
            reason: `Không thể nối ngược từ Tầng END [${sourceLabel}] về Tầng START [${targetLabel}]. Chuỗi xử lý chỉ chạy 1 chiều: START -> MIDDLE -> END.`,
            sourceTier,
            targetTier,
        };
    }

    // Chặn nối ngược từ END về MIDDLE
    if (sourceTier === 'END' && targetTier === 'MIDDLE') {
        return {
            isValid: false,
            reason: `Không thể nối ngược từ Tầng END [${sourceLabel}] về Tầng MIDDLE [${targetLabel}]. Vui lòng đưa các node hành động về cuối chuỗi.`,
            sourceTier,
            targetTier,
        };
    }

    // Chặn nối ngược từ MIDDLE về START (ngoại lệ: logic_gate không nối vào process/schedule)
    if (sourceTier === 'MIDDLE' && targetTier === 'START') {
        return {
            isValid: false,
            reason: `Không thể nối ngược từ Tầng MIDDLE [${sourceLabel}] về Tầng START [${targetLabel}]. Tín hiệu phải bắt nguồn từ Triggers/Process.`,
            sourceTier,
            targetTier,
        };
    }

    // Hợp lệ:
    // START -> START (Schedule -> Process, Process -> Metric Alert)
    // START -> MIDDLE (Trigger -> Condition, Trigger -> Logic Gate, Trigger -> Quota)
    // START -> END (Trigger -> Action, Trigger -> Webhook)
    // MIDDLE -> MIDDLE (Condition -> Logic Gate, Condition -> Quota)
    // MIDDLE -> END (Condition -> Action, Logic Gate -> Webhook)
    // END -> END (Service Action -> PC Automation, Action -> Webhook)
    return {
        isValid: true,
        sourceTier,
        targetTier,
    };
}

