import { sellerNodeRepository } from "../repositories/seller-node.repository";
import { inferenceLogRepository } from "../repositories/inference-log.repository";
import { sellerNodeService } from "./seller-node.service";
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

        // Tự động đồng bộ các node thời gian thực vừa kết nối từ Distributed Service (Go)
        try {
            await sellerNodeService.syncPartnerNodesFromDistributed();
        } catch {
            // Ignore
        }

        let node = await sellerNodeRepository.findByNodeId(nodeId);
        if (!node) {
            // Nếu không tìm thấy chính xác nodeId này, tìm node ONLINE hoặc BUSY bất kỳ đang trực tuyến
            const allNodes = await sellerNodeRepository.findAll();
            node = allNodes.find((n: any) => n.nodeId === nodeId || n.status === "ONLINE" || n.status === "BUSY") || null;
        }

        const effectiveNodeId = nodeId || node?.nodeId || "local_seller_mesh";
        const effectiveNodeName = node?.nodeName || "Local Desktop Worker";
        const effectiveModelName = node?.modelDisplayName || "Qwen 2.5 Coder (1.5B)";
        const targetModel = this.normalizeOllamaModel(node?.hostedModel);

        const startTime = Date.now();
        let generatedText = "";
        let usedOllama = false;
        let relayedViaWs = false;

        // 1. Thử đẩy lệnh qua đường hầm WebSocket của Distributed Service (P2P Worker Relay - xuyên NAT/Firewall)
        const distEndpoints = [
            DISTRIBUTED_SERVICE_URL,
            "http://localhost:5010",
            "http://127.0.0.1:5010",
            "http://localhost:4000",
            "http://127.0.0.1:4000",
        ];

        for (const distUrl of distEndpoints) {
            try {
                const wsRelayRes = await fetch(`${distUrl}/api/v1/distributed/inference`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        nodeId: effectiveNodeId,
                        model: targetModel,
                        prompt,
                        systemPrompt: systemPrompt || "Bạn là AI Agent thực thi chuyên nghiệp",
                        temperature: temperature || 0.7,
                        maxTokens: maxTokens || 1024,
                    }),
                    signal: AbortSignal.timeout(45000), // 45 giây cho worker sinh token thực tế
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
                node?.localEndpoint || "http://localhost:11434",
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

        // Nếu cả WS Worker lẫn Ollama trực tiếp đều không phản hồi, báo lỗi minh bạch
        if (!usedOllama || !generatedText) {
            throw new Error(
                `[P2P Relay Error] Không thể kết nối tới Desktop Worker hoặc Ollama (:11434) của node "${effectiveNodeName}" (Node ID: ${effectiveNodeId}). Vui lòng đảm bảo ứng dụng Worker (.exe / worker.py) đang chạy và mô hình "${targetModel}" đã sẵn sàng trong Ollama.`
            );
        }

        const latencyMs = Date.now() - startTime;
        const tokensGenerated = Math.max(15, Math.round(generatedText.length / 3.8));
        const coinsBilled = Number(Math.max(0.1, (tokensGenerated / 1000) * (node?.coinsPer1kTokens || 0.5)).toFixed(4));

        // Cập nhật thống kê vào MongoDB
        try {
            await sellerNodeRepository.incrementStats(effectiveNodeId, tokensGenerated, coinsBilled);
        } catch {
            // Ignore
        }

        // Cộng thưởng SaveCoin thực tế vào ví của Seller trên savecoin-service
        const coinUrls = [SAVECOIN_SERVICE_URL, "http://localhost:5006"];
        for (const cUrl of coinUrls) {
            try {
                const r = await fetch(`${cUrl}/api/v1/coins/reward`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId: node?.sellerId || "usr_seller_01",
                        amount: coinsBilled,
                        reason: `Doanh thu phục vụ Local LLM (${effectiveModelName}) - ${tokensGenerated} tokens`,
                        source: "seller_compute",
                        metadata: { nodeId: effectiveNodeId, renterId, tokensGenerated },
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
        try {
            await inferenceLogRepository.create({
                taskId,
                nodeId: effectiveNodeId,
                renterId,
                prompt,
                systemPrompt,
                output: generatedText,
                tokens: tokensGenerated,
                latencyMs,
                coinsBilled,
                status: "SUCCESS",
            });
        } catch {
            // Ignore
        }

        return {
            taskId,
            nodeId: effectiveNodeId,
            nodeName: effectiveNodeName,
            modelName: effectiveModelName,
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
