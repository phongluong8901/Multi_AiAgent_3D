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

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: { origin: "*" },
});

const AI_CORE_URL = process.env.AI_CORE_URL || "http://localhost:8000";
const PORT = process.env.PORT || 4000;

// Helper: Lấy dữ liệu bộ nhớ mới nhất từ AI Core và bắn Socket.IO realtime cho tất cả clients
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

// Webhook nội bộ từ AI Core khi tiến trình tự học ngầm hoàn tất
app.post("/api/internal/memory-updated", async (_req: Request, res: Response) => {
  const result = await broadcastMemoryUpdated();
  if (result) {
    res.json({ status: "ok" });
  } else {
    res.status(500).json({ error: "Failed to broadcast memory update" });
  }
});

app.post("/api/memory-consolidation", async (_req: Request, res: Response) => {
  try {
    const response = await axios.post(`${AI_CORE_URL}/api/v1/memory-consolidation`);
    await broadcastMemoryUpdated();
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// REST Proxy để Frontend lấy dữ liệu ban đầu
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

// Knowledge Synthesis Engine Endpoints
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

app.get("/api/synthesis/tiered-stats", async (_req: Request, res: Response) => {
  try {
    const response = await axios.get(`${AI_CORE_URL}/api/v1/synthesis/tiered-stats`);
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

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

// Quản lý kết nối Realtime Socket.IO với Type-Safety
io.on(
  "connection",
  (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    console.log(`[Gateway TS] Client connected: ${socket.id}`);

    // Gửi dữ liệu bộ nhớ realtime ngay khi client kết nối
    broadcastMemoryUpdated();

    // 1. Khi người dùng chat
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

    // 2. Khi người dùng bấm nút ép AI tự đi học chủ đề mới ngay lập tức trên UI
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
        // Bắn Socket.IO cập nhật ngay bộ nhớ & danh sách tri thức
        await broadcastMemoryUpdated();
      } catch (error: any) {
        socket.emit("agent_error", { error: error.message });
      }
    });
  },
);

// CRONJOB CHỦ ĐỘNG TỰ HỌC: Chạy mỗi 6 tiếng
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

server.listen(PORT, () => {
  console.log(`[Gateway TS] Service running on port ${PORT}`);
});
