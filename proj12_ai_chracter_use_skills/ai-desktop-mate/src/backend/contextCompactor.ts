import { OllamaMessage } from '../core/types';

/**
 * Two-Tier Context Compactor + Topic-Clustered Associative Fuzzy Session Memory
 * + Execution Self-Verification Anti-Spoofing Guard (ported from proj11_AI_use_Skills).
 */

const VI_STOPWORDS = new Set([
  'la', 'va', 'cua', 'cho', 'voi', 'cac', 'nhung', 'mot', 'nay', 'kia', 'thi',
  'co', 'khong', 'duoc', 'nhu', 'the', 'nao', 'xem', 'di', 'nhe', 'nha', 'toi',
  'minh', 'ban', 'to', 'giup', 'hay',
]);

export function stripViAccents(raw: string): string {
  return (raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function tokenizeVi(text: string): Set<string> {
  const norm = stripViAccents(text);
  const words = norm.split(/[^a-z0-9_]+/).filter((w) => w.length >= 2 && !VI_STOPWORDS.has(w));
  return new Set(words);
}

function jaccardSim(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) {
    if (b.has(w)) inter++;
  }
  if (inter === 0) return 0;
  return inter / (a.size + b.size - inter);
}

function fadeText(text: string, maxChars: number): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(36, maxChars - 3)).trimEnd()}...`;
}

/**
 * Tier-1 Sanitizer: Strip raw [TOOL:...] tags and spoofed [Tool trace: ...] markers
 * from past assistant messages so small models never parrot fake tool traces.
 */
export function sanitizeTurnTextForHistory(text: string): string {
  return (text || '')
    .replace(/\[TOOL:[a-zA-Z0-9_]+:[\s\S]*?\]/gi, '')
    .replace(/\[Tool trace:[^\]]*\]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

interface TopicGroup {
  id: number;
  tokens: Set<string>;
  indices: number[];
}

/**
 * Topic-Clustered Associative Fuzzy Session Memory (0ms, 0 API cost):
 * - Immediate last 2 turns OR high-relevance topic group (>=45%): 100% Sharp recall
 * - Medium relevance (20-44%) OR within sharpWindow: ~45% Faded summary
 * - Unrelated older topic groups: ~12% Ultra-Faint gist
 */
export function buildCompactedHistoryWindow(
  history: OllamaMessage[],
  currentQuery: string,
  maxPairs = 10,
  sharpTurns = 4
): OllamaMessage[] {
  const cleanMsgs = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-(maxPairs * 2));

  if (cleanMsgs.length <= 4) {
    return cleanMsgs.map((m) => ({
      role: m.role,
      content: m.role === 'assistant' ? sanitizeTurnTextForHistory(m.content) : m.content,
    }));
  }

  // Pair up alternating (user, assistant) turns
  const pairs: Array<{ u: string; a: string; tokens: Set<string> }> = [];
  let i = 0;
  while (i < cleanMsgs.length) {
    if (cleanMsgs[i].role === 'user') {
      const uTxt = cleanMsgs[i].content;
      let aTxt = '';
      if (i + 1 < cleanMsgs.length && cleanMsgs[i + 1].role === 'assistant') {
        aTxt = sanitizeTurnTextForHistory(cleanMsgs[i + 1].content);
        i += 2;
      } else {
        i += 1;
      }
      if (aTxt) {
        pairs.push({
          u: uTxt,
          a: aTxt,
          tokens: tokenizeVi(`${uTxt} ${aTxt.slice(0, 280)}`),
        });
      } else {
        // Trailing current user prompt
        pairs.push({ u: uTxt, a: '', tokens: tokenizeVi(uTxt) });
      }
    } else {
      i += 1;
    }
  }

  const completedCount = pairs.filter((p) => p.a !== '').length;
  if (completedCount <= 2) {
    const flat: OllamaMessage[] = [];
    for (const p of pairs) {
      flat.push({ role: 'user', content: p.u });
      if (p.a) flat.push({ role: 'assistant', content: p.a });
    }
    return flat;
  }

  // 1. Greedy Topic Clustering
  const groups: TopicGroup[] = [];
  const turnGroup = new Map<number, number>();
  pairs.forEach((p, idx) => {
    let bestGid = -1;
    let bestSim = 0.16;
    for (const g of groups) {
      const sim = jaccardSim(p.tokens, g.tokens);
      if (sim > bestSim) {
        bestSim = sim;
        bestGid = g.id;
      }
    }
    if (bestGid === -1) {
      const gid = groups.length + 1;
      groups.push({ id: gid, tokens: new Set(p.tokens), indices: [idx] });
      turnGroup.set(idx, gid);
    } else {
      const g = groups[bestGid - 1];
      for (const t of p.tokens) g.tokens.add(t);
      g.indices.push(idx);
      turnGroup.set(idx, bestGid);
    }
  });

  // 2. Compute relevance % of each Topic Group to currentQuery
  const qTokens = tokenizeVi(currentQuery);
  const groupRel = new Map<number, number>();
  for (const g of groups) {
    if (qTokens.size === 0) {
      groupRel.set(g.id, 0.5);
    } else {
      let inter = 0;
      for (const qt of qTokens) {
        if (g.tokens.has(qt)) inter++;
      }
      const overlap = inter / Math.max(1, Math.min(qTokens.size, 5));
      const jacc = jaccardSim(qTokens, g.tokens);
      groupRel.set(g.id, Math.min(1.0, Math.max(overlap * 0.85, jacc * 1.6)));
    }
  }

  // 3. Render multi-resolution window
  const out: OllamaMessage[] = [];
  pairs.forEach((p, idx) => {
    if (!p.a) {
      out.push({ role: 'user', content: p.u });
      return;
    }
    const turnsAgo = completedCount - idx;
    const gid = turnGroup.get(idx) || 1;
    const relPct = Math.round((groupRel.get(gid) || 0) * 100);

    if (turnsAgo <= 2 || (qTokens.size > 0 && relPct >= 45)) {
      out.push({ role: 'user', content: p.u });
      out.push({ role: 'assistant', content: p.a });
    } else if (relPct >= 20 || turnsAgo <= sharpTurns) {
      out.push({ role: 'user', content: fadeText(p.u, 150) });
      out.push({
        role: 'assistant',
        content: `[Nhóm #${gid} | liên quan ~${relPct}%] ${fadeText(p.a, 220)}`,
      });
    } else {
      out.push({ role: 'user', content: fadeText(p.u, 70) });
      out.push({
        role: 'assistant',
        content: `[Ký ức mờ #${gid}] ${fadeText(p.a, 90)}`,
      });
    }
  });

  return out;
}

/**
 * Execution Self-Verification & Anti-Spoofing Guard:
 * Detects when an LLM claims it already executed an action ("Đã tạo file", "Đã gửi mail", etc.)
 * while 0 real tools were called, so the caller can trigger automatic tool execution or strip fake traces.
 */
export function verifyActionHonesty(
  userPrompt: string,
  assistantReply: string,
  executedRealTool: boolean
): { spoofDetected: boolean; cleanedReply: string } {
  const cleanedReply = (assistantReply || '')
    .replace(/\[Tool trace:[^\]]*\]/gi, '')
    .trim();

  if (executedRealTool) {
    return { spoofDetected: false, cleanedReply };
  }

  const normUser = stripViAccents(userPrompt);
  const normReply = stripViAccents(cleanedReply);

  const isActionRequest =
    /\b(gui mail|doc mail|tao google sheet|tao google doc|ve bieu do|quet docker|nhan zalo|xuat file|tao file excel|chup cua so)\b/.test(
      normUser
    );
  const claimsDoneWithoutTool =
    /\b(da thuc hien|da gui|da tao xong|da luu file|da cap nhat tren google|da quet xong)\b/.test(
      normReply
    );

  return {
    spoofDetected: isActionRequest && claimsDoneWithoutTool,
    cleanedReply,
  };
}

const SUGGEST_SKILL_RE = /\[\[SUGGEST_SKILL:\s*([a-zA-Z0-9_\-]+)\s*\|\s*([\s\S]+?)\s*\]\]/i;

export function extractSuggestedSkillFromTurn(
  rawAnswer: string,
  userPrompt: string,
  hasOkTool: boolean
): { cleanedAnswer: string; suggested: { module_name: string; requirement: string } | null } {
  const m = (rawAnswer || '').match(SUGGEST_SKILL_RE);
  if (m) {
    let mod = m[1].trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    if (!mod.startsWith('skill_')) mod = `skill_${mod}`;
    const req = m[2].trim();
    const cleaned = (rawAnswer || '').replace(SUGGEST_SKILL_RE, '').trim();
    return { cleanedAnswer: cleaned, suggested: { module_name: mod, requirement: req } };
  }

  const normAns = stripViAccents(rawAnswer || '');
  const gapSignals = [
    'khong tich hop san cong cu',
    'khong co cong cu',
    'chua co cong cu',
    'chua tich hop',
    'chua ho tro',
    'khong ho tro',
    'khong co tool',
    'chua co tool',
    'chua co skill',
    'khong the truy cap truc tiep',
  ];
  if (!hasOkTool && userPrompt.trim().length >= 6 && gapSignals.some((s) => normAns.includes(s))) {
    const normP = stripViAccents(userPrompt);
    const words = normP
      .split(/[^a-z0-9]+/)
      .filter(
        (w) =>
          w.length >= 2 &&
          !['xem', 'cho', 'co', 'khong', 'hay', 'giup', 'toi', 'moi', 'cua', 'nay', 'lay', 'tra'].includes(w)
      );
    const slug = words.slice(0, 3).join('_') || 'custom_auto';
    return {
      cleanedAnswer: rawAnswer,
      suggested: {
        module_name: `skill_${slug}`,
        requirement: userPrompt.trim(),
      },
    };
  }

  return { cleanedAnswer: rawAnswer, suggested: null };
}
