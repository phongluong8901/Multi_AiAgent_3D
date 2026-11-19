import * as THREE from 'three';

export interface WinRect {
  hwnd: number;
  title: string;
  process_name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  is_maximized?: boolean;
}

export interface FrameZone {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  ledge_offset_y: number;
}

export type AccessoryType =
  | 'none'
  | 'crown'
  | 'cyber_visor'
  | 'headset'
  | 'propeller'
  | 'halo'
  | 'sun_hat_glasses'
  | 'rain_umbrella'
  | 'winter_beanie';

export interface DesktopState {
  windows: WinRect[];
  active_hwnd: number;
  cursor_x: number;
  cursor_y: number;
  audio_peak?: number;
  key_press_total?: number;
  cursor_idle_ms?: number;
}

export type CharacterState =
  | 'IDLE'
  | 'WALKING'
  | 'SITTING_WINDOW'
  | 'DRAGGING'
  | 'FALLING'
  | 'JUMPING'
  | 'DANCING'
  | 'WAVING'
  | 'HEADPAT'
  | 'PUSHING'
  | 'PULLING'
  | 'SCANNING'
  | 'ALERT'
  | 'EATING'
  | 'TIRED'
  | 'CLIMBING'
  | 'PARACHUTING'
  | 'BACKFLIP'
  | 'SPIN'
  | 'RADAR'
  | 'FLYING_ROCKET'
  | 'FISHING'
  | 'SWIMMING'
  | 'SWINGING_WINDOW'
  | 'BUTT_PLANT'
  | 'SLEEP';

export type FaceExpression = 'neutral' | 'happy' | 'surprised' | 'sad' | 'blink' | 'talk';

export interface ParticleItem {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  baseScale?: number;
}

export interface DragSample {
  x: number;
  y: number;
  t: number;
}

export interface HardwareInfo {
  cpu_name: string;
  cpu_load_pct: number;
  ram_total_gb: number;
  ram_used_gb: number;
  ram_used_pct: number;
  gpu_name: string;
  disk_free_gb: number;
  disk_total_gb: number;
  battery_pct?: number;
  battery_charging?: boolean;
  top_processes?: string;
}

export interface AppProcessMetrics {
  pid: number;
  app_cpu_pct: number;
  app_ram_mb: number;
  app_peak_ram_mb: number;
  app_virtual_mem_mb: number;
  app_handles: number;
  system_cpu_cores: number;
  system_ram_total_gb: number;
  system_ram_used_gb: number;
  system_ram_used_pct: number;
  uptime_seconds: number;
}

export interface NetworkInfo {
  internet_ok: boolean;
  latency_ms: number;
  ollama_ok: boolean;
  local_ip?: string;
  wifi_ssid?: string;
  conn_summary?: string;
}

export interface WeatherInfo {
  location: string;
  temp_c: number;
  feels_like_c: number;
  humidity_pct: number;
  wind_kmh: number;
  description: string;
}

export interface BitcoinInfo {
  price_usd: number;
  change_24h_pct: number;
  source: string;
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProfileFact {
  key: string;
  value: string;
  updated_at: number;
}

export interface ChatEntry {
  role: string;
  content: string;
  created_at: number;
}

export interface AppUsageStat {
  app_title: string;
  total_sec: number;
}

export interface HabitPattern {
  app_title: string;
  hour_of_day: number;
  days_count: number;
  total_sec: number;
  accepted_count: number;
  dismissed_count: number;
  last_shown_at: number;
}

export interface MemoryInsights {
  db_ready: boolean;
  db_path: string;
  profile_facts: ProfileFact[];
  top_apps_today: AppUsageStat[];
  habit_for_hour: HabitPattern | null;
  total_chat_count: number;
}

export interface BrowserItem {
  title: string;
  url: string;
  visit_count: number;
}

export interface BrowserInsights {
  browser_name: string;
  top_youtube: BrowserItem[];
  top_sites: BrowserItem[];
}

export interface OcrResultInfo {
  image_path: string;
  raw_text: string;
}

export interface OcrRegionResult {
  image_path: string;
  image_base64: string;
  raw_text: string;
  width: number;
  height: number;
}

export interface TranslateResult {
  translated_text: string;
  detected_lang: string;
  engine: string;
}

export interface LongMemoryEntry {
  id: number;
  category: 'persona' | 'rule' | 'knowledge' | string;
  title: string;
  content: string;
  enabled: boolean;
  updated_at: number;
}

export interface ActiveWindowTask {
  hwnd: number;
  mode: 'push' | 'expand' | 'shrink';
  phase: 'approaching' | 'acting';
  targetX: number;
  targetY: number;
  dirX: number; // +1 phải, -1 trái
  stepsRemaining: number;
  stepTimer: number;
  side: 'left' | 'right';
}

export type WeatherEffectMode = 'clear' | 'rain' | 'hot' | 'cold' | 'wind' | 'night';

export interface ClipboardHistoryEntry {
  id: number;
  content: string;
  created_at: number;
}

export interface MacroEntry {
  id: number;
  trigger_name: string;
  actions_json: string;
  updated_at: number;
}

export interface ScheduledNoteEntry {
  id: number;
  content: string;
  schedule_time: string;
  repeat_daily: boolean;
  is_done: boolean;
  last_triggered_date: string;
  created_at: number;
}

export interface NewsArticleItem {
  title: string;
  link: string;
  source: string;
  pub_date: string;
  summary: string;
}

export interface EnglishVocabItem {
  word: string;
  phonetic: string;
  part_of_speech: string;
  definition_en: string;
  meaning_vi: string;
  example_en: string;
  example_vi: string;
  audio_url: string;
  topic: string;
  synonyms: string[];
}

export interface NumericColStat {
  column: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  sum: number;
}

export interface ChartBarItem {
  label: string;
  value: number;
}

export interface ColumnChartSeries {
  column_name: string;
  unit_or_kind: string;
  points: ChartBarItem[];
}

export interface IngestedFileAnalysis {
  file_name: string;
  file_path: string;
  file_type: string;
  file_size_kb: number;
  row_count: number;
  col_count: number;
  columns: string[];
  sample_rows: string[][];
  numeric_stats: NumericColStat[];
  chart_series: ChartBarItem[];
  column_charts: ColumnChartSeries[];
  raw_excerpt: string;
  quick_overview: string;
}

export type AutoBehaviorKey =
  | 'walk_roam'
  | 'wheel_roll'
  | 'wave'
  | 'dance'
  | 'backflip'
  | 'spin'
  | 'radar_scan'
  | 'sleep'
  | 'feed_food'
  | 'accessory_hat'
  | 'special_fx'
  | 'rocket_parachute'
  | 'black_hole'
  | 'jump_window'
  | 'window_swing'
  | 'window_push_resize'
  | 'swim_pool'
  | 'territory_defense'
  | 'goose_mischief'
  | 'beat_dance'
  | 'drag_desktop_icon';

export type AutoBehaviorConfig = Record<AutoBehaviorKey, boolean>;

export interface AutoBehaviorMeta {
  key: AutoBehaviorKey;
  label: string;
  group: 'basic' | 'action';
  defaultEnabled: boolean;
}

export const AUTO_BEHAVIOR_CATALOG: AutoBehaviorMeta[] = [
  { key: 'walk_roam', label: 'Đi dạo quanh màn hình', group: 'basic', defaultEnabled: true },
  { key: 'wheel_roll', label: 'Gập người lướt bánh xe', group: 'basic', defaultEnabled: true },
  { key: 'wave', label: 'Vẫy tay chào & Biểu cảm', group: 'basic', defaultEnabled: true },
  { key: 'dance', label: 'Nhảy Idol 3D', group: 'basic', defaultEnabled: true },
  { key: 'backflip', label: 'Lộn nhào 360 độ', group: 'basic', defaultEnabled: true },
  { key: 'spin', label: 'Xoay tít Turbo', group: 'basic', defaultEnabled: true },
  { key: 'radar_scan', label: 'Quét đĩa Radar 3D', group: 'basic', defaultEnabled: true },
  { key: 'sleep', label: 'Ngủ đông nghỉ ngơi', group: 'basic', defaultEnabled: true },
  { key: 'feed_food', label: 'Thả đồ ăn & Chạy ăn', group: 'basic', defaultEnabled: true },
  { key: 'accessory_hat', label: 'Đổi Phụ kiện 3D', group: 'basic', defaultEnabled: true },
  { key: 'special_fx', label: 'Hiệu ứng 3D (Sao băng / Pháo hoa)', group: 'basic', defaultEnabled: true },
  { key: 'rocket_parachute', label: 'Rocket Bay & Nhảy Dù Nóc', group: 'action', defaultEnabled: true },
  { key: 'black_hole', label: 'Hố Đen Vũ Trụ dịch chuyển', group: 'action', defaultEnabled: true },
  { key: 'jump_window', label: 'Nhảy lên mép cửa sổ', group: 'action', defaultEnabled: true },
  { key: 'window_swing', label: 'Đu Cửa Sổ (Tay dài & Dập mông)', group: 'action', defaultEnabled: true },
  { key: 'window_push_resize', label: 'Đẩy & Co giãn cửa sổ', group: 'action', defaultEnabled: true },
  { key: 'swim_pool', label: 'Hồ Bơi 3D & Đi Bơi Ra Xa', group: 'action', defaultEnabled: true },
  { key: 'territory_defense', label: 'Bảo Vệ Lãnh Thổ (Kiếm / UFO)', group: 'action', defaultEnabled: true },
  { key: 'goose_mischief', label: 'Vịt Tinh Nghịch (Goose Mode)', group: 'action', defaultEnabled: true },
  { key: 'beat_dance', label: 'Nhảy theo nhạc & Cổ vũ gõ phím', group: 'action', defaultEnabled: true },
  { key: 'drag_desktop_icon', label: 'Kéo Icon Desktop đi dạo', group: 'action', defaultEnabled: false },
];

export function createDefaultAutoBehaviors(): AutoBehaviorConfig {
  const result = {} as AutoBehaviorConfig;
  for (const item of AUTO_BEHAVIOR_CATALOG) {
    result[item.key] = item.defaultEnabled;
  }
  return result;
}


