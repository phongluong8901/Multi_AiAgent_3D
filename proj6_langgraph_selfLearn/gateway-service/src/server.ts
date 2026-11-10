/**
 * Gateway Service HTTP & WebSocket Server.
 * Serves as the central API gateway and real-time Socket.IO coordinator
 * bridging frontend dashboards, scheduled learning cron jobs, and the AI Core Service.
 */

import express, { Request, Response } from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import axios from "axios";
import cron from "node-cron";
import cors from "cors";
import {
  ClientToServerEvents,
  ServerToClientEvents,
  UserMessagePayload,
  AICoreChatResponse,
  MemoryStats,
} from "./types";

// Initialize Express application and global middleware
const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server and mount Socket.IO server with type-safe event signatures
const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: { origin: "*" },
});

const AI_CORE_URL = process.env.AI_CORE_URL || "http://localhost:8000";
const PORT = process.env.PORT || 4000;

/**
 * Fetches updated memory statistics and active memory items from AI Core Service
 * and broadcasts them via Socket.IO to all connected client dashboards.
 *
 * @returns Object with stats and items, or null on failure.
 */
async function broadcastMemoryUpdated() {
  try {
    const [statsRes, itemsRes] = await Promise.all([
      axios.get<MemoryStats>(`${AI_CORE_URL}/api/v1/memory-stats`),
      axios.get<{ items: any[] }>(`${AI_CORE_URL}/api/v1/memory-items?limit=100`),
    ]);
    io.emit("memory_updated", {
      stats: statsRes.data,
      items: itemsRes.data.items,
    });
    return { stats: statsRes.data, items: itemsRes.data.items };
  } catch (err: any) {
    console.error("[Gateway TS] broadcastMemoryUpdated error:", err.message);
    return null;
  }
}

/**
 * Internal webhook endpoint invoked by AI Core background worker upon completing memory digestion.
 */
app.post("/api/internal/memory-updated", async (_req: Request, res: Response) => {
  const result = await broadcastMemoryUpdated();
  if (result) {
    res.json({ status: "ok" });
  } else {
    res.status(500).json({ error: "Failed to broadcast memory update" });
  }
});

/**
 * Endpoint to trigger manual memory consolidation and pruning in AI Core.
 */
app.post("/api/memory-consolidation", async (_req: Request, res: Response) => {
  try {
    const response = await axios.post(`${AI_CORE_URL}/api/v1/memory-consolidation`);
    await broadcastMemoryUpdated();
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * REST proxy: Retrieves current memory statistics.
 */
app.get("/api/memory-stats", async (_req: Request, res: Response) => {
  try {
    const response = await axios.get<MemoryStats>(
      `${AI_CORE_URL}/api/v1/memory-stats`,
    );
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * REST proxy: Retrieves active declarative knowledge base items.
 */
app.get("/api/memory-knowledge", async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${AI_CORE_URL}/api/v1/memory-knowledge`, {
      params: { limit: req.query.limit },
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * REST proxy: Retrieves merged memory items (knowledge + experiences).
 */
app.get("/api/memory-items", async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${AI_CORE_URL}/api/v1/memory-items`, {
      params: { limit: req.query.limit },
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Knowledge Synthesis Engine REST Proxies ---

/**
 * Triggers multi-hop synthesis workflow on AI Core Service.
 */
app.post("/api/synthesis/run-multihop", async (req: Request, res: Response) => {
  try {
    const response = await axios.post(
      `${AI_CORE_URL}/api/v1/synthesis/run-multihop`,
      req.body
    );
    await broadcastMemoryUpdated();
    res.json(response.data);
  } catch (error: any) {
    const status = error?.response?.status || 500;
    const detail = error?.response?.data?.detail || error.message;
    res.status(status).json({ error: detail });
  }
});

/**
 * Triggers sleep phase discovery (abductive synthesis across stored memories).
 */
app.post("/api/synthesis/sleep-phase-discovery", async (_req: Request, res: Response) => {
  try {
    const response = await axios.post(
      `${AI_CORE_URL}/api/v1/synthesis/sleep-phase-discovery`
    );
    await broadcastMemoryUpdated();
    res.json(response.data);
  } catch (error: any) {
    const status = error?.response?.status || 500;
    const detail = error?.response?.data?.detail || error.message;
    res.status(status).json({ error: detail });
  }
});

/**
 * Retrieves tiered memory statistics from AI Core.
 */
app.get("/api/synthesis/tiered-stats", async (_req: Request, res: Response) => {
  try {
    const response = await axios.get(`${AI_CORE_URL}/api/v1/synthesis/tiered-stats`);
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Retrieves Tier 3 synthesized knowledge insights.
 */
app.get("/api/synthesis/insights", async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${AI_CORE_URL}/api/v1/synthesis/insights`, {
      params: { limit: req.query.limit },
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Retrieves Tier 2 concept relational bridges.
 */
app.get("/api/synthesis/bridges", async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${AI_CORE_URL}/api/v1/synthesis/bridges`, {
      params: { limit: req.query.limit },
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Retrieves Negative Knowledge Memory (falsified hypotheses).
 */
app.get("/api/synthesis/falsified", async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${AI_CORE_URL}/api/v1/synthesis/falsified`, {
      params: { limit: req.query.limit },
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Executes code benchmark scripts in the sandbox via AI Core proxy.
 */
app.post("/api/synthesis/run-sandbox", async (req: Request, res: Response) => {
  try {
    const response = await axios.post(
      `${AI_CORE_URL}/api/v1/synthesis/run-sandbox`,
      req.body
    );
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Real-time Socket.IO Connection Handler
io.on(
  "connection",
  (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    console.log(`[Gateway TS] Client connected: ${socket.id}`);

    // Deliver initial memory state immediately upon client connection
    broadcastMemoryUpdated();

    // 1. Interactive chat message from client
    socket.on("user_message", async (payload: UserMessagePayload) => {
      const { sessionId, message } = payload;
      socket.emit("agent_status", {
        status: "Đang truy xuất Redis & Qdrant...",
      });

      try {
        const response = await axios.post<AICoreChatResponse>(
          `${AI_CORE_URL}/api/v1/chat`,
          {
            session_id: sessionId,
            message: message,
          },
        );
        socket.emit("agent_response", response.data);
      } catch (error: any) {
        socket.emit("agent_error", {
          error: error?.response?.data?.detail || error.message,
        });
      }
    });

    // 2. Manual trigger from client dashboard for autonomous learning
    socket.on("trigger_learn_now", async ({ topic }) => {
      socket.emit("agent_status", {
        status: `Đang tự nghiên cứu chủ đề: "${topic}"...`,
      });
      try {
        const res = await axios.post(`${AI_CORE_URL}/api/v1/autonomous-learn`, {
          topic,
        });
        io.emit("autonomous_learned", {
          topic: res.data.topic,
          summary: res.data.summary,
        });
        // Synchronize updated memory state across all active dashboards
        await broadcastMemoryUpdated();
      } catch (error: any) {
        socket.emit("agent_error", { error: error.message });
      }
    });
  },
);

/**
 * Autonomous Learning Cron Job.
 * Periodically triggers exploratory learning on predetermined architectural topics every 6 hours.
 */
cron.schedule("0 */6 * * *", async () => {
  const topicsToExplore = [
    "LangGraph multi-agent architecture best practices",
    "Qdrant vector search optimization",
    "FastAPI high concurrency patterns",
  ];
  const randomTopic =
    topicsToExplore[Math.floor(Math.random() * topicsToExplore.length)];
  console.log(`[Autonomous Cron] Kích hoạt AI tự học: ${randomTopic}`);

  try {
    const res = await axios.post(`${AI_CORE_URL}/api/v1/autonomous-learn`, {
      topic: randomTopic,
    });
    io.emit("autonomous_learned", {
      topic: randomTopic,
      summary: res.data.summary,
    });
    await broadcastMemoryUpdated();
  } catch (err: any) {
    console.error(`[Autonomous Cron Error]:`, err.message);
  }
});

// Start HTTP and WebSocket listener
server.listen(PORT, () => {
  console.log(`[Gateway TS] Service running on port ${PORT}`);
});

