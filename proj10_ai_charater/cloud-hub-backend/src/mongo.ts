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

export interface EnglishVocabDocument {
  word: string;
  phonetic: string;
  part_of_speech: string;
  meaning_vi: string;
  definition_en: string;
  example_en: string;
  example_vi: string;
  audio_url: string;
  topic: string;
  level: string;
  synonyms: string[];
  freq_rank: number;
  updated_at_ms: number;
}

export interface VocabFilterQuery {
  query?: string;
  topic?: string;
  level?: string;
}

export function buildVocabFilter({
  query = '',
  topic = 'all',
  level = 'all',
}: VocabFilterQuery = {}): Filter<Document> {
  const filter: Filter<Document> = {};
  const cleanTopic = String(topic || '').trim().toLowerCase();
  if (cleanTopic && cleanTopic !== 'all' && cleanTopic !== 'random') {
    if (cleanTopic === 'daily') {
      filter.topic = { $in: ['daily', 'general'] };
    } else if (cleanTopic === 'ielts') {
      filter.topic = { $in: ['ielts', 'academic'] };
    } else {
      filter.topic = cleanTopic;
    }
  }
  const cleanLevel = String(level || '').trim().toUpperCase();
  if (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(cleanLevel)) {
    filter.level = cleanLevel;
  }
  const cleanQuery = String(query || '').trim();
  if (cleanQuery) {
    const escaped = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');
    filter.$or = [
      { word: rx },
      { meaning_vi: rx },
    ];
  }
  return filter;
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
  vocabCollection: Collection<EnglishVocabDocument>;
}> {
  if (!params.uri) {
    throw new Error('Thiếu MONGODB_URI trong biến môi trường.');
  }
  const { MongoClient: MongoClientCtor } = await import('mongodb');
  const client = new MongoClientCtor(params.uri, {
    serverSelectionTimeoutMS: 10000,
    family: 4,
  });
  try {
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

    const vocabCollection = db.collection<EnglishVocabDocument>('english_vocab');
    await vocabCollection.createIndex({ word: 1 }, { unique: true });
    await vocabCollection.createIndex({ topic: 1, freq_rank: 1 });
    await vocabCollection.createIndex({ level: 1, freq_rank: 1 });
    await vocabCollection.createIndex({ freq_rank: 1 });

    return { client, db, collection, chatCollection, vocabCollection };
  } catch (err) {
    await client.close().catch(() => {});
    throw err;
  }
}
