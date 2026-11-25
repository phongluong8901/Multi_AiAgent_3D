import 'dotenv/config';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { Collection, MongoClient } from 'mongodb';
import {
  type GoogleUserInfo,
  isSkillOwner,
  validateChatPayload,
  validateSkillPayload,
  verifyGoogleBearerToken,
} from './auth.js';
import {
  type ChatSyncDocument,
  type CommunitySkillDocument,
  buildSkillFilter,
  connectMongo,
} from './mongo.js';
import { webCompanionHtml } from './webUi.js';

interface AuthedRequest extends Request {
  googleUser?: GoogleUserInfo;
}

const PORT = Number(process.env.PORT || 8787);
const MONGODB_URI = String(process.env.MONGODB_URI || '').trim();
const MONGODB_DB = String(process.env.MONGODB_DB || 'duck_ai_manager').trim();
const MONGODB_COLLECTION = String(process.env.MONGODB_COLLECTION || 'community_skills').trim();
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || '').trim();

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

let mongoCollection: Collection<CommunitySkillDocument> | null = null;
let chatCollection: Collection<ChatSyncDocument> | null = null;
let mongoClient: MongoClient | null = null;
const sseClients = new Map<string, Set<Response>>();

function broadcastSse(userSub: string, eventName: string, payload: unknown): void {
  const clients = sseClients.get(userSub);
  if (!clients || clients.size === 0) return;
  const line = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try {
      res.write(line);
    } catch {
      clients.delete(res);
    }
  }
}

async function initMongo(): Promise<void> {
  if (!MONGODB_URI) {
    console.warn('[WARN] MONGODB_URI chua duoc cau hinh. Chi chay endpoint /api/health.');
    return;
  }
  try {
    const conn = await connectMongo({
      uri: MONGODB_URI,
      dbName: MONGODB_DB,
      collectionName: MONGODB_COLLECTION,
    });
    mongoClient = conn.client;
    mongoCollection = conn.collection;
    chatCollection = conn.chatCollection;
    console.log(`[INFO] Ket noi MongoDB thanh cong (${MONGODB_DB}.${MONGODB_COLLECTION}).`);
  } catch (err) {
    console.error('[ERROR] Khong ket noi duoc MongoDB:', (err as Error).message);
  }
}

async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await verifyGoogleBearerToken(req.headers.authorization, GOOGLE_CLIENT_ID);
    req.googleUser = user;
    next();
  } catch (err) {
    res.status(401).json({ ok: false, error: (err as Error).message });
  }
}

function requireMongo(_req: Request, res: Response, next: NextFunction): void {
  if (!mongoCollection || !chatCollection) {
    res.status(503).json({
      ok: false,
      error: 'MongoDB chua san sang tren backend online.',
    });
    return;
  }
  next();
}

app.get('/', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(webCompanionHtml);
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'duck-ai-cloud-hub',
    mongo_connected: Boolean(mongoCollection),
    google_client_configured: Boolean(GOOGLE_CLIENT_ID),
  });
});

app.get('/api/skills', requireAuth, requireMongo, async (req: AuthedRequest, res: Response) => {
  try {
    const filter = buildSkillFilter({
      query: typeof req.query.q === 'string' ? req.query.q : '',
      language: typeof req.query.lang === 'string' ? req.query.lang : 'all',
    });
    const items = await mongoCollection!
      .find(filter, { projection: { _id: 0 } })
      .sort({ stars: -1, downloads: -1, updated_at_ms: -1 })
      .limit(60)
      .toArray();
    res.json({ ok: true, items });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

app.get(
  '/api/skills/:skillKey',
  requireAuth,
  requireMongo,
  async (req: AuthedRequest, res: Response) => {
    try {
      const item = await mongoCollection!.findOne(
        { skill_key: String(req.params.skillKey || '').trim() },
        { projection: { _id: 0 } }
      );
      if (!item) {
        res.status(404).json({ ok: false, error: 'Khong tim thay Skill nay tren MongoDB.' });
        return;
      }
      res.json({ ok: true, item });
    } catch (err) {
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  }
);

app.post('/api/skills', requireAuth, requireMongo, async (req: AuthedRequest, res: Response) => {
  const checked = validateSkillPayload(req.body);
  if (!checked.ok) {
    res.status(400).json({ ok: false, error: checked.error });
    return;
  }
  try {
    const user = req.googleUser!;
    const authorTag = user.sub || user.email;
    const skillKey = `${authorTag}:${checked.clean.id}`;
    const now = Date.now();
    const doc = {
      ...checked.clean,
      skill_key: skillKey,
      author_sub: user.sub,
      author_email: user.email,
      author_name: user.name,
      updated_at_ms: now,
    };

    await mongoCollection!.updateOne(
      { skill_key: skillKey },
      {
        $set: doc,
        $setOnInsert: { downloads: 0, stars: 0, starred_by: [], created_at_ms: now },
      },
      { upsert: true }
    );

    const saved = await mongoCollection!.findOne(
      { skill_key: skillKey },
      { projection: { _id: 0 } }
    );
    res.json({ ok: true, item: saved || { ...doc, downloads: 0, stars: 0, starred_by: [] } });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

app.delete(
  '/api/skills/:skillKey',
  requireAuth,
  requireMongo,
  async (req: AuthedRequest, res: Response) => {
    try {
      const skillKey = String(req.params.skillKey || '').trim();
      const existing = await mongoCollection!.findOne({ skill_key: skillKey });
      if (!existing) {
        res.status(404).json({ ok: false, error: 'Khong tim thay Skill nay tren MongoDB.' });
        return;
      }
      if (!isSkillOwner(existing, req.googleUser!)) {
        res.status(403).json({
          ok: false,
          error: 'Chi tac gia da dang Skill nay moi co quyen xoa khoi MongoDB.',
        });
        return;
      }
      await mongoCollection!.deleteOne({ skill_key: skillKey });
      res.json({ ok: true, deleted_key: skillKey });
    } catch (err) {
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  }
);

app.post(
  '/api/skills/:skillKey/star',
  requireAuth,
  requireMongo,
  async (req: AuthedRequest, res: Response) => {
    try {
      const skillKey = String(req.params.skillKey || '').trim();
      const userTag = req.googleUser!.sub || req.googleUser!.email;
      const existing = await mongoCollection!.findOne({ skill_key: skillKey });
      if (!existing) {
        res.status(404).json({ ok: false, error: 'Khong tim thay Skill.' });
        return;
      }
      const list = Array.isArray(existing.starred_by) ? [...existing.starred_by] : [];
      const idx = list.indexOf(userTag);
      let starred = false;
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        list.push(userTag);
        starred = true;
      }
      await mongoCollection!.updateOne(
        { skill_key: skillKey },
        { $set: { starred_by: list, stars: list.length } }
      );
      res.json({ ok: true, stars: list.length, starred });
    } catch (err) {
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  }
);

app.post(
  '/api/skills/:skillKey/download',
  requireAuth,
  requireMongo,
  async (req: AuthedRequest, res: Response) => {
    try {
      await mongoCollection!.updateOne(
        { skill_key: String(req.params.skillKey || '').trim() },
        { $inc: { downloads: 1 } }
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  }
);

app.get('/api/chat', requireAuth, requireMongo, async (req: AuthedRequest, res: Response) => {
  try {
    const userSub = req.googleUser!.sub || req.googleUser!.email;
    const sinceMs = Number(req.query.since_ms || 0) || 0;
    const items = await chatCollection!
      .find(
        sinceMs > 0
          ? { user_sub: userSub, created_at_ms: { $gt: sinceMs } }
          : { user_sub: userSub },
        { projection: { _id: 0, user_sub: 0 } }
      )
      .sort({ created_at_ms: 1 })
      .limit(80)
      .toArray();
    res.json({ ok: true, email: req.googleUser!.email, items });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

app.get('/api/chat/stream', async (req: Request, res: Response) => {
  try {
    const rawTok =
      typeof req.query.token === 'string' && req.query.token.trim()
        ? `Bearer ${req.query.token.trim()}`
        : req.headers.authorization;
    const user = await verifyGoogleBearerToken(rawTok, GOOGLE_CLIENT_ID);
    const userSub = user.sub || user.email;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(`retry: 3000\nevent: ready\ndata: ${JSON.stringify({ ok: true, email: user.email })}\n\n`);

    let set = sseClients.get(userSub);
    if (!set) {
      set = new Set<Response>();
      sseClients.set(userSub, set);
    }
    set.add(res);

    const ping = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(ping);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(ping);
      set?.delete(res);
      if (set && set.size === 0) {
        sseClients.delete(userSub);
      }
    });
  } catch (err) {
    res.status(401).json({ ok: false, error: (err as Error).message });
  }
});

app.post('/api/chat/stream-chunk', requireAuth, (req: AuthedRequest, res: Response) => {
  const userSub = req.googleUser!.sub || req.googleUser!.email;
  const body = (req.body || {}) as Record<string, unknown>;
  const streamId = String(body.stream_id || 'default').slice(0, 80);
  const token = String(body.token || '');
  const done = Boolean(body.done);
  broadcastSse(userSub, 'chunk', {
    stream_id: streamId,
    token,
    done,
    role: 'assistant',
    source: 'desktop',
  });
  res.json({ ok: true });
});

app.post('/api/chat', requireAuth, requireMongo, async (req: AuthedRequest, res: Response) => {
  const checked = validateChatPayload(req.body);
  if (!checked.ok) {
    res.status(400).json({ ok: false, error: checked.error });
    return;
  }
  try {
    const userSub = req.googleUser!.sub || req.googleUser!.email;
    const doc: ChatSyncDocument = {
      user_sub: userSub,
      ...checked.clean,
    };
    await chatCollection!.updateOne(
      { user_sub: userSub, msg_id: doc.msg_id },
      { $setOnInsert: doc },
      { upsert: true }
    );
    broadcastSse(userSub, 'message', checked.clean);
    res.json({ ok: true, item: checked.clean });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

app.delete('/api/chat', requireAuth, requireMongo, async (req: AuthedRequest, res: Response) => {
  try {
    const userSub = req.googleUser!.sub || req.googleUser!.email;
    await chatCollection!.deleteMany({ user_sub: userSub });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[INFO] Duck ai Cloud Hub API listening on http://0.0.0.0:${PORT}`);
  void initMongo();
});

let isShuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[INFO] Received ${signal}, shutting down Duck ai Cloud Hub gracefully...`);
  if (mongoClient) {
    await mongoClient.close().catch(() => {});
  }
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
