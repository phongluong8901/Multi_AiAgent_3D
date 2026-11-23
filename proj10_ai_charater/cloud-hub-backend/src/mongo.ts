import type { Collection, Db, Document, Filter, MongoClient } from 'mongodb';
import type { CleanSkillInput } from './auth.js';

export interface CommunitySkillDocument extends CleanSkillInput {
  skill_key: string;
  author_sub: string;
  author_email: string;
  author_name: string;
  downloads: number;
  stars?: number;
  starred_by?: string[];
  created_at_ms?: number;
  updated_at_ms: number;
}

export interface ChatSyncDocument {
  user_sub: string;
  msg_id: string;
  role: 'user' | 'assistant';
  content: string;
  source: 'desktop' | 'web';
  created_at_ms: number;
}

export interface SkillFilterQuery {
  query?: string;
  language?: string;
}

export function buildSkillFilter({
  query = '',
  language = 'all',
}: SkillFilterQuery = {}): Filter<Document> {
  const filter: Filter<Document> = {};
  const cleanLang = String(language || '').trim().toLowerCase();
  if (cleanLang === 'powershell' || cleanLang === 'python') {
    filter.language = cleanLang;
  }
  const cleanQuery = String(query || '').trim();
  if (cleanQuery) {
    const escaped = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');
    filter.$or = [
      { name: rx },
      { description: rx },
      { id: rx },
      { author_name: rx },
      { triggers_json: rx },
    ];
  }
  return filter;
}

export async function connectMongo(params: {
  uri: string;
  dbName?: string;
  collectionName?: string;
}): Promise<{
  client: MongoClient;
  db: Db;
  collection: Collection<CommunitySkillDocument>;
  chatCollection: Collection<ChatSyncDocument>;
}> {
  if (!params.uri) {
    throw new Error('Thiếu MONGODB_URI trong biến môi trường.');
  }
  const { MongoClient: MongoClientCtor } = await import('mongodb');
  const client = new MongoClientCtor(params.uri, {
    serverSelectionTimeoutMS: 8000,
  });
  await client.connect();
  const db = client.db(params.dbName || 'duck_ai_manager');
  const collection = db.collection<CommunitySkillDocument>(
    params.collectionName || 'community_skills'
  );
  await collection.createIndex({ skill_key: 1 }, { unique: true });
  await collection.createIndex({ downloads: -1, updated_at_ms: -1 });

  const chatCollection = db.collection<ChatSyncDocument>('chat_sync');
  await chatCollection.createIndex({ user_sub: 1, created_at_ms: 1 });
  await chatCollection.createIndex({ user_sub: 1, msg_id: 1 }, { unique: true });

  return { client, db, collection, chatCollection };
}
