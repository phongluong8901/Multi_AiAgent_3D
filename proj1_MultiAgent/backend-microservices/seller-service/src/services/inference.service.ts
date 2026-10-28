import { sellerNodeRepository } from "../repositories/seller-node.repository";
import { inferenceLogRepository } from "../repositories/inference-log.repository";
import { logger } from "../config/logger";

export interface InferenceParams {
    nodeId: string;
    renterId: string;
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
}

export class InferenceService {
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

        // Thử gọi Ollama trên local host của Seller
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
                        model: node.hostedModel || "qwen2.5-coder:1.5b",
                        prompt: prompt,
                        system: systemPrompt || "Bạn là AI Agent thực thi chuyên nghiệp",
                        stream: false,
                        options: {
                            temperature: temperature || 0.7,
                            num_predict: maxTokens || 1024,
                        },
                    }),
                    signal: AbortSignal.timeout(12000),
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
            } catch (err: any) {
                // Tiếp tục thử fallback
            }
        }

        // Nếu Ollama trên máy Seller chưa bật hoặc không thể kết nối
        if (!usedOllama) {
            throw new Error(`Không thể kết nối tới mô hình AI trên máy Seller (${node.localEndpoint}). Vui lòng đảm bảo Seller đã bật Ollama và tải model ${node.hostedModel}.`);
        }

        const latencyMs = Date.now() - startTime;
        const tokensGenerated = Math.max(15, Math.round(generatedText.length / 3.8));
        const coinsBilled = Number(((tokensGenerated / 1000) * (node.coinsPer1kTokens || 0.5)).toFixed(4));

        // Cập nhật thống kê vào MongoDB
        await sellerNodeRepository.incrementStats(nodeId, tokensGenerated, coinsBilled);

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
        };
    }
}

export const inferenceService = new InferenceService();
