import { rentalSessionRepository } from "../repositories/rental-session.repository";
import { agentBindingRepository } from "../repositories/agent-binding.repository";
import { logger } from "../config/logger";

const SELLER_SERVICE_URL = process.env.SELLER_SERVICE_URL || "http://seller-service:5011";

export interface AgentInferenceParams {
    rentalSessionId: string;
    agentId?: string;
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
}

export class AgentInferenceService {
    async runInferenceForAgent(params: AgentInferenceParams) {
        const { rentalSessionId, agentId, prompt, systemPrompt, temperature, maxTokens } = params;

        const session = await rentalSessionRepository.findBySessionId(rentalSessionId);
        if (!session) {
            throw new Error(`Phiên thuê không tồn tại: ${rentalSessionId}`);
        }

        if (session.status !== "ACTIVE") {
            throw new Error(`Phiên thuê ${rentalSessionId} không còn hiệu lực (trạng thái: ${session.status})`);
        }

        // Chuyển tiếp yêu cầu suy luận sang seller-service
        let sellerResult: any = null;
        try {
            const res = await fetch(`${SELLER_SERVICE_URL}/api/v1/seller/nodes/${session.nodeId}/inference`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    renterId: session.renterId,
                    prompt,
                    systemPrompt,
                    temperature,
                    maxTokens,
                }),
                signal: AbortSignal.timeout(15000),
            });

            if (res.ok) {
                sellerResult = await res.json();
            } else {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || `Lỗi từ Seller Service (HTTP ${res.status})`);
            }
        } catch (err: any) {
            logger.error("Lỗi kết nối tới seller-service:", err.message);
            throw new Error(`Không thể thực thi lệnh trên Node của Seller: ${err.message}`);
        }

        if (!sellerResult || !sellerResult.output) {
            throw new Error(sellerResult?.message || `Node của Seller không phản hồi kết quả suy luận hợp lệ.`);
        }

        const latencyMs = sellerResult.latencyMs || 0;
        const tokens = sellerResult.tokens || 0;
        const coinsBilled = sellerResult.coinsBilled || 0;
        const output = sellerResult.output;

        // Cập nhật thống kê phiên thuê vào MongoDB
        await rentalSessionRepository.incrementUsage(rentalSessionId, tokens, coinsBilled);

        if (agentId) {
            const binding = await agentBindingRepository.findByAgentId(agentId);
            if (binding) {
                await agentBindingRepository.incrementPrompts(binding.bindingId);
            }
        }

        return {
            success: true,
            sessionId: rentalSessionId,
            nodeId: session.nodeId,
            nodeName: session.nodeName,
            modelName: session.modelDisplayName,
            output,
            tokens,
            latencyMs,
            coinsBilled,
        };
    }
}

export const agentInferenceService = new AgentInferenceService();
