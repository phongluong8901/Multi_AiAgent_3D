import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applySlidingWindowContext,
  buildColabChatPayload,
  normalizeTunnelUrl,
  parseNdjsonLine,
} from '../src/client.js';

test('normalizeTunnelUrl trims trailing slashes', () => {
  assert.equal(
    normalizeTunnelUrl('  https://abc.trycloudflare.com///  '),
    'https://abc.trycloudflare.com'
  );
});

test('applySlidingWindowContext preserves system prompt and last N messages', () => {
  const msgs = [
    { role: 'system' as const, content: 'sys' },
    ...Array.from({ length: 12 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `m${i}`,
    })),
  ];
  const sliced = applySlidingWindowContext(msgs, 4);
  assert.equal(sliced.length, 5);
  assert.equal(sliced[0].content, 'sys');
  assert.equal(sliced[1].content, 'm8');
  assert.equal(sliced[4].content, 'm11');
});

test('buildColabChatPayload and parseNdjsonLine match Ollama Colab format', () => {
  const payload = buildColabChatPayload({
    model: 'qwen2.5-coder:14b',
    messages: [{ role: 'user', content: 'hi' }],
  });
  assert.equal(payload.keep_alive, -1);
  assert.equal(payload.options.num_ctx, 8192);
  assert.equal(payload.options.temperature, 0.2);

  const chunk = parseNdjsonLine('{"message":{"content":"fn main()"},"done":false}');
  assert.deepEqual(chunk, {
    token: 'fn main()',
    done: false,
    evalCount: undefined,
    evalDurationNs: undefined,
  });
});
