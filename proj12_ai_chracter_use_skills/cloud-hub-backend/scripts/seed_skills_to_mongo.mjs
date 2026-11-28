import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');
const skillsRoot = path.resolve(backendRoot, '..', 'skills');

dotenv.config({ path: path.join(backendRoot, '.env') });

const MONGODB_URI = (process.env.MONGODB_URI || '').trim();
const MONGODB_DB = (process.env.MONGODB_DB || 'duck_ai_hub').trim();
const MONGODB_COLLECTION = (process.env.MONGODB_COLLECTION || 'community_skills').trim();

if (!MONGODB_URI) {
  console.error('[ERROR] Missing MONGODB_URI in cloud-hub-backend/.env');
  process.exit(1);
}

function extractDescription(code, packName, modName) {
  const m = code.match(/"description"\s*:\s*"([^"]{8,400})"/);
  if (m && m[1]) return m[1].trim();
  const doc = code.match(/"""([\s\S]{8,300}?)"""/);
  if (doc && doc[1]) return doc[1].trim().split('\n')[0].slice(0, 300);
  return `Python Skill (${packName}/${modName}) — tải về chạy local trực tiếp.`;
}

async function main() {
  if (!fs.existsSync(skillsRoot)) {
    console.error(`[ERROR] skills/ directory not found at: ${skillsRoot}`);
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 12000 });
  await client.connect();
  const col = client.db(MONGODB_DB).collection(MONGODB_COLLECTION);

  const packs = fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('_'))
    .map((d) => d.name)
    .sort();

  let uploaded = 0;
  for (const packName of packs) {
    const packDir = path.join(skillsRoot, packName);
    const files = fs
      .readdirSync(packDir)
      .filter((f) => f.startsWith('skill_') && f.endsWith('.py'))
      .sort();

    for (const file of files) {
      const modName = file.replace(/\.py$/, '');
      const code = fs.readFileSync(path.join(packDir, file), 'utf8');
      const testPath = path.join(packDir, `test_${file}`);
      const testCode = fs.existsSync(testPath) ? fs.readFileSync(testPath, 'utf8') : '';
      const codeHash = crypto.createHash('sha256').update(code, 'utf8').digest('hex');
      const skillKey = `official:${packName}:${modName}`;
      const now = Date.now();

      await col.updateOne(
        { skill_key: skillKey },
        {
          $set: {
            skill_key: skillKey,
            id: modName,
            name: `${packName}/${modName}`,
            description: extractDescription(code, packName, modName),
            language: 'python',
            skill_kind: 'python_pack_skill',
            pack_name: packName,
            module_name: modName,
            triggers_json: JSON.stringify([packName, modName.replace(/^skill_/, '')]),
            params_schema_json: '[]',
            code,
            test_code: testCode,
            test_args_json: '{}',
            expected_keywords_json: '[]',
            version: 1,
            code_hash: codeHash,
            author_sub: 'official',
            author_email: 'official@duck-ai-hub',
            author_name: 'Duck AI Official',
            updated_at_ms: now,
          },
          $setOnInsert: {
            downloads: 0,
            stars: 0,
            starred_by: [],
            created_at_ms: now,
          },
        },
        { upsert: true }
      );
      uploaded++;
    }
  }

  console.log(`[SUCCESS] Upserted ${uploaded} Python pack skills into MongoDB (${MONGODB_DB}.${MONGODB_COLLECTION}).`);
  await client.close();
}

main().catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});
