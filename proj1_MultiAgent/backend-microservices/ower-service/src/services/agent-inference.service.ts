import { rentalSessionRepository } from "../repositories/rental-session.repository";
import { agentBindingRepository } from "../repositories/agent-binding.repository";
import { logger } from "../config/logger";

const SELLER_SERVICE_URL = process.env.SELLER_SERVICE_URL || "http://seller-service:5011";
const SAVECOIN_SERVICE_URL = process.env.SAVECOIN_SERVICE_URL || "http://savecoin-service:5006";

export interface AgentInferenceParams {
    rentalSessionId?: string;
    agentId?: string;
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
}

export class AgentInferenceService {
    async runInferenceForAgent(params: AgentInferenceParams) {
        const { rentalSessionId, agentId, prompt, systemPrompt, temperature, maxTokens } = params;

        let session = rentalSessionId
            ? await rentalSessionRepository.findBySessionId(rentalSessionId)
            : null;

        // Nếu không truyền rentalSessionId hoặc truyền modelId/agentId, tự động tìm phiên ACTIVE tương ứng
        if (!session && agentId) {
            const binding = await agentBindingRepository.findByAgentId(agentId);
            if (binding?.rentalSessionId) {
                session = await rentalSessionRepository.findBySessionId(binding.rentalSessionId);
            }
        }
        if (!session) {
            const activeSessions = await rentalSessionRepository.findAllActive();
            if (activeSessions.length > 0) {
                session = activeSessions[0];
            }
        }

        if (!session) {
            throw new Error(
                `Chưa có phiên thuê máy (RentalSession) nào đang ACTIVE. Vui lòng thuê ít nhất 1 máy trên trang /owner trước.`
            );
        }

        if (session.status !== "ACTIVE") {
            throw new Error(`Phiên thuê ${session.sessionId} không còn hiệu lực (trạng thái: ${session.status})`);
        }

        // Chuyển tiếp yêu cầu suy luận sang seller-service (thử cả Docker DNS và localhost)
        let sellerResult: any = null;
        let lastErr: any = null;
        const sellerBaseUrls = [SELLER_SERVICE_URL, "http://localhost:5011"];

        for (const baseUrl of sellerBaseUrls) {
            try {
                const res = await fetch(`${baseUrl}/api/v1/seller/nodes/${session.nodeId}/inference`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        renterId: session.renterId,
                        prompt,
                        systemPrompt,
                        temperature,
                        maxTokens,
                    }),
                    signal: AbortSignal.timeout(22000),
                });

                if (res.ok) {
                    sellerResult = await res.json();
                    break;
                } else {
                    const errData: any = await res.json().catch(() => ({}));
                    lastErr = new Error(errData.message || `Lỗi từ Seller Service (HTTP ${res.status})`);
                }
            } catch (err: any) {
                lastErr = err;
            }
        }

        if (!sellerResult || !sellerResult.output) {
            logger.error("Lỗi kết nối tới seller-service:", lastErr?.message);
            throw new Error(
                lastErr?.message || `Node của Seller không phản hồi kết quả suy luận hợp lệ.`
            );
        }

        const latencyMs = sellerResult.latencyMs || 0;
        const tokens = sellerResult.tokens || 0;
        const coinsBilled = sellerResult.coinsBilled || 0;
        const output = sellerResult.output;

        // Cập nhật thống kê phiên thuê vào MongoDB
        const updatedSession = await rentalSessionRepository.incrementUsage(
            session.sessionId,
            tokens,
            coinsBilled
        );

        // Khấu trừ SaveCoin thực tế từ ví của Owner trên savecoin-service
        const coinUrls = [SAVECOIN_SERVICE_URL, "http://localhost:5006"];
        for (const cUrl of coinUrls) {
            try {
                const spendRes = await fetch(`${cUrl}/api/v1/coins/spend`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId: session.renterId,
                        amount: coinsBilled,
                        reason: `Thuê Local LLM (${session.modelDisplayName} trên máy ${session.nodeName}) - ${tokens} tokens`,
                        metadata: { sessionId: session.sessionId, nodeId: session.nodeId, tokens },
                    }),
                    signal: AbortSignal.timeout(2500),
                });
                if (spendRes.ok) break;
            } catch {
                // Ignore nếu savecoin-service đang khởi động
            }
        }

        if (agentId) {
            const binding = await agentBindingRepository.findByAgentId(agentId);
            if (binding) {
                await agentBindingRepository.incrementPrompts(binding.bindingId);
            }
        }

        return {
            success: true,
            sessionId: session.sessionId,
            nodeId: session.nodeId,
            nodeName: session.nodeName,
            modelName: session.modelDisplayName,
            output,
            tokens,
            latencyMs,
            coinsBilled,
            rentalSession: {
                id: session.sessionId,
                nodeName: session.nodeName,
                modelName: session.modelDisplayName,
                boundAgentName: session.assignedAgentId || "Multi-Agent",
                totalCoinsSpent: updatedSession?.totalCoinsSpent ?? session.totalCoinsSpent + coinsBilled,
            },
        };
    }
}

export const agentInferenceService = new AgentInferenceService();
