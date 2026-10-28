import { sellerNodeRepository } from "../repositories/seller-node.repository";
import { inferenceLogRepository } from "../repositories/inference-log.repository";
import { logger } from "../config/logger";

const DISTRIBUTED_SERVICE_URL = process.env.DISTRIBUTED_SERVICE_URL || "http://distributed-service:5010";
const SAVECOIN_SERVICE_URL = process.env.SAVECOIN_SERVICE_URL || "http://savecoin-service:5006";

export interface InferenceParams {
    nodeId: string;
    renterId: string;
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
}

export class InferenceService {
    private normalizeOllamaModel(hostedModel?: string): string {
        const raw = (hostedModel || "qwen2.5-coder:1.5b").toLowerCase();
        if (raw.includes(":")) return raw;
        if (raw === "qwen-2.5-coder-1.5b") return "qwen2.5-coder:1.5b";
        if (raw === "qwen-2.5-coder-7b") return "qwen2.5-coder:7b";
        if (raw === "deepseek-r1-7b") return "deepseek-r1:7b";
        if (raw === "deepseek-r1-1.5b") return "deepseek-r1:1.5b";
        if (raw === "llama-3.3-8b") return "llama3:8b";
        if (raw === "phi-3-mini") return "phi3:mini";
        return raw;
    }

    async executeInference(params: InferenceParams) {
        const { nodeId, renterId, prompt, systemPrompt, temperature, maxTokens } = params;

        const node = await sellerNodeRepository.findByNodeId(nodeId);
        if (!node) {
            throw new Error(`Node không tồn tại: ${nodeId}`);
        }

        if (node.status === "OFFLINE") {
            throw new Error(`Node ${node.nodeName} hiện đang OFFLINE, không thể nhận nhiệm vụ`);
        }

        const startTime = Date.now();
        let generatedText = "";
        let usedOllama = false;
        let relayedViaWs = false;
        const targetModel = this.normalizeOllamaModel(node.hostedModel);

        // 1. Thử đẩy lệnh qua đường hầm WebSocket của Distributed Service (P2P Worker Relay - xuyên NAT/Firewall)
        const distEndpoints = [
            DISTRIBUTED_SERVICE_URL,
            "http://localhost:5010",
        ];

        for (const distUrl of distEndpoints) {
            try {
                const wsRelayRes = await fetch(`${distUrl}/api/v1/distributed/inference`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        nodeId: node.nodeId,
                        model: targetModel,
                        prompt,
                        systemPrompt: systemPrompt || "Bạn là AI Agent thực thi chuyên nghiệp",
                        temperature: temperature || 0.7,
                        maxTokens: maxTokens || 1024,
                    }),
                    signal: AbortSignal.timeout(18000),
                });

                if (wsRelayRes.ok) {
                    const relayData: any = await wsRelayRes.json();
                    if (relayData?.success && relayData?.output) {
                        generatedText = relayData.output;
                        usedOllama = true;
                        relayedViaWs = true;
                        logger.info(`Đã thực thi inference qua P2P WebSocket Worker Relay (${distUrl})`);
                        break;
                    }
                }
            } catch {
                // Nếu Worker chưa kết nối WS hoặc lỗi mạng nội bộ, chuyển sang gọi trực tiếp Ollama
            }
        }

        // 2. Nếu chưa lấy được qua WS Relay, thử gọi trực tiếp Ollama trên local/LAN host của Seller
        if (!usedOllama) {
            const ollamaEndpoints = [
                node.localEndpoint || "http://localhost:11434",
                "http://host.docker.internal:11434",
                "http://127.0.0.1:11434",
            ];

            for (const endpoint of ollamaEndpoints) {
                try {
                    const response = await fetch(`${endpoint}/api/generate`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            model: targetModel,
                            prompt: prompt,
                            system: systemPrompt || "Bạn là AI Agent thực thi chuyên nghiệp",
                            stream: false,
                            options: {
                                temperature: temperature || 0.7,
                                num_predict: maxTokens || 1024,
                            },
                        }),
                        signal: AbortSignal.timeout(15000),
                    });

                    if (response.ok) {
                        const data: any = await response.json();
                        if (data && data.response) {
                            generatedText = data.response;
                            usedOllama = true;
                            logger.info(`Đã thực thi inference thành công qua Ollama tại ${endpoint}`);
                            break;
                        }
                    }
                } catch {
                    // Tiếp tục thử fallback
                }
            }
        }

        // Nếu cả WS Worker lẫn Ollama trực tiếp đều chưa bật
        if (!usedOllama) {
            throw new Error(
                `Không thể kết nối tới mô hình AI trên máy Seller (${node.localEndpoint}). Vui lòng đảm bảo Seller đã bật Worker (.exe) hoặc Ollama với model ${targetModel}.`
            );
        }

        const latencyMs = Date.now() - startTime;
        const tokensGenerated = Math.max(15, Math.round(generatedText.length / 3.8));
        const coinsBilled = Number(Math.max(0.1, (tokensGenerated / 1000) * (node.coinsPer1kTokens || 0.5)).toFixed(4));

        // Cập nhật thống kê vào MongoDB
        await sellerNodeRepository.incrementStats(nodeId, tokensGenerated, coinsBilled);

        // Cộng thưởng SaveCoin thực tế vào ví của Seller trên savecoin-service
        const coinUrls = [SAVECOIN_SERVICE_URL, "http://localhost:5006"];
        for (const cUrl of coinUrls) {
            try {
                const r = await fetch(`${cUrl}/api/v1/coins/reward`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId: node.sellerId,
                        amount: coinsBilled,
                        reason: `Doanh thu phục vụ Local LLM (${node.modelDisplayName}) - ${tokensGenerated} tokens`,
                        source: "seller_compute",
                        metadata: { nodeId, renterId, tokensGenerated },
                    }),
                    signal: AbortSignal.timeout(2500),
                });
                if (r.ok) break;
            } catch {
                // Ignore nếu savecoin-service đang khởi động
            }
        }

        // Ghi log vào MongoDB
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await inferenceLogRepository.create({
            taskId,
            nodeId,
            renterId,
            prompt,
            systemPrompt,
            output: generatedText,
            tokens: tokensGenerated,
            latencyMs,
            coinsBilled,
            status: "SUCCESS",
        });

        return {
            taskId,
            nodeId,
            nodeName: node.nodeName,
            modelName: node.modelDisplayName,
            output: generatedText,
            tokens: tokensGenerated,
            latencyMs,
            coinsBilled,
            usedOllama,
            relayedViaWs,
        };
    }
}

export const inferenceService = new InferenceService();
