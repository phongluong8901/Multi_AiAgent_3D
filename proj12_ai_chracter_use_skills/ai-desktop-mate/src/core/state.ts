import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import {
  AccessoryType,
  ActiveWindowTask,
  AUTO_BEHAVIOR_CATALOG,
  AutoBehaviorConfig,
  AutoBehaviorKey,
  CharacterState,
  createDefaultAutoBehaviors,
  FaceExpression,
  WeatherEffectMode,
  WinRect,
} from './types';

function loadInitialAutoActionIntervalSec(): number {
  const raw = Number(localStorage.getItem('mate_auto_action_interval_sec'));
  if (Number.isFinite(raw) && raw >= 5) {
    return Math.max(5, Math.min(300, Math.round(raw)));
  }
  return 15;
}

function loadInitialAutoBehaviors(): AutoBehaviorConfig {
  const base = createDefaultAutoBehaviors();
  try {
    const raw = localStorage.getItem('mate_auto_behaviors_json');
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        for (const item of AUTO_BEHAVIOR_CATALOG) {
          if (typeof parsed[item.key] === 'boolean') {
            base[item.key] = parsed[item.key] as boolean;
          }
        }
      }
    }
  } catch {
    // fallback default
  }
  return base;
}

export const PRESET_ALICIA_URL =
  'https://cdn.jsdelivr.net/gh/vrm-c/UniVRM@master/Tests/Models/Alicia_solid/AliciaSolid.vrm';
export const PRESET_VRM1_URL =
  'https://cdn.jsdelivr.net/gh/pixiv/three-vrm@dev/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm';

export function getDesktopFloorY(hOverride?: number): number {
  const winH = hOverride || appState?.H || window.innerHeight || 1080;
  const availH = window.screen?.availHeight || winH;
  const scrH = window.screen?.height || winH;
  // Khi cửa sổ maximized theo Work Area của Windows, đáy cửa sổ đã nằm ngay mép trên Taskbar
  if (winH <= availH + 8) {
    return Math.max(180, winH - 6);
  }
  const taskbarH = Math.max(28, Math.min(72, scrH - availH || 48));
  return Math.max(180, winH - taskbarH - 4);
}

export class AppState {
  W: number = window.innerWidth;
  H: number = window.innerHeight;

  state: CharacterState = 'IDLE';
  posX: number = Math.max(200, (window.innerWidth || 1920) - 280);
  posY: number = Math.max(240, getDesktopFloorY(window.innerHeight || 1080));
  posZ: number = 0;
  swimDepthScale: number = 1.0;
  velX: number = 0;
  velY: number = 0;
  walkDir: number = 1;
  facingAngle: number = 0;
  dragSway: number = 0;
  swingTiltAngle: number = 0;
  squashX: number = 1.0;
  squashY: number = 1.0;
  squashVelX: number = 0;
  squashVelY: number = 0;
  stateTimer: number = 0;
  autoActionIntervalSec: number = loadInitialAutoActionIntervalSec();
  nextRoamDuration: number = this.autoActionIntervalSec;

  modelScale: number = 1.0;
  gravity: number = 0.68;
  bounceFactor: number = 0.42;
  autoRoamEnabled: boolean = true;
  autoBehaviors: AutoBehaviorConfig = loadInitialAutoBehaviors();
  lookAtEnabled: boolean = true;
  windowInteractEnabled: boolean = true;

  mood: number = 80;
  energy: number = 90;
  hunger: number = 85;
  foodTarget: { x: number; y: number } | null = null;
  speechLipSyncTimer: number = 0;
  speechAudioLevel: number = 0;
  speechFormantSharpness: number = 0;
  isRealAudioLipSync: boolean = false;
  expressionMood: FaceExpression = 'neutral';
  expressionTimer: number = 0;
  globalCursorX: number = window.innerWidth / 2;
  globalCursorY: number = window.innerHeight / 2;
  systemAudioPeak: number = 0;
  systemAudioLeft: number = 0;
  systemAudioRight: number = 0;
  systemAudioBeatSeq: number = 0;
  systemAudioBpm: number = 0;
  audioBeatPulse: number = 0;
  isSystemMusicPlaying: boolean = false;
  audioVisualizer3dEnabled: boolean =
    localStorage.getItem('mate_audio_beat_3d') !== '0';
  isSmartDropzoneOpen: boolean = false;
  keyPressTotal: number = 0;
  cursorIdleMs: number = 0;
  rhythmIntensity: number = 0;
  activeAccessory: AccessoryType = 'none';
  isEdgePeekMode: boolean = false;
  weatherMode: WeatherEffectMode = 'clear';
  weatherTempC: number = 26;
  weatherFeelsLikeC: number = 27;
  weatherHumidity: number = 68;
  weatherWindKmh: number = 10;
  weatherDesc: string = 'Chưa cập nhật';
  weatherLocation: string = 'Hà Nội';
  weatherCityQuery: string = 'auto';
  englishIntervalMin: number = Math.max(
    0,
    Math.min(360, Number.isFinite(Number(localStorage.getItem('mate_english_interval_min'))) ? Number(localStorage.getItem('mate_english_interval_min') ?? 15) : 15)
  );
  newsIntervalMin: number = Math.max(
    0,
    Math.min(360, Number.isFinite(Number(localStorage.getItem('mate_news_interval_min'))) ? Number(localStorage.getItem('mate_news_interval_min') ?? 20) : 20)
  );
  weatherIntervalMin: number = Math.max(
    0,
    Math.min(360, Number.isFinite(Number(localStorage.getItem('mate_weather_interval_min'))) ? Number(localStorage.getItem('mate_weather_interval_min') ?? 30) : 30)
  );
  appMetricsIntervalMin: number = Math.max(
    0,
    Math.min(360, Number.isFinite(Number(localStorage.getItem('mate_app_metrics_interval_min'))) ? Number(localStorage.getItem('mate_app_metrics_interval_min') ?? 25) : 25)
  );
  btcIntervalMin: number = Math.max(
    0,
    Math.min(360, Number.isFinite(Number(localStorage.getItem('mate_btc_interval_min'))) ? Number(localStorage.getItem('mate_btc_interval_min') ?? 30) : 30)
  );
  weatherSourceMode: 'api' | 'custom' =
    localStorage.getItem('mate_weather_source_mode') === 'custom' ? 'custom' : 'api';
  weatherCustomMode: WeatherEffectMode =
    (['clear', 'rain', 'hot', 'cold', 'wind', 'night'].includes(
      localStorage.getItem('mate_weather_custom_mode') || ''
    )
      ? (localStorage.getItem('mate_weather_custom_mode') as WeatherEffectMode)
      : 'clear');
  weatherCustomTempC: number = Math.max(
    -30,
    Math.min(55, Number.isFinite(Number(localStorage.getItem('mate_weather_custom_temp'))) ? Number(localStorage.getItem('mate_weather_custom_temp') ?? 28) : 28)
  );
  weatherCustomHumidityPct: number = Math.max(
    0,
    Math.min(100, Number.isFinite(Number(localStorage.getItem('mate_weather_custom_hum'))) ? Number(localStorage.getItem('mate_weather_custom_hum') ?? 68) : 68)
  );
  weatherCustomLocation: string = localStorage.getItem('mate_weather_custom_loc') || 'Tùy chỉnh';
  weatherCustomDesc: string = localStorage.getItem('mate_weather_custom_desc') || 'Trời quang đãng';
  chatDockSide: 'left' | 'right' =
    localStorage.getItem('mate_chat_dock_side') === 'left' ? 'left' : 'right';
  randomFeatureEnabled: boolean = true;
  ecoMode: boolean = localStorage.getItem('mate_eco_mode') === 'true';

  openWindows: WinRect[] = [];
  activeWindowHwnd: number | null = null;
  attachedWindowHwnd: number | null = null;
  attachedOffsetX: number = 0;
  attachedLedgeOffsetY: number = 0;
  attachedWinTitle: string = '';
  attachedZoneLabel: string = '';

  activeWindowTask: ActiveWindowTask | null = null;

  isBubbleVisible: boolean = true;
  isChatOpen: boolean = false;
  isChatting: boolean = false;
  isLeftPanelOpen: boolean = false;
  isRightPanelOpen: boolean = false;
  isStudioOpen: boolean = false;
  isLongMemoryOpen: boolean = false;
  isNotificationManagerOpen: boolean = false;
  isP2pArenaOpen: boolean = false;
  isPcControlOpen: boolean = false;
  isOcrModalOpen: boolean = false;
  isOcrSnipMode: boolean = false;
  isToolForgeOpen: boolean = false;
  isTarotModalOpen: boolean = false;
  isEnglishCoachOpen: boolean = false;
  isMiniScreenOpen: boolean = false;
  isMigratedOut: boolean = false;
  blackHoleWarpMode: boolean = false;
  isFileDragHovering: boolean = false;

  currentVrm: VRM | null = null;
  currentGlbScene: THREE.Group | null = null;
  currentGlbMixer: THREE.AnimationMixer | null = null;
  builtinModelType: 'idol' | 'microduck' = 'microduck';
  duckCrouchRoll: boolean = false;
  duckBodyColor: string = '#f4f4f6';
  duckAccentColor: string = '#f97316';
  vrmBaseScale: number = 115;
  vrmFloorOffset: number = 0;

  readonly avatarGroup: THREE.Group = new THREE.Group();
  hitBoxMesh!: THREE.Mesh;

  private lastMoodPct: number = -1;
  private lastEnergyPct: number = -1;
  private lastHungerPct: number = -1;
  private moodBarEl: HTMLElement | null = null;
  private moodValEl: HTMLElement | null = null;
  private energyBarEl: HTMLElement | null = null;
  private energyValEl: HTMLElement | null = null;
  private hungerBarEl: HTMLElement | null = null;
  private hungerValEl: HTMLElement | null = null;

  ensureHitbox() {
    if (!this.hitBoxMesh) {
      const hitGeo = new THREE.BoxGeometry(110, 175, 110);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      this.hitBoxMesh = new THREE.Mesh(hitGeo, hitMat);
      this.hitBoxMesh.position.y = 85;
    }
  }

  changeMood(deltaMood: number) {
    this.mood = Math.max(0, Math.min(100, this.mood + deltaMood));
    const pct = Math.round(this.mood);
    if (pct === this.lastMoodPct && this.moodBarEl?.isConnected && this.moodValEl?.isConnected) {
      return;
    }
    if (!this.moodBarEl?.isConnected) {
      this.moodBarEl = document.getElementById('mood-bar-fill');
    }
    if (!this.moodValEl?.isConnected) {
      this.moodValEl = document.getElementById('mood-value');
    }
    if (!this.moodBarEl && !this.moodValEl) return;
    if (this.moodBarEl) this.moodBarEl.style.width = `${pct}%`;
    if (this.moodValEl) this.moodValEl.textContent = `${pct}%`;
    this.lastMoodPct = pct;
  }

  changeEnergy(deltaEnergy: number) {
    this.energy = Math.max(0, Math.min(100, this.energy + deltaEnergy));
    const pct = Math.round(this.energy);
    if (pct === this.lastEnergyPct && this.energyBarEl?.isConnected && this.energyValEl?.isConnected) {
      return;
    }
    if (!this.energyBarEl?.isConnected) {
      this.energyBarEl = document.getElementById('energy-bar-fill');
    }
    if (!this.energyValEl?.isConnected) {
      this.energyValEl = document.getElementById('energy-value');
    }
    if (!this.energyBarEl && !this.energyValEl) return;
    if (this.energyBarEl) this.energyBarEl.style.width = `${pct}%`;
    if (this.energyValEl) this.energyValEl.textContent = `${pct}%`;
    this.lastEnergyPct = pct;
  }

  changeHunger(deltaHunger: number) {
    this.hunger = Math.max(0, Math.min(100, this.hunger + deltaHunger));
    const pct = Math.round(this.hunger);
    if (pct === this.lastHungerPct && this.hungerBarEl?.isConnected && this.hungerValEl?.isConnected) {
      return;
    }
    if (!this.hungerBarEl?.isConnected) {
      this.hungerBarEl = document.getElementById('hunger-bar-fill');
    }
    if (!this.hungerValEl?.isConnected) {
      this.hungerValEl = document.getElementById('hunger-value');
    }
    if (!this.hungerBarEl && !this.hungerValEl) return;
    if (this.hungerBarEl) this.hungerBarEl.style.width = `${pct}%`;
    if (this.hungerValEl) this.hungerValEl.textContent = `${pct}%`;
    this.lastHungerPct = pct;
  }

  setExpression(expr: FaceExpression, duration = 3.2) {
    this.expressionMood = expr;
    this.expressionTimer = duration;
  }

  triggerSquash(sx: number, sy: number) {
    this.squashX = THREE.MathUtils.clamp(sx, 0.68, 1.38);
    this.squashY = THREE.MathUtils.clamp(sy, 0.68, 1.38);
    this.squashVelX = 0;
    this.squashVelY = 0;
  }

  setState(next: CharacterState) {
    if (this.state !== next) {
      this.state = next;
      this.stateTimer = 0;
      const stateBadge = document.getElementById('state-badge');
      if (stateBadge) stateBadge.textContent = `[${next}]`;
    }
  }

  getAutoActionDelay(): number {
    return Math.max(5, Math.min(300, Math.round(this.autoActionIntervalSec || 15)));
  }

  isAutoBehaviorEnabled(key: AutoBehaviorKey): boolean {
    return Boolean(this.autoBehaviors[key]);
  }

  applyAutoBehaviorsJson(rawJson: string | undefined | null) {
    if (!rawJson) return;
    try {
      const parsed = JSON.parse(rawJson) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        for (const item of AUTO_BEHAVIOR_CATALOG) {
          if (typeof parsed[item.key] === 'boolean') {
            this.autoBehaviors[item.key] = parsed[item.key] as boolean;
          }
        }
        localStorage.setItem('mate_auto_behaviors_json', JSON.stringify(this.autoBehaviors));
      }
    } catch {
      // ignore invalid json
    }
  }
}

export const appState = new AppState();

