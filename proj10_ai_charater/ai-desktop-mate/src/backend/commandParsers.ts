import { AccessoryType } from '../characters/accessories3d';

function stripDiacriticsLocal(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function isQuestionOrMetaDiscussion(text: string): boolean {
  const clean = text.trim();
  if (!clean) return false;
  const norm = stripDiacriticsLocal(clean);

  const hasStrongFraming =
    /\b(?:tai sao|vi sao|sao no|sao lai|sao may|y la|la gi|nhu the nao|the nao|cach\s+(?:lam|dung|viet|tao|sua|xu ly|toi uu|hoc|cai)|huong dan|giai thich|so sanh|tu van|nen chon|khac gi|co tot khong|bi loi|loi gi|khong hieu|khong thong minh|xu ly sai|tai sao lai)\b/.test(
      norm
    );
  if (hasStrongFraming) return true;

  const words = norm.split(/\s+/).filter(Boolean);
  if (
    clean.endsWith('?') &&
    words.length >= 7 &&
    !/^(?:hay|giup|nho|mo|bat|tat|dong|xoa|don|chia|xep|tim|hen gio|chup|quet|gui|nhan tin|check|kiem tra|doc|tom tat|phan tich|dich|loc|them|sua)\b/.test(
      norm
    )
  ) {
    return true;
  }

  return false;
}

export function parseAccessoryCommand(
  text: string
): AccessoryType | 'random' | 'cycle' | null {
  if (isQuestionOrMetaDiscussion(text)) return null;
  const lower = text.toLowerCase().trim();
  const words = lower.split(/\s+/).filter(Boolean);
  if (
    lower.includes('tháo mũ') ||
    lower.includes('bỏ mũ') ||
    lower.includes('tháo kính') ||
    lower.includes('tháo phụ kiện') ||
    lower.includes('gỡ phụ kiện')
  ) {
    return 'none';
  }

  const hasEquipCue =
    /\b(?:đeo|deo|đội|doi|mặc|mac|gắn|gan|trang bị|trang bi|đổi|doi|bật|bat|cho vịt|cho vit|lên đầu|len dau|equip|wear)\b/i.test(
      lower
    ) || words.length <= 3;
  if (!hasEquipCue) return null;

  if (lower.includes('vương miện') || lower.includes('vuong mien') || lower.includes('crown')) {
    return 'crown';
  }
  if (lower.includes('đeo kính') || lower.includes('kính mát') || lower.includes('kính cyber') || lower.includes('visor')) {
    return 'cyber_visor';
  }
  if (lower.includes('tai nghe') || lower.includes('headset') || lower.includes('headphone')) {
    return 'headset';
  }
  if (lower.includes('chong chóng') || lower.includes('chong chong') || lower.includes('propeller')) {
    return 'propeller';
  }
  if (lower.includes('hào quang') || lower.includes('vòng thiên thần') || lower.includes('halo')) {
    return 'halo';
  }
  if (lower.includes('đổi mũ') || lower.includes('đổi phụ kiện') || lower.includes('đội mũ') || lower.includes('đội nón')) {
    return 'cycle';
  }
  return null;
}

export function parseDesktopIconCommand(
  text: string
): { mode: 'drag' | 'circle' | 'grid' | 'restore'; name?: string } | null {
  if (isQuestionOrMetaDiscussion(text)) return null;
  const lower = text.toLowerCase().trim();
  if (
    lower.includes('xếp icon vòng tròn') ||
    lower.includes('xep icon vong tron') ||
    lower.includes('vòng tròn icon')
  ) {
    return { mode: 'circle' };
  }
  if (
    lower.includes('xếp lưới icon') ||
    lower.includes('xếp icon lưới') ||
    lower.includes('sắp xếp icon') ||
    lower.includes('dọn icon')
  ) {
    return { mode: 'grid' };
  }
  if (
    lower.includes('trả vị trí icon') ||
    lower.includes('trả lại vị trí icon') ||
    lower.includes('khôi phục icon') ||
    lower.includes('reset icon')
  ) {
    return { mode: 'restore' };
  }

  if (lower.includes('kéo to') || lower.includes('cửa sổ')) {
    return null;
  }

  const iconActionRegex =
    /(?:kéo|di chuyển|dịch chuyển|tha|lôi|chuyển|đẩy|move|drag)\s+(?:icon|biểu tượng|app|ứng dụng|shortcut)?\s*([^\n]+)?/i;
  const m = text.match(iconActionRegex);
  if (!m) return null;

  const isIconVerbContext =
    /\b(?:icon|biểu tượng|bieu tuong|shortcut)\b|ngoài màn|ngoai man|trên màn|tren man|ngoài desktop|ngoai desktop|trên desktop|tren desktop/i.test(
      lower
    );

  if (!isIconVerbContext) return null;

  const cleanedName = (m[1] || '')
    .replace(
      /\b(?:icon|biểu tượng|app|ứng dụng|shortcut|này|kia|đi dạo|chỗ khác|vị trí khác|vị trí mới|ra chỗ khác|vào giữa|ngoài|trên|màn hình|desktop|cho tớ|cho bạn|giúp|hộ|với|nhé|nha|đi|qua|sang|tới|lên|xuống)\b/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();

  return { mode: 'drag', name: cleanedName };
}

export function parseTimerCommand(
  text: string
): { mode: 'start'; minutes: number; task: string } | { mode: 'stop' } | null {
  if (isQuestionOrMetaDiscussion(text)) return null;
  const lower = text.toLowerCase().trim();
  if (
    /^(?:tắt|hủy|huỷ|dừng|bỏ|ngừng|stop|cancel)\s+(?:hẹn giờ|hen gio|báo thức|bao thuc|đếm ngược|dem nguoc|timer|pomodoro)/i.test(
      lower
    )
  ) {
    return { mode: 'stop' };
  }

  const hasTimerVerb =
    /(?:hẹn giờ|hen gio|đặt giờ|dat gio|báo thức|bao thuc|đếm ngược|dem nguoc|nhắc tớ|nhắc mình|nhắc tôi|set timer|countdown)/i.test(
      lower
    );
  if (!hasTimerVerb) return null;

  const numMatch = lower.match(
    /(\d+(?:[.,]\d+)?)\s*(giây|giay|s\b|sec|phút|phut|p\b|min|giờ|gio|tiếng|tieng|h\b|hour)/i
  );
  if (!numMatch) return null;

  const rawNum = parseFloat(numMatch[1].replace(',', '.'));
  if (!Number.isFinite(rawNum) || rawNum <= 0) return null;

  const unit = numMatch[2].toLowerCase();
  let minutes = rawNum;
  if (unit.startsWith('giây') || unit.startsWith('giay') || unit === 's' || unit.startsWith('sec')) {
    minutes = rawNum / 60;
  } else if (unit.startsWith('giờ') || unit.startsWith('gio') || unit.startsWith('tiếng') || unit.startsWith('tieng') || unit === 'h' || unit.startsWith('hour')) {
    minutes = rawNum * 60;
  }

  const taskMatch = text.match(/(?:để|nhắc|rằng|nội dung|:)\s*([^\n]+)$/i);
  const rawAfterTime = text.slice((numMatch.index ?? 0) + numMatch[0].length).trim();
  const cleanedTask = (taskMatch?.[1] || rawAfterTime || 'Hẹn giờ')
    .replace(/\b(?:nữa|sau|giúp tớ|giúp mình|hộ|với|nhé|nha|đi|nhắc tớ|nhắc mình|nhắc tôi)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    mode: 'start',
    minutes,
    task: cleanedTask || 'Hẹn giờ',
  };
}

export function parseProcessCommand(
  text: string
): { action: 'top' | 'kill'; target: string } | null {
  if (isQuestionOrMetaDiscussion(text)) return null;
  const lower = text.toLowerCase().trim();
  if (
    /(?:top|xem|kiểm tra|check|liệt kê|ứng dụng nào|app nào|tiến trình nào).*(?:ngốn ram|ngon ram|chiếm ram|chiem ram|ngốn cpu|ngon cpu|tiến trình|tien trinh|process)/i.test(
      lower
    ) ||
    lower === 'top ram' ||
    lower === 'top process'
  ) {
    return { action: 'top', target: '' };
  }

  const killMatch = text.match(
    /^(?:đóng|dong|tắt|tat|kill|buộc dừng|buoc dung|thoát|thoat)\s+(?:tiến trình|tien trinh|process|app|ứng dụng|ung dung)?\s*([^\n?!.]+)$/i
  );
  if (!killMatch?.[1]) return null;

  const hasExplicitProcKeyword = /(?:tiến trình|tien trinh|process|app|ứng dụng|ung dung)/i.test(
    text
  );
  const target = killMatch[1]
    .replace(/\b(?:giúp|hộ|cho tớ|cho mình|đi|nhé|nha|ngay)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tLower = target.toLowerCase();
  const targetWords = target.split(/\s+/).filter(Boolean);
  if (
    !target ||
    /^(?:tiếng|tieng|âm|am|nhạc|nhac|màn hình|man hinh|hẹn giờ|hen gio|pomodoro|phụ kiện|phu kien|bảng|cửa sổ|ứng dụng|app|tiến trình|máy|tất cả)$/i.test(
      tLower
    )
  ) {
    return null;
  }
  if (
    !hasExplicitProcKeyword &&
    (targetWords.length > 2 ||
      target.length > 22 ||
      /^(?:góp|gop|bớt|bot|cột|cot|dòng|dong|file|tệp|tep|ý kiến|y kien|hết|het|bình luận|comment)\b/i.test(
        target
      ))
  ) {
    return null;
  }
  return { action: 'kill', target };
}

export function parseWebSearchCommand(
  text: string
): { engine: string; query: string } | null {
  if (isQuestionOrMetaDiscussion(text)) return null;
  const lower = text.toLowerCase().trim();
  if (/\b(?:tìm hiểu|tim hieu)\b/i.test(lower)) return null;
  if (!/(?:youtube|youtobe|github|stackoverflow|stack overflow|google|\bgg\b)/i.test(lower)) {
    return null;
  }
  const m = text.match(
    /(?:tìm kiếm|tim kiem|tìm|tim|tra|search)\s+(?:trên\s+|ở\s+|bằng\s+)?(youtube|youtobe|github|stackoverflow|stack overflow|google|gg)\s*(?:từ khóa|ve|về|:)?\s*(.+)$/i
  );
  if (!m?.[1] || !m?.[2]) return null;
  const eng = m[1].toLowerCase().replace(/\s+/g, '');
  const query = m[2]
    .replace(/\b(?:giúp|hộ|tớ|mình|nhé|nha|với|lên)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!query || query.length < 2) return null;
  return {
    engine: eng === 'youtobe' ? 'youtube' : eng === 'gg' ? 'google' : eng,
    query,
  };
}

export function parseStickyNoteCommand(
  text: string
):
  | { mode: 'clear' }
  | { mode: 'open' }
  | { mode: 'pin'; text: string; saveDesktop: boolean; scheduleTime: string; repeatDaily: boolean }
  | null {
  if (isQuestionOrMetaDiscussion(text)) return null;
  const lower = text.toLowerCase().trim();
  if (
    /(?:xóa hết|xoa het|dọn sạch|clear)\s+(?:note|ghi chú|ghi chu|sticky|lịch hẹn|lich hen)/i.test(
      lower
    )
  ) {
    return { mode: 'clear' };
  }
  if (
    /^(?:mở|xem|bật|hiện)\s+(?:bảng\s+)?(?:ghim note|ghi chú|lịch hẹn|lich hen|sticky note)$/i.test(
      lower
    )
  ) {
    return { mode: 'open' };
  }

  const timeMatch = text.match(/\b(\d{1,2})[:hg](\d{2})?\b/i);
  let scheduleTime = '';
  if (timeMatch?.[1]) {
    const hh = Number(timeMatch[1]);
    const mm = timeMatch[2] ? Number(timeMatch[2]) : 0;
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      scheduleTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
  }
  const repeatDaily = /(?:hàng ngày|hằng ngày|mỗi ngày|daily|every day)/i.test(lower);

  const m = text.match(
    /(?:ghim note|ghim ghi chú|ghim ghi chu|sticky note|tạo ghi chú|tao ghi chu|lưu note|luu note|lưu ghi chú|luu ghi chu|viết note|viet note|đặt lịch|dat lich|lịch hẹn|lich hen|nhắc việc|nhac viec|nhắc nhở lúc|nhắc tớ lúc|nhắc mình lúc|nhắc lúc)\s*(?:ra desktop|lên màn hình|nổi|lúc)?\s*[:\-]?\s*(.+)$/i
  );
  if (!m?.[1]) return null;

  let cleanText = m[1].trim();
  if (scheduleTime && timeMatch?.[0]) {
    cleanText = cleanText.replace(timeMatch[0], ' ');
  }
  cleanText = cleanText
    .replace(/\b(?:hàng ngày|hằng ngày|mỗi ngày|daily|lúc|vào lúc|nhắc tớ|nhắc mình|nhắc tôi)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText || cleanText.length < 2) return null;
  const saveDesktop =
    lower.includes('desktop') || lower.includes('ra file') || lower.includes('lưu file');
  return { mode: 'pin', text: cleanText, saveDesktop, scheduleTime, repeatDaily };
}

export function parseDeepSystemCommand(
  text: string
): { action: string; param: string } | null {
  if (isQuestionOrMetaDiscussion(text)) return null;
  const lower = text.toLowerCase().trim();
  if (
    lower.includes('dọn thùng rác') ||
    lower.includes('xóa thùng rác') ||
    lower.includes('empty recycle bin') ||
    lower.includes('dọn recycle bin')
  ) {
    return { action: 'empty_recycle_bin', param: '' };
  }
  if (
    lower.includes('đóng app treo') ||
    lower.includes('tắt app treo') ||
    lower.includes('ứng dụng bị treo') ||
    lower.includes('not responding') ||
    lower.includes('kill hung')
  ) {
    return { action: 'kill_unresponsive', param: '' };
  }
  if (lower.includes('flush dns') || lower.includes('làm mới dns') || lower.includes('reset dns')) {
    return { action: 'flush_dns', param: '' };
  }
  if (lower.includes('hủy tắt máy') || lower.includes('huy tat may') || lower.includes('cancel shutdown')) {
    return { action: 'cancel_shutdown', param: '' };
  }
  const shutMatch = lower.match(/(?:hẹn giờ tắt máy|tắt máy sau|shutdown)\s*(\d+)/i);
  if (shutMatch?.[1]) {
    return { action: 'shutdown_timer', param: shutMatch[1] };
  }
  if (lower.includes('hiệu năng cao') || lower.includes('high performance')) {
    return { action: 'power_high', param: '' };
  }
  if (lower.includes('tiết kiệm pin') || lower.includes('power saver')) {
    return { action: 'power_saver', param: '' };
  }
  if (lower.includes('nguồn cân bằng') || lower.includes('balanced power')) {
    return { action: 'power_balanced', param: '' };
  }
  if (lower.includes('device manager') || lower.includes('trình quản lý thiết bị')) {
    return { action: 'open_panel', param: 'devmgmt' };
  }
  if (lower.includes('disk management') || lower.includes('quản lý ổ đĩa')) {
    return { action: 'open_panel', param: 'diskmgmt' };
  }
  if (lower.includes('resource monitor')) {
    return { action: 'open_panel', param: 'resmon' };
  }
  if (lower.includes('services') && (lower.includes('mở') || lower.includes('xem'))) {
    return { action: 'open_panel', param: 'services' };
  }
  if (lower.includes('startup apps') || lower.includes('ứng dụng khởi động')) {
    return { action: 'open_panel', param: 'startup' };
  }
  if (lower.includes('bluetooth') && (lower.includes('mở') || lower.includes('cài đặt'))) {
    return { action: 'open_panel', param: 'bluetooth' };
  }
  if (lower.includes('cài đặt âm thanh') || lower.includes('sound settings')) {
    return { action: 'open_panel', param: 'sound' };
  }
  if (lower.includes('windows update') || lower.includes('cập nhật windows')) {
    return { action: 'open_panel', param: 'update' };
  }
  return null;
}

export function parseWorkspaceCommand(text: string): { autoRestore: boolean } | null {
  const lower = text.toLowerCase().trim();
  const isScheduleReadQuery =
    lower.includes('hôm nay có lịch gì') || lower.includes('kiểm tra lịch hẹn');
  if (!isScheduleReadQuery && isQuestionOrMetaDiscussion(text)) return null;
  if (
    lower.includes('khôi phục workspace') ||
    lower.includes('mở app thói quen') ||
    lower.includes('mở workspace')
  ) {
    return { autoRestore: true };
  }
  if (
    lower.includes('trợ lý db') ||
    lower.includes('hỗ trợ hôm nay') ||
    lower.includes('hôm nay có lịch gì') ||
    lower.includes('tóm tắt lịch hẹn') ||
    lower.includes('kiểm tra lịch hẹn')
  ) {
    return { autoRestore: false };
  }
  return null;
}

export function parseClipboardCommand(
  text: string
): { action: 'read' | 'summarize' | 'translate' | 'copy'; text: string } | null {
  if (isQuestionOrMetaDiscussion(text)) return null;
  const lower = text.toLowerCase().trim();
  if (!lower.includes('clipboard') && !lower.includes('bộ nhớ tạm')) {
    return null;
  }
  if (
    !/(?:đọc|doc|xem|kiểm tra|kiem tra|check|dịch|dich|tóm tắt|tom tat|giải thích|giai thich|copy|chép|chep|ghi|lưu|luu|read|summarize|translate)/i.test(
      lower
    )
  ) {
    return null;
  }

  const copyMatch = text.match(
    /(?:copy|chép|chep|ghi|lưu)\s+(?:vào\s+|vao\s+)?(?:clipboard|bộ nhớ tạm)\s*[:\-]?\s*(.+)$/i
  );
  if (copyMatch?.[1] && copyMatch[1].trim().length > 0) {
    return { action: 'copy', text: copyMatch[1].trim() };
  }
  if (lower.includes('dịch') || lower.includes('dich') || lower.includes('translate')) {
    return { action: 'translate', text: '' };
  }
  if (
    lower.includes('tóm tắt') ||
    lower.includes('tom tat') ||
    lower.includes('giải thích') ||
    lower.includes('giai thich') ||
    lower.includes('summarize')
  ) {
    return { action: 'summarize', text: '' };
  }
  return { action: 'read', text: '' };
}
