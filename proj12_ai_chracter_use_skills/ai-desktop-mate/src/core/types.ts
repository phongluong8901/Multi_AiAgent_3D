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
  audio_left?: number;
  audio_right?: number;
  audio_beat_seq?: number;
  audio_bpm?: number;
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
  weather_code?: number;
  is_day?: boolean;
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
  level?: string;
  mastery_level?: number;
  next_review_at?: number;
  correct_count?: number;
  wrong_count?: number;
  is_starred?: boolean;
  learned_at?: number;
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
  | 'drag_desktop_icon'
  | 'clip_ai_thinking_orbit'
  | 'clip_chat_explain'
  | 'clip_wing_flutter_joy'
  | 'clip_poke_giggle'
  | 'clip_cyber_salute'
  | 'clip_dizzy_spin'
  | 'clip_celebrate_backhop'
  | 'clip_focus_guard'
  | 'clip_gym_pump'
  | 'clip_super_saiyan_charge'
  | 'clip_paparazzi_pose'
  | 'clip_hologram_code'
  | 'clip_royal_parade'
  | 'clip_love_serenade'
  | 'clip_curious_inspect'
  | 'clip_happy_wiggle'
  | 'clip_startled_hop'
  | 'clip_shy_sit'
  | 'clip_polite_bow'
  | 'clip_wake_stretch'
  | 'clip_stalking_crouch'
  | 'clip_proud_carry'
  | 'clip_dramatic_flop'
  | 'clip_reading_study'
  | 'clip_pipe_ponder'
  | 'clip_eureka_idea'
  | 'clip_coffee_sip'
  | 'clip_detective_scan'
  | 'clip_idle_alive'
  | 'clip_sleepy_doze'
  | 'clip_nod'
  | 'clip_head_shake'
  | 'clip_hop'
  | 'clip_victory'
  | 'clip_bow'
  | 'clip_think'
  | 'clip_shiver'
  | 'clip_typing'
  | 'clip_peek'
  | 'clip_surprise'
  | 'clip_sad'
  | 'clip_twirl'
  | 'clip_heartbeat'
  | 'clip_sneeze'
  | 'clip_groove'
  | 'clip_chomp'
  | 'clip_stretch'
  | 'clip_front_flip'
  | 'clip_jelly'
  | 'clip_levitate'
  | 'clip_scan_look'
  | 'clip_facepalm'
  | 'clip_cheer'
  | 'clip_weather_shiver'
  | 'clip_weather_breeze'
  | 'clip_weather_sunbathe';

export type AutoBehaviorConfig = Record<AutoBehaviorKey, boolean>;

export interface AutoBehaviorMeta {
  key: AutoBehaviorKey;
  label: string;
  group: 'basic' | 'action' | 'clip3d';
  defaultEnabled: boolean;
  clipId?: string;
}

export const AUTO_BEHAVIOR_CATALOG: AutoBehaviorMeta[] = [
  // Nhóm Hoạt ảnh Đa Pha & Đạo cụ 3D Mới (28)
  { key: 'clip_ai_thinking_orbit', label: 'Suy Luận AI & Hologram 3D', group: 'clip3d', defaultEnabled: true, clipId: 'ai_thinking_orbit' },
  { key: 'clip_chat_explain', label: 'Giảng Giải Vẫy Cánh', group: 'clip3d', defaultEnabled: true, clipId: 'chat_explain' },
  { key: 'clip_wing_flutter_joy', label: 'Vỗ Cánh Phấn Khích', group: 'clip3d', defaultEnabled: true, clipId: 'wing_flutter_joy' },
  { key: 'clip_poke_giggle', label: 'Khúc Khích & Trái Tim 3D', group: 'clip3d', defaultEnabled: true, clipId: 'poke_giggle' },
  { key: 'clip_cyber_salute', label: 'Chào Quân Đội & Vương Miện 3D', group: 'clip3d', defaultEnabled: true, clipId: 'cyber_salute' },
  { key: 'clip_dizzy_spin', label: 'Chóng Mặt Loạng Choạng', group: 'clip3d', defaultEnabled: true, clipId: 'dizzy_spin' },
  { key: 'clip_celebrate_backhop', label: 'Bật Nhảy Ăn Mừng', group: 'clip3d', defaultEnabled: true, clipId: 'celebrate_backhop' },
  { key: 'clip_focus_guard', label: 'Canh Gác Tập Trung', group: 'clip3d', defaultEnabled: true, clipId: 'focus_guard' },
  { key: 'clip_gym_pump', label: 'Tập Tạ Thể Lực 3D', group: 'clip3d', defaultEnabled: true, clipId: 'gym_pump' },
  { key: 'clip_super_saiyan_charge', label: 'Tụ Khí Sấm Sét 3D', group: 'clip3d', defaultEnabled: true, clipId: 'super_saiyan_charge' },
  { key: 'clip_paparazzi_pose', label: 'Chụp Ảnh Flash 3D', group: 'clip3d', defaultEnabled: true, clipId: 'paparazzi_pose' },
  { key: 'clip_hologram_code', label: 'Thao Tác Hologram 3D', group: 'clip3d', defaultEnabled: true, clipId: 'hologram_code' },
  { key: 'clip_royal_parade', label: 'Diễu Hành Hoàng Gia 3D', group: 'clip3d', defaultEnabled: true, clipId: 'royal_parade' },
  { key: 'clip_love_serenade', label: 'Bắn Tim Yêu Thương 3D', group: 'clip3d', defaultEnabled: true, clipId: 'love_serenade' },
  { key: 'clip_curious_inspect', label: 'Tò Mò Quan Sát (? 3D)', group: 'clip3d', defaultEnabled: true, clipId: 'curious_inspect' },
  { key: 'clip_happy_wiggle', label: 'Nhún Nhảy & Nốt Nhạc 3D', group: 'clip3d', defaultEnabled: true, clipId: 'happy_wiggle' },
  { key: 'clip_startled_hop', label: 'Giật Mình Nảy Bật (! 3D)', group: 'clip3d', defaultEnabled: true, clipId: 'startled_hop' },
  { key: 'clip_shy_sit', label: 'Dỗi & Ngại Ngùng', group: 'clip3d', defaultEnabled: true, clipId: 'shy_sit' },
  { key: 'clip_polite_bow', label: 'Cúi Chào Lễ Phép', group: 'clip3d', defaultEnabled: true, clipId: 'polite_bow' },
  { key: 'clip_wake_stretch', label: 'Thức Dậy Vươn Vai', group: 'clip3d', defaultEnabled: true, clipId: 'wake_stretch' },
  { key: 'clip_stalking_crouch', label: 'Rình Mồi Rón Rén', group: 'clip3d', defaultEnabled: true, clipId: 'stalking_crouch' },
  { key: 'clip_proud_carry', label: 'Khoe Cúp Vàng 3D', group: 'clip3d', defaultEnabled: true, clipId: 'proud_carry' },
  { key: 'clip_dramatic_flop', label: 'Ăn Vạ / Giả Chết', group: 'clip3d', defaultEnabled: true, clipId: 'dramatic_flop' },
  { key: 'clip_reading_study', label: 'Đọc 3 Cuốn Sách 3D', group: 'clip3d', defaultEnabled: true, clipId: 'reading_study' },
  { key: 'clip_pipe_ponder', label: 'Hút Tẩu Khói Tròn 3D', group: 'clip3d', defaultEnabled: true, clipId: 'pipe_ponder' },
  { key: 'clip_eureka_idea', label: 'Bóng Đèn Ý Tưởng 3D', group: 'clip3d', defaultEnabled: true, clipId: 'eureka_idea' },
  { key: 'clip_coffee_sip', label: 'Thưởng Thức Cà Phê 3D', group: 'clip3d', defaultEnabled: true, clipId: 'coffee_sip' },
  { key: 'clip_detective_scan', label: 'Kính Lúp Thám Tử 3D', group: 'clip3d', defaultEnabled: true, clipId: 'detective_scan' },
  { key: 'clip_idle_alive', label: 'Thở & Quan Sát Tự Nhiên', group: 'clip3d', defaultEnabled: true, clipId: 'idle_alive' },
  { key: 'clip_sleepy_doze', label: 'Ngủ Gật & Bong Bóng Zzz 3D', group: 'clip3d', defaultEnabled: true, clipId: 'sleepy_doze' },
  { key: 'clip_nod', label: 'Gật Đầu Đồng Ý', group: 'clip3d', defaultEnabled: true, clipId: 'nod' },
  { key: 'clip_head_shake', label: 'Lắc Đầu Từ Chối', group: 'clip3d', defaultEnabled: true, clipId: 'head_shake' },
  { key: 'clip_hop', label: 'Nhảy Chân Sáo Đàn Hồi', group: 'clip3d', defaultEnabled: true, clipId: 'hop' },
  { key: 'clip_victory', label: 'Ăn Mừng Cúp Vàng 360', group: 'clip3d', defaultEnabled: true, clipId: 'victory' },
  { key: 'clip_bow', label: 'Cúi Gập Người Nhanh', group: 'clip3d', defaultEnabled: true, clipId: 'bow' },
  { key: 'clip_think', label: 'Suy Nghĩ Trầm Tư (Tẩu 3D)', group: 'clip3d', defaultEnabled: true, clipId: 'think' },
  { key: 'clip_shiver', label: 'Run Rẩy Sợ Hãi', group: 'clip3d', defaultEnabled: true, clipId: 'shiver' },
  { key: 'clip_typing', label: 'Gõ Phím Hacker Liên Hồi', group: 'clip3d', defaultEnabled: true, clipId: 'typing' },
  { key: 'clip_peek', label: 'Ngó Nghiêng Quan Sát', group: 'clip3d', defaultEnabled: true, clipId: 'peek' },
  { key: 'clip_surprise', label: 'Ngạc Nhiên Nảy Bật (! 3D)', group: 'clip3d', defaultEnabled: true, clipId: 'surprise' },
  { key: 'clip_sad', label: 'Buồn Xìu Ỉu Xìu', group: 'clip3d', defaultEnabled: true, clipId: 'sad' },
  { key: 'clip_twirl', label: 'Xoay Vòng Ballet 360', group: 'clip3d', defaultEnabled: true, clipId: 'twirl' },
  { key: 'clip_heartbeat', label: 'Tim Đập Rộn Ràng', group: 'clip3d', defaultEnabled: true, clipId: 'heartbeat' },
  { key: 'clip_sneeze', label: 'Hắt Xì Hơi Vui Nhộn', group: 'clip3d', defaultEnabled: true, clipId: 'sneeze' },
  { key: 'clip_groove', label: 'Lắc Lư Groove Nhịp Điệu', group: 'clip3d', defaultEnabled: true, clipId: 'groove' },
  { key: 'clip_chomp', label: 'Đớp Đớp Thèm Ăn', group: 'clip3d', defaultEnabled: true, clipId: 'chomp' },
  { key: 'clip_stretch', label: 'Duỗi Thân Vươn Cao', group: 'clip3d', defaultEnabled: true, clipId: 'stretch' },
  { key: 'clip_front_flip', label: 'Lộn Nhào Mini 360', group: 'clip3d', defaultEnabled: true, clipId: 'front_flip' },
  { key: 'clip_jelly', label: 'Rung Thạch Jelly Đàn Hồi', group: 'clip3d', defaultEnabled: true, clipId: 'jelly' },
  { key: 'clip_levitate', label: 'Bay Lơ Lửng Thiền 3D', group: 'clip3d', defaultEnabled: true, clipId: 'levitate' },
  { key: 'clip_scan_look', label: 'Quét Mắt Toàn Cảnh (Kính Lúp)', group: 'clip3d', defaultEnabled: true, clipId: 'scan_look' },
  { key: 'clip_facepalm', label: 'Ôm Đầu Thất Vọng', group: 'clip3d', defaultEnabled: true, clipId: 'facepalm' },
  { key: 'clip_cheer', label: 'Cổ Vũ Nhiệt Tình (Nốt Nhạc 3D)', group: 'clip3d', defaultEnabled: true, clipId: 'cheer' },
  { key: 'clip_weather_shiver', label: 'Co Ro Trời Lạnh & Tuyết', group: 'clip3d', defaultEnabled: true, clipId: 'weather_shiver' },
  { key: 'clip_weather_breeze', label: 'Nghiêng Mình Đón Gió', group: 'clip3d', defaultEnabled: true, clipId: 'weather_breeze' },
  { key: 'clip_weather_sunbathe', label: 'Tắm Nắng Khoan Khoái', group: 'clip3d', defaultEnabled: true, clipId: 'weather_sunbathe' },

  // Nhóm Cơ bản (11)
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
  { key: 'special_fx', label: 'Hiệu ứng 3D (9 loại FX)', group: 'basic', defaultEnabled: true },

  // Nhóm Kỹ năng 3D & Tương tác Màn hình (10)
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

export interface SkillParamDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  default?: unknown;
}

export interface CustomSkillRecord {
  id: string;
  name: string;
  description: string;
  language: 'powershell' | 'python' | string;
  triggers_json: string;
  params_schema_json: string;
  code: string;
  test_args_json: string;
  expected_keywords_json: string;
  version: number;
  verified: boolean;
  code_hash: string;
  last_test_output: string;
  last_test_ms: number;
  usage_count: number;
  heal_count: number;
  last_heal_note: string;
  enabled: boolean;
  created_at: number;
  updated_at: number;
}

export interface SandboxRunResult {
  verified: boolean;
  static_safe: boolean;
  safety_issues: string[];
  exit_code: number;
  timed_out: boolean;
  duration_ms: number;
  stdout: string;
  stderr: string;
  code_hash: string;
  failure_reason: string;
}

export interface SkillExecResult {
  ok: boolean;
  skill_id: string;
  exit_code: number;
  timed_out: boolean;
  duration_ms: number;
  stdout: string;
  stderr: string;
  error_summary: string;
}

export interface ToolForgeDraft {
  id: string;
  name: string;
  description: string;
  language: 'powershell' | 'python';
  triggers: string[];
  paramsSchema: SkillParamDef[];
  code: string;
  testArgsJson: string;
  expectedKeywords: string[];
  sandbox: SandboxRunResult | null;
  liveTest?: SkillExecResult | null;
  liveTestArgsJson?: string;
  healLogs: string[];
  originalRequest: string;
  isGenerating?: boolean;
}

export interface CloudHubConfigPublic {
  google_client_id: string;
  has_google_client_secret: boolean;
  cloud_hub_api_url: string;
  is_google_configured: boolean;
  is_hub_configured: boolean;
}

export interface CloudAuthStatus {
  logged_in: boolean;
  sub: string;
  email: string;
  name: string;
  picture: string;
  expires_at_ms: number;
}

export interface CommunitySkillDoc {
  skill_key: string;
  id: string;
  name: string;
  description: string;
  language: 'powershell' | 'python' | string;
  triggers_json: string;
  params_schema_json: string;
  code: string;
  test_args_json: string;
  expected_keywords_json: string;
  version: number;
  code_hash: string;
  author_sub: string;
  author_email: string;
  author_name: string;
  downloads: number;
  stars?: number;
  starred_by?: string[];
  updated_at_ms: number;
}

export interface SyncedChatMessage {
  msg_id: string;
  role: 'user' | 'assistant' | string;
  content: string;
  source: 'desktop' | 'web' | string;
  created_at_ms: number;
}

export interface UiaElementInfo {
  index: number;
  name: string;
  control_type: string;
  automation_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  center_x: number;
  center_y: number;
  value: string;
}

export interface CdpTabInfo {
  id: string;
  title: string;
  url: string;
  ws_url: string;
}

export interface PublicEndpointStatus {
  endpoint_id: string;
  provider: string;
  model: string;
  priority: number;
  status: string;
  cooldown_remaining_sec: number;
  requests: number;
  successes: number;
  errors: number;
  last_latency_ms: number;
  ewma_latency_ms: number;
  last_error: string;
}

export interface PublicVaultKeyInfo {
  id: string;
  provider: string;
  label: string;
  masked_key: string;
  encryption: string;
  created_at: number;
}

export interface RouterStatusPayload {
  strategy: string;
  total_endpoints: number;
  healthy_endpoints: number;
  endpoints: PublicEndpointStatus[];
  vault_keys: PublicVaultKeyInfo[];
}

export interface RouterChatResponse {
  reply: string;
  provider: string;
  model: string;
  endpoint_id: string;
  latency_ms: number;
  rotated_attempts: number;
}

export interface CognitiveContextBundle {
  prompt_block: string;
  matched_facts: Array<{ key: string; value: string; category: string; effective_score: number }>;
  active_rules: Array<{ rule_key: string; rule_text: string; source: string }>;
  matched_playbooks: Array<{ playbook_id: string; tools_csv: string; strategy_hint: string }>;
  recent_entities: Array<{ entity_key: string; label: string; uri_or_path: string }>;
}

export interface SleepConsolidationResult {
  consolidated_events: number;
  pruned_old_logs: number;
  active_facts: number;
  active_rules: number;
  playbooks_count: number;
}

export interface PackSkillEntry {
  tool_name: string;
  pack: string;
  module_name: string;
  description: string;
  risk_level: string;
  kind: string;
  params: Array<{
    name: string;
    param_type: string;
    required: boolean;
    description: string;
    enum_values: string[];
  }>;
}

export interface PackCatalogSummary {
  skills_root: string;
  python_exe: string;
  total_tools: number;
  packs: Record<string, number>;
  working_memory_keys: string[];
  entries: PackSkillEntry[];
}

export interface PackRouteResult {
  total_indexed: number;
  sub_goals: string[];
  routed: Array<{
    tool_name: string;
    pack: string;
    module_name: string;
    description: string;
    score: number;
  }>;
  prompt_block: string;
  python_available: boolean;
}

export interface PackExecResult {
  ok: boolean;
  tool_name: string;
  pack: string;
  mem_ref: string;
  duration_ms: number;
  summary_text: string;
  data_json: string;
  created_files: string[];
  error: string;
}

export interface RichToolTraceItem {
  tool: string;
  pack: string;
  module_name: string;
  args: Record<string, unknown>;
  ok: boolean;
  elapsed_ms: number;
  mem_ref?: string;
  error?: string;
  created_files?: string[];
}

export interface SuggestedSkillHint {
  module_name: string;
  requirement: string;
}

export interface RichTurnMeta {
  engine: string;
  elapsed_ms: number;
  routed_tools: string[];
  trace: RichToolTraceItem[];
  image_paths: string[];
  suggested_skill: SuggestedSkillHint | null;
  user_prompt: string;
}

export interface WsChatSessionSummary {
  session_id: string;
  title: string;
  message_count: number;
  created_at: number;
  updated_at: number;
}

export interface WsChatMessageRecord {
  id: number;
  session_id: string;
  role: string;
  content: string;
  meta_json: string;
  created_at: number;
}

export interface EditableSkillFileInfo {
  pack: string;
  module_name: string;
  has_test: boolean;
  active_version: string;
  version_count: number;
}

export interface SkillVersionEntry {
  version: string;
  created_at: string;
  source: string;
  note: string;
  is_active: boolean;
}

export interface SkillSourcePayload {
  pack: string;
  module_name: string;
  version: string;
  active_version: string;
  skill_code: string;
  test_code: string;
  versions: SkillVersionEntry[];
}

export interface SkillEvolutionPayload {
  ok: boolean;
  pack: string;
  module_name: string;
  version: string;
  rounds_used: number;
  skill_code: string;
  test_code: string;
  pytest_output: string;
  logs: string[];
  versions: SkillVersionEntry[];
  total_tools_after_reload: number;
}

export interface WorkspaceOutputFile {
  name: string;
  path: string;
  ext: string;
  size_kb: number;
  modified_sec: number;
  is_image: boolean;
}

export interface AutomationRuleRecord {
  id: string;
  name: string;
  trigger_type: string;
  trigger_value: string;
  skill_id: string;
  args_json: string;
  enabled: boolean;
  last_run_at: number;
  run_count: number;
  created_at: number;
}

export interface InstallCommunitySkillResult {
  skill: CustomSkillRecord;
  sandbox: SandboxRunResult;
}

export type TarotFortuneCode =
  | 'dai_cat'
  | 'tieu_cat'
  | 'binh_hoa'
  | 'tieu_hung'
  | 'dai_hung';

export interface TarotReadingRecord {
  id: number;
  drawn_at_ms: number;
  next_draw_at_ms: number;
  card_name: string;
  card_name_vi: string;
  card_short: string;
  arcana_type: string;
  is_reversed: boolean;
  fortune_code: TarotFortuneCode | string;
  fortune_label: string;
  luck_score: number;
  can_chi_day: string;
  ngu_hanh: string;
  lucky_color: string;
  lucky_numbers: string;
  summary_vi: string;
  work_advice: string;
  wealth_advice: string;
  love_advice: string;
  remedy_advice: string;
  meaning_en: string;
  api_source: string;
  ai_deep_reading: string;
}

export interface TarotStatusResponse {
  can_draw: boolean;
  remaining_ms: number;
  cooldown_hours: number;
  already_drawn_in_window: boolean;
  current_reading: TarotReadingRecord | null;
  history: TarotReadingRecord[];
}

export interface CapturedWindowFrame {
  hwnd: number;
  title: string;
  process_name: string;
  width: number;
  height: number;
  is_minimized: boolean;
  is_stealth?: boolean;
  bmp_base64: string;
}

export interface CapturedWindowBatchItem {
  hwnd: number;
  frame: CapturedWindowFrame | null;
  error: string | null;
}

export interface MiniWindowEntry {
  hwnd: number;
  title: string;
  process_name: string;
  is_minimized: boolean;
  is_stealth: boolean;
}

export interface MiniWebStatus {
  is_open: boolean;
  url: string;
  title: string;
  always_on_top: boolean;
  width: number;
  height: number;
}



