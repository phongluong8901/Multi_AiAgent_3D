import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import { ActiveWindowTask, CharacterState, FaceExpression, WinRect } from './types';

export const PRESET_ALICIA_URL =
  'https://cdn.jsdelivr.net/gh/vrm-c/UniVRM@master/Tests/Models/Alicia_solid/AliciaSolid.vrm';
export const PRESET_VRM1_URL =
  'https://cdn.jsdelivr.net/gh/pixiv/three-vrm@dev/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm';

export class AppState {
  W: number = window.innerWidth;
  H: number = window.innerHeight;

  state: CharacterState = 'FALLING';
  posX: number = Math.max(180, window.innerWidth - 260);
  posY: number = 240;
  velX: number = 0;
  velY: number = 0;
  walkDir: number = 1;
  facingAngle: number = 0;
  dragSway: number = 0;
  squashX: number = 1.0;
  squashY: number = 1.0;
  stateTimer: number = 0;
  nextRoamDuration: number = 7;

  modelScale: number = 1.0;
  gravity: number = 0.68;
  bounceFactor: number = 0.42;
  autoRoamEnabled: boolean = true;
  lookAtEnabled: boolean = true;
  windowInteractEnabled: boolean = true;

  mood: number = 80;
  energy: number = 90;
  hunger: number = 85;
  foodTarget: { x: number; y: number } | null = null;
  speechLipSyncTimer: number = 0;
  expressionMood: FaceExpression = 'neutral';
  expressionTimer: number = 0;
  globalCursorX: number = window.innerWidth / 2;
  globalCursorY: number = window.innerHeight / 2;

  openWindows: WinRect[] = [];
  activeWindowHwnd: number | null = null;
  attachedWindowHwnd: number | null = null;
  attachedOffsetX: number = 0;
  attachedLedgeOffsetY: number = 0;
  attachedWinTitle: string = '';
  attachedZoneLabel: string = '';

  activeWindowTask: ActiveWindowTask | null = null;

  isBubbleVisible: boolean = true;
  isLeftPanelOpen: boolean = false;
  isRightPanelOpen: boolean = true;
  isStudioOpen: boolean = false;
  isLongMemoryOpen: boolean = false;

  currentVrm: VRM | null = null;
  currentGlbScene: THREE.Group | null = null;
  currentGlbMixer: THREE.AnimationMixer | null = null;
  builtinModelType: 'idol' | 'microduck' = 'idol';
  vrmBaseScale: number = 115;
  vrmFloorOffset: number = 0;

  readonly avatarGroup: THREE.Group = new THREE.Group();
  hitBoxMesh!: THREE.Mesh;

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
    const moodBarFill = document.getElementById('mood-bar-fill');
    const moodValue = document.getElementById('mood-value');
    if (moodBarFill) moodBarFill.style.width = `${this.mood}%`;
    if (moodValue) moodValue.textContent = `${Math.round(this.mood)}%`;
  }

  changeEnergy(deltaEnergy: number) {
    this.energy = Math.max(0, Math.min(100, this.energy + deltaEnergy));
    const barFill = document.getElementById('energy-bar-fill');
    const valEl = document.getElementById('energy-value');
    if (barFill) barFill.style.width = `${this.energy}%`;
    if (valEl) valEl.textContent = `${Math.round(this.energy)}%`;
  }

  changeHunger(deltaHunger: number) {
    this.hunger = Math.max(0, Math.min(100, this.hunger + deltaHunger));
    const barFill = document.getElementById('hunger-bar-fill');
    const valEl = document.getElementById('hunger-value');
    if (barFill) barFill.style.width = `${this.hunger}%`;
    if (valEl) valEl.textContent = `${Math.round(this.hunger)}%`;
  }

  setExpression(expr: FaceExpression, duration = 3.2) {
    this.expressionMood = expr;
    this.expressionTimer = duration;
  }

  setState(next: CharacterState) {
    if (this.state !== next) {
      this.state = next;
      this.stateTimer = 0;
      const stateBadge = document.getElementById('state-badge');
      if (stateBadge) stateBadge.textContent = `[${next}]`;
    }
  }
}

export const appState = new AppState();

