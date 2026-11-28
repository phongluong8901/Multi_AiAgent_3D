import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectMongo } from '../dist/src/mongo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const CACHE_DIR = path.resolve(__dirname, '../.cache');

const MAX_SEED_WORDS = 45000;

const SOURCES = {
  anhViet109k: {
    file: 'anhviet109K.txt',
    urls: [
      'https://raw.githubusercontent.com/yenthanh132/avdict-database-sqlite-converter/master/anhviet109K.txt',
      'https://raw.githubusercontent.com/yenthanh132/avdict-database-sqlite-converter/main/anhviet109K.txt',
    ],
  },
  ipaUs: {
    file: 'en_US.txt',
    urls: [
      'https://raw.githubusercontent.com/open-dict-data/ipa-dict/master/data/en_US.txt',
      'https://raw.githubusercontent.com/open-dict-data/ipa-dict/main/data/en_US.txt',
    ],
  },
  websters: {
    file: 'dictionary_compact.json',
    urls: [
      'https://raw.githubusercontent.com/matthewreagan/WebstersEnglishDictionary/master/dictionary_compact.json',
    ],
  },
  freq20k: {
    file: '20k.txt',
    urls: [
      'https://raw.githubusercontent.com/first20hours/google-10000-english/master/20k.txt',
    ],
  },
};

function normalizePos(rawPos) {
  const s = String(rawPos || '').trim().toLowerCase();
  if (!s) return 'vocab';
  if (s.includes('danh từ') || s === 'n' || s.includes('noun')) return 'noun';
  if (s.includes('động từ') || s === 'v' || s.startsWith('v.') || s.includes('verb')) return 'verb';
  if (s.includes('tính từ') || s === 'a' || s === 'adj' || s.includes('adj')) return 'adjective';
  if (s.includes('phó từ') || s.includes('trạng từ') || s === 'adv' || s.includes('adverb')) return 'adverb';
  if (s.includes('giới từ') || s.includes('prep')) return 'preposition';
  if (s.includes('liên từ') || s.includes('conj')) return 'conjunction';
  if (s.includes('đại từ') || s.includes('pron')) return 'pronoun';
  if (s.includes('thán từ') || s.includes('interj')) return 'interjection';
  return 'vocab';
}

function inferLevel(freqRank) {
  if (freqRank <= 1200) return 'A1';
  if (freqRank <= 3000) return 'A2';
  if (freqRank <= 7000) return 'B1';
  if (freqRank <= 13000) return 'B2';
  if (freqRank <= 22000) return 'C1';
  return 'C2';
}

function inferTopic(word, defEn, meaningVi, freqRank) {
  const hay = `${word} ${defEn} ${meaningVi}`.toLowerCase();
  if (
    /\b(software|computer|algorithm|network|server|database|digital|program|code|cyber|cloud|hardware|circuit|electronic|machine|interface|computing|binary)\b/.test(hay) ||
    /(phần mềm|máy tính|thuật toán|lập trình|mạng máy|dữ liệu|máy chủ|kỹ thuật số|vi xử lý|điện toán|mã hóa)/.test(hay)
  ) {
    return 'technology';
  }
  if (
    /\b(finance|market|commerce|trade|company|profit|capital|invest|audit|bank|revenue|contract|asset|credit|stock|economy|enterprise|management|corporate|budget|tax)\b/.test(hay) ||
    /(tài chính|thị trường|kinh doanh|thương mại|lợi nhuận|đầu tư|ngân hàng|doanh nghiệp|cổ phiếu|ngân sách|hợp đồng|kinh tế)/.test(hay)
  ) {
    return 'business';
  }
  if (
    /\b(physics|chemistry|biology|molecule|atom|cell|gene|genome|planet|species|electron|quantum|laboratory|experiment|gravity|chemical|organism|evolution|radiation)\b/.test(hay) ||
    /(vật lý|hóa học|sinh học|phân tử|nguyên tử|tế bào|thí nghiệm|khoa học|lượng tử|tiến hóa|bức xạ)/.test(hay)
  ) {
    return 'science';
  }
  if (
    /\b(theory|hypothesis|research|philosophy|methodology|principle|literature|analysis|criterion|phenomenon|empirical|thesis|discourse|academic|scholar)\b/.test(hay) ||
    /(nghiên cứu|lý thuyết|giả thuyết|triết học|học thuật|phân tích|luận văn|nguyên lý|khái niệm)/.test(hay)
  ) {
    return 'academic';
  }
  if (
    /\b(family|kitchen|food|weather|morning|sleep|house|friend|travel|clothes|garden|dinner|breakfast|holiday|hobby|walk)\b/.test(hay) ||
    /(gia đình|thức ăn|thời tiết|nhà cửa|bạn bè|du lịch|quần áo|buổi sáng|bữa tối|kỳ nghỉ)/.test(hay)
  ) {
    return 'daily';
  }
  if (
    freqRank >= 1500 &&
    freqRank <= 18000 &&
    /(tion|sion|ment|ness|ity|ance|ence|ous|ive|able|ible|ize|ise)$/.test(word)
  ) {
    return 'ielts';
  }
  return 'general';
}

function buildContextExample(word, pos, topic) {
  const ctx =
    topic === 'technology'
      ? 'modern software architecture'
      : topic === 'business'
      ? 'global business strategy'
      : topic === 'science'
      ? 'scientific research'
      : topic === 'academic'
      ? 'academic writing'
      : 'everyday English';
  if (pos === 'verb') return `Teams regularly ${word} key ideas when discussing ${ctx}.`;
  if (pos === 'adjective') return `A ${word} approach makes a noticeable difference in ${ctx}.`;
  if (pos === 'adverb') return `Experts communicate ${word} to stay aligned in ${ctx}.`;
  return `Understanding "${word}" helps express clear thoughts in ${ctx}.`;
}

async function fetchOrCache(entry) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const target = path.join(CACHE_DIR, entry.file);
  if (fs.existsSync(target) && fs.statSync(target).size > 1024) {
    console.log(`[CACHE HIT] ${entry.file} (${(fs.statSync(target).size / 1024 / 1024).toFixed(2)} MB)`);
    return fs.readFileSync(target, 'utf8');
  }
  let lastErr = null;
  for (const url of entry.urls) {
    try {
      console.log(`[DOWNLOAD] ${url} ...`);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'DuckAiCloudHubSeeder/1.0' },
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.length < 1024) throw new Error('Response too small');
      fs.writeFileSync(target, text, 'utf8');
      console.log(`[SAVED] ${entry.file} (${(text.length / 1024 / 1024).toFixed(2)} MB)`);
      return text;
    } catch (err) {
      lastErr = err;
      console.warn(`[WARN] Download failed for ${url}: ${err.message}`);
    }
  }
  throw new Error(`Failed all URLs for ${entry.file}: ${lastErr?.message || 'unknown'}`);
}

const CURATED_TECH_IELTS_WORDS = [
  { word: 'resilience', phonetic: '/rɪˈzɪl.jəns/', pos: 'noun', vi: 'khả năng phục hồi, sức bật bền bỉ', def: 'The capacity to recover quickly from difficulties.', ex: 'System resilience ensures services keep running under heavy load.', exVi: 'Khả năng phục hồi hệ thống giúp dịch vụ luôn chạy ổn định khi tải nặng.', topic: 'ielts', level: 'B2', syn: ['adaptability', 'toughness'] },
  { word: 'scalability', phonetic: '/ˌskeɪ.ləˈbɪl.ə.ti/', pos: 'noun', vi: 'khả năng mở rộng quy mô', def: 'Capability of a system to handle growing amounts of work.', ex: 'MongoDB indexing directly improves query scalability.', exVi: 'Đánh chỉ mục MongoDB giúp cải thiện trực tiếp khả năng mở rộng truy vấn.', topic: 'technology', level: 'C1', syn: ['extensibility', 'flexibility'] },
  { word: 'latency', phonetic: '/ˈleɪ.tən.si/', pos: 'noun', vi: 'độ trễ truyền tải dữ liệu', def: 'Delay before a transfer of data begins following an instruction.', ex: 'Edge caching cuts API latency to under twenty milliseconds.', exVi: 'Lưu đệm tại biên giúp giảm độ trễ API xuống dưới hai mươi mili-giây.', topic: 'technology', level: 'C1', syn: ['delay', 'lag'] },
  { word: 'throughput', phonetic: '/ˈθruː.pʊt/', pos: 'noun', vi: 'lưu lượng xử lý theo thời gian', def: 'The amount of material or data passing through a system.', ex: 'Batching database writes tripled our ingestion throughput.', exVi: 'Ghi dữ liệu theo lô đã tăng gấp ba lưu lượng xử lý của hệ thống.', topic: 'technology', level: 'C1', syn: ['capacity', 'output'] },
  { word: 'heuristic', phonetic: '/hjʊəˈrɪs.tɪk/', pos: 'noun', vi: 'phương pháp thử nghiệm nhanh, quy tắc kinh nghiệm', def: 'Practical problem-solving method sufficient for immediate goals.', ex: 'Our parser uses a heuristic repair pass for malformed JSON.', exVi: 'Bộ phân tích dùng bước sửa theo kinh nghiệm cho JSON lỗi cú pháp.', topic: 'technology', level: 'C2', syn: ['approximation'] },
  { word: 'idempotent', phonetic: '/ˌaɪ.dɛmˈpoʊ.tənt/', pos: 'adjective', vi: 'lũy đẳng (chạy nhiều lần cùng một kết quả)', def: 'Denoting an operation that leaves state unchanged when applied repeatedly.', ex: 'Upsert requests should always be idempotent to handle retries safely.', exVi: 'Yêu cầu upsert nên luôn lũy đẳng để thử lại an toàn.', topic: 'technology', level: 'C2', syn: ['repeatable', 'consistent'] },
  { word: 'telemetry', phonetic: '/təˈlem.ə.tri/', pos: 'noun', vi: 'đo lường và thu thập dữ liệu từ xa', def: 'Automated collection and transmission of measurements from remote sources.', ex: 'Real-time telemetry warns us before RAM usage hits the threshold.', exVi: 'Đo lường thời gian thực cảnh báo trước khi RAM chạm ngưỡng.', topic: 'technology', level: 'C1', syn: ['monitoring', 'diagnostics'] },
  { word: 'orchestration', phonetic: '/ˌɔː.kɪˈstreɪ.ʃən/', pos: 'noun', vi: 'sự điều phối tự động nhiều dịch vụ', def: 'Automated configuration, coordination, and management of complex systems.', ex: 'Container orchestration automates scaling and failover across nodes.', exVi: 'Điều phối container tự động hóa việc mở rộng và dự phòng lỗi.', topic: 'technology', level: 'C1', syn: ['coordination', 'automation'] },
  { word: 'ubiquitous', phonetic: '/juːˈbɪk.wɪ.təs/', pos: 'adjective', vi: 'phổ biến khắp mọi nơi', def: 'Present, appearing, or found everywhere.', ex: 'Cloud-connected mobile apps have become ubiquitous in daily work.', exVi: 'Ứng dụng kết nối đám mây đã trở nên phổ biến khắp mọi nơi.', topic: 'ielts', level: 'C1', syn: ['omnipresent', 'pervasive'] },
  { word: 'mitigate', phonetic: '/ˈmɪt.ɪ.ɡeɪt/', pos: 'verb', vi: 'giảm nhẹ, làm dịu bớt rủi ro', def: 'To make less severe, serious, or painful.', ex: 'TTL caching helps mitigate spikes in external API traffic.', exVi: 'Bộ nhớ đệm TTL giúp giảm nhẹ đột biến lưu lượng API.', topic: 'ielts', level: 'C1', syn: ['alleviate', 'reduce'] },
  { word: 'leverage', phonetic: '/ˈlev.ər.ɪdʒ/', pos: 'verb', vi: 'tận dụng tối đa nguồn lực, đòn bẩy', def: 'Use something to maximum advantage.', ex: 'Small teams can leverage open-source corpora to ship faster.', exVi: 'Đội nhóm nhỏ có thể tận dụng kho dữ liệu mở để phát hành nhanh hơn.', topic: 'business', level: 'B2', syn: ['utilize', 'harness'] },
  { word: 'pragmatic', phonetic: '/præɡˈmæt.ɪk/', pos: 'adjective', vi: 'thực tế, thiết thực', def: 'Dealing with things sensibly and realistically.', ex: 'A pragmatic engineering plan prioritizes reliability before polish.', exVi: 'Kế hoạch kỹ thuật thực tế ưu tiên độ ổn định trước phần trau chuốt.', topic: 'academic', level: 'C1', syn: ['practical', 'realistic'] },
  { word: 'sustainable', phonetic: '/səˈsteɪ.nə.bəl/', pos: 'adjective', vi: 'bền vững, có thể duy trì lâu dài', def: 'Able to be maintained at a certain rate or level.', ex: 'Clean energy investments promote sustainable economic growth.', exVi: 'Đầu tư năng lượng sạch thúc đẩy tăng trưởng kinh tế bền vững.', topic: 'ielts', level: 'B2', syn: ['viable', 'renewable'] },
  { word: 'articulate', phonetic: '/ɑːˈtɪk.jə.lət/', pos: 'verb', vi: 'diễn đạt rõ ràng, phát âm rành mạch', def: 'Express an idea or feeling fluently and coherently.', ex: 'Practicing shadowing helps you articulate difficult vowels cleanly.', exVi: 'Luyện nói nhại giúp bạn phát âm các nguyên âm khó rõ ràng hơn.', topic: 'ielts', level: 'C1', syn: ['express', 'enunciate'] },
  { word: 'collocation', phonetic: '/ˌkɒl.əˈkeɪ.ʃən/', pos: 'noun', vi: 'cụm từ đi kèm tự nhiên với nhau', def: 'Habitual juxtaposition of particular words in a language.', ex: 'Learning collocations prevents awkward literal translations.', exVi: 'Học cụm từ tự nhiên giúp tránh dịch thô từng chữ ngượng nghịu.', topic: 'academic', level: 'B2', syn: ['phrase', 'idiom'] },
  { word: 'paradigm', phonetic: '/ˈpær.ə.daɪm/', pos: 'noun', vi: 'mô hình tư duy, hệ chuẩn mực', def: 'A typical example, pattern, or worldview of something.', ex: 'Vector search shifted the database retrieval paradigm.', exVi: 'Tìm kiếm vector đã làm thay đổi mô hình truy xuất cơ sở dữ liệu.', topic: 'academic', level: 'C1', syn: ['model', 'framework'] },
  { word: 'consolidate', phonetic: '/kənˈsɒl.ɪ.deɪt/', pos: 'verb', vi: 'củng cố, hợp nhất cho vững chắc', def: 'Make something physically stronger or combine into one whole.', ex: 'Spaced repetition helps consolidate new vocabulary into memory.', exVi: 'Lặp lại ngắt quãng giúp củng cố từ vựng mới vào trí nhớ sâu.', topic: 'business', level: 'B2', syn: ['strengthen', 'merge'] },
  { word: 'bottleneck', phonetic: '/ˈbɒt.əl.nek/', pos: 'noun', vi: 'nút thắt cổ chai, điểm nghẽn hiệu năng', def: 'Point of congestion that slows down a workflow or system.', ex: 'Profiling revealed synchronous disk I/O as the main bottleneck.', exVi: 'Đo hiệu năng chỉ ra đọc ghi ổ cứng đồng bộ là điểm nghẽn chính.', topic: 'business', level: 'B2', syn: ['congestion', 'hindrance'] },
  { word: 'empirical', phonetic: '/ɪmˈpɪr.ɪ.kəl/', pos: 'adjective', vi: 'dựa trên thực nghiệm và quan sát thực tế', def: 'Based on observation or experience rather than pure theory.', ex: 'Empirical benchmarks confirmed a forty percent speed improvement.', exVi: 'Đo kiểm thực nghiệm xác nhận tốc độ được cải thiện bốn mươi phần trăm.', topic: 'science', level: 'C1', syn: ['experimental', 'observed'] },
  { word: 'equilibrium', phonetic: '/ˌiː.kwɪˈlɪb.ri.əm/', pos: 'noun', vi: 'trạng thái cân bằng ổn định', def: 'A state in which opposing forces or influences are balanced.', ex: 'Supply and demand eventually reach market equilibrium.', exVi: 'Cung và cầu cuối cùng sẽ đạt tới trạng thái cân bằng thị trường.', topic: 'science', level: 'C1', syn: ['balance', 'stability'] },
];

async function main() {
  const uri = String(process.env.MONGODB_URI || '').trim();
  const dbName = String(process.env.MONGODB_DB || 'duck_ai_manager').trim();
  const collectionName = String(process.env.MONGODB_COLLECTION || 'community_skills').trim();
  if (!uri) {
    throw new Error('MONGODB_URI is missing in cloud-hub-backend/.env');
  }

  const [anhVietTxt, ipaTxt, webstersJson, freqTxt] = await Promise.all([
    fetchOrCache(SOURCES.anhViet109k),
    fetchOrCache(SOURCES.ipaUs),
    fetchOrCache(SOURCES.websters),
    fetchOrCache(SOURCES.freq20k),
  ]);

  console.log('[PARSE] Indexing frequency ranks...');
  const freqMap = new Map();
  let rank = 1;
  for (const line of freqTxt.split(/\r?\n/)) {
    const w = line.trim().toLowerCase();
    if (w && !freqMap.has(w)) {
      freqMap.set(w, rank++);
    }
  }

  console.log('[PARSE] Indexing US IPA pronunciations...');
  const ipaMap = new Map();
  for (const line of ipaTxt.split(/\r?\n/)) {
    const tabIdx = line.indexOf('\t');
    if (tabIdx <= 0) continue;
    const w = line.slice(0, tabIdx).trim().toLowerCase();
    let pron = line.slice(tabIdx + 1).trim();
    const commaIdx = pron.indexOf(',');
    if (commaIdx > 0) pron = pron.slice(0, commaIdx).trim();
    if (w && pron && !ipaMap.has(w)) {
      ipaMap.set(w, pron.startsWith('/') ? pron : `/${pron}/`);
    }
  }

  console.log('[PARSE] Parsing Websters compact definitions...');
  const webstersObj = JSON.parse(webstersJson);
  const websterMap = new Map();
  for (const [rawKey, rawVal] of Object.entries(webstersObj)) {
    const w = rawKey.trim().toLowerCase();
    if (!w || w.length < 3) continue;
    let cleanDef = String(rawVal || '').replace(/\s+/g, ' ').trim();
    const firstSentence = cleanDef.split(/(?<=[.;])\s+/)[0] || cleanDef;
    cleanDef = firstSentence.slice(0, 150).trim();
    if (cleanDef && !websterMap.has(w)) {
      websterMap.set(w, cleanDef);
    }
  }

  console.log('[PARSE] Extracting anhviet109K entries...');
  const blocks = anhVietTxt.split(/\r?\n(?=@)/);
  const docsMap = new Map();
  let fallbackRank = 20001;
  const nowMs = Date.now();

  for (const rawBlock of blocks) {
    const lines = rawBlock.split(/\r?\n/);
    const header = (lines[0] || '').trim();
    if (!header.startsWith('@')) continue;

    let headPart = header.slice(1).trim();
    let rawPhonetic = '';
    const slashIdx = headPart.indexOf('/');
    if (slashIdx > 0) {
      rawPhonetic = headPart.slice(slashIdx).trim();
      headPart = headPart.slice(0, slashIdx).trim();
    }
    const word = headPart.toLowerCase();
    if (!/^[a-z]{3,22}$/.test(word)) continue;

    let pos = 'vocab';
    const viMeanings = [];
    const viSeen = new Set();
    let exampleEn = '';
    let exampleVi = '';

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line.startsWith('*')) {
        if (pos === 'vocab') {
          pos = normalizePos(line.slice(1).trim());
        }
      } else if (line.startsWith('-')) {
        const mClean = line
          .slice(1)
          .replace(/^\([^)]*\)\s*/, '')
          .trim();
        if (mClean && mClean.length <= 75) {
          const low = mClean.toLowerCase();
          if (!viSeen.has(low)) {
            viSeen.add(low);
            viMeanings.push(mClean);
          }
        }
      } else if (!exampleEn && line.startsWith('=')) {
        const exBody = line.slice(1);
        const plusIdx = exBody.indexOf('+');
        if (plusIdx > 0) {
          const eEn = exBody.slice(0, plusIdx).trim();
          const eVi = exBody.slice(plusIdx + 1).trim();
          if (eEn.length >= 8 && eEn.length <= 130) {
            exampleEn = eEn;
            exampleVi = eVi.slice(0, 140);
          }
        }
      }
      if (viMeanings.length >= 4 && exampleEn) break;
    }

    if (viMeanings.length === 0) continue;
    const meaningVi = viMeanings.join('; ').slice(0, 140).trim();
    if (!meaningVi) continue;

    const freqRank = freqMap.get(word) ?? fallbackRank++;
    const phonetic =
      ipaMap.get(word) ||
      (rawPhonetic
        ? rawPhonetic.startsWith('/')
          ? rawPhonetic
          : `/${rawPhonetic}/`
        : `/${word}/`);
    const defEn = websterMap.get(word) || `English ${pos} meaning "${meaningVi.slice(0, 55)}".`;
    const topic = inferTopic(word, defEn, meaningVi, freqRank);
    const level = inferLevel(freqRank);
    if (!exampleEn) {
      exampleEn = buildContextExample(word, pos, topic);
    }

    if (!docsMap.has(word)) {
      docsMap.set(word, {
        word,
        phonetic,
        part_of_speech: pos,
        meaning_vi: meaningVi,
        definition_en: defEn,
        example_en: exampleEn,
        example_vi: exampleVi,
        audio_url: '',
        topic,
        level,
        synonyms: [],
        freq_rank: freqRank,
        updated_at_ms: nowMs,
      });
    }
  }

  for (const c of CURATED_TECH_IELTS_WORDS) {
    docsMap.set(c.word, {
      word: c.word,
      phonetic: c.phonetic,
      part_of_speech: c.pos,
      meaning_vi: c.vi,
      definition_en: c.def,
      example_en: c.ex,
      example_vi: c.exVi || '',
      audio_url: '',
      topic: c.topic,
      level: c.level,
      synonyms: c.syn,
      freq_rank: freqMap.get(c.word) ?? 1800,
      updated_at_ms: nowMs,
    });
  }

  // Sort by freq_rank ascending and keep up to MAX_SEED_WORDS (always >= 35000 if available)
  const sortedDocs = Array.from(docsMap.values()).sort((a, b) => a.freq_rank - b.freq_rank);
  const allDocs = sortedDocs.slice(0, MAX_SEED_WORDS);
  console.log(`[READY] Extracted ${sortedDocs.length} clean entries, syncing top ${allDocs.length} to MongoDB...`);
  if (allDocs.length < 30000) {
    throw new Error(`Expected >= 30000 vocabulary entries, got ${allDocs.length}`);
  }

  const conn = await connectMongo({ uri, dbName, collectionName });
  try {
    const col = conn.vocabCollection;
    const BATCH = 2500;
    let processed = 0;
    for (let i = 0; i < allDocs.length; i += BATCH) {
      const slice = allDocs.slice(i, i + BATCH);
      const ops = slice.map((doc) => ({
        updateOne: {
          filter: { word: doc.word },
          update: { $set: doc },
          upsert: true,
        },
      }));
      await col.bulkWrite(ops, { ordered: false });
      processed += slice.length;
      console.log(`[UPSERT] ${processed}/${allDocs.length} words synced to MongoDB...`);
    }
    const finalCount = await col.countDocuments({});
    console.log(`SEEDED_MONGO_VOCAB_COUNT=${finalCount}`);
    if (finalCount < 30000) {
      throw new Error(`MongoDB count check failed: ${finalCount} < 30000`);
    }
  } finally {
    await conn.client.close();
  }
}

main().catch((err) => {
  console.error('[SEED ERROR]', err);
  process.exit(1);
});
