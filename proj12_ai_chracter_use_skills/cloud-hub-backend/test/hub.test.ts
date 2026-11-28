import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractBearerToken,
  isSkillOwner,
  sanitizeSkillId,
  validateChatPayload,
  validateCognitiveMemoryPayload,
  validateSkillPayload,
} from '../src/auth.js';
import { buildSkillFilter, buildVocabFilter } from '../src/mongo.js';

test('extractBearerToken parses Bearer header cleanly', () => {
  assert.equal(extractBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
  assert.equal(extractBearerToken('bearer token123'), 'token123');
  assert.equal(extractBearerToken('Basic xyz'), '');
  assert.equal(extractBearerToken(undefined), '');
});

test('validateSkillPayload validates and sanitizes community skill payload', () => {
  assert.equal(sanitizeSkillId('Port Cleaner v2!'), 'port_cleaner_v2');

  const badLang = validateSkillPayload({
    id: 'test',
    name: 'Test',
    language: 'bash',
    code: 'echo ok',
  });
  assert.equal(badLang.ok, false);

  const ok = validateSkillPayload({
    id: 'Port Check!',
    name: 'Port Check',
    description: 'Kiem tra port',
    language: 'PowerShell',
    code: "Write-Output 'OK'",
    version: 2,
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.clean.id, 'port_check');
    assert.equal(ok.clean.language, 'powershell');
    assert.equal(ok.clean.version, 2);
  }
});

test('buildSkillFilter builds MongoDB filter for language and search query', () => {
  const all = buildSkillFilter({ query: '', language: 'all' });
  assert.deepEqual(all, {});

  const filtered = buildSkillFilter({ query: 'port.3000', language: 'python' });
  assert.equal(filtered.language, 'python');
  assert.equal(Array.isArray(filtered.$or), true);
  assert.equal((filtered.$or as unknown[]).length, 5);
});

test('isSkillOwner and validateChatPayload enforce ownership and chat format', () => {
  assert.equal(
    isSkillOwner({ author_sub: '123', author_email: 'a@b.com' }, { sub: '123', email: 'x@y.com' }),
    true
  );
  assert.equal(
    isSkillOwner({ author_sub: '123', author_email: 'a@b.com' }, { sub: '999', email: 'A@B.COM' }),
    true
  );
  assert.equal(
    isSkillOwner({ author_sub: '123', author_email: 'a@b.com' }, { sub: '999', email: 'other@b.com' }),
    false
  );

  const emptyChat = validateChatPayload({ role: 'user', content: '   ' });
  assert.equal(emptyChat.ok, false);

  const okChat = validateChatPayload({
    msg_id: 'm1',
    role: 'assistant',
    content: 'Xin chao',
    source: 'web',
    created_at_ms: 1700000000000,
  });
  assert.equal(okChat.ok, true);
  if (okChat.ok) {
    assert.equal(okChat.clean.role, 'assistant');
    assert.equal(okChat.clean.source, 'web');
    assert.equal(okChat.clean.content, 'Xin chao');
  }
});

test('buildVocabFilter builds MongoDB filter for topic, level, and query', () => {
  const all = buildVocabFilter({ query: '', topic: 'random', level: 'all' });
  assert.deepEqual(all, {});

  const techB2 = buildVocabFilter({ query: 'algo', topic: 'technology', level: 'b2' });
  assert.equal(techB2.topic, 'technology');
  assert.equal(techB2.level, 'B2');
  assert.equal(Array.isArray(techB2.$or), true);
  assert.equal((techB2.$or as unknown[]).length, 2);

  const ieltsOnly = buildVocabFilter({ topic: 'ielts' });
  assert.deepEqual(ieltsOnly.topic, { $in: ['ielts', 'academic'] });
});

test('validateCognitiveMemoryPayload scrubs secrets and preserves clean facts/rules/playbooks', () => {
  const res = validateCognitiveMemoryPayload({
    facts: [
      { key: 'user_name', value: 'Phong', category: 'profile', importance: 200 },
      { key: 'GEMINI_API_KEY', value: 'AIzaSySecret123456', category: 'secret' },
      { key: 'vault_pw', value: 'dpapi:encryptedblob', category: 'auth' },
    ],
    rules: [
      { rule_key: 'rule_concise', rule_text: 'Tra loi ngan gon suc tich', source: 'implicit_habit' },
    ],
    playbooks: [
      {
        playbook_id: 'pb_gmail',
        trigger_keywords: 'doc mail gmail',
        tools_csv: 'gmail_imap_smtp__execute',
        strategy_hint: 'Doc hop thu bang IMAP',
        success_count: 3,
      },
    ],
  });

  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.clean.facts.length, 1);
    assert.equal(res.clean.facts[0].key, 'user_name');
    assert.equal(res.clean.rules.length, 1);
    assert.equal(res.clean.playbooks.length, 1);
    assert.equal(res.clean.playbooks[0].success_count, 3);
  }
});
