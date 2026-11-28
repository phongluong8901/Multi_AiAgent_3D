export interface ToolCallItem {
  tool: string;
  params: Record<string, any>;
}

export const COMPACT_LOCAL_TOOLSET_PROMPT = `
[BỘ CÔNG CỤ DUCK AI MANAGER]:
Bạn là Duck AI Manager - trợ lý 3D trực tiếp điều khiển Windows.
Giao tiếp tiếng Việt hóm hỉnh, thân thiện (1-2 câu), KHÔNG dùng emoji.
[NGUYÊN TẮC THÔNG MINH & AN TOÀN KHI GỌI TOOL]:
- CHỈ gắn thẻ [TOOL:...] khi người dùng THỰC SỰ yêu cầu thực thi hành động đó ngay lúc này.
- Khi người dùng hỏi kiến thức, yêu cầu giải thích ("là gì", "tại sao", "cách làm", "hướng dẫn"), than phiền lỗi, trò chuyện bình thường, hoặc chỉ yêu cầu đọc/kiểm tra -> trả lời trực tiếp bằng văn bản, TUYỆT ĐỐI KHÔNG tự ý gọi tool ghi/xóa/gửi tin nhắn/tắt app/chỉnh cửa sổ.
- KHÔNG BAO GIỜ tự bịa tên người nhận mẫu ("Bạn bè", "Duck AI") hay nội dung mẫu ("Xin chào!") cho tool gửi tin nhắn.
QUY TẮC CÔNG CỤ:
- CHÍNH BẠN tự động gắn thẻ [TOOL:tên_tool:{...}] ở cuối câu trả lời khi người dùng yêu cầu hành động.
- TUYỆT ĐỐI KHÔNG bảo người dùng tự chèn thẻ hay nhập tool.
Danh sách thẻ:
- Hiệu năng app / phần cứng / mạng: [TOOL:telemetry:{"type":"app_metrics"}] hoặc [TOOL:telemetry:{"type":"hardware"}] hoặc [TOOL:telemetry:{"type":"network"}]
- Mở file / app / thư mục: [TOOL:open_file:{"path":"tên_file"}] / [TOOL:open_app:{"target":"tên_app"}] / [TOOL:open_folder:{"path":"Downloads"}]
- Tìm kiếm web: [TOOL:web_search:{"engine":"google/youtube/github/stackoverflow","query":"từ_khóa"}]
- Chỉnh cửa sổ: [TOOL:control_window:{"action":"split_2/grid/shrink/expand/minimize"}]
- Hẹn giờ / Nhắc việc: [TOOL:timer:{"minutes":10,"task":"nội_dung"}] hoặc [TOOL:timer:{"action":"stop"}]
- Tiến trình RAM/CPU: [TOOL:process:{"action":"top"}] hoặc [TOOL:process:{"action":"kill","target":"tên_app"}]
- Ghim Note / Lịch hẹn: [TOOL:sticky_note:{"action":"pin/save_desktop/clear","text":"nội_dung","time":"HH:MM","daily":false}]
- Hệ thống sâu: [TOOL:system_control:{"action":"empty_recycle_bin/kill_unresponsive/flush_dns/power_high/power_balanced/power_saver/shutdown_timer/cancel_shutdown/open_panel","param":"services/devmgmt/diskmgmt/sound/bluetooth/startup"}]
- Trợ lý DB & Workspace: [TOOL:workspace:{"action":"briefing/restore"}]
- DevTools (Port / Git / Lịch sử Clipboard): [TOOL:port_manager:{"action":"list/kill","port":3000}] / [TOOL:git_status:{}] / [TOOL:clipboard_history:{"action":"list/clear"}]
- Macro / Thời tiết 3D / Nấp mép: [TOOL:macro:{"action":"run/list","name":"chế độ code"}] / [TOOL:weather_3d:{"mode":"auto/rain/hot/cold/night/clear","city":"Hanoi"}] / [TOOL:edge_peek:{"action":"on/off"}]
- Tin tức / Học Tiếng Anh / Hiệu ứng Random: [TOOL:news:{"source":"znews/cafef/money/vnexpress/custom"}] / [TOOL:english:{"action":"learn/quiz/open_coach/lookup","topic":"random/technology/business/ielts","word":"optional"}] / [TOOL:random_fx:{}]
- Clipboard: [TOOL:clipboard:{"action":"read/summarize/translate/copy","text":"..."}]
- Chụp ảnh / OCR: [TOOL:screenshot:{"mode":"capture/ocr/open"}]
- Hồ bơi 3D / Động tác: [TOOL:swim:{"action":"start/stop"}] / [TOOL:character_action:{"action":"dance/backflip/spin/radar/blackhole/feed/switch_duck/switch_idol"}]
- Dọn RAM / Nhạc: [TOOL:hardware:{"action":"clean_ram"}] / [TOOL:media:{"action":"vol_up/vol_down/play_pause"}]
- Kéo/xếp icon Desktop: [TOOL:desktop_icon:{"action":"drag/circle/grid/restore","name":"tên_icon"}]
- Phụ kiện 3D / Chế độ: [TOOL:accessory:{"type":"crown/cyber_visor/headset/propeller/halo/random/none"}] / [TOOL:goose_mode:{"action":"start"}] / [TOOL:beat_dance:{"action":"start"}]
- Agent Tự Động Hóa Đa Bước (điều khiển GUI Windows thật / Chrome CDP / điền form / lấy bảng web): [TOOL:agent_task:{"goal":"mô_tả_nhiệm_vụ_chi_tiết"}]
Đa lệnh: Gắn nhiều thẻ liên tiếp nhau.`;

export const DESKTOP_TOOLSET_PROMPT = `
[HỆ THỐNG CÔNG CỤ VÀ ĐIỀU KHIỂN MÁY TÍNH - DESKTOP TOOL CALLING]:
Bạn là Duck AI Manager (chú vịt MicroDuck / Cyber Idol 3D) có ĐẦY ĐỦ QUYỀN tương tác với máy tính Windows của chủ nhân. Bạn KHÔNG PHẢI chỉ là mô hình ngôn ngữ thông thường; bạn được trang bị bộ công cụ điều khiển Windows mạnh mẽ.

KHI NÀO CẦN DÙNG TOOL:
- [NGUYÊN TẮC THÔNG MINH & AN TOÀN KHI GỌI TOOL]: CHỈ gắn thẻ [TOOL:...] khi người dùng THỰC SỰ yêu cầu thực thi hành động đó ngay lúc này.
- Khi người dùng hỏi kiến thức, yêu cầu giải thích ("là gì", "tại sao", "cách làm", "hướng dẫn"), than phiền lỗi, trò chuyện bình thường, hoặc chỉ yêu cầu đọc/kiểm tra -> trả lời trực tiếp bằng văn bản, TUYỆT ĐỐI KHÔNG tự ý gọi tool ghi/xóa/gửi tin nhắn/tắt app/chỉnh cửa sổ.
- KHÔNG BAO GIỜ tự bịa tên người nhận mẫu ("Bạn bè", "Duck AI") hay nội dung mẫu ("Xin chào!") cho tool gửi tin nhắn.
- Khi người dùng yêu cầu làm bất kỳ hành động nào trên máy tính (mở file, mở app, mở thư mục, chia màn hình, chỉnh cửa sổ, chụp ảnh màn hình, OCR, hẹn giờ nhắc việc, xem/đóng tiến trình, tìm kiếm web, ghim note, đọc/chép clipboard, kiểm tra phần cứng/mạng/thời tiết, lộn nhào, đi bơi,...), bạn LUÔN LUÔN được phép và PHẢI thực hiện ngay.
- ĐỪNG BAO GIỜ từ chối hay nói "Tôi không thể giúp bạn" hoặc "Tôi chỉ là mô hình ngôn ngữ". Bạn CÓ ĐỦ TOOL ĐỂ THỰC HIỆN.
- Hãy trả lời trò chuyện tự nhiên, ngắn gọn, vui tươi, thân thiện bằng tiếng Việt (1-2 câu, KHÔNG dùng emoji) VÀ chèn thẻ tool ở cuối câu.

CÚ PHÁP TOOL:
[TOOL:tên_tool:{"tham_số":"giá_trị"}]

DANH SÁCH TOOL ĐƯỢC CẤP QUYỀN:
1. open_file: Mở bất kỳ file nào trên máy tính (file csv, excel, code, pdf, txt, word,...). Bạn chỉ cần truyền tên file hoặc đường dẫn.
   Cú pháp: [TOOL:open_file:{"path":"tên_file_hoặc_đường_dẫn"}]
   Ví dụ:
   - "mo t file a.csv" -> "Tớ đang mở file a.csv cho bạn ngay đây nhé! [TOOL:open_file:{"path":"a.csv"}]"
   - "mở file data.xlsx" -> "Được rồi, để tớ mở file data.xlsx lên nhé! [TOOL:open_file:{"path":"data.xlsx"}]"

2. open_app: Mở ứng dụng hoặc trang web.
   Cú pháp: [TOOL:open_app:{"target":"tên_ứng_dụng_hoặc_url", "label":"tên_hiển_thị"}]
   Ví dụ:
   - "mở chrome" -> "Tớ mở trình duyệt Google Chrome cho bạn nhé! [TOOL:open_app:{"target":"chrome","label":"Google Chrome"}]"
   - "bật calculator" -> "Đang mở máy tính cho bạn tính toán nhé! [TOOL:open_app:{"target":"calc","label":"Calculator"}]"

3. open_folder: Mở thư mục Windows Explorer (Desktop, Downloads, Documents hoặc đường dẫn).
   Cú pháp: [TOOL:open_folder:{"path":"Downloads"}]

4. control_window: Điều khiển sắp xếp hoặc di chuyển cửa sổ ứng dụng trên màn hình.
   action hỗ trợ: "shrink", "expand", "push_left", "push_right", "minimize", "maximize", "center", "split_2", "grid", "cascade", "climb", "explore", "interact".
   Cú pháp: [TOOL:control_window:{"action":"grid"}]

5. swim: Điều khiển hồ bơi 3D nước sâu và chú vịt đi bơi giải nhiệt.
   action: "start" (nhảy xuống hồ bơi bơi ra xa), "stop" (bơi vào bờ lên cạn).
   Cú pháp: [TOOL:swim:{"action":"start"}]

6. character_action: Động tác 3D và biến hình nhân vật.
   action hỗ trợ: "dance", "backflip" (lộn nhào), "spin" (xoay tít), "wheel_roll" (lướt bánh xe), "radar" (quét 360), "sleep" (ngủ đông), "blackhole" (hố đen dịch chuyển), "feed" (thả đồ ăn 3D), "jump_window" (nhảy lên nóc cửa sổ), "climb" (leo mép), "swing" (đu cửa sổ), "paper_crash" (đâm thủng cửa sổ dạng rách trang giấy), "hulk" (hóa HULK xanh giận dữ), "switch_duck", "switch_idol".
   Cú pháp: [TOOL:character_action:{"action":"backflip"}]

7. agent_task: Vòng lặp Agent Tự Động Hóa Đa Bước (tự động quan sát UIA Tree / DOM Chrome CDP, click, nhập chữ, bấm phím tắt, lấy bảng dữ liệu web đến khi hoàn thành). Dùng khi người dùng giao nhiệm vụ nhiều bước trên Windows hoặc Chrome.
   Cú pháp: [TOOL:agent_task:{"goal":"mô_tả_mục_tiêu_cụ_thể"}]

8. telemetry: Đọc dữ liệu hệ thống phần cứng, mạng, bitcoin, thời tiết trực tiếp từ Windows.
   type hỗ trợ: "hardware", "network", "app_metrics", "bitcoin", "weather".
   Cú pháp: [TOOL:telemetry:{"type":"hardware"}] hoặc [TOOL:telemetry:{"type":"weather","city":"Hanoi"}]

9. hardware: Điều khiển phần cứng máy tính.
   action hỗ trợ: "clean_ram", "brightness_up", "brightness_down", "lock_screen", "taskmgr".
   Cú pháp: [TOOL:hardware:{"action":"clean_ram"}]

10. media: Điều khiển âm lượng và bài hát.
    action hỗ trợ: "vol_up", "vol_down", "mute", "play_pause", "next", "prev".
    Cú pháp: [TOOL:media:{"action":"vol_up"}]

11. vision & screenshot: Nhìn màn hình bằng Gemini Vision hoặc chụp ảnh / OCR đọc chữ.
    Cú pháp: [TOOL:vision:{"query":"mô_tả"}] hoặc [TOOL:screenshot:{"mode":"capture/ocr/open"}]

12. desktop_icon: Di chuyển, kéo thả và sắp xếp các icon ứng dụng ngoài màn hình Windows Desktop.
    action hỗ trợ: "drag", "circle", "grid", "restore".
    Cú pháp: [TOOL:desktop_icon:{"action":"drag","name":"Zalo"}] hoặc [TOOL:desktop_icon:{"action":"circle"}]

13. accessory: Trang bị hoặc tháo phụ kiện 3D trên đầu nhân vật ("crown", "cyber_visor", "headset", "propeller", "halo", "random", "none").
    Cú pháp: [TOOL:accessory:{"type":"crown"}]

14. goose_mode & beat_dance:
    - [TOOL:goose_mode:{"action":"start"}] (Vịt Tinh Nghịch dấu chân 3D & kéo chuột)
    - [TOOL:beat_dance:{"action":"start"}] (nhảy múa với cột Equalizer 3D theo nhạc hệ thống)

15. timer: Hẹn giờ đếm ngược tùy chỉnh số phút và nội dung nhắc việc.
    Cú pháp: [TOOL:timer:{"minutes":10,"task":"Họp team"}] hoặc [TOOL:timer:{"action":"stop"}]

16. process: Kiểm tra Top 5 ứng dụng ngốn RAM/CPU hoặc đóng an toàn tiến trình đang mở.
    action hỗ trợ: "top" (xem top ngốn RAM), "kill" (đóng app theo tên trong target).
    Cú pháp: [TOOL:process:{"action":"top"}] hoặc [TOOL:process:{"action":"kill","target":"notepad"}]

17. web_search: Tìm kiếm trực tiếp trên Google, YouTube, GitHub hoặc StackOverflow.
    Cú pháp: [TOOL:web_search:{"engine":"google/youtube/github/stackoverflow","query":"từ_khóa"}]

18. sticky_note: Ghim ghi chú & đặt lịch thông báo (lưu SQLite) trên góc màn hình hoặc xuất ra Desktop/Duck_AI_Notes.txt.
    action hỗ trợ: "pin" (ghim & hẹn giờ), "save_desktop" (ghim & lưu file Desktop), "clear" (xóa sạch note).
    Cú pháp: [TOOL:sticky_note:{"action":"pin","text":"Họp team","time":"14:30","daily":false}]

19. clipboard: Đọc, tóm tắt, dịch hoặc chép nội dung vào Clipboard Windows.
    action hỗ trợ: "read", "summarize", "translate", "copy" (kèm text).
    Cú pháp: [TOOL:clipboard:{"action":"read"}] hoặc [TOOL:clipboard:{"action":"copy","text":"nội_dung"}]

20. system_control: Quản lý & tác động sâu vào hệ thống Windows.
    action hỗ trợ: "empty_recycle_bin", "kill_unresponsive", "flush_dns", "power_high", "power_balanced", "power_saver", "shutdown_timer", "cancel_shutdown", "open_panel".
    Cú pháp: [TOOL:system_control:{"action":"flush_dns"}]

21. workspace: Tổng hợp thông minh dữ liệu đã học trong SQLite hoặc tự động mở lại Workspace thói quen.
    Cú pháp: [TOOL:workspace:{"action":"briefing"}] hoặc [TOOL:workspace:{"action":"restore"}]

22. port_manager, git_status, clipboard_history:
    Cú pháp: [TOOL:port_manager:{"action":"list"}] / [TOOL:git_status:{}] / [TOOL:clipboard_history:{"action":"list"}]

23. macro, weather_3d, edge_peek, news, english, random_fx:
    Cú pháp: [TOOL:macro:{"action":"run","name":"chế độ code"}] / [TOOL:weather_3d:{"mode":"auto","city":"Hanoi"}] / [TOOL:news:{"source":"znews"}] / [TOOL:english:{"action":"learn/open_coach/lookup","topic":"random","word":""}] / [TOOL:random_fx:{}]

CHUỖI HÀNH ĐỘNG ĐA LỆNH (MULTI-TOOL CHAINING):
- Khi người dùng đưa ra câu lệnh gồm nhiều hành động nối tiếp nhau, hãy xuất NHIỀU THẺ TOOL LIÊN TIẾP trong cùng một câu trả lời để hệ thống thực thi tuần tự.
`;

function normalizeLooseJsonText(input: string): string {
  return input
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g, 'null')
    .replace(/,\s*([}\]])/g, '$1');
}

function repairAndParseLooseJson(rawText: string): Record<string, any> | null {
  const cleaned = normalizeLooseJsonText(rawText).trim();
  if (!cleaned) return null;

  const tryCandidates = (src: string): Record<string, any> | null => {
    try {
      const parsed = JSON.parse(src);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  };

  const direct = tryCandidates(cleaned);
  if (direct) return direct;

  // Sửa key không có ngoặc kép, dấu nháy đơn -> nháy kép, trailing comma, và đóng ngoặc bị LLM cắt cụt
  let repaired = cleaned
    .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
    .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"')
    .replace(/,\s*([}\]])/g, '$1');

  let quoteCount = 0;
  let esc = false;
  for (let i = 0; i < repaired.length; i += 1) {
    const ch = repaired[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === '\\') {
      esc = true;
      continue;
    }
    if (ch === '"') quoteCount += 1;
  }
  if (quoteCount % 2 === 1) repaired += '"';

  repaired = repaired.replace(/,\s*$/, '');
  let braceBalance = 0;
  let inString = false;
  esc = false;
  for (let i = 0; i < repaired.length; i += 1) {
    const ch = repaired[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === '\\' && inString) {
      esc = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{') braceBalance += 1;
      else if (ch === '}') braceBalance -= 1;
    }
  }
  while (braceBalance > 0) {
    repaired += '}';
    braceBalance -= 1;
  }

  return tryCandidates(repaired);
}

function parseRelaxedJsonParams(rawParam: string): Record<string, any> {
  const trimmed = normalizeLooseJsonText(rawParam).trim();
  if (!trimmed) return {};

  if (trimmed.startsWith('{')) {
    const parsed = repairAndParseLooseJson(trimmed);
    if (parsed) return parsed;
  }

  const kvPairs: Record<string, any> = {};
  const unwrapped = trimmed.startsWith('(') && trimmed.endsWith(')')
    ? trimmed.slice(1, -1).trim()
    : trimmed;
  const kvRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=|:)\s*(?:"([^"]*)"|'([^']*)'|([^,})\s]+))/g;
  let m: RegExpExecArray | null;
  let matchedKv = false;
  while ((m = kvRegex.exec(unwrapped)) !== null) {
    matchedKv = true;
    const val = (m[2] ?? m[3] ?? m[4] ?? '').trim();
    const numVal = Number(val);
    kvPairs[m[1].toLowerCase()] =
      val !== '' && !Number.isNaN(numVal) && /^-?\d+(?:\.\d+)?$/.test(val)
        ? numVal
        : val === 'true'
          ? true
          : val === 'false'
            ? false
            : val;
  }
  if (matchedKv) {
    kvPairs.raw = trimmed;
    return kvPairs;
  }

  return { target: trimmed, path: trimmed, action: trimmed, type: trimmed, raw: trimmed };
}

function scanBalancedJsonEnd(text: string, braceStart: number): number {
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = braceStart; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function parseAiToolCalls(text: string): { cleanText: string; toolCalls: ToolCallItem[] } {
  const toolCalls: ToolCallItem[] = [];
  const removeSpans: Array<[number, number]> = [];

  const prefixRegex = /(?:\[|\*\*|\b)(?:TOOL|TOOL_CALL):([a-zA-Z0-9_]+):?/gi;
  let match: RegExpExecArray | null;
  while ((match = prefixRegex.exec(text)) !== null) {
    const start = match.index;
    const name = match[1].trim().toLowerCase();
    let cursor = prefixRegex.lastIndex;
    while (cursor < text.length && (text[cursor] === ' ' || text[cursor] === '\t')) {
      cursor++;
    }

    let rawParam = '';
    if (text[cursor] === '{') {
      const endBrace = scanBalancedJsonEnd(text, cursor);
      if (endBrace !== -1) {
        rawParam = text.slice(cursor, endBrace + 1);
        cursor = endBrace + 1;
      } else {
        const nl = text.indexOf('\n', cursor);
        const end = nl === -1 ? text.length : nl;
        rawParam = text.slice(cursor, end).replace(/(?:\]|\*\*)+$/g, '').trim();
        cursor = end;
      }
    } else {
      let end = cursor;
      while (end < text.length && text[end] !== '\n' && text[end] !== ']' && text[end] !== '*') {
        end++;
      }
      rawParam = text.slice(cursor, end).trim();
      cursor = end;
    }

    while (cursor < text.length && (text[cursor] === ' ' || text[cursor] === '\t')) {
      if (text[cursor + 1] === ']' || text.slice(cursor + 1, cursor + 3) === '**') {
        cursor++;
      } else {
        break;
      }
    }
    if (text[cursor] === ']') cursor++;
    else if (text.slice(cursor, cursor + 2) === '**') cursor += 2;

    const params = parseRelaxedJsonParams(rawParam);
    toolCalls.push({ tool: name, params });
    removeSpans.push([start, cursor]);
    prefixRegex.lastIndex = Math.max(prefixRegex.lastIndex, cursor);
  }

  let cleanText = '';
  let lastIdx = 0;
  for (const [s, e] of removeSpans) {
    if (s > lastIdx) cleanText += text.slice(lastIdx, s);
    lastIdx = Math.max(lastIdx, e);
  }
  cleanText += text.slice(lastIdx);
  cleanText = cleanText.trim();

  cleanText = cleanText.replace(/(?:Hãy|Bạn hãy|Vui lòng)?\s*(?:chèn|nhập|gửi|cung cấp)\s*thẻ\s*(?:này|tool|công cụ)?\s*(?:vào|cho tôi xem)?[:\s]*/gi, '').trim();

  const actionRegex = /\[(?:[A-Z_]+:)?ACTION:([^\]]+)\]/gi;
  while ((match = actionRegex.exec(text)) !== null) {
    const spec = match[1].trim();
    if (spec.toLowerCase().startsWith('open_file:')) {
      toolCalls.push({ tool: 'open_file', params: { path: spec.slice(10).trim() } });
    } else if (spec.toLowerCase().startsWith('open:')) {
      toolCalls.push({ tool: 'open_app', params: { target: spec.slice(5).trim() } });
    } else if (['push_left', 'push_right', 'shrink', 'expand', 'minimize', 'maximize', 'split_2', 'grid', 'cascade', 'center', 'climb', 'explore', 'interact'].includes(spec)) {
      toolCalls.push({ tool: 'control_window', params: { action: spec } });
    }
  }
  cleanText = cleanText.replace(actionRegex, '').trim();

  const extractToolObj = (obj: Record<string, any> | null) => {
    if (!obj) return;
    const rawName = obj.tool ?? obj.name ?? obj.function?.name;
    if (!rawName) return;
    const rawArgs = obj.params ?? obj.arguments ?? obj.args ?? obj.function?.arguments ?? {};
    const params =
      typeof rawArgs === 'string'
        ? parseRelaxedJsonParams(rawArgs)
        : rawArgs && typeof rawArgs === 'object'
          ? rawArgs
          : {};
    toolCalls.push({ tool: String(rawName).trim().toLowerCase(), params });
  };

  const xmlToolCallRegex = /<tool_call(?:\s+name=["']?([^"'>\s]+)["']?)?\s*>([\s\S]*?)<\/tool_call>/gi;
  while ((match = xmlToolCallRegex.exec(text)) !== null) {
    const attrName = match[1]?.trim().toLowerCase();
    const inner = match[2].trim();
    const parsedObj = repairAndParseLooseJson(inner);
    if (parsedObj && (parsedObj.tool || parsedObj.name || parsedObj.function?.name)) {
      extractToolObj(parsedObj);
    } else if (attrName) {
      toolCalls.push({ tool: attrName, params: parseRelaxedJsonParams(inner) });
    }
  }
  cleanText = cleanText.replace(xmlToolCallRegex, '').trim();

  const codeBlockRegex = /```(?:json|tool)?\s*(\{[\s\S]*?(?:"tool"|"name"|tool\s*:|name\s*:)[\s\S]*?\})\s*```/gi;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    extractToolObj(repairAndParseLooseJson(match[1]));
  }
  cleanText = cleanText.replace(codeBlockRegex, '').trim();

  cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();
  return { cleanText, toolCalls };
}
