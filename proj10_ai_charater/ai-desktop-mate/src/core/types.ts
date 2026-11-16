import * as THREE from 'three';

export interface WinRect {
  hwnd: number;
  title: string;
  process_name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameZone {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  ledge_offset_y: number;
}

export interface DesktopState {
  windows: WinRect[];
  active_hwnd: number;
  cursor_x: number;
  cursor_y: number;
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
  | 'SPIN';

export type FaceExpression = 'neutral' | 'happy' | 'surprised' | 'sad' | 'blink' | 'talk';

export interface ParticleItem {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
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

