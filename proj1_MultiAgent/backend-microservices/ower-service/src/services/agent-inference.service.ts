import { rentalSessionRepository } from "../repositories/rental-session.repository";
import { agentBindingRepository } from "../repositories/agent-binding.repository";
import { ownerRentalService } from "./owner-rental.service";
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
    async resolveSession(params: AgentInferenceParams): Promise<any> {
        const { rentalSessionId, agentId } = params;
        let session: any = null;

        // 1. Kiểm tra xem người dùng đang chọn phiên đã thuê hay đang test thử trực tiếp node trên sàn
        if (rentalSessionId && rentalSessionId.startsWith("test_node_")) {
            const rawNodeId = rentalSessionId.replace("test_node_", "");
            try {
                const marketNodes = await ownerRentalService.getMarketplaceNodes();
                const matched = marketNodes.find((n: any) => n.nodeId === rawNodeId || n.id === rawNodeId);
                if (matched) {
                    session = {
                        sessionId: `test_${Date.now()}`,
                        nodeId: matched.nodeId || matched.id,
                        nodeName: matched.nodeName || "Marketplace Node",
                        sellerId: matched.sellerId || "usr_seller_01",
                        sellerName: matched.sellerName || "Seller Partner",
                        modelKey: matched.hostedModel || "qwen-2.5-coder-1.5b",
                        modelDisplayName: matched.modelDisplayName || "Qwen 2.5 Coder (1.5B)",
                        coinsPerHour: Number(matched.coinsPerHour) || 30,
                        coinsPer1kTokens: Number(matched.coinsPer1kTokens) || 0.5,
                        renterId: "usr_owner_01",
                        renterName: "Agent Tester",
                        status: "ACTIVE",
                        isTestOnly: true,
                    };
                }
            } catch {
                // Ignore
            }
        }

        if (!session && rentalSessionId) {
            session = await rentalSessionRepository.findBySessionId(rentalSessionId);
        }

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

        // Tự động cấp phiên thuê nếu có máy trạm trên Marketplace
        if (!session) {
            try {
                const marketNodes = await ownerRentalService.getMarketplaceNodes();
                if (marketNodes && marketNodes.length > 0) {
                    const bestNode = marketNodes.find((n: any) => n.status === "ONLINE") || marketNodes[0];
                    session = await ownerRentalService.startRental({
                        nodeId: bestNode.nodeId || bestNode.id,
                        nodeName: bestNode.nodeName || "Local AI Compute Station",
                        sellerId: bestNode.sellerId || "usr_seller_01",
                        sellerName: bestNode.sellerName || "Local Partner",
                        modelKey: bestNode.hostedModel || "qwen-2.5-coder-1.5b",
                        modelDisplayName: bestNode.modelDisplayName || "Qwen 2.5 Coder (1.5B)",
                        hourlyRate: Number(bestNode.coinsPerHour) || 30,
                        tokenRate: Number(bestNode.coinsPer1kTokens) || 0.5,
                        renterId: "usr_owner_01",
                        renterName: "Agent Renter",
                        assignedAgentId: agentId || "agent_manager",
                        boundAgentName: "Multi-Agent System",
                    });
                    logger.info(`[INFERENCE] Đã tự động kích hoạt phiên thuê mới ${session.sessionId} cho node ${session.nodeId}`);
                }
            } catch (err: any) {
                logger.warn(`Không thể tự động thuê node từ marketplace:`, err.message);
            }
        }

        if (!session) {
            // Fallback node kiểm thử an toàn
            session = {
                sessionId: `test_${Date.now()}`,
                nodeId: "local_seller_mesh",
                nodeName: "Seller Hardware Workstation",
                sellerId: "usr_seller_01",
                sellerName: "Local Partner",
                modelKey: "qwen2.5:1.5b",
                modelDisplayName: "Qwen 2.5 (1.5B)",
                coinsPerHour: 35,
                coinsPer1kTokens: 0.5,
                renterId: "usr_owner_01",
                renterName: "Owner Tester",
                status: "ACTIVE",
                isTestOnly: true,
            };
        }

        return session;
    }

    async streamInferenceForAgent(params: AgentInferenceParams, res: any) {
        const { prompt, systemPrompt, temperature, maxTokens } = params;
        const session = await this.resolveSession(params);

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");

        const distUrls = [
            process.env.DISTRIBUTED_SERVICE_URL || "http://distributed-service:5010",
            "http://localhost:5010",
            "http://127.0.0.1:5010",
            "http://gateway-service:4000",
            "http://localhost:4000",
        ];

        let upstreamRes: any = null;
        for (const dUrl of distUrls) {
            try {
                const upstream = await fetch(`${dUrl}/api/v1/distributed/inference`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "text/event-stream",
                    },
                    body: JSON.stringify({
                        nodeId: session?.nodeId || "",
                        model: session?.modelKey || "qwen2.5-coder:1.5b",
                        prompt,
                        systemPrompt: systemPrompt || "Bạn là AI Agent thực thi chuyên nghiệp",
                        temperature: temperature || 0.7,
                        maxTokens: maxTokens || 1024,
                        stream: true,
                    }),
                    signal: AbortSignal.timeout(120000),
                });
                if (upstream.ok && upstream.body) {
                    upstreamRes = upstream;
                    break;
                }
            } catch {
                // Tiếp tục thử URL tiếp theo
            }
        }

        if (!upstreamRes || !upstreamRes.body) {
            const errPayload = JSON.stringify({
                error: `Không thể kết nối P2P Relay tới máy trạm "${session?.nodeName || session?.nodeId}". Vui lòng đảm bảo Worker đang chạy.`,
                done: true,
                success: false,
            });
            res.write(`data: ${errPayload}\n\n`);
            res.end();
            return;
        }

        let fullOutput = "";
        const reader = upstreamRes.body.getReader();
        const decoder = new TextDecoder("utf-8");

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunkStr = decoder.decode(value, { stream: true });
                res.write(chunkStr);

                const lines = chunkStr.split("\n");
                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.chunk) fullOutput += data.chunk;
                            if (data.output && !fullOutput) fullOutput = data.output;
                        } catch {
                            // Bỏ qua dòng json chưa hoàn chỉnh
                        }
                    }
                }
            }
        } catch (err: any) {
            res.write(`data: ${JSON.stringify({ error: err.message, done: true })}\n\n`);
        } finally {
            res.end();
        }

        // Cập nhật thống kê và khấu trừ coins sau khi stream hoàn tất
        if (fullOutput) {
            const tokens = Math.max(1, Math.round(fullOutput.length / 3.8));
            const coinsBilled = Number(Math.max(0.01, (tokens / 1000) * (session?.coinsPer1kTokens || 0.5)).toFixed(4));

            if (!session.isTestOnly && session.sessionId) {
                try {
                    await rentalSessionRepository.incrementUsage(session.sessionId, tokens, coinsBilled);
                } catch {
                    // Ignore
                }
            }
        }
    }

    async runInferenceForAgent(params: AgentInferenceParams) {
        const { prompt, systemPrompt, temperature, maxTokens, agentId } = params;
        const session = await this.resolveSession(params);

        // Chuyển tiếp yêu cầu suy luận sang seller-service (thử cả Docker DNS, localhost và Gateway)
        let sellerResult: any = null;
        let lastErr: any = null;
        const sellerBaseUrls = [
            SELLER_SERVICE_URL,
            "http://localhost:5011",
            "http://127.0.0.1:5011",
            "http://localhost:4000",
            "http://127.0.0.1:4000",
        ];

        const encodedNodeId = encodeURIComponent(session.nodeId);

        for (const baseUrl of sellerBaseUrls) {
            try {
                const res = await fetch(`${baseUrl}/api/v1/seller/nodes/${encodedNodeId}/inference`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        renterId: session.renterId,
                        prompt,
                        systemPrompt,
                        temperature,
                        maxTokens,
                    }),
                    signal: AbortSignal.timeout(120000),
                });

                if (res.ok) {
                    sellerResult = await res.json();
                    if (sellerResult?.output) break;
                } else {
                    const errData: any = await res.json().catch(() => ({}));
                    lastErr = new Error(errData.message || `Lỗi từ Seller Service (HTTP ${res.status})`);
                }
            } catch (err: any) {
                lastErr = err;
            }
        }

        // Nếu seller-service chưa phản hồi, thử đẩy lệnh trực tiếp qua Distributed Service (P2P WebSocket Relay như /node-checker)
        if (!sellerResult || !sellerResult.output) {
            const distUrls = [
                process.env.DISTRIBUTED_SERVICE_URL || "http://distributed-service:5010",
                "http://localhost:5010",
                "http://127.0.0.1:5010",
                "http://localhost:4000",
                "http://127.0.0.1:4000",
            ];

            for (const dUrl of distUrls) {
                try {
                    const dRes = await fetch(`${dUrl}/api/v1/distributed/inference`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            nodeId: session.nodeId,
                            model: session.modelKey || "qwen2.5:1.5b",
                            prompt,
                            systemPrompt: systemPrompt || "Bạn là AI Agent thực thi chuyên nghiệp",
                            temperature: temperature || 0.7,
                            maxTokens: maxTokens || 1024,
                        }),
                        signal: AbortSignal.timeout(120000),
                    });

                    if (dRes.ok) {
                        const dData: any = await dRes.json();
                        if (dData?.output) {
                            sellerResult = {
                                output: dData.output,
                                tokens: Math.max(1, Math.round(dData.output.length / 3.8)),
                                latencyMs: 1400,
                                coinsBilled: 0.1,
                            };
                            logger.info(`[INFERENCE] Đã thực thi inference trực tiếp qua Distributed Service P2P Relay (${dUrl})`);
                            break;
                        }
                    } else {
                        const dErr: any = await dRes.json().catch(() => ({}));
                        if (dErr?.message) {
                            lastErr = new Error(dErr.message);
                        }
                    }
                } catch {
                    // Ignore
                }
            }

            // Fallback: nếu nodeId chỉ định không khớp worker nào, định tuyến tự động tới worker đang online bất kỳ
            if (!sellerResult || !sellerResult.output) {
                for (const dUrl of distUrls) {
                    try {
                        const anyRes = await fetch(`${dUrl}/api/v1/distributed/inference`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                nodeId: "",
                                model: session.modelKey || "qwen2.5-coder:1.5b",
                                prompt,
                                systemPrompt: systemPrompt || "Bạn là AI Agent thực thi chuyên nghiệp",
                                temperature: temperature || 0.7,
                                maxTokens: maxTokens || 1024,
                            }),
                            signal: AbortSignal.timeout(120000),
                        });
                        if (anyRes.ok) {
                            const anyData: any = await anyRes.json();
                            if (anyData?.output) {
                                sellerResult = {
                                    output: anyData.output,
                                    tokens: Math.max(1, Math.round(anyData.output.length / 3.8)),
                                    latencyMs: 1400,
                                    coinsBilled: 0.1,
                                };
                                logger.info(`[INFERENCE] Đã thực thi inference qua worker đang hoạt động (${dUrl})`);
                                break;
                            }
                        }
                    } catch {
                        // Ignore
                    }
                }
            }
        }

        // Kiểm tra kết quả thực tế từ Seller Worker
        if (!sellerResult || !sellerResult.output) {
            const nodeLabel = session?.nodeName || session?.nodeId || "Seller Node";
            const detailMsg = lastErr?.message || "Desktop Worker (Electron) chưa phản hồi hoặc chưa bật Ollama";
            throw new Error(`[P2P Relay Error] Không thể kết nối tới máy trạm "${nodeLabel}" (Node ID: ${session?.nodeId}). Chi tiết: ${detailMsg}. Vui lòng đảm bảo ứng dụng Worker (.exe / worker.py) đang chạy và giữ kết nối WebSocket.`);
        }

        const latencyMs = sellerResult.latencyMs || 0;
        const tokens = sellerResult.tokens || 0;
        const coinsBilled = sellerResult.coinsBilled || 0;
        const output = sellerResult.output;

        // Cập nhật thống kê phiên thuê vào MongoDB (nếu không phải phiên test thử)
        if (!session.isTestOnly && session.sessionId) {
            try {
                await rentalSessionRepository.incrementUsage(
                    session.sessionId,
                    tokens,
                    coinsBilled
                );
            } catch {
                // Ignore
            }
        }

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
                totalCoinsSpent: (session.totalCoinsSpent || 0) + coinsBilled,
            },
        };
    }
}

export const agentInferenceService = new AgentInferenceService();
