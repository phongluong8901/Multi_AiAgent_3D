/**
 * Animation Binder - Quản lý gắn Hoạt ảnh với Tool / Skill / Trạng thái / Sự kiện.
 *
 * Kiến trúc:
 * - CLIP_CATALOG: 34 hoạt ảnh thủ tục (procedural) gồm 11 hoạt ảnh đa pha chuẩn
 *   MicroDuck (Cảm xúc & Xã hội, Trạng thái chờ & Sinh học, Vật lý & Vui nhộn)
 *   kết hợp cùng 23 động tác nhanh cho AI Tools & Giao diện.
 * - Bindings: quy tắc "Khi <trigger> xảy ra -> chạy <clip> + FX + biểu cảm + âm thanh + đèn LED".
 * - Runtime overlay dùng mô hình Undo/Apply: đầu mỗi frame gỡ offset của frame trước,
 *   cuối frame cộng offset mới. Nhờ vậy các phép lerp gốc không bị cộng dồn sai lệch.
 */
import * as THREE from 'three';
import { appState } from './state';
import type { CharacterState, FaceExpression } from './types';
import {
  rigHips,
  rigHead,
  rigTorso,
  rigLeftLeg,
  rigRightLeg,
  rigLeftShin,
  rigRightShin,
  rigLeftArm,
  rigRightArm,
  duckNodes,
} from '../characters/rigState';
import {
  spawnParticles,
  spawnShockwave,
  spawnScanEffect,
  spawnAlertEffect,
  spawnDriftSmoke,
} from './particles';
import {
  type ActionProp3DId,
  spawnActionProp3D,
  stopAllActionProps3D,
} from './props3d';
import {
  playDuckQuackSound,
  playSuccessChimeSound,
  playJumpSound,
  playWhooshSound,
  playAlertBeep,
  playLandSound,
  playCuriousQuackSound,
  playHappyChirpSound,
  playStartledSquawkSound,
  playShyMutterSound,
  playBeakTapSound,
  playSleepyYawnSound,
  playWakeStretchSound,
  playStalkPurrSound,
  playProudMuffledQuackSound,
  playDramaticFlopSound,
} from './soundFx';

/* ------------------------------------------------------------------ */
/* 1. Kiểu dữ liệu                                                      */
/* ------------------------------------------------------------------ */

export interface PoseOffset {
  rootX?: number;
  rootY?: number;
  rootRotX?: number;
  rootRotY?: number;
  rootRotZ?: number;
  scaleX?: number;
  scaleY?: number;
  hipsY?: number;
  hipsZ?: number;
  torsoX?: number;
  torsoZ?: number;
  neckX?: number;
  headX?: number;
  headY?: number;
  headZ?: number;
  beak?: number;
  beakUpper?: number;
  legLX?: number;
  legRX?: number;
  legLZ?: number;
  legRZ?: number;
  shinLX?: number;
  shinRX?: number;
  armLZ?: number;
  armRZ?: number;
  wingLZ?: number;
  wingRZ?: number;
  wingLX?: number;
  wingRX?: number;
  tailY?: number;
  tailX?: number;
  earZ?: number;
}

export type ClipGroup = 'emotion' | 'lifelike' | 'motion' | 'work' | 'special';

export type AnimTriggerType = 'tool' | 'skill' | 'state' | 'event';
export type AnimTriggerPhase = 'start' | 'success' | 'error' | 'enter';
export type AnimFxId =
  | 'none'
  | 'sparkle'
  | 'confetti'
  | 'hearts'
  | 'shockwave'
  | 'scan'
  | 'alert'
  | 'smoke'
  | 'stars'
  | ActionProp3DId;

export type AnimSoundId =
  | 'none'
  | 'clip'
  | 'quack'
  | 'chime'
  | 'jump'
  | 'whoosh'
  | 'alert'
  | 'land'
  | 'curious'
  | 'chirp'
  | 'squawk'
  | 'mutter'
  | 'beak_tap'
  | 'yawn'
  | 'wake'
  | 'purr'
  | 'muffled_quack'
  | 'flop_slide';

export interface AnimClipDef {
  id: string;
  label: string;
  group: ClipGroup;
  defaultDuration: number;
  description: string;
  pose: (t: number, p: number) => PoseOffset;
  featured?: boolean;
  recommendedLoop?: boolean;
  ambientLowFps?: boolean;
  defaultFx?: AnimFxId;
  soundCues?: Array<{ atSec: number; sound: AnimSoundId }>;
  ledColor?: (t: number, p: number) => number | null;
  phaseNote?: string;
}

export interface AnimBinding {
  id: string;
  enabled: boolean;
  triggerType: AnimTriggerType;
  triggerKey: string;
  phase: AnimTriggerPhase;
  clipId: string;
  durationSec: number;
  fx: AnimFxId;
  expression: FaceExpression | 'none';
  sound: AnimSoundId;
  cooldownSec: number;
  fireCount: number;
  loop?: boolean;
}

/* ------------------------------------------------------------------ */
/* 2. Thư viện Hoạt ảnh (Procedural Clips)                              */
/* ------------------------------------------------------------------ */

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeInOut = (p: number) => {
  const x = clamp01(p);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
};
const bell = (p: number) => Math.sin(Math.PI * clamp01(p));
const seg = (t: number, a: number, b: number) => easeInOut((t - a) / Math.max(0.001, b - a));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export const CLIP_CATALOG: AnimClipDef[] = [
  /* ===== 11 HOẠT ẢNH CHUYÊN BIỆT ĐA PHA CHO MICRODUCK ===== */
  // Nhóm A: Cảm xúc & Tương tác xã hội
  {
    id: 'curious_inspect',
    label: 'Tò Mò Quan Sát',
    group: 'emotion',
    defaultDuration: 2.5,
    featured: true,
    defaultFx: 'prop_question',
    description: 'Hạ gối, vươn cổ 15°, nghiêng đầu trái 25° rồi phải 20° hé mỏ dò hỏi',
    phaseNote: 'Quack? ở cuối pha | Đèn camera chớp chậm 2 lần',
    soundCues: [{ atSec: 0.58, sound: 'curious' }],
    ledColor: (t) => {
      if (t >= 0.45 && t < 0.72) return 0x38bdf8;
      if (t >= 1.15 && t < 1.42) return 0x38bdf8;
      return 0x1e293b;
    },
    pose: (t) => {
      const crouch = t < 0.6 ? seg(t, 0, 0.45) : t < 1.85 ? 1 : 1 - seg(t, 1.85, 2.5);
      let headZ = 0;
      let beak = 0;
      if (t >= 0.55 && t < 1.1) {
        headZ = seg(t, 0.55, 0.85) * 0.44;
      } else if (t >= 1.1 && t < 1.45) {
        headZ = lerp(0.44, -0.35, seg(t, 1.1, 1.38));
        beak = 0.14 * seg(t, 1.15, 1.35);
      } else if (t >= 1.45 && t < 1.85) {
        headZ = -0.35;
        beak = 0.14;
      } else if (t >= 1.85) {
        const back = seg(t, 1.85, 2.45);
        headZ = lerp(-0.35, 0, back);
        beak = lerp(0.14, 0, back);
      }
      return {
        hipsY: -6 * crouch,
        legLX: 0.22 * crouch,
        legRX: 0.22 * crouch,
        shinLX: -0.42 * crouch,
        shinRX: -0.42 * crouch,
        neckX: 0.26 * crouch,
        headX: -0.18 * crouch,
        headZ,
        beak,
      };
    },
  },
  {
    id: 'happy_wiggle',
    label: 'Vui Mừng Nhún Nhảy',
    group: 'emotion',
    defaultDuration: 3.0,
    featured: true,
    defaultFx: 'prop_music',
    description: 'Nhún gối 2.5Hz, lắc hông, ngẩng đầu đóng-mở mỏ 4 nhịp rồi ưỡn ngực tự hào',
    phaseNote: 'Chuỗi líu ríu vui nhộn | Đèn xanh sáng liên tục',
    soundCues: [
      { atSec: 0.18, sound: 'chirp' },
      { atSec: 1.25, sound: 'chirp' },
    ],
    ledColor: () => 0x34d399,
    pose: (t) => {
      if (t < 2.25) {
        const fade = t < 0.25 ? t / 0.25 : 1;
        const bounce = (0.5 - 0.5 * Math.cos(t * TAU * 2.5)) * fade;
        const sway = Math.sin(t * TAU * 1.25) * fade;
        const chirpWave = t < 1.7 ? Math.max(0, Math.sin(t * TAU * 2.35)) * fade : 0;
        return {
          hipsY: -9 * bounce,
          legLX: 0.30 * bounce,
          legRX: 0.30 * bounce,
          shinLX: -0.58 * bounce,
          shinRX: -0.58 * bounce,
          torsoZ: sway * 0.16,
          rootRotZ: sway * 0.08,
          neckX: -0.14 * fade,
          headX: -0.18 * fade,
          beakUpper: -0.18 * chirpWave,
          beak: 0.32 * chirpWave,
        };
      }
      const hold = seg(t, 2.25, 2.6) * (1 - seg(t, 2.82, 3.0));
      return {
        torsoX: -0.16 * hold,
        neckX: -0.18 * hold,
        headX: -0.12 * hold,
        hipsY: 2 * hold,
      };
    },
  },
  {
    id: 'startled_hop',
    label: 'Giật Mình Nảy Bật',
    group: 'emotion',
    defaultDuration: 1.5,
    featured: true,
    defaultFx: 'prop_exclamation',
    description: 'Co gối rụt cổ lùi sau, mở to mỏ rồi bật đứng thẳng quét đầu trái-phải',
    phaseNote: 'Tiếng kêu giật mình sắc | Đèn đỏ chớp cảnh báo',
    soundCues: [{ atSec: 0.04, sound: 'squawk' }],
    ledColor: (t) => (t < 0.8 ? (Math.sin(t * 28) > 0 ? 0xef4444 : 0x7f1d1d) : 0xf59e0b),
    pose: (t) => {
      if (t < 0.28) {
        const k = seg(t, 0, 0.24);
        return {
          hipsY: -15 * k,
          hipsZ: -5 * k,
          legLX: 0.46 * k,
          legRX: 0.46 * k,
          shinLX: -0.86 * k,
          shinRX: -0.86 * k,
          neckX: -0.32 * k,
          headX: -0.22 * k,
          beakUpper: -0.34 * k,
          beak: 0.58 * k,
        };
      }
      if (t < 0.85) {
        const u = (t - 0.28) / 0.57;
        const hop = Math.sin(clamp01(u * 1.4) * Math.PI) * 28;
        const scan = Math.sin((t - 0.28) * 19) * 0.55;
        return {
          rootY: Math.max(0, hop),
          scaleY: u < 0.25 ? 0.14 : -0.05 * Math.sin(u * Math.PI),
          scaleX: u < 0.25 ? -0.06 : 0.04 * Math.sin(u * Math.PI),
          headY: scan,
          beak: 0.26 * (1 - u),
          beakUpper: -0.14 * (1 - u),
        };
      }
      const relax = 1 - seg(t, 0.85, 1.45);
      return {
        headY: Math.sin(0.57 * 19) * 0.35 * relax,
      };
    },
  },
  {
    id: 'shy_sit',
    label: 'Dỗi & Ngại Ngùng',
    group: 'emotion',
    defaultDuration: 4.0,
    featured: true,
    description: 'Ngồi xuống, rụt cổ xoay đầu né 35° rồi liếc nhẹ về giữa và quay đi',
    phaseNote: 'Lầm bầm trầm ngắt quãng | Đèn mờ dần',
    soundCues: [
      { atSec: 0.82, sound: 'mutter' },
      { atSec: 2.38, sound: 'mutter' },
    ],
    ledColor: (t) => (t < 0.7 ? 0x64748b : 0x1e293b),
    pose: (t) => {
      const sit = t < 0.7 ? seg(t, 0, 0.65) : t < 3.35 ? 1 : 1 - seg(t, 3.35, 3.98);
      let yaw = 0.61;
      if (t < 0.7) yaw = 0.61 * seg(t, 0.25, 0.7);
      else if (t >= 1.95 && t < 2.25) yaw = lerp(0.61, 0.12, seg(t, 1.95, 2.25));
      else if (t >= 2.25 && t < 2.55) yaw = lerp(0.12, 0.61, seg(t, 2.25, 2.55));
      else if (t >= 3.35) yaw = lerp(0.61, 0, seg(t, 3.35, 3.98));

      return {
        hipsY: -20.5 * sit,
        legLX: 0.78 * sit,
        legRX: 0.78 * sit,
        shinLX: -1.32 * sit,
        shinRX: -1.32 * sit,
        torsoX: 0.12 * sit,
        neckX: 0.28 * sit,
        headX: 0.20 * sit,
        headY: yaw,
        headZ: -0.14 * sit,
      };
    },
  },
  {
    id: 'polite_bow',
    label: 'Cúi Chào Lễ Phép',
    group: 'emotion',
    defaultDuration: 2.2,
    featured: true,
    description: 'Giữ chân trụ vững, đẩy nhẹ hông ra sau, gập cổ đầu 40° rồi ngẩng chào',
    phaseNote: '2 tiếng chào ngắn | Đèn chuyển xanh sang vàng ấm',
    soundCues: [{ atSec: 1.56, sound: 'quack' }],
    ledColor: (t) => (t < 1.55 ? 0x38bdf8 : 0xfbbf24),
    pose: (t) => {
      let bow = 0;
      if (t < 0.55) bow = seg(t, 0.1, 0.55);
      else if (t < 1.18) bow = 1;
      else if (t < 1.65) bow = 1 - seg(t, 1.18, 1.62);

      const greetSnap = t >= 1.55 && t < 2.15 ? bell((t - 1.55) / 0.6) : 0;
      return {
        hipsZ: -5.5 * bow,
        hipsY: -3.0 * bow,
        torsoX: 0.18 * bow - 0.08 * greetSnap,
        neckX: 0.42 * bow - 0.10 * greetSnap,
        headX: 0.28 * bow - 0.10 * greetSnap,
        legLX: -0.12 * bow,
        legRX: -0.12 * bow,
        beak: 0.22 * greetSnap,
        beakUpper: -0.08 * greetSnap,
      };
    },
  },

  // Nhóm B: Trạng thái chờ & Sinh học
  {
    id: 'idle_alive',
    label: 'Thở & Quan Sát Tự Nhiên',
    group: 'lifelike',
    defaultDuration: 6.5,
    featured: true,
    recommendedLoop: true,
    ambientLowFps: true,
    description: 'Nhún gối vi mô ±2° theo nhịp 3s, thỉnh thoảng gõ mỏ nhẹ 2 cái và ngó quanh',
    phaseNote: 'Gõ mỏ cực khẽ | Tiết kiệm CPU khi đứng yên',
    soundCues: [{ atSec: 2.25, sound: 'beak_tap' }],
    ledColor: () => 0xf59e0b,
    pose: (t) => {
      const breath = Math.sin((t * TAU) / 3.0);
      let beakTap = 0;
      if (t >= 2.2 && t < 2.95) {
        const sub = (t - 2.2) / 0.75;
        beakTap = Math.max(0, Math.sin(sub * TAU * 2)) * 0.17;
      }
      let lookYaw = 0;
      let lookRoll = 0;
      if (t >= 4.1 && t < 5.9) {
        const u = (t - 4.1) / 1.8;
        lookYaw = Math.sin(u * TAU) * 0.34 * bell(u);
        lookRoll = Math.sin(u * TAU) * 0.08 * bell(u);
      }
      return {
        hipsY: breath * 1.4,
        legLX: breath * 0.035,
        legRX: breath * 0.035,
        shinLX: -breath * 0.07,
        shinRX: -breath * 0.07,
        neckX: breath * 0.045,
        headX: -breath * 0.03 + beakTap * 0.28,
        headY: lookYaw,
        headZ: lookRoll,
        beak: beakTap,
      };
    },
  },
  {
    id: 'sleepy_doze',
    label: 'Ngủ Gật Thiu Thiu',
    group: 'lifelike',
    defaultDuration: 5.0,
    featured: true,
    recommendedLoop: true,
    ambientLowFps: true,
    defaultFx: 'prop_zzz',
    description: 'Ngồi xuống rũ cổ 15°->25°, giật mình ngẩng nhẹ một nhịp rồi gục ngủ thở chậm',
    phaseNote: 'Tiếng ngáp dài hạ tông | Đèn thở siêu chậm',
    soundCues: [{ atSec: 0.55, sound: 'yawn' }],
    ledColor: (t) => (Math.sin(t * 1.25) > 0 ? 0x312e81 : 0x0f172a),
    pose: (t) => {
      const sit = t < 0.7 ? seg(t, 0, 0.7) : 1;
      const breathSlow = Math.sin((t * TAU) / 5.0);
      let droop = 0.26;
      let yawnJaw = 0;
      if (t < 0.7) {
        droop = 0.26 * seg(t, 0.1, 0.7);
      } else if (t < 2.45) {
        droop = lerp(0.26, 0.44, seg(t, 0.7, 2.45));
      } else if (t >= 2.45 && t < 2.85) {
        // Giật mình ngẩng nhẹ lên rồi gục lại
        const jolt = bell((t - 2.45) / 0.4);
        droop = lerp(0.44, 0.08, jolt);
      } else {
        droop = lerp(0.44, 0.50, seg(t, 2.85, 3.6)) + breathSlow * 0.04;
      }
      if (t >= 0.48 && t < 1.35) {
        yawnJaw = bell((t - 0.48) / 0.87);
      }
      return {
        hipsY: -22 * sit,
        legLX: 0.86 * sit,
        legRX: 0.86 * sit,
        shinLX: -1.44 * sit,
        shinRX: -1.44 * sit,
        torsoX: (0.14 + breathSlow * 0.04) * sit,
        neckX: droop,
        headX: droop * 0.72,
        beakUpper: -0.22 * yawnJaw,
        beak: 0.42 * yawnJaw,
      };
    },
  },
  {
    id: 'wake_stretch',
    label: 'Thức Dậy Vươn Vai',
    group: 'lifelike',
    defaultDuration: 3.5,
    featured: true,
    description: 'Từ tư thế ngồi vươn cổ cao hết cỡ ngáp vươn vai, đứng dậy rồi lắc đầu tỉnh táo',
    phaseNote: 'Kèm tiếng vươn vai + kêu gọn | Đèn sáng dần',
    soundCues: [{ atSec: 0.25, sound: 'wake' }],
    ledColor: (t) => (t < 1.8 ? 0x64748b : 0x22d3ee),
    pose: (t) => {
      const sitFactor = t < 1.35 ? 1 : 1 - seg(t, 1.35, 2.2);
      const stretch = t < 1.55 ? bell(t / 1.55) : 0;
      const shakeHead = t >= 2.25 && t < 3.35 ? Math.sin((t - 2.25) * 14) * 0.42 * bell((t - 2.25) / 1.1) : 0;
      return {
        hipsY: -20 * sitFactor + 3 * stretch,
        legLX: 0.74 * sitFactor,
        legRX: 0.74 * sitFactor,
        shinLX: -1.28 * sitFactor,
        shinRX: -1.28 * sitFactor,
        scaleY: 0.11 * stretch,
        scaleX: -0.04 * stretch,
        torsoX: -0.14 * stretch,
        neckX: -0.44 * stretch,
        headX: -0.26 * stretch,
        headY: shakeHead,
        headZ: -shakeHead * 0.22,
        beakUpper: -0.40 * stretch,
        beak: 0.65 * stretch,
      };
    },
  },

  // Nhóm C: Tương tác Vật lý & Vui nhộn
  {
    id: 'stalking_crouch',
    label: 'Rình Mồi Rón Rén',
    group: 'motion',
    defaultDuration: 3.6,
    featured: true,
    recommendedLoop: true,
    description: 'Hạ trọng tâm sâu, bước rón rén chậm, khóa góc đầu phẳng tuyệt đối hướng mục tiêu',
    phaseNote: 'Tiếng rù trầm tập trung | Đèn cam rực',
    soundCues: [
      { atSec: 0.15, sound: 'purr' },
      { atSec: 1.9, sound: 'purr' },
    ],
    ledColor: () => 0xf97316,
    pose: (t, p) => {
      const ramp = t < 0.4 ? seg(t, 0, 0.4) : t > 3.25 ? 1 - seg(t, 3.25, 3.6) : 1;
      const step = Math.sin(t * 3.5);
      const torsoPitch = 0.34 * ramp;
      const neckPitch = 0.22 * ramp;
      return {
        hipsY: -20 * ramp,
        rootX: Math.sin(p * TAU) * 7 * ramp,
        torsoX: torsoPitch,
        torsoZ: step * 0.04 * ramp,
        neckX: neckPitch,
        // Bù ngược hoàn toàn góc nghiêng lưng + cổ để đầu phẳng tuyệt đối nhìn thẳng
        headX: -(torsoPitch + neckPitch) - 0.06 * ramp,
        legLX: (0.72 + step * 0.18) * ramp,
        legRX: (0.72 - step * 0.18) * ramp,
        shinLX: (-1.30 - step * 0.24) * ramp,
        shinRX: (-1.30 + step * 0.24) * ramp,
      };
    },
  },
  {
    id: 'proud_carry',
    label: 'Khoe Chiến Lợi Phẩm',
    group: 'motion',
    defaultDuration: 3.4,
    featured: true,
    recommendedLoop: true,
    defaultFx: 'prop_trophy',
    description: 'Ưỡn ngực, nâng cổ cao 15°, bước lạch bạch lắc hông rõ rệt như đang tha đồ khoe',
    phaseNote: 'Quạc tự hào hơi nghẹt mỏ | Đèn vàng kim',
    soundCues: [
      { atSec: 0.45, sound: 'muffled_quack' },
      { atSec: 1.95, sound: 'muffled_quack' },
    ],
    ledColor: () => 0xfacc15,
    pose: (t, p) => {
      const ramp = t < 0.3 ? seg(t, 0, 0.3) : t > 3.1 ? 1 - seg(t, 3.1, 3.4) : 1;
      const waddle = Math.sin(t * 7.2);
      const step = Math.sin(t * 7.2);
      return {
        torsoX: -0.18 * ramp,
        torsoZ: waddle * 0.20 * ramp,
        rootRotZ: waddle * 0.11 * ramp,
        rootX: Math.sin(p * TAU) * 9 * ramp,
        hipsY: Math.abs(waddle) * 5.5 * ramp,
        neckX: -0.26 * ramp,
        headX: 0.10 * ramp,
        headZ: -waddle * 0.10 * ramp,
        legLX: step * 0.32 * ramp,
        legRX: -step * 0.32 * ramp,
        shinLX: -Math.max(0, step) * 0.30 * ramp,
        shinRX: -Math.max(0, -step) * 0.30 * ramp,
        beakUpper: -0.06 * ramp,
        beak: 0.10 * ramp,
      };
    },
  },
  {
    id: 'dramatic_flop',
    label: 'Ăn Vạ / Giả Chết',
    group: 'motion',
    defaultDuration: 4.5,
    featured: true,
    description: 'Rướn cổ ngã lăn ra sàn, quẫy nhẹ hai chân 1.5s rồi tự bật dậy như lò xo',
    phaseNote: 'Trượt tông weee-ooo + tiếng ngã + bật dậy | Đèn tắt rồi sáng lại',
    soundCues: [
      { atSec: 0.42, sound: 'flop_slide' },
      { atSec: 1.16, sound: 'land' },
      { atSec: 3.10, sound: 'jump' },
    ],
    ledColor: (t) => (t >= 1.1 && t < 3.05 ? 0x0f172a : t >= 3.05 ? 0x38bdf8 : 0xf59e0b),
    pose: (t) => {
      // Pha 1 (0 - 0.55s): Đứng khựng, rướn cổ ra sau
      if (t < 0.55) {
        const k = seg(t, 0, 0.50);
        return {
          neckX: -0.42 * k,
          headX: -0.34 * k,
          torsoX: -0.18 * k,
          beakUpper: -0.25 * k,
          beak: 0.40 * k,
        };
      }
      // Pha 2 (0.55 - 1.25s): Ngã nghiêng có kiểm soát lên mặt sàn (không tụt xuống taskbar)
      if (t < 1.25) {
        const f = seg(t, 0.55, 1.20);
        return {
          rootRotZ: 1.48 * f,
          rootY: 16 * f,
          hipsY: 0,
          neckX: lerp(-0.42, 0.25, f),
          headX: lerp(-0.34, 0.22, f),
          beak: lerp(0.40, 0.22, f),
        };
      }
      // Pha 3 (1.25 - 2.95s): Nằm ăn vạ & quẫy nhẹ hai chân > 1.5s
      if (t < 2.95) {
        const kick = Math.sin((t - 1.25) * 14);
        return {
          rootRotZ: 1.48 + kick * 0.04,
          rootY: 16,
          hipsY: 0,
          neckX: 0.25,
          headX: 0.22,
          legLX: 0.25 + kick * 0.50,
          legRX: 0.25 - kick * 0.50,
          shinLX: -0.42 - Math.abs(kick) * 0.35,
          shinRX: -0.42 - Math.abs(kick) * 0.35,
          beak: 0.22,
        };
      }
      // Pha 4 (2.95 - 4.5s): Bật dậy (Get back up)
      const getUp = seg(t, 2.95, 3.85);
      const bounce = t >= 3.15 && t < 4.05 ? bell((t - 3.15) / 0.9) * 20 : 0;
      const squash = t >= 3.85 && t < 4.25 ? bell((t - 3.85) / 0.4) * 0.12 : 0;
      return {
        rootRotZ: lerp(1.48, 0, getUp),
        rootY: lerp(16, 0, getUp) + bounce,
        hipsY: 0,
        scaleY: -squash,
        scaleX: squash * 0.65,
        neckX: lerp(0.25, 0, getUp),
        headX: lerp(0.22, 0, getUp),
      };
    },
  },

  /* ===== KHO HOẠT ẢNH NHANH CHO TOOL / GIAO DIỆN ===== */
  {
    id: 'nod',
    label: 'Gật Đầu Đồng Ý',
    group: 'emotion',
    defaultDuration: 1.4,
    description: 'Gật đầu nhịp nhàng 3 lần',
    pose: (t) => ({ headX: Math.max(0, Math.sin(t * 13)) * 0.32, torsoX: Math.max(0, Math.sin(t * 13)) * 0.05 }),
  },
  {
    id: 'head_shake',
    label: 'Lắc Đầu Từ Chối',
    group: 'emotion',
    defaultDuration: 1.3,
    description: 'Lắc đầu qua lại nhanh',
    pose: (t, p) => ({ headY: Math.sin(t * 17) * 0.48 * (1 - p * 0.6), torsoZ: Math.sin(t * 17) * 0.04 }),
  },
  {
    id: 'hop',
    label: 'Nhảy Chân Sáo',
    group: 'motion',
    defaultDuration: 1.5,
    description: '3 cú bật nhảy vui vẻ có co giãn đàn hồi',
    pose: (_t, p) => {
      const ph = (p * 3) % 1;
      const h = Math.sin(ph * Math.PI);
      const land = ph < 0.12 || ph > 0.88 ? 1 : 0;
      return {
        rootY: h * 30,
        scaleY: land ? -0.1 : h * 0.06,
        scaleX: land ? 0.08 : -h * 0.03,
        legLX: -h * 0.35,
        legRX: -h * 0.35,
      };
    },
  },
  {
    id: 'victory',
    label: 'Ăn Mừng Chiến Thắng',
    group: 'special',
    defaultDuration: 1.6,
    defaultFx: 'prop_trophy',
    description: 'Bật cao và xoay 360 độ trên không',
    pose: (_t, p) => ({
      rootY: bell(p) * 72,
      rootRotY: easeInOut(THREE.MathUtils.clamp((p - 0.1) / 0.75, 0, 1)) * TAU,
      headX: -0.25 * bell(p),
      scaleY: p < 0.08 ? -0.14 : p > 0.92 ? -0.1 : 0.05 * bell(p),
    }),
  },
  {
    id: 'bow',
    label: 'Cúi Gập Người Nhanh',
    group: 'emotion',
    defaultDuration: 1.8,
    description: 'Cúi gập người nhanh',
    pose: (_t, p) => ({ torsoX: bell(p) * 0.6, headX: bell(p) * 0.4, rootY: -bell(p) * 6 }),
  },
  {
    id: 'think',
    label: 'Suy Nghĩ Trầm Tư',
    group: 'work',
    defaultDuration: 2.6,
    defaultFx: 'prop_pipe',
    description: 'Nghiêng đầu, lắc lư chậm như đang tính toán',
    pose: (t) => ({
      headZ: 0.3,
      neckX: 0.12,
      headX: -0.14 + Math.sin(t * 2.2) * 0.04,
      headY: Math.sin(t * 1.1) * 0.18,
      rootRotZ: Math.sin(t * 1.6) * 0.05,
    }),
  },
  {
    id: 'shiver',
    label: 'Run Rẩy Sợ Hãi',
    group: 'emotion',
    defaultDuration: 1.4,
    description: 'Run cầm cập, thu người lại',
    pose: (t) => ({
      rootX: Math.sin(t * 62) * 2.0,
      rootRotZ: Math.sin(t * 47) * 0.035,
      scaleY: -0.05,
      scaleX: 0.03,
      headX: 0.2,
    }),
  },
  {
    id: 'typing',
    label: 'Gõ Phím Hacker',
    group: 'work',
    defaultDuration: 2.4,
    description: 'Cúi đầu gõ phím liên hồi, chân nhịp',
    pose: (t) => ({
      headX: 0.2 + Math.sin(t * 22) * 0.07,
      torsoX: 0.14,
      legLX: Math.max(0, Math.sin(t * 10)) * 0.22,
      legRX: Math.max(0, -Math.sin(t * 10)) * 0.22,
      beak: Math.abs(Math.sin(t * 9)) * 0.08,
    }),
  },
  {
    id: 'peek',
    label: 'Ngó Nghiêng Quan Sát',
    group: 'work',
    defaultDuration: 2.2,
    description: 'Xoay người ngó trái ngó phải',
    pose: (t) => ({ headY: Math.sin(t * 3.4) * 0.62, rootRotY: Math.sin(t * 3.4) * 0.26, headX: -0.08 }),
  },
  {
    id: 'surprise',
    label: 'Ngạc Nhiên Nhảy Bật',
    group: 'emotion',
    defaultDuration: 1.1,
    defaultFx: 'prop_exclamation',
    description: 'Bật nảy lên, mỏ há to',
    pose: (_t, p) => ({
      rootY: p < 0.4 ? Math.sin((p / 0.4) * Math.PI) * 46 : 0,
      scaleY: p < 0.1 ? 0.18 : p > 0.4 && p < 0.5 ? -0.12 : 0,
      headX: -0.32 * bell(p),
      beak: 0.45 * bell(p),
    }),
  },
  {
    id: 'sad',
    label: 'Buồn Xìu Ỉu Xìu',
    group: 'emotion',
    defaultDuration: 2.4,
    description: 'Cúi gằm mặt, thân xẹp xuống',
    pose: (t) => ({ torsoX: 0.26, headX: 0.46 + Math.sin(t * 1.4) * 0.03, scaleY: -0.06, rootY: -4 }),
  },
  {
    id: 'twirl',
    label: 'Xoay Vòng Ballet',
    group: 'motion',
    defaultDuration: 1.3,
    description: 'Xoay tròn 360 độ tại chỗ',
    pose: (_t, p) => ({ rootRotY: easeInOut(p) * TAU, rootY: bell(p) * 8 }),
  },
  {
    id: 'heartbeat',
    label: 'Tim Đập Rộn Ràng',
    group: 'lifelike',
    defaultDuration: 2.0,
    description: 'Phập phồng như nhịp tim',
    pose: (t) => {
      const beat = Math.pow(Math.max(0, Math.sin(t * TAU * 1.6)), 6) * 0.09;
      return { scaleX: beat, scaleY: beat, headX: -0.06 };
    },
  },
  {
    id: 'sneeze',
    label: 'Hắt Xì Hơi',
    group: 'lifelike',
    defaultDuration: 1.5,
    description: 'Ngửa ra lấy đà rồi hắt xì bật tới',
    pose: (_t, p) => {
      if (p < 0.6) {
        const k = p / 0.6;
        return { headX: -0.4 * k, torsoX: -0.12 * k, beak: 0.25 * k, scaleY: 0.05 * k };
      }
      const k = 1 - (p - 0.6) / 0.4;
      return { headX: 0.55 * k, torsoX: 0.2 * k, rootX: 6 * k, beak: 0.5 * k, scaleY: -0.08 * k };
    },
  },
  {
    id: 'groove',
    label: 'Lắc Lư Groove',
    group: 'motion',
    defaultDuration: 2.6,
    description: 'Đung đưa theo điệu nhạc tưởng tượng',
    pose: (t) => ({
      rootX: Math.sin(t * 4) * 10,
      rootRotZ: Math.sin(t * 8) * 0.08,
      headY: Math.sin(t * 4) * 0.22,
      rootY: Math.abs(Math.sin(t * 8)) * 5,
    }),
  },
  {
    id: 'chomp',
    label: 'Đớp Đớp Thèm Ăn',
    group: 'emotion',
    defaultDuration: 1.6,
    description: 'Há mỏ đớp liên tục',
    pose: (t) => ({ beak: Math.abs(Math.sin(t * 14)) * 0.62, headX: Math.sin(t * 14) * 0.1 - 0.08 }),
  },
  {
    id: 'stretch',
    label: 'Duỗi Thân Nhanh',
    group: 'lifelike',
    defaultDuration: 2.2,
    description: 'Duỗi người cao lên rồi thả lỏng',
    pose: (_t, p) => ({
      rootY: bell(p) * 10,
      hipsY: bell(p) * 5,
      scaleY: bell(p) * 0.13,
      scaleX: -bell(p) * 0.05,
      neckX: -bell(p) * 0.32,
      headX: -bell(p) * 0.42,
      legLX: -bell(p) * 0.14,
      legRX: -bell(p) * 0.14,
      shinLX: bell(p) * 0.12,
      shinRX: bell(p) * 0.12,
      beak: bell(p) * 0.16,
      armLZ: bell(p) * 1.2,
      armRZ: -bell(p) * 1.2,
    }),
  },
  {
    id: 'front_flip',
    label: 'Lộn Nhào Mini',
    group: 'special',
    defaultDuration: 1.2,
    description: 'Bật lên lộn một vòng ra trước',
    pose: (_t, p) => ({
      rootY: bell(p) * 96,
      hipsY: bell(p) * 14,
      rootRotX: easeInOut(THREE.MathUtils.clamp((p - 0.12) / 0.72, 0, 1)) * TAU,
      scaleY: p < 0.1 ? -0.14 : p > 0.9 ? -0.1 : 0,
    }),
  },
  {
    id: 'jelly',
    label: 'Rung Thạch Jelly',
    group: 'motion',
    defaultDuration: 1.2,
    description: 'Co giãn đàn hồi như thạch',
    pose: (t, p) => {
      const w = Math.sin(t * 19) * 0.12 * (1 - p);
      return { scaleX: w, scaleY: -w };
    },
  },
  {
    id: 'levitate',
    label: 'Bay Lơ Lửng Thiền',
    group: 'special',
    defaultDuration: 3.0,
    description: 'Nổi lên lơ lửng nhẹ nhàng',
    pose: (t, p) => ({
      rootY: bell(Math.min(1, p * 1.0)) * (20 + Math.sin(t * 3) * 6),
      rootRotZ: Math.sin(t * 2) * 0.05,
      legLX: 0.5 * bell(p),
      legRX: 0.5 * bell(p),
    }),
  },
  {
    id: 'scan_look',
    label: 'Quét Mắt Toàn Cảnh',
    group: 'work',
    defaultDuration: 2.4,
    defaultFx: 'prop_magnifier',
    description: 'Quay đầu rà soát mọi hướng',
    pose: (t) => ({ headY: Math.sin(t * 5.5) * 0.7, headX: Math.cos(t * 3.2) * 0.22, neckX: Math.sin(t * 2.5) * 0.14 }),
  },
  {
    id: 'facepalm',
    label: 'Ôm Đầu Thất Vọng',
    group: 'emotion',
    defaultDuration: 1.8,
    description: 'Gục đầu, lắc nhẹ thất vọng',
    pose: (t, p) => ({
      headX: 0.5 * bell(p),
      headY: Math.sin(t * 6) * 0.14 * bell(p),
      torsoX: 0.18 * bell(p),
      rootY: -5 * bell(p),
    }),
  },
  {
    id: 'cheer',
    label: 'Cổ Vũ Nhiệt Tình',
    group: 'special',
    defaultDuration: 2.0,
    defaultFx: 'prop_music',
    description: 'Nhún nhảy liên tục, ngẩng cao đầu',
    pose: (t) => ({
      rootY: Math.abs(Math.sin(t * 9)) * 18,
      hipsY: Math.abs(Math.sin(t * 9)) * 7,
      legLX: Math.sin(t * 9) * 0.22,
      legRX: -Math.sin(t * 9) * 0.22,
      shinLX: -Math.max(0, Math.sin(t * 9)) * 0.28,
      shinRX: -Math.max(0, -Math.sin(t * 9)) * 0.28,
      neckX: -0.22,
      headX: -0.3,
      beak: Math.abs(Math.sin(t * 9)) * 0.28,
      beakUpper: -Math.abs(Math.sin(t * 9)) * 0.12,
      rootRotZ: Math.sin(t * 4.5) * 0.1,
      armLZ: 1.4 + Math.sin(t * 9) * 0.3,
      armRZ: -1.4 - Math.sin(t * 9) * 0.3,
    }),
  },

  /* ===== 8 HOẠT ẢNH MỚI KÈM HIỆU ỨNG 3D PROPS & THỜI TIẾT ===== */
  {
    id: 'reading_study',
    label: 'Đọc Sách Nghiên Cứu',
    group: 'work',
    defaultDuration: 3.8,
    featured: true,
    defaultFx: 'prop_books',
    description: 'Cúi đầu đọc 3 cuốn sách bay lơ lửng, gõ mỏ suy ngẫm theo từng trang',
    phaseNote: 'Kèm 3 cuốn sách 3D xoay quanh | Tiếng gõ mỏ khẽ',
    soundCues: [
      { atSec: 0.6, sound: 'beak_tap' },
      { atSec: 2.3, sound: 'beak_tap' },
    ],
    ledColor: () => 0x6366f1,
    pose: (t) => {
      const scan = Math.sin(t * 2.4) * 0.26;
      const nod = Math.max(0, Math.sin(t * 4.5)) * 0.08;
      return {
        hipsY: -5,
        legLX: 0.18,
        legRX: 0.18,
        shinLX: -0.34,
        shinRX: -0.34,
        torsoX: 0.14,
        neckX: 0.22,
        headX: 0.16 + nod,
        headY: scan,
        beak: Math.abs(Math.sin(t * 5.2)) * 0.09,
      };
    },
  },
  {
    id: 'pipe_ponder',
    label: 'Hút Tẩu Suy Ngẫm',
    group: 'work',
    defaultDuration: 4.0,
    featured: true,
    defaultFx: 'prop_pipe',
    description: 'Ngậm tẩu thuốc gỗ cổ điển, nhả khói vòng tròn trầm tư như thám tử',
    phaseNote: 'Kèm tẩu thuốc 3D + vòng khói bay | Đèn hổ phách trầm',
    soundCues: [{ atSec: 0.5, sound: 'mutter' }],
    ledColor: () => 0xd97706,
    pose: (t) => {
      const puff = Math.max(0, Math.sin(t * 2.1));
      return {
        torsoX: -0.10,
        neckX: -0.12 - puff * 0.08,
        headX: -0.08 - puff * 0.06,
        headY: Math.sin(t * 0.9) * 0.18,
        headZ: 0.12,
        beak: 0.10 + puff * 0.06,
      };
    },
  },
  {
    id: 'eureka_idea',
    label: 'Loé Sáng Ý Tưởng',
    group: 'emotion',
    defaultDuration: 2.4,
    featured: true,
    defaultFx: 'prop_lightbulb',
    description: 'Nhíu suy nghĩ rồi bật nảy người phấn khích khi bóng đèn 3D sáng rực trên đầu',
    phaseNote: 'Kèm bóng đèn 3D phát sáng | Chuông ting thành công',
    soundCues: [{ atSec: 0.45, sound: 'chime' }],
    ledColor: (t) => (t >= 0.4 ? 0xfacc15 : 0x38bdf8),
    pose: (t) => {
      if (t < 0.42) {
        const k = seg(t, 0, 0.4);
        return { hipsY: -8 * k, legLX: 0.28 * k, legRX: 0.28 * k, shinLX: -0.52 * k, shinRX: -0.52 * k, headX: 0.2 * k };
      }
      const u = (t - 0.42) / 1.98;
      const pop = t < 0.9 ? bell((t - 0.42) / 0.48) * 32 : 0;
      return {
        rootY: pop,
        hipsY: 4 * bell(u),
        torsoX: -0.14 * bell(u),
        neckX: -0.24 * bell(u),
        headX: -0.22 * bell(u),
        beakUpper: -0.16 * bell(u),
        beak: 0.30 * bell(u),
      };
    },
  },
  {
    id: 'coffee_sip',
    label: 'Thư Giãn Cà Phê',
    group: 'lifelike',
    defaultDuration: 3.4,
    featured: true,
    defaultFx: 'prop_coffee',
    description: 'Hơi cúi nhấp cà phê nóng hổi, gật gù thưởng thức giữa giờ làm việc',
    phaseNote: 'Kèm tách cà phê bốc khói 3D | Âm thanh thư thái',
    soundCues: [
      { atSec: 0.9, sound: 'mutter' },
      { atSec: 2.35, sound: 'chirp' },
    ],
    ledColor: () => 0xfbbf24,
    pose: (t) => {
      const sip = t >= 0.6 && t < 1.65 ? bell((t - 0.6) / 1.05) : 0;
      const sway = Math.sin(t * 2.2) * 0.06;
      return {
        torsoX: 0.14 * sip,
        neckX: 0.24 * sip,
        headX: 0.18 * sip + Math.sin(t * 4.5) * 0.04,
        headY: -0.28 * sip,
        rootRotZ: sway,
        beak: 0.18 * sip,
      };
    },
  },
  {
    id: 'detective_scan',
    label: 'Soi Kính Lúp Thám Tử',
    group: 'work',
    defaultDuration: 3.0,
    featured: true,
    defaultFx: 'prop_magnifier',
    description: 'Cúi người đưa kính lúp quét trái phải tìm manh mối trên màn hình',
    phaseNote: 'Kèm kính lúp 3D quét màn hình | Đèn cyan dò tìm',
    soundCues: [{ atSec: 0.3, sound: 'curious' }],
    ledColor: () => 0x06b6d4,
    pose: (t) => {
      const sweep = Math.sin(t * 2.5);
      return {
        hipsY: -8,
        legLX: 0.28,
        legRX: 0.28,
        shinLX: -0.54,
        shinRX: -0.54,
        torsoX: 0.22,
        neckX: 0.26,
        headX: -0.14,
        headY: sweep * 0.42,
        headZ: -sweep * 0.12,
      };
    },
  },
  {
    id: 'weather_shiver',
    label: 'Co Ro Trời Lạnh',
    group: 'lifelike',
    defaultDuration: 3.0,
    featured: true,
    description: 'Rụt cổ rùng mình lắc nhẹ giữ ấm khi nhiệt độ xuống thấp / trời tuyết',
    phaseNote: 'Tự kích khi thời tiết chuyển Lạnh / Tuyết | Đèn xanh băng',
    soundCues: [{ atSec: 0.4, sound: 'mutter' }],
    ledColor: () => 0x7dd3fc,
    pose: (t, p) => {
      const vib = Math.sin(t * 36) * 0.05 * bell(p);
      return {
        hipsY: -10 * bell(p),
        legLX: 0.34 * bell(p),
        legRX: 0.34 * bell(p),
        shinLX: -0.64 * bell(p),
        shinRX: -0.64 * bell(p),
        torsoX: 0.16 * bell(p),
        neckX: 0.28 * bell(p),
        headX: 0.14 * bell(p),
        rootX: Math.sin(t * 42) * 1.8 * bell(p),
        rootRotZ: vib,
      };
    },
  },
  {
    id: 'weather_breeze',
    label: 'Nghiêng Mình Đón Gió',
    group: 'motion',
    defaultDuration: 3.0,
    featured: true,
    description: 'Chống chân vững và nghiêng người nhịp nhàng theo luồng gió thổi mạnh',
    phaseNote: 'Tự kích khi thời tiết Gió mạnh | Tiếng gió vút',
    soundCues: [{ atSec: 0.35, sound: 'whoosh' }],
    ledColor: () => 0x38bdf8,
    pose: (t, p) => {
      const gust = Math.sin(t * 3.8) * 0.14 * bell(p);
      return {
        hipsY: -5 * bell(p),
        legLX: 0.20 * bell(p),
        legRX: 0.20 * bell(p),
        shinLX: -0.38 * bell(p),
        shinRX: -0.38 * bell(p),
        torsoZ: 0.16 * bell(p) + gust,
        rootRotZ: 0.10 * bell(p) + gust * 0.5,
        headZ: -0.14 * bell(p),
      };
    },
  },
  {
    id: 'weather_sunbathe',
    label: 'Tắm Nắng Khoan Khoái',
    group: 'lifelike',
    defaultDuration: 3.2,
    featured: true,
    description: 'Ngẩng đầu đón nắng ấm, vươn cổ thư giãn và hé mỏ cười tươi',
    phaseNote: 'Tự kích khi trời Nắng / Quang đãng | Líu ríu vui',
    soundCues: [{ atSec: 0.6, sound: 'chirp' }],
    ledColor: () => 0xfacc15,
    pose: (t, p) => {
      const bask = bell(p);
      return {
        torsoX: -0.16 * bask,
        neckX: -0.28 * bask,
        headX: -0.22 * bask,
        headY: Math.sin(t * 1.8) * 0.24 * bask,
        beakUpper: -0.12 * bask,
        beak: 0.20 * bask,
        hipsY: Math.sin(t * 2.5) * 1.5,
      };
    },
  },

  /* ===== 8 HOẠT ẢNH THẾ HỆ MỚI (CÁNH CYBER, ĐUÔI BIỂU CẢM & PHẢN ỨNG NGỮ CẢNH AI) ===== */
  {
    id: 'ai_thinking_orbit',
    label: 'Suy Luận AI Đa Luồng',
    group: 'work',
    defaultDuration: 3.2,
    featured: true,
    recommendedLoop: true,
    defaultFx: 'prop_hologram',
    description: 'Nghiêng đầu nhịp nhàng, gõ mỏ suy luận, nhấp cánh cyber & đổi đèn tím-cyan khi AI đang suy nghĩ',
    phaseNote: 'Tự kích khi LLM bắt đầu suy nghĩ | Đèn tím-cyan luân phiên',
    soundCues: [{ atSec: 0.75, sound: 'beak_tap' }],
    ledColor: (t) => (Math.sin(t * 4.5) > 0 ? 0xa855f7 : 0x06b6d4),
    pose: (t) => {
      const sway = Math.sin((t * TAU) / 3.2);
      const pulse = Math.sin((t * TAU) / 1.6);
      const tap = t % 1.6 < 0.32 ? Math.max(0, Math.sin(((t % 1.6) / 0.32) * Math.PI * 2)) * 0.14 : 0;
      return {
        hipsY: pulse * 1.8,
        torsoX: 0.08,
        torsoZ: sway * 0.07,
        neckX: 0.14 + pulse * 0.04,
        headX: -0.12 + tap * 0.25,
        headY: sway * 0.26,
        headZ: sway * 0.22,
        wingLZ: -0.18 - Math.abs(pulse) * 0.14,
        wingRZ: 0.18 + Math.abs(pulse) * 0.14,
        tailY: sway * 0.22,
        earZ: pulse * 0.10,
        beak: tap,
      };
    },
  },
  {
    id: 'chat_explain',
    label: 'Giảng Giải Nhiệt Tình',
    group: 'emotion',
    defaultDuration: 2.6,
    featured: true,
    description: 'Dang nhẹ cánh cyber diễn đạt theo nhịp nói, gật đầu thân thiện và vẫy đuôi vui vẻ khi trả lời xong',
    phaseNote: 'Tự kích khi AI hoàn tất câu trả lời | Đèn ngọc lục bảo',
    soundCues: [{ atSec: 0.22, sound: 'chirp' }],
    ledColor: () => 0x10b981,
    pose: (t, p) => {
      const env = bell(Math.min(1, p * 1.15));
      const gesture = Math.sin(t * 7.2);
      const nod = Math.max(0, Math.sin(t * 6.4));
      return {
        hipsY: nod * 2.6 * env,
        torsoX: (-0.08 + nod * 0.06) * env,
        torsoZ: gesture * 0.06 * env,
        neckX: -0.12 * env,
        headX: (-0.08 + nod * 0.16) * env,
        headY: gesture * 0.18 * env,
        wingLZ: (-0.48 - Math.max(0, gesture) * 0.35) * env,
        wingRZ: (0.48 + Math.max(0, -gesture) * 0.35) * env,
        wingLX: gesture * 0.22 * env,
        wingRX: -gesture * 0.22 * env,
        tailY: Math.sin(t * 12) * 0.32 * env,
        beak: Math.abs(Math.sin(t * 11)) * 0.18 * env,
      };
    },
  },
  {
    id: 'wing_flutter_joy',
    label: 'Vỗ Cánh Phấn Khích',
    group: 'emotion',
    defaultDuration: 2.2,
    featured: true,
    defaultFx: 'sparkle',
    description: 'Nhón chân vỗ hai cánh cyber liên hồi, vẫy đuôi tít mù và líu ríu hân hoan',
    phaseNote: 'Phản hồi khi chạy xong công cụ | Líu ríu vui nhộn',
    soundCues: [
      { atSec: 0.15, sound: 'chirp' },
      { atSec: 1.05, sound: 'chirp' },
    ],
    ledColor: () => 0x34d399,
    pose: (t, p) => {
      const e = bell(p);
      const flap = Math.sin(t * 22);
      const hop = Math.abs(Math.sin(t * 7.5));
      return {
        rootY: hop * 14 * e,
        hipsY: hop * 4 * e,
        torsoX: -0.14 * e,
        neckX: -0.20 * e,
        headX: -0.16 * e,
        wingLZ: (-0.82 - flap * 0.42) * e,
        wingRZ: (0.82 + flap * 0.42) * e,
        tailY: Math.sin(t * 20) * 0.44 * e,
        tailX: 0.16 * e,
        earZ: 0.16 * e,
        beakUpper: -0.14 * hop * e,
        beak: 0.26 * hop * e,
      };
    },
  },
  {
    id: 'poke_giggle',
    label: 'Khúc Khích Khi Chọc',
    group: 'emotion',
    defaultDuration: 1.7,
    featured: true,
    defaultFx: 'prop_hearts',
    description: 'Rụt cổ nhột nhạt, lắc thân khúc khích và xoè hai cánh đáng yêu khi được click vào người',
    phaseNote: 'Tự kích khi click chọc vào Vịt | Đèn hồng vui vẻ',
    soundCues: [{ atSec: 0.08, sound: 'chirp' }],
    ledColor: () => 0xf472b6,
    pose: (t, p) => {
      const e = bell(p);
      const wiggle = Math.sin(t * 20);
      return {
        hipsY: -9 * e,
        legLX: 0.28 * e,
        legRX: 0.28 * e,
        shinLX: -0.52 * e,
        shinRX: -0.52 * e,
        torsoZ: wiggle * 0.14 * e,
        neckX: 0.22 * e,
        headZ: -wiggle * 0.20 * e,
        wingLZ: (-0.65 - Math.abs(wiggle) * 0.28) * e,
        wingRZ: (0.65 + Math.abs(wiggle) * 0.28) * e,
        tailY: wiggle * 0.38 * e,
        scaleX: 0.06 * e,
        scaleY: -0.05 * e,
        beak: 0.22 * Math.abs(wiggle) * e,
      };
    },
  },
  {
    id: 'cyber_salute',
    label: 'Chào Quân Đội Cyber',
    group: 'work',
    defaultDuration: 2.0,
    featured: true,
    defaultFx: 'prop_crown_aura',
    description: 'Đứng nghiêm ưỡn ngực, giơ cánh phải lên chào chuẩn tác phong chiến thuật rồi hạ xuống gọn',
    phaseNote: 'Chuẩn bị nhận nhiệm vụ | Tiếng bíp xác nhận',
    soundCues: [{ atSec: 0.28, sound: 'chime' }],
    ledColor: () => 0x38bdf8,
    pose: (t) => {
      const hold = t < 0.35 ? seg(t, 0, 0.35) : t < 1.5 ? 1 : 1 - seg(t, 1.5, 2.0);
      return {
        hipsY: 2.5 * hold,
        torsoX: -0.14 * hold,
        neckX: -0.18 * hold,
        headX: -0.08 * hold,
        wingRZ: 1.32 * hold,
        wingRX: -0.45 * hold,
        wingLZ: -0.06 * hold,
        tailX: 0.14 * hold,
        earZ: 0.12 * hold,
      };
    },
  },
  {
    id: 'dizzy_spin',
    label: 'Chóng Mặt Loạng Choạng',
    group: 'motion',
    defaultDuration: 2.5,
    featured: true,
    defaultFx: 'stars',
    description: 'Lắc lư xoay vòng nghiêng ngả sau cú va chạm mạnh rồi lắc đầu lấy lại thăng bằng',
    phaseNote: 'Tự kích khi tiếp đất mạnh | Sao bay trên đầu',
    soundCues: [{ atSec: 0.12, sound: 'squawk' }],
    ledColor: (t) => (Math.sin(t * 16) > 0 ? 0xfacc15 : 0xf97316),
    pose: (t) => {
      if (t < 1.7) {
        const u = 1 - t / 1.7;
        const wobX = Math.sin(t * 9.5) * u;
        const wobZ = Math.cos(t * 9.5) * u;
        return {
          hipsY: -8 * u,
          torsoX: wobX * 0.24,
          torsoZ: wobZ * 0.24,
          headX: -wobX * 0.28,
          headZ: wobZ * 0.32,
          wingLZ: -0.55 * u - Math.abs(wobZ) * 0.2,
          wingRZ: 0.55 * u + Math.abs(wobZ) * 0.2,
          beak: 0.24 * u,
        };
      }
      const shake = bell((t - 1.7) / 0.8);
      return {
        headY: Math.sin((t - 1.7) * 24) * 0.42 * shake,
        wingLZ: -0.25 * shake,
        wingRZ: 0.25 * shake,
      };
    },
  },
  {
    id: 'celebrate_backhop',
    label: 'Bật Nhảy Ăn Mừng',
    group: 'special',
    defaultDuration: 2.1,
    featured: true,
    defaultFx: 'confetti',
    description: 'Nhún sâu lấy đà, bật tung lên xoè rộng hai cánh đón pháo giấy chiến thắng rực rỡ',
    phaseNote: 'Pháo giấy nhiều màu | Chuông chiến thắng',
    soundCues: [
      { atSec: 0.32, sound: 'jump' },
      { atSec: 0.65, sound: 'chime' },
    ],
    ledColor: () => 0xfacc15,
    pose: (t) => {
      if (t < 0.32) {
        const k = seg(t, 0, 0.3);
        return {
          hipsY: -14 * k,
          legLX: 0.44 * k,
          legRX: 0.44 * k,
          shinLX: -0.82 * k,
          shinRX: -0.82 * k,
          scaleY: -0.10 * k,
          scaleX: 0.08 * k,
        };
      }
      if (t < 1.35) {
        const u = (t - 0.32) / 1.03;
        const arc = Math.sin(u * Math.PI);
        return {
          rootY: arc * 56,
          rootRotY: easeInOut(u) * TAU,
          wingLZ: -1.15 * arc,
          wingRZ: 1.15 * arc,
          neckX: -0.24 * arc,
          headX: -0.22 * arc,
          beak: 0.34 * arc,
          beakUpper: -0.16 * arc,
          scaleY: 0.08 * arc,
        };
      }
      const settle = bell((t - 1.35) / 0.75);
      return {
        hipsY: -6 * settle,
        scaleY: -0.08 * settle,
        scaleX: 0.06 * settle,
        tailY: Math.sin(t * 18) * 0.35 * settle,
      };
    },
  },
  {
    id: 'focus_guard',
    label: 'Canh Gác Tập Trung',
    group: 'work',
    defaultDuration: 4.8,
    featured: true,
    recommendedLoop: true,
    ambientLowFps: true,
    description: 'Đứng thế tấn vững chãi, tai và camera đảo nhẹ canh gác không gian làm việc cho chủ nhân',
    phaseNote: 'Chế độ tuần tra êm ái | Đèn xanh ngọc',
    ledColor: () => 0x0ea5e9,
    pose: (t) => {
      const sweep = Math.sin((t * TAU) / 4.8);
      return {
        hipsY: -3.5,
        legLX: 0.14,
        legRX: 0.14,
        shinLX: -0.26,
        shinRX: -0.26,
        legLZ: -0.06,
        legRZ: 0.06,
        torsoX: -0.08,
        neckX: -0.10,
        headY: sweep * 0.42,
        wingLZ: -0.16,
        wingRZ: 0.16,
        earZ: Math.abs(sweep) * 0.12,
      };
    },
  },

  /* ===== 6 HOẠT ẢNH ĐẠO CỤ 3D NÂNG CAO (GỒM ĐẠO CỤ THỰC THỂ 3D MỚI) ===== */
  {
    id: 'gym_pump',
    label: 'Tập Tạ Thể Lực 3D',
    group: 'motion',
    defaultDuration: 2.8,
    featured: true,
    defaultFx: 'prop_dumbbell',
    description: 'Nhún squat theo nhịp và nâng tạ đôi 3D hai bên cánh tăng sức mạnh cyber',
    phaseNote: 'Kèm tạ đôi 3D nâng nhịp nhàng | Đèn cam-xanh thể thao',
    soundCues: [
      { atSec: 0.35, sound: 'jump' },
      { atSec: 1.65, sound: 'jump' },
    ],
    ledColor: (t) => (Math.sin(t * 7.5) > 0 ? 0xf97316 : 0x34d399),
    pose: (t, p) => {
      const e = bell(Math.min(1, p * 1.15));
      const rep = Math.max(0, Math.sin(t * 7.5));
      return {
        hipsY: -10 * (1 - rep) * e,
        legLX: 0.32 * (1 - rep) * e,
        legRX: 0.32 * (1 - rep) * e,
        shinLX: -0.58 * (1 - rep) * e,
        shinRX: -0.58 * (1 - rep) * e,
        torsoX: (0.14 - rep * 0.18) * e,
        neckX: (-0.08 - rep * 0.10) * e,
        wingLZ: (-0.42 - rep * 0.72) * e,
        wingRZ: (0.42 + rep * 0.72) * e,
        scaleX: (1 - rep) * 0.04 * e,
        scaleY: rep * 0.06 * e,
      };
    },
  },
  {
    id: 'super_saiyan_charge',
    label: 'Tụ Khí Siêu Năng Lượng 3D',
    group: 'special',
    defaultDuration: 3.0,
    featured: true,
    defaultFx: 'prop_lightning_aura',
    description: 'Rùng mình tụ lực dưới đất rồi bùng nổ hào quang sấm sét 3D bung rộng hai cánh',
    phaseNote: 'Vòng năng lượng & tia sét 3D | Tiếng gió + chuông bùng nổ',
    soundCues: [
      { atSec: 0.2, sound: 'purr' },
      { atSec: 1.15, sound: 'whoosh' },
      { atSec: 1.35, sound: 'chime' },
    ],
    ledColor: (t) => (t < 1.1 ? 0x38bdf8 : Math.sin(t * 24) > 0 ? 0xfacc15 : 0x38bdf8),
    pose: (t) => {
      if (t < 1.1) {
        const k = seg(t, 0, 1.0);
        const vib = Math.sin(t * 48) * 0.05 * k;
        return {
          hipsY: -13 * k,
          legLX: 0.42 * k,
          legRX: 0.42 * k,
          shinLX: -0.78 * k,
          shinRX: -0.78 * k,
          torsoX: 0.22 * k,
          neckX: 0.18 * k,
          rootX: Math.sin(t * 54) * 2.2 * k,
          rootRotZ: vib,
          wingLZ: -0.25 * k,
          wingRZ: 0.25 * k,
          scaleY: -0.06 * k,
          scaleX: 0.05 * k,
        };
      }
      const burst = bell((t - 1.1) / 1.9);
      return {
        rootY: 22 * burst,
        hipsY: 4 * burst,
        torsoX: -0.22 * burst,
        neckX: -0.32 * burst,
        headX: -0.24 * burst,
        wingLZ: -1.35 * burst,
        wingRZ: 1.35 * burst,
        beakUpper: -0.22 * burst,
        beak: 0.42 * burst,
        earZ: 0.22 * burst,
        scaleY: 0.10 * burst,
        scaleX: -0.04 * burst,
      };
    },
  },
  {
    id: 'paparazzi_pose',
    label: 'Tạo Dáng Chụp Ảnh Flash 3D',
    group: 'emotion',
    defaultDuration: 3.0,
    featured: true,
    defaultFx: 'prop_camera_flash',
    description: 'Tạo 3 dáng idol siêu ngầu khớp nhịp đèn flash máy ảnh 3D chớp sáng xung quanh',
    phaseNote: 'Máy ảnh & vòng sáng Flash 3D | Líu ríu tạo dáng',
    soundCues: [
      { atSec: 0.35, sound: 'chirp' },
      { atSec: 1.35, sound: 'chirp' },
      { atSec: 2.25, sound: 'chime' },
    ],
    ledColor: (t) => ((t * 1.25) % 1 < 0.26 ? 0xfef08a : 0xf472b6),
    pose: (t) => {
      if (t < 1.0) {
        const k = bell(t / 1.0);
        return {
          headZ: 0.32 * k,
          headY: -0.24 * k,
          torsoZ: -0.10 * k,
          wingRZ: 1.05 * k,
          wingLZ: -0.25 * k,
          beak: 0.14 * k,
        };
      }
      if (t < 2.0) {
        const k = bell((t - 1.0) / 1.0);
        return {
          hipsY: -6 * k,
          headZ: -0.28 * k,
          headY: 0.26 * k,
          torsoZ: 0.12 * k,
          wingLZ: -1.15 * k,
          wingRZ: 0.28 * k,
          beak: 0.18 * k,
        };
      }
      const k = bell((t - 2.0) / 1.0);
      return {
        rootY: 16 * k,
        torsoX: -0.14 * k,
        neckX: -0.16 * k,
        wingLZ: -0.95 * k,
        wingRZ: 0.95 * k,
        tailY: Math.sin(t * 18) * 0.32 * k,
      };
    },
  },
  {
    id: 'hologram_code',
    label: 'Thao Tác Hologram 3D',
    group: 'work',
    defaultDuration: 3.4,
    featured: true,
    defaultFx: 'prop_hologram',
    description: 'Chiếu màn hình Hologram 3D lơ lửng trước mặt, vẫy cánh thao tác dữ liệu như Iron Man',
    phaseNote: 'Màn hình Hologram 3D tương tác | Đèn cyan công nghệ',
    soundCues: [
      { atSec: 0.4, sound: 'beak_tap' },
      { atSec: 1.8, sound: 'chime' },
    ],
    ledColor: () => 0x22d3ee,
    pose: (t, p) => {
      const e = bell(Math.min(1, p * 1.15));
      const swipe = Math.sin(t * 5.2);
      return {
        hipsY: -4 * e,
        torsoX: 0.10 * e,
        neckX: 0.16 * e,
        headX: -0.06 * e,
        headY: swipe * 0.28 * e,
        wingLZ: (-0.52 - Math.max(0, swipe) * 0.48) * e,
        wingRZ: (0.52 + Math.max(0, -swipe) * 0.48) * e,
        wingLX: swipe * 0.35 * e,
        wingRX: -swipe * 0.35 * e,
        beak: Math.abs(Math.sin(t * 8)) * 0.10 * e,
      };
    },
  },
  {
    id: 'royal_parade',
    label: 'Diễu Hành Hoàng Gia 3D',
    group: 'special',
    defaultDuration: 3.2,
    featured: true,
    defaultFx: 'prop_crown_aura',
    description: 'Bật hào quang vương miện & ngọc quý 3D, bước diễu hành oai vệ rồi cúi chào quý tộc',
    phaseNote: 'Vương miện & kim cương xoay 3D | Đèn vàng kim',
    soundCues: [{ atSec: 0.3, sound: 'chime' }],
    ledColor: () => 0xfacc15,
    pose: (t) => {
      if (t < 2.2) {
        const u = bell(t / 2.2);
        const march = Math.sin(t * 6.8);
        return {
          hipsY: Math.abs(march) * 4 * u,
          torsoX: -0.18 * u,
          torsoZ: march * 0.09 * u,
          neckX: -0.22 * u,
          headX: -0.10 * u,
          legLX: march * 0.34 * u,
          legRX: -march * 0.34 * u,
          shinLX: -Math.max(0, march) * 0.38 * u,
          shinRX: -Math.max(0, -march) * 0.38 * u,
          wingLZ: -0.45 * u,
          wingRZ: 0.45 * u,
          tailX: 0.22 * u,
        };
      }
      const bow = bell((t - 2.2) / 1.0);
      return {
        torsoX: 0.22 * bow,
        neckX: 0.34 * bow,
        headX: 0.24 * bow,
        wingLZ: -0.82 * bow,
        wingRZ: 0.82 * bow,
      };
    },
  },
  {
    id: 'love_serenade',
    label: 'Bắn Tim Yêu Thương 3D',
    group: 'emotion',
    defaultDuration: 2.8,
    featured: true,
    defaultFx: 'prop_hearts',
    description: 'Nhún nhảy đung đưa thả mưa trái tim 3D bay xoắn ốc, vẫy đuôi rối rít bày tỏ tình cảm',
    phaseNote: 'Trái tim 3D bay lên | Líu ríu ngọt ngào',
    soundCues: [
      { atSec: 0.2, sound: 'chirp' },
      { atSec: 1.4, sound: 'chirp' },
    ],
    ledColor: () => 0xf43f5e,
    pose: (t, p) => {
      const e = bell(p);
      const sway = Math.sin(t * 5.6);
      const hop = Math.abs(Math.sin(t * 5.6));
      return {
        hipsY: hop * 5 * e,
        torsoZ: sway * 0.14 * e,
        headZ: -sway * 0.22 * e,
        neckX: -0.12 * e,
        wingLZ: (-0.62 - hop * 0.42) * e,
        wingRZ: (0.62 + hop * 0.42) * e,
        tailY: Math.sin(t * 18) * 0.42 * e,
        earZ: 0.18 * e,
        beakUpper: -0.08 * hop * e,
        beak: 0.20 * hop * e,
      };
    },
  },
];

const CLIP_MAP = new Map(CLIP_CATALOG.map((c) => [c.id, c]));

export function getClipById(id: string): AnimClipDef | undefined {
  return CLIP_MAP.get(id);
}

/* ------------------------------------------------------------------ */
/* 3. Danh mục Trigger                                                  */
/* ------------------------------------------------------------------ */

export const TOOL_TRIGGER_CATALOG: Array<{ key: string; label: string }> = [
  { key: '*', label: 'Bất kỳ Tool nào (*)' },
  { key: 'open_app', label: 'Mở ứng dụng / web' },
  { key: 'open_file', label: 'Mở file' },
  { key: 'open_folder', label: 'Mở thư mục' },
  { key: 'web_search', label: 'Tìm kiếm Web' },
  { key: 'screenshot', label: 'Chụp màn hình' },
  { key: 'ocr', label: 'OCR đọc chữ & Dịch vùng' },
  { key: 'vision', label: 'Gemini Vision' },
  { key: 'weather_3d', label: 'Thời tiết & Hiệu ứng 3D' },
  { key: 'tarot', label: 'Bốc Tarot & Tử vi' },
  { key: 'mini_screen', label: 'Màn Hình Mini (PiP)' },
  { key: 'swim', label: 'Bơi Hồ 3D' },
  { key: 'accessory', label: 'Phụ kiện 3D' },
  { key: 'goose_mode', label: 'Vịt Tinh Nghịch' },
  { key: 'beat_dance', label: 'Nhảy Theo Nhạc' },
  { key: 'desktop_icon', label: 'Icon Desktop' },
  { key: 'telemetry', label: 'Telemetry hệ thống' },
  { key: 'hardware', label: 'Phần cứng' },
  { key: 'media', label: 'Điều khiển Media' },
  { key: 'timer', label: 'Hẹn giờ / Nhắc nhở' },
  { key: 'process_manager', label: 'Quản lý tiến trình' },
  { key: 'port_manager', label: 'Quản lý Port' },
  { key: 'git_status', label: 'Git Status' },
  { key: 'clipboard', label: 'Clipboard' },
  { key: 'clipboard_history', label: 'Lịch sử Clipboard' },
  { key: 'sticky_note', label: 'Ghi chú dính' },
  { key: 'system_control', label: 'Điều khiển hệ thống' },
  { key: 'control_window', label: 'Điều khiển cửa sổ' },
  { key: 'macro', label: 'Macro / Routine' },
  { key: 'news', label: 'Đọc tin tức' },
  { key: 'english', label: 'Học tiếng Anh' },
  { key: 'workspace', label: 'Trợ lý Workspace / DB' },
  { key: 'character_action', label: 'Hành động nhân vật' },
  { key: 'random_fx', label: 'Hiệu ứng Ngẫu nhiên' },
  { key: 'edge_peek', label: 'Nấp mép Focus Mode' },
  { key: 'custom_skill', label: 'Chạy Custom Skill (chung)' },
  { key: 'forge_tool', label: 'Rèn Tool mới (Tool Forge)' },
  { key: 'cloud_hub', label: 'Đồng bộ & Tải Skill Cloud Hub' },
  { key: 'p2p_arena', label: 'Đấu trường PK P2P' },
  { key: 'long_memory', label: 'Ghi nhớ dài hạn SQLite' },
  { key: 'file_cleanup', label: 'Dọn rác & Phân tích File' },
  { key: 'window_layout', label: 'Sắp xếp bố cục Cửa sổ' },
];

const TOOL_KEY_ALIASES: Record<string, string> = {
  git: 'git_status',
  port: 'port_manager',
  process: 'process_manager',
  note: 'sticky_note',
  system: 'system_control',
  read_news: 'news',
  learn_english: 'english',
  routine: 'macro',
  briefing: 'workspace',
  db_support: 'workspace',
  search: 'web_search',
  reminder: 'timer',
  weather: 'weather_3d',
  random_effect: 'random_fx',
  focus_mode: 'edge_peek',
};

export function normalizeToolTriggerKey(raw: string): string {
  const clean = String(raw || '').trim().toLowerCase();
  return TOOL_KEY_ALIASES[clean] || clean;
}

export const STATE_TRIGGER_CATALOG: CharacterState[] = [
  'IDLE',
  'WALKING',
  'SITTING_WINDOW',
  'DRAGGING',
  'FALLING',
  'JUMPING',
  'DANCING',
  'WAVING',
  'HEADPAT',
  'PUSHING',
  'PULLING',
  'SCANNING',
  'ALERT',
  'EATING',
  'TIRED',
  'CLIMBING',
  'PARACHUTING',
  'BACKFLIP',
  'SPIN',
  'RADAR',
  'FLYING_ROCKET',
  'FISHING',
  'SWIMMING',
  'SWINGING_WINDOW',
  'BUTT_PLANT',
  'SLEEP',
];

export const EVENT_TRIGGER_CATALOG: Array<{ key: string; label: string }> = [
  { key: 'app_start', label: 'Khởi động ứng dụng' },
  { key: 'chat_send', label: 'Người dùng gửi tin nhắn' },
  { key: 'ai_thinking', label: 'AI bắt đầu suy nghĩ / gọi LLM' },
  { key: 'chat_reply', label: 'AI trả lời xong tin nhắn' },
  { key: 'duck_poke', label: 'Click / chọc vui vào Vịt' },
  { key: 'duck_drag_end', label: 'Thả rơi Vịt sau khi kéo' },
  { key: 'duck_land_heavy', label: 'Vịt tiếp đất mạnh' },
  { key: 'duck_wake', label: 'Vịt thức dậy / hồi phục năng lượng' },
  { key: 'food_spawn', label: 'Đồ ăn xuất hiện trên màn hình' },
  { key: 'food_eat', label: 'Vịt ăn no nê' },
  { key: 'schedule_alarm', label: 'Chuông nhắc lịch hẹn / Ghi chú' },
  { key: 'notif_incoming', label: 'Có thông báo mới từ App / Web' },
  { key: 'hw_high_alert', label: 'Cảnh báo quá tải CPU / RAM' },
  { key: 'p2p_victory', label: 'Chiến thắng trận PK P2P' },
  { key: 'p2p_defeat', label: 'Thua trận PK P2P' },
  { key: 'tarot_good', label: 'Bốc quẻ Tarot Đại Cát / Tiểu Cát' },
  { key: 'tarot_bad', label: 'Bốc quẻ Tarot Tiểu Hung / Đại Hung' },
  { key: 'cloud_login', label: 'Đăng nhập Google Cloud Hub' },
  { key: 'file_drop', label: 'Thả file vào Vịt' },
  { key: 'weather:clear', label: 'Thời tiết: Trời Quang' },
  { key: 'weather:rain', label: 'Thời tiết: Mưa & Dông' },
  { key: 'weather:hot', label: 'Thời tiết: Nắng Nóng' },
  { key: 'weather:cold', label: 'Thời tiết: Lạnh & Tuyết' },
  { key: 'weather:wind', label: 'Thời tiết: Gió Mạnh' },
  { key: 'weather:night', label: 'Thời tiết: Ban Đêm' },
  { key: 'panel:studio-panel', label: 'Mở trang Studio 3D' },
  { key: 'panel:tarot-modal', label: 'Mở trang Tarot' },
  { key: 'panel:tool-forge-modal', label: 'Mở trang Xưởng Skill' },
  { key: 'panel:mini-screen-panel', label: 'Mở trang Mini Screen' },
  { key: 'panel:notification-panel', label: 'Mở trang Notification' },
  { key: 'panel:p2p-arena-panel', label: 'Mở trang P2P Arena' },
  { key: 'panel:pc-control-modal', label: 'Mở trang Điều khiển PC' },
  { key: 'panel:long-memory-panel', label: 'Mở trang Long Memory' },
  { key: 'panel:ocr-translate-modal', label: 'Mở trang OCR Dịch' },
  { key: 'panel:right-action-panel', label: 'Mở bảng Hành động' },
  { key: 'panel:left-telemetry-panel', label: 'Mở bảng Telemetry' },
  { key: 'panel:file-dashboard-modal', label: 'Mở bảng Phân tích File' },
  { key: 'panel:anim-manager-modal', label: 'Mở bảng Quản lý Hoạt ảnh' },
  { key: 'panel:sticky-notes-widget', label: 'Mở bảng Ghi chú & Lịch hẹn' },
  { key: 'panel:english-coach-modal', label: 'Mở trang Học Tiếng Anh' },
];

export const FX_CATALOG: Array<{ id: AnimFxId; label: string }> = [
  { id: 'none', label: 'Không hiệu ứng' },
  { id: 'prop_books', label: '3 Cuốn Sách Bay 3D' },
  { id: 'prop_pipe', label: 'Hút Tẩu Thuốc 3D + Khói' },
  { id: 'prop_question', label: 'Dấu Hỏi Chấm ? 3D' },
  { id: 'prop_exclamation', label: 'Dấu Chấm Than ! 3D' },
  { id: 'prop_lightbulb', label: 'Bóng Đèn Ý Tưởng 3D' },
  { id: 'prop_coffee', label: 'Tách Cà Phê Nóng 3D' },
  { id: 'prop_zzz', label: 'Bong Bóng Ngủ Zzz 3D' },
  { id: 'prop_magnifier', label: 'Kính Lúp Thám Tử 3D' },
  { id: 'prop_music', label: 'Nốt Nhạc 3D Bay' },
  { id: 'prop_trophy', label: 'Cúp Vàng Chiến Thắng 3D' },
  { id: 'prop_hearts', label: 'Trái Tim Hồng 3D Bay' },
  { id: 'prop_hologram', label: 'Màn Hình Hologram Sci-Fi 3D' },
  { id: 'prop_dumbbell', label: 'Tạ Đôi Tập Gym 3D' },
  { id: 'prop_camera_flash', label: 'Máy Ảnh & Chớp Flash 3D' },
  { id: 'prop_crown_aura', label: 'Hào Quang Vương Miện & Kim Cương 3D' },
  { id: 'prop_lightning_aura', label: 'Siêu Năng Lượng Sấm Sét 3D' },
  { id: 'sparkle', label: 'Lấp lánh xanh' },
  { id: 'confetti', label: 'Pháo giấy nhiều màu' },
  { id: 'hearts', label: 'Bụi hồng trái tim' },
  { id: 'stars', label: 'Sao vàng bay' },
  { id: 'shockwave', label: 'Sóng xung kích' },
  { id: 'scan', label: 'Tia quét Scan' },
  { id: 'alert', label: 'Cảnh báo đỏ' },
  { id: 'smoke', label: 'Khói bụi' },
];

export const SOUND_CATALOG: Array<{ id: AnimSoundId; label: string }> = [
  { id: 'clip', label: 'Theo hoạt ảnh (Tự động)' },
  { id: 'none', label: 'Im lặng' },
  { id: 'curious', label: 'Hỏi thăm (Quack?)' },
  { id: 'chirp', label: 'Líu ríu vui nhộn' },
  { id: 'squawk', label: 'Giật mình sắc' },
  { id: 'mutter', label: 'Lầm bầm trầm' },
  { id: 'quack', label: 'Tiếng Quạc' },
  { id: 'beak_tap', label: 'Gõ mỏ khẽ' },
  { id: 'yawn', label: 'Ngáp dài hạ tông' },
  { id: 'wake', label: 'Vươn vai tỉnh giấc' },
  { id: 'purr', label: 'Rù trầm rình mồi' },
  { id: 'muffled_quack', label: 'Quạc tự hào (nghẹt mỏ)' },
  { id: 'flop_slide', label: 'Trượt tông ăn vạ' },
  { id: 'chime', label: 'Chuông thành công' },
  { id: 'jump', label: 'Bật nhảy' },
  { id: 'whoosh', label: 'Vút gió' },
  { id: 'alert', label: 'Bíp cảnh báo' },
  { id: 'land', label: 'Tiếp đất' },
];

export const EXPRESSION_CATALOG: Array<{ id: FaceExpression | 'none'; label: string }> = [
  { id: 'none', label: 'Giữ nguyên' },
  { id: 'happy', label: 'Vui vẻ' },
  { id: 'surprised', label: 'Ngạc nhiên' },
  { id: 'sad', label: 'Buồn' },
  { id: 'talk', label: 'Nói chuyện' },
  { id: 'neutral', label: 'Bình thường' },
];

/* ------------------------------------------------------------------ */
/* 4. Lưu trữ Bindings                                                  */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'mate_anim_bindings_v1';
const MASTER_KEY = 'mate_anim_binder_enabled';
const SCHEMA_KEY = 'mate_anim_bindings_schema';
const SCHEMA_VERSION = '5';

let bindings: AnimBinding[] = [];
let masterEnabled = localStorage.getItem(MASTER_KEY) !== 'false';
const changeListeners = new Set<() => void>();
const fireListeners = new Set<(b: AnimBinding | null, clip: AnimClipDef) => void>();

function newId(): string {
  return `ab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function mk(
  triggerType: AnimTriggerType,
  triggerKey: string,
  phase: AnimTriggerPhase,
  clipId: string,
  fx: AnimFxId = 'none',
  expression: FaceExpression | 'none' = 'none',
  sound: AnimSoundId = 'none',
  opts?: { loop?: boolean; cooldownSec?: number }
): AnimBinding {
  const clip = getClipById(clipId);
  return {
    id: newId(),
    enabled: true,
    triggerType,
    triggerKey,
    phase,
    clipId,
    durationSec: clip?.defaultDuration ?? 1.5,
    fx,
    expression,
    sound,
    cooldownSec: opts?.cooldownSec ?? 1.5,
    fireCount: 0,
    loop: opts?.loop ?? false,
  };
}

export function createDefaultBindings(): AnimBinding[] {
  return [
    // Vòng đời ứng dụng, AI Chat & Phản xạ tương tác
    mk('event', 'app_start', 'enter', 'polite_bow', 'none', 'happy', 'none'),
    mk('event', 'cloud_login', 'enter', 'polite_bow', 'prop_crown_aura', 'happy', 'chime'),
    mk('event', 'chat_send', 'enter', 'curious_inspect', 'prop_question', 'none', 'none'),
    mk('event', 'ai_thinking', 'enter', 'ai_thinking_orbit', 'prop_hologram', 'none', 'none', { loop: true, cooldownSec: 1.0 }),
    mk('event', 'ai_thinking', 'enter', 'think', 'prop_pipe', 'none', 'none', { loop: true, cooldownSec: 1.0 }),
    mk('event', 'chat_reply', 'enter', 'chat_explain', 'sparkle', 'happy', 'none', { cooldownSec: 1.2 }),
    mk('event', 'chat_reply', 'enter', 'eureka_idea', 'prop_lightbulb', 'happy', 'clip', { cooldownSec: 1.2 }),
    mk('event', 'chat_reply', 'enter', 'nod', 'none', 'happy', 'none', { cooldownSec: 1.2 }),
    mk('event', 'duck_poke', 'enter', 'poke_giggle', 'prop_hearts', 'happy', 'none', { cooldownSec: 0.7 }),
    mk('event', 'duck_poke', 'enter', 'love_serenade', 'prop_hearts', 'happy', 'clip', { cooldownSec: 0.7 }),
    mk('event', 'duck_poke', 'enter', 'jelly', 'sparkle', 'happy', 'none', { cooldownSec: 0.7 }),
    mk('event', 'duck_poke', 'enter', 'heartbeat', 'hearts', 'happy', 'none', { cooldownSec: 0.7 }),
    mk('event', 'duck_poke', 'enter', 'sneeze', 'smoke', 'surprised', 'none', { cooldownSec: 0.7 }),
    mk('event', 'duck_drag_end', 'enter', 'jelly', 'none', 'none', 'none', { cooldownSec: 1.2 }),
    mk('event', 'duck_land_heavy', 'enter', 'dizzy_spin', 'stars', 'surprised', 'none', { cooldownSec: 2.2 }),
    mk('event', 'duck_wake', 'enter', 'wake_stretch', 'sparkle', 'happy', 'clip', { cooldownSec: 2.0 }),
    mk('event', 'food_spawn', 'enter', 'stalking_crouch', 'none', 'none', 'clip', { cooldownSec: 1.5 }),
    mk('event', 'food_eat', 'enter', 'chomp', 'confetti', 'happy', 'none', { cooldownSec: 1.5 }),
    mk('event', 'schedule_alarm', 'enter', 'startled_hop', 'prop_exclamation', 'surprised', 'clip', { cooldownSec: 1.5 }),
    mk('event', 'notif_incoming', 'enter', 'surprise', 'prop_exclamation', 'surprised', 'none', { cooldownSec: 2.0 }),
    mk('event', 'hw_high_alert', 'enter', 'shiver', 'alert', 'surprised', 'none', { cooldownSec: 3.0 }),
    mk('event', 'p2p_victory', 'enter', 'celebrate_backhop', 'prop_trophy', 'happy', 'clip', { cooldownSec: 2.0 }),
    mk('event', 'p2p_defeat', 'enter', 'dramatic_flop', 'smoke', 'sad', 'clip', { cooldownSec: 2.0 }),
    mk('event', 'tarot_good', 'enter', 'royal_parade', 'prop_crown_aura', 'happy', 'clip', { cooldownSec: 1.5 }),
    mk('event', 'tarot_bad', 'enter', 'facepalm', 'alert', 'sad', 'none', { cooldownSec: 1.5 }),
    mk('event', 'file_drop', 'enter', 'reading_study', 'prop_books', 'surprised', 'none'),

    // Thời tiết 3D
    mk('event', 'weather:clear', 'enter', 'weather_sunbathe', 'none', 'happy', 'none'),
    mk('event', 'weather:rain', 'enter', 'shy_sit', 'none', 'none', 'clip'),
    mk('event', 'weather:hot', 'enter', 'weather_sunbathe', 'none', 'happy', 'clip'),
    mk('event', 'weather:cold', 'enter', 'weather_shiver', 'none', 'none', 'clip'),
    mk('event', 'weather:wind', 'enter', 'weather_breeze', 'none', 'none', 'clip'),
    mk('event', 'weather:night', 'enter', 'sleepy_doze', 'prop_zzz', 'none', 'none'),

    // Mở các Trang / Dialog ứng dụng
    mk('event', 'panel:studio-panel', 'enter', 'bow', 'sparkle', 'happy', 'none'),
    mk('event', 'panel:tarot-modal', 'enter', 'levitate', 'stars', 'none', 'none'),
    mk('event', 'panel:tool-forge-modal', 'enter', 'pipe_ponder', 'prop_pipe', 'none', 'none'),
    mk('event', 'panel:mini-screen-panel', 'enter', 'paparazzi_pose', 'prop_camera_flash', 'happy', 'none'),
    mk('event', 'panel:notification-panel', 'enter', 'peek', 'none', 'none', 'none'),
    mk('event', 'panel:p2p-arena-panel', 'enter', 'cyber_salute', 'prop_crown_aura', 'happy', 'none'),
    mk('event', 'panel:pc-control-modal', 'enter', 'hologram_code', 'prop_hologram', 'none', 'none'),
    mk('event', 'panel:long-memory-panel', 'enter', 'reading_study', 'prop_books', 'none', 'none'),
    mk('event', 'panel:ocr-translate-modal', 'enter', 'detective_scan', 'prop_magnifier', 'none', 'none'),
    mk('event', 'panel:right-action-panel', 'enter', 'stretch', 'none', 'happy', 'none'),
    mk('event', 'panel:left-telemetry-panel', 'enter', 'gym_pump', 'prop_dumbbell', 'none', 'none'),
    mk('event', 'panel:file-dashboard-modal', 'enter', 'detective_scan', 'prop_magnifier', 'none', 'none'),
    mk('event', 'panel:anim-manager-modal', 'enter', 'hologram_code', 'prop_hologram', 'none', 'none'),
    mk('event', 'panel:sticky-notes-widget', 'enter', 'coffee_sip', 'prop_coffee', 'happy', 'none'),
    mk('event', 'panel:english-coach-modal', 'enter', 'reading_study', 'prop_books', 'happy', 'none'),

    // AI Tools & Tác vụ cụ thể
    mk('tool', 'web_search', 'start', 'curious_inspect', 'prop_question', 'none', 'none'),
    mk('tool', 'web_search', 'success', 'eureka_idea', 'prop_lightbulb', 'happy', 'clip'),
    mk('tool', 'open_app', 'start', 'happy_wiggle', 'prop_music', 'happy', 'clip'),
    mk('tool', 'open_file', 'start', 'hop', 'sparkle', 'happy', 'none'),
    mk('tool', 'open_folder', 'start', 'hop', 'sparkle', 'happy', 'none'),
    mk('tool', 'screenshot', 'start', 'paparazzi_pose', 'prop_camera_flash', 'happy', 'clip'),
    mk('tool', 'ocr', 'start', 'detective_scan', 'prop_magnifier', 'none', 'none'),
    mk('tool', 'ocr', 'success', 'reading_study', 'prop_books', 'happy', 'clip'),
    mk('tool', 'vision', 'start', 'scan_look', 'prop_magnifier', 'none', 'none'),
    mk('tool', 'weather_3d', 'start', 'curious_inspect', 'prop_question', 'none', 'none'),
    mk('tool', 'tarot', 'start', 'levitate', 'stars', 'none', 'none'),
    mk('tool', 'telemetry', 'start', 'pipe_ponder', 'prop_pipe', 'none', 'none'),
    mk('tool', 'hardware', 'start', 'gym_pump', 'prop_dumbbell', 'none', 'clip'),
    mk('tool', 'media', 'start', 'groove', 'prop_music', 'happy', 'none'),
    mk('tool', 'media', 'success', 'cheer', 'prop_music', 'happy', 'none'),
    mk('tool', 'timer', 'start', 'surprise', 'prop_exclamation', 'surprised', 'none'),
    mk('tool', 'news', 'start', 'coffee_sip', 'prop_coffee', 'none', 'none'),
    mk('tool', 'english', 'start', 'reading_study', 'prop_books', 'none', 'none'),
    mk('tool', 'english', 'success', 'cheer', 'confetti', 'happy', 'none'),
    mk('tool', 'git_status', 'start', 'typing', 'none', 'none', 'none'),
    mk('tool', 'port_manager', 'start', 'typing', 'none', 'none', 'none'),
    mk('tool', 'process_manager', 'start', 'typing', 'none', 'none', 'none'),
    mk('tool', 'clipboard', 'start', 'typing', 'none', 'none', 'none'),
    mk('tool', 'clipboard', 'success', 'nod', 'sparkle', 'happy', 'none'),
    mk('tool', 'clipboard_history', 'start', 'typing', 'none', 'none', 'none'),
    mk('tool', 'sticky_note', 'start', 'hop', 'sparkle', 'happy', 'none'),
    mk('tool', 'sticky_note', 'success', 'nod', 'sparkle', 'happy', 'none'),
    mk('tool', 'system_control', 'start', 'cyber_salute', 'prop_crown_aura', 'none', 'clip'),
    mk('tool', 'control_window', 'start', 'focus_guard', 'none', 'none', 'none'),
    mk('tool', 'window_layout', 'start', 'stretch', 'none', 'happy', 'none'),
    mk('tool', 'macro', 'start', 'super_saiyan_charge', 'prop_lightning_aura', 'none', 'clip'),
    mk('tool', 'workspace', 'start', 'reading_study', 'prop_books', 'none', 'none'),
    mk('tool', 'workspace', 'success', 'proud_carry', 'prop_trophy', 'happy', 'none'),
    mk('tool', 'forge_tool', 'start', 'hologram_code', 'prop_hologram', 'none', 'clip'),
    mk('tool', 'forge_tool', 'success', 'super_saiyan_charge', 'prop_lightning_aura', 'happy', 'clip'),
    mk('tool', 'cloud_hub', 'start', 'hologram_code', 'prop_hologram', 'none', 'none'),
    mk('tool', 'cloud_hub', 'success', 'royal_parade', 'prop_crown_aura', 'happy', 'clip'),
    mk('tool', 'p2p_arena', 'start', 'cyber_salute', 'prop_crown_aura', 'none', 'clip'),
    mk('tool', 'long_memory', 'start', 'focus_guard', 'none', 'none', 'none'),
    mk('tool', 'file_cleanup', 'start', 'scan_look', 'scan', 'none', 'none'),
    mk('tool', 'desktop_icon', 'start', 'scan_look', 'none', 'none', 'none'),
    mk('tool', 'accessory', 'start', 'twirl', 'sparkle', 'happy', 'none'),
    mk('tool', 'swim', 'start', 'twirl', 'sparkle', 'happy', 'none'),
    mk('tool', 'goose_mode', 'start', 'front_flip', 'shockwave', 'happy', 'none'),
    mk('tool', 'beat_dance', 'start', 'groove', 'prop_music', 'happy', 'none'),
    mk('tool', 'random_fx', 'start', 'front_flip', 'shockwave', 'happy', 'none'),
    mk('tool', 'edge_peek', 'start', 'peek', 'none', 'none', 'none'),
    mk('tool', 'edge_peek', 'success', 'focus_guard', 'none', 'none', 'none', { loop: true, cooldownSec: 3.0 }),
    mk('tool', '*', 'success', 'wing_flutter_joy', 'sparkle', 'happy', 'none', { cooldownSec: 1.8 }),
    mk('tool', '*', 'success', 'celebrate_backhop', 'confetti', 'happy', 'clip', { cooldownSec: 1.8 }),
    mk('tool', '*', 'success', 'victory', 'prop_trophy', 'happy', 'none', { cooldownSec: 1.8 }),
    mk('tool', '*', 'error', 'dramatic_flop', 'prop_exclamation', 'sad', 'clip', { cooldownSec: 2.0 }),
    mk('tool', '*', 'error', 'facepalm', 'prop_exclamation', 'sad', 'none', { cooldownSec: 2.0 }),
    mk('tool', '*', 'error', 'head_shake', 'none', 'sad', 'none', { cooldownSec: 2.0 }),

    // Custom Skills & Trạng thái nhân vật
    mk('skill', '*', 'start', 'typing', 'none', 'none', 'none'),
    mk('skill', '*', 'success', 'proud_carry', 'prop_trophy', 'happy', 'clip'),
    mk('skill', '*', 'success', 'victory', 'prop_trophy', 'happy', 'chime'),
    mk('skill', '*', 'error', 'shy_sit', 'prop_exclamation', 'sad', 'clip'),
    mk('skill', '*', 'error', 'sad', 'prop_exclamation', 'sad', 'none'),
    mk('skill', '*', 'error', 'head_shake', 'none', 'sad', 'none'),
    mk('state', 'HEADPAT', 'enter', 'happy_wiggle', 'hearts', 'happy', 'clip', { cooldownSec: 1.2 }),
    mk('state', 'HEADPAT', 'enter', 'love_serenade', 'prop_hearts', 'happy', 'clip', { cooldownSec: 1.2 }),
    mk('state', 'ALERT', 'enter', 'startled_hop', 'prop_exclamation', 'surprised', 'clip'),
    mk('state', 'EATING', 'enter', 'chomp', 'none', 'happy', 'none', { cooldownSec: 1.8 }),
    mk('state', 'TIRED', 'enter', 'sleepy_doze', 'prop_zzz', 'sad', 'clip'),
    mk('state', 'IDLE', 'enter', 'idle_alive', 'none', 'none', 'none', { loop: true, cooldownSec: 10 }),
    mk('state', 'SITTING_WINDOW', 'enter', 'idle_alive', 'none', 'none', 'none', { loop: true, cooldownSec: 12 }),
  ];
}

function sanitizeBinding(raw: Partial<AnimBinding>): AnimBinding | null {
  if (!raw || typeof raw !== 'object') return null;
  const clipId = String(raw.clipId || '');
  if (!CLIP_MAP.has(clipId)) return null;
  const tt = raw.triggerType;
  if (tt !== 'tool' && tt !== 'skill' && tt !== 'state' && tt !== 'event') return null;
  const phase: AnimTriggerPhase =
    raw.phase === 'start' || raw.phase === 'success' || raw.phase === 'error' || raw.phase === 'enter'
      ? raw.phase
      : tt === 'tool' || tt === 'skill'
      ? 'start'
      : 'enter';
  const rawKey = String(raw.triggerKey || '*');
  const normalizedKey = tt === 'tool' ? normalizeToolTriggerKey(rawKey) : rawKey;
  return {
    id: String(raw.id || newId()),
    enabled: raw.enabled !== false,
    triggerType: tt,
    triggerKey: normalizedKey || '*',
    phase,
    clipId,
    durationSec: THREE.MathUtils.clamp(Number(raw.durationSec) || 1.5, 0.4, 12),
    fx: (FX_CATALOG.some((f) => f.id === raw.fx) ? raw.fx : 'none') as AnimFxId,
    expression: (EXPRESSION_CATALOG.some((e) => e.id === raw.expression)
      ? raw.expression
      : 'none') as FaceExpression | 'none',
    sound: (SOUND_CATALOG.some((s) => s.id === raw.sound) ? raw.sound : 'none') as AnimSoundId,
    cooldownSec: THREE.MathUtils.clamp(Number(raw.cooldownSec ?? 1.5), 0, 60),
    fireCount: Math.max(0, Math.floor(Number(raw.fireCount) || 0)),
    loop: raw.loop === true,
  };
}

function migrateLegacyBindings() {
  if (localStorage.getItem(SCHEMA_KEY) === SCHEMA_VERSION) return;
  let dirty = false;

  // Dọn app_start cũ khỏi sparkle+audio gây bật AudioService khi vừa mở app
  for (const b of bindings) {
    if (
      b.triggerType === 'event' &&
      b.triggerKey === 'app_start' &&
      b.clipId === 'polite_bow' &&
      b.fx === 'sparkle' &&
      b.sound === 'clip'
    ) {
      b.fx = 'none';
      b.sound = 'none';
      dirty = true;
    }
  }

  // Bổ sung không phá hủy các quy tắc mới theo cả trigger + clipId
  const defaults = createDefaultBindings();
  for (const def of defaults) {
    const exists = bindings.some(
      (b) =>
        b.triggerType === def.triggerType &&
        b.triggerKey.toLowerCase() === def.triggerKey.toLowerCase() &&
        b.phase === def.phase &&
        b.clipId === def.clipId
    );
    if (!exists) {
      bindings.push(def);
      dirty = true;
    }
  }

  localStorage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
  if (dirty) persistBindings();
}

function loadBindings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        bindings = parsed
          .map((x) => sanitizeBinding(x))
          .filter((x): x is AnimBinding => x !== null);
        migrateLegacyBindings();
        return;
      }
    }
  } catch {
    // dữ liệu hỏng -> dùng mặc định
  }
  bindings = createDefaultBindings();
  localStorage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
  persistBindings();
}

let persistTimer: number | null = null;
function persistBindings() {
  if (persistTimer !== null) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
    } catch {
      // bỏ qua lỗi quota
    }
  }, 120);
}

function emitChange() {
  persistBindings();
  changeListeners.forEach((fn) => fn());
}

export function getBindings(): AnimBinding[] {
  return bindings;
}

export function upsertBinding(b: AnimBinding) {
  const clean = sanitizeBinding(b);
  if (!clean) return;
  const idx = bindings.findIndex((x) => x.id === clean.id);
  if (idx >= 0) bindings[idx] = clean;
  else bindings.unshift(clean);
  emitChange();
}

export function removeBinding(id: string) {
  bindings = bindings.filter((b) => b.id !== id);
  emitChange();
}

export function toggleBinding(id: string, enabled: boolean) {
  const b = bindings.find((x) => x.id === id);
  if (b) {
    b.enabled = enabled;
    emitChange();
  }
}

export function resetBindingsToDefault() {
  bindings = createDefaultBindings();
  emitChange();
}

export function exportBindingsJson(): string {
  return JSON.stringify(bindings, null, 2);
}

export function importBindingsJson(json: string): number {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error('JSON phải là một mảng bindings');
  const list = parsed.map((x) => sanitizeBinding(x)).filter((x): x is AnimBinding => x !== null);
  bindings = list;
  emitChange();
  return list.length;
}

export function isAnimBinderEnabled(): boolean {
  return masterEnabled;
}

export function setAnimBinderEnabled(on: boolean) {
  masterEnabled = on;
  localStorage.setItem(MASTER_KEY, on ? 'true' : 'false');
  if (!on) players.length = 0;
  changeListeners.forEach((fn) => fn());
}

export function onBindingsChanged(fn: () => void): () => void {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

export function onAnimationFired(fn: (b: AnimBinding | null, clip: AnimClipDef) => void): () => void {
  fireListeners.add(fn);
  return () => fireListeners.delete(fn);
}

/* ------------------------------------------------------------------ */
/* 5. Runtime: Phát hoạt ảnh & Overlay Undo/Apply                       */
/* ------------------------------------------------------------------ */

interface ActivePlayer {
  clip: AnimClipDef;
  t: number;
  duration: number;
  loop: boolean;
  boundState: CharacterState | null;
  useClipAudio: boolean;
  firedCues: Set<number>;
}

const MAX_PLAYERS = 3;
const players: ActivePlayer[] = [];
const lastFireAt = new Map<string, number>();

type NumKey = 'x' | 'y' | 'z';
interface AppliedEntry {
  obj: THREE.Object3D;
  kind: 'pos' | 'rot' | 'scale';
  axis: NumKey;
  value: number;
}
let applied: AppliedEntry[] = [];
let savedLedHex: number | null = null;

export function isAnimationOverlayActive(): boolean {
  if (players.length === 0) return false;
  return players.some((p) => !p.clip.ambientLowFps);
}

export function getActiveClipLabels(): string[] {
  return players.map((p) => p.clip.label);
}

export interface PlayClipOptions {
  durationSec?: number;
  loop?: boolean;
  boundState?: CharacterState | null;
  useClipAudio?: boolean;
}

export function playClip(clipId: string, durationOrOpts?: number | PlayClipOptions): boolean {
  const clip = getClipById(clipId);
  if (!clip) return false;
  const opts: PlayClipOptions =
    typeof durationOrOpts === 'number' ? { durationSec: durationOrOpts } : durationOrOpts || {};
  const duration = THREE.MathUtils.clamp(opts.durationSec ?? clip.defaultDuration, 0.4, 12);
  const loop = opts.loop === true;
  const boundState = opts.boundState ?? null;
  const useClipAudio = opts.useClipAudio === true;

  // Cùng clip đang chạy -> làm mới thời lượng thay vì chồng 2 lần
  const existing = players.find((p) => p.clip.id === clip.id);
  if (existing) {
    existing.t = Math.min(existing.t, 0.12);
    existing.duration = duration;
    existing.loop = loop;
    existing.boundState = boundState;
    existing.useClipAudio = useClipAudio;
    existing.firedCues.clear();
    return true;
  }
  // Làm mờ mượt (crossfade 0.18s) các hoạt ảnh cũ thay vì cắt cụt đột ngột gây giật khung xương
  for (const old of players) {
    if (old.clip.id !== clip.id && (old.loop || old.duration - old.t > 0.22)) {
      old.loop = false;
      old.duration = Math.min(old.duration, old.t + 0.18);
    }
  }
  if (players.length >= MAX_PLAYERS) players.shift();
  players.push({
    clip,
    t: 0,
    duration,
    loop,
    boundState,
    useClipAudio,
    firedCues: new Set<number>(),
  });
  return true;
}

export function stopLoopingClipById(clipId: string) {
  for (const pl of players) {
    if (pl.clip.id === clipId) {
      pl.loop = false;
      pl.duration = Math.min(pl.duration, pl.t + 0.20);
    }
  }
}

export function stopAllThinkingClips() {
  stopLoopingClipById('ai_thinking_orbit');
  stopLoopingClipById('think');
}

export function stopAllClips() {
  for (const pl of players) {
    pl.loop = false;
    pl.duration = Math.min(pl.duration, pl.t + 0.16);
  }
  stopAllActionProps3D();
}

function spawnFx(fx: AnimFxId, durationSec = 3.2) {
  if (fx.startsWith('prop_')) {
    spawnActionProp3D(fx as ActionProp3DId, durationSec);
    return;
  }
  const x = appState.posX;
  const y = appState.posY - 90 * appState.modelScale;
  switch (fx) {
    case 'sparkle':
      spawnParticles(x, y, 12, 0x38bdf8);
      break;
    case 'confetti':
      spawnParticles(x, y, 8, 0xf472b6);
      spawnParticles(x, y, 8, 0xfbbf24);
      spawnParticles(x, y, 8, 0x34d399);
      spawnParticles(x, y, 6, 0x818cf8);
      break;
    case 'hearts':
      spawnParticles(x, y - 20, 14, 0xf472b6);
      spawnParticles(x, y - 20, 6, 0xfb7185);
      break;
    case 'stars':
      spawnParticles(x, y - 30, 14, 0xfde047);
      break;
    case 'shockwave':
      spawnShockwave(appState.posX, appState.posY, 0x38bdf8);
      break;
    case 'scan':
      spawnScanEffect(x, y);
      break;
    case 'alert':
      spawnAlertEffect(x, y);
      break;
    case 'smoke':
      spawnDriftSmoke(appState.posX, appState.posY, -1);
      spawnDriftSmoke(appState.posX, appState.posY, 1);
      break;
    default:
      break;
  }
}

function playSound(id: AnimSoundId) {
  const x = appState.posX;
  switch (id) {
    case 'quack':
      playDuckQuackSound(x);
      break;
    case 'chime':
      playSuccessChimeSound(x);
      break;
    case 'jump':
      playJumpSound(x);
      break;
    case 'whoosh':
      playWhooshSound(x);
      break;
    case 'alert':
      playAlertBeep(x);
      break;
    case 'land':
      playLandSound(x);
      break;
    case 'curious':
      playCuriousQuackSound(x);
      break;
    case 'chirp':
      playHappyChirpSound(x);
      break;
    case 'squawk':
      playStartledSquawkSound(x);
      break;
    case 'mutter':
      playShyMutterSound(x);
      break;
    case 'beak_tap':
      playBeakTapSound(x);
      break;
    case 'yawn':
      playSleepyYawnSound(x);
      break;
    case 'wake':
      playWakeStretchSound(x);
      break;
    case 'purr':
      playStalkPurrSound(x);
      break;
    case 'muffled_quack':
      playProudMuffledQuackSound(x);
      break;
    case 'flop_slide':
      playDramaticFlopSound(x);
      break;
    default:
      break;
  }
}

/** Chạy trực tiếp một binding (dùng cho nút Preview trong Manager hoặc từ Trigger). */
export function runBinding(b: AnimBinding, force = false): boolean {
  const clip = getClipById(b.clipId);
  if (!clip) return false;
  const now = performance.now();
  if (!force) {
    const last = lastFireAt.get(b.id) ?? 0;
    if (now - last < b.cooldownSec * 1000) return false;
  }
  lastFireAt.set(b.id, now);
  playClip(b.clipId, {
    durationSec: b.durationSec,
    loop: b.loop === true && !force,
    boundState: !force && b.triggerType === 'state' ? (b.triggerKey as CharacterState) : null,
    useClipAudio: b.sound === 'clip',
  });
  if (b.fx !== 'none') spawnFx(b.fx, b.durationSec);
  if (b.expression !== 'none') appState.setExpression(b.expression, Math.min(4, b.durationSec + 0.4));
  if (b.sound !== 'none' && b.sound !== 'clip') playSound(b.sound);
  if (!force) {
    b.fireCount += 1;
    persistBindings();
  }
  fireListeners.forEach((fn) => fn(b, clip));
  return true;
}

const randomClipDeck: string[] = [];
let lastRandomClipId: string = '';

function refillRandomClipDeck() {
  randomClipDeck.length = 0;
  for (const clip of CLIP_CATALOG) {
    randomClipDeck.push(clip.id);
  }
  for (let i = randomClipDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = randomClipDeck[i];
    randomClipDeck[i] = randomClipDeck[j];
    randomClipDeck[j] = tmp;
  }
  if (randomClipDeck.length > 1 && randomClipDeck[randomClipDeck.length - 1] === lastRandomClipId) {
    const swapIdx = Math.floor(Math.random() * (randomClipDeck.length - 1));
    const top = randomClipDeck[randomClipDeck.length - 1];
    randomClipDeck[randomClipDeck.length - 1] = randomClipDeck[swapIdx];
    randomClipDeck[swapIdx] = top;
  }
}

export function playRandomClipFromDeck(filterFn?: (c: AnimClipDef) => boolean): AnimClipDef {
  let chosen: AnimClipDef | undefined;
  for (let pass = 0; pass < 2 && !chosen; pass++) {
    if (randomClipDeck.length === 0) refillRandomClipDeck();
    for (let i = randomClipDeck.length - 1; i >= 0; i--) {
      const candidate = getClipById(randomClipDeck[i]);
      if (!candidate) {
        randomClipDeck.splice(i, 1);
        continue;
      }
      if (!filterFn || filterFn(candidate)) {
        randomClipDeck.splice(i, 1);
        chosen = candidate;
        break;
      }
    }
    if (!chosen) refillRandomClipDeck();
  }
  const picked = chosen || CLIP_CATALOG[0];
  lastRandomClipId = picked.id;
  previewClip(picked.id);
  if (!picked.defaultFx || picked.defaultFx === 'none') {
    const accentFx: AnimFxId =
      picked.group === 'emotion'
        ? 'hearts'
        : picked.group === 'special'
        ? 'confetti'
        : picked.group === 'motion'
        ? 'stars'
        : 'sparkle';
    spawnFx(accentFx, picked.defaultDuration);
  }
  return picked;
}

export function previewClip(clipId: string) {
  const clip = getClipById(clipId);
  if (!clip) return;
  playClip(clipId, { useClipAudio: true });
  if (clip.defaultFx && clip.defaultFx !== 'none') {
    spawnFx(clip.defaultFx, clip.defaultDuration);
  }
  fireListeners.forEach((fn) => fn(null, clip));
}

function keyMatches(bindingKey: string, key: string): boolean {
  if (bindingKey === '*') return true;
  return bindingKey.toLowerCase() === key.toLowerCase();
}

const triggerCursorMap = new Map<string, number>();
const lastTriggerGroupFireAt = new Map<string, number>();

/**
 * Điểm vào duy nhất để phát trigger từ khắp ứng dụng.
 * Ưu tiên binding khớp chính xác key; nếu nhiều quy tắc cùng gắn vào 1 trigger,
 * luân phiên xoay vòng từng hoạt ảnh để tận dụng đều toàn bộ thư viện.
 */
export function fireAnimationTrigger(
  type: AnimTriggerType,
  key: string,
  phase: AnimTriggerPhase = type === 'tool' || type === 'skill' ? 'start' : 'enter'
): boolean {
  if (!masterEnabled) return false;
  if (appState.state === 'DRAGGING') return false;
  const resolvedKey = type === 'tool' ? normalizeToolTriggerKey(key) : key;
  const candidates = bindings.filter(
    (b) => b.enabled && b.triggerType === type && b.phase === phase && keyMatches(b.triggerKey, resolvedKey)
  );
  if (candidates.length === 0) return false;
  const exact = candidates.filter((b) => b.triggerKey !== '*');
  const pool = exact.length > 0 ? exact : candidates;
  const now = performance.now();
  const groupKey = `${type}:${resolvedKey.toLowerCase()}:${phase}`;
  const minGroupCdMs = Math.min(...pool.map((b) => b.cooldownSec)) * 1000;
  const lastGroupAt = lastTriggerGroupFireAt.get(groupKey) ?? 0;
  if (pool.length > 1 && now - lastGroupAt < minGroupCdMs) {
    return false;
  }
  const ready = pool.filter((b) => now - (lastFireAt.get(b.id) ?? 0) >= b.cooldownSec * 1000);
  if (ready.length === 0) return false;
  const cur = triggerCursorMap.get(groupKey) ?? 0;
  const pick = ready[cur % ready.length];
  triggerCursorMap.set(groupKey, cur + 1);
  lastTriggerGroupFireAt.set(groupKey, now);
  return runBinding(pick);
}

function writeAxis(obj: THREE.Object3D, kind: AppliedEntry['kind'], axis: NumKey, value: number) {
  if (kind === 'pos') obj.position[axis] += value;
  else if (kind === 'rot') obj.rotation[axis] += value;
  else obj.scale[axis] *= value;
}

function undoAxis(e: AppliedEntry) {
  if (e.kind === 'pos') e.obj.position[e.axis] -= e.value;
  else if (e.kind === 'rot') e.obj.rotation[e.axis] -= e.value;
  else if (Math.abs(e.value) > 1e-6) e.obj.scale[e.axis] /= e.value;
}

/** Gọi ĐẦU mỗi frame (trước vật lý & diễn hoạt gốc). */
export function beginAnimationOverlayFrame() {
  if (savedLedHex !== null && duckNodes.cameraRingMat) {
    duckNodes.cameraRingMat.color.setHex(savedLedHex);
    savedLedHex = null;
  }
  if (applied.length === 0) return;
  for (let i = applied.length - 1; i >= 0; i--) undoAxis(applied[i]);
  applied = [];
}

const accum: Required<PoseOffset> = {
  rootX: 0,
  rootY: 0,
  rootRotX: 0,
  rootRotY: 0,
  rootRotZ: 0,
  scaleX: 0,
  scaleY: 0,
  hipsY: 0,
  hipsZ: 0,
  torsoX: 0,
  torsoZ: 0,
  neckX: 0,
  headX: 0,
  headY: 0,
  headZ: 0,
  beak: 0,
  beakUpper: 0,
  legLX: 0,
  legRX: 0,
  legLZ: 0,
  legRZ: 0,
  shinLX: 0,
  shinRX: 0,
  armLZ: 0,
  armRZ: 0,
  wingLZ: 0,
  wingRZ: 0,
  wingLX: 0,
  wingRX: 0,
  tailY: 0,
  tailX: 0,
  earZ: 0,
};

/** Gọi CUỐI mỗi frame (sau diễn hoạt gốc, trước render). */
export function applyAnimationOverlayFrame(delta: number) {
  if (players.length === 0) return;
  if (appState.state === 'DRAGGING') {
    players.length = 0;
    return;
  }

  (Object.keys(accum) as Array<keyof PoseOffset>).forEach((k) => {
    accum[k] = 0;
  });

  let desiredLed: number | null = null;

  for (let i = players.length - 1; i >= 0; i--) {
    const pl = players[i];
    pl.t += delta;

    // Nếu là vòng lặp gắn với 1 trạng thái và nhân vật vừa rời trạng thái đó -> kết thúc êm trong 0.22s
    if (pl.loop && pl.boundState && appState.state !== pl.boundState) {
      pl.loop = false;
      pl.duration = Math.min(pl.duration, pl.t + 0.22);
    }

    if (pl.t >= pl.duration) {
      if (pl.loop) {
        pl.t = pl.t % pl.duration;
        pl.firedCues.clear();
      } else {
        players.splice(i, 1);
        continue;
      }
    }

    // Phát âm thanh đồng bộ theo từng pha của hoạt ảnh
    if (pl.useClipAudio && pl.clip.soundCues && pl.clip.soundCues.length > 0) {
      for (let c = 0; c < pl.clip.soundCues.length; c++) {
        const cue = pl.clip.soundCues[c];
        if (!pl.firedCues.has(c) && pl.t >= cue.atSec) {
          pl.firedCues.add(c);
          playSound(cue.sound);
        }
      }
    }

    const p = pl.t / pl.duration;
    // Đường bao mềm: vào 0.18s / ra 0.22s để không giật (loop bỏ fade-in/out sau vòng 1)
    const envIn = pl.t < 0.18 ? pl.t / 0.18 : 1;
    const envOut = !pl.loop && pl.duration - pl.t < 0.22 ? (pl.duration - pl.t) / 0.22 : 1;
    const env = Math.max(0, Math.min(1, envIn, envOut));

    const pose = pl.clip.pose(pl.t, p);
    for (const k in pose) {
      const key = k as keyof PoseOffset;
      const v = pose[key];
      if (typeof v === 'number' && Number.isFinite(v)) accum[key] += v * env;
    }

    if (pl.clip.ledColor && desiredLed === null) {
      const c = pl.clip.ledColor(pl.t, p);
      if (typeof c === 'number') desiredLed = c;
    }
  }

  if (desiredLed !== null && duckNodes.cameraRingMat) {
    savedLedHex = duckNodes.cameraRingMat.color.getHex();
    duckNodes.cameraRingMat.color.setHex(desiredLed);
  }

  if (players.length === 0 && accum.rootY === 0) return;

  const s = appState.modelScale || 1;
  const group = appState.avatarGroup;
  const push = (obj: THREE.Object3D | null, kind: AppliedEntry['kind'], axis: NumKey, value: number) => {
    if (!obj) return;
    if (kind === 'scale' ? Math.abs(value - 1) < 1e-5 : Math.abs(value) < 1e-5) return;
    writeAxis(obj, kind, axis, value);
    applied.push({ obj, kind, axis, value });
  };
  const pushClamped = (
    obj: THREE.Object3D | null,
    kind: 'pos' | 'rot',
    axis: NumKey,
    rawDelta: number,
    minVal: number,
    maxVal: number
  ): number => {
    if (!obj || Math.abs(rawDelta) < 1e-5) return 0;
    const cur = kind === 'pos' ? obj.position[axis] : obj.rotation[axis];
    const target = THREE.MathUtils.clamp(cur + rawDelta, minVal, maxVal);
    const appliedDelta = target - cur;
    if (Math.abs(appliedDelta) < 1e-5) return 0;
    writeAxis(obj, kind, axis, appliedDelta);
    applied.push({ obj, kind, axis, value: appliedDelta });
    return appliedDelta;
  };

  if (group) {
    push(group, 'pos', 'x', accum.rootX * s);
    push(group, 'pos', 'y', accum.rootY * s);
    push(group, 'rot', 'x', accum.rootRotX);
    push(group, 'rot', 'y', accum.rootRotY);
    push(group, 'rot', 'z', accum.rootRotZ);
    push(group, 'scale', 'x', Math.max(0.5, 1 + accum.scaleX));
    push(group, 'scale', 'y', Math.max(0.5, 1 + accum.scaleY));
    push(group, 'scale', 'z', Math.max(0.5, 1 + accum.scaleX));
  }

  // Khung xương nội bộ chỉ áp dụng cho nhân vật dựng sẵn (MicroDuck / Idol)
  if (!appState.currentVrm && !appState.currentGlbScene) {
    if (appState.builtinModelType === 'microduck') {
      pushClamped(rigHips, 'pos', 'y', accum.hipsY, 38, 84);
      push(rigHips, 'pos', 'z', accum.hipsZ);
      pushClamped(rigTorso, 'rot', 'x', accum.torsoX, -0.55, 0.72);
      push(rigTorso, 'rot', 'z', accum.torsoZ);
      pushClamped(rigHead, 'rot', 'x', accum.headX, -0.62, 0.68);
      push(rigHead, 'rot', 'y', accum.headY);
      push(rigHead, 'rot', 'z', accum.headZ);
      const appliedLegL = pushClamped(rigLeftLeg, 'rot', 'x', accum.legLX, -1.25, 1.05);
      const appliedLegR = pushClamped(rigRightLeg, 'rot', 'x', accum.legRX, -1.25, 1.05);
      push(rigLeftLeg, 'rot', 'z', accum.legLZ);
      push(rigRightLeg, 'rot', 'z', accum.legRZ);
      const appliedShinL = pushClamped(rigLeftShin, 'rot', 'x', accum.shinLX, -1.65, 0.45);
      const appliedShinR = pushClamped(rigRightShin, 'rot', 'x', accum.shinRX, -1.65, 0.45);

      pushClamped(duckNodes.neck, 'rot', 'x', accum.neckX, -0.65, 0.72);
      pushClamped(duckNodes.beakUpper, 'rot', 'x', accum.beakUpper, -0.75, 0.25);
      pushClamped(duckNodes.beakLower, 'rot', 'x', accum.beak, -0.15, 1.15);

      const totalWingLZ = accum.wingLZ - Math.abs(accum.armLZ) * 0.65;
      const totalWingRZ = accum.wingRZ + Math.abs(accum.armRZ) * 0.65;
      pushClamped(rigLeftArm, 'rot', 'z', totalWingLZ, -1.55, 0.25);
      pushClamped(rigRightArm, 'rot', 'z', totalWingRZ, -0.25, 1.55);
      pushClamped(rigLeftArm, 'rot', 'x', accum.wingLX, -0.85, 0.85);
      pushClamped(rigRightArm, 'rot', 'x', accum.wingRX, -0.85, 0.85);
      pushClamped(duckNodes.tail, 'rot', 'y', accum.tailY, -0.65, 0.65);
      pushClamped(duckNodes.tail, 'rot', 'x', accum.tailX, -0.45, 0.55);
      pushClamped(duckNodes.earLeft, 'rot', 'z', -accum.earZ, -0.45, 0.45);
      pushClamped(duckNodes.earRight, 'rot', 'z', accum.earZ, -0.45, 0.45);

      // Giữ bàn chân chạm phẳng sàn theo đúng delta khớp gối/đùi thực tế đã áp dụng
      if (
        duckNodes.feet.length === 2 &&
        Math.abs(accum.rootRotZ) < 0.35 &&
        Math.abs(accum.rootRotX) < 0.35
      ) {
        push(duckNodes.feet[0], 'rot', 'x', -(appliedLegL + appliedShinL));
        push(duckNodes.feet[1], 'rot', 'x', -(appliedLegR + appliedShinR));
      }
    } else {
      push(rigHips, 'pos', 'y', accum.hipsY);
      push(rigHips, 'pos', 'z', accum.hipsZ);
      push(rigTorso, 'rot', 'x', accum.torsoX);
      push(rigTorso, 'rot', 'z', accum.torsoZ);
      push(rigHead, 'rot', 'x', accum.headX);
      push(rigHead, 'rot', 'y', accum.headY);
      push(rigHead, 'rot', 'z', accum.headZ);
      push(rigLeftLeg, 'rot', 'x', accum.legLX);
      push(rigRightLeg, 'rot', 'x', accum.legRX);
      push(rigLeftLeg, 'rot', 'z', accum.legLZ);
      push(rigRightLeg, 'rot', 'z', accum.legRZ);
      push(rigLeftShin, 'rot', 'x', accum.shinLX);
      push(rigRightShin, 'rot', 'x', accum.shinRX);
      push(rigLeftArm, 'rot', 'z', accum.armLZ);
      push(rigRightArm, 'rot', 'z', accum.armRZ);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 6. Khởi tạo: lắng nghe Trạng thái & mở Trang (panel)                 */
/* ------------------------------------------------------------------ */

let initialized = false;
let lastTrackedState: CharacterState = 'IDLE';

/**
 * Theo dõi chuyển trạng thái nhân vật. Gọi mỗi frame từ vòng lặp chính:
 * bắt được cả các chỗ gán trực tiếp appState.state = ... (không qua setState).
 */
export function trackCharacterStateTransition() {
  const cur = appState.state;
  if (cur === lastTrackedState) return;
  lastTrackedState = cur;
  fireAnimationTrigger('state', cur, 'enter');
}

export function initAnimationBinder() {
  if (initialized) return;
  initialized = true;
  loadBindings();

  lastTrackedState = appState.state;

  // Theo dõi các "trang" (modal/panel) khi được mở: chỉ quan sát thuộc tính style
  // của đúng các phần tử này -> chi phí gần như bằng 0 (không quét DOM theo frame).
  const panelIds = EVENT_TRIGGER_CATALOG.filter((e) => e.key.startsWith('panel:')).map((e) =>
    e.key.slice(6)
  );
  const visibility = new Map<string, boolean>();
  const isShown = (el: HTMLElement) => {
    const d = el.style.display;
    if (d === 'none') return false;
    if (d) return true;
    return !el.classList.contains('collapsed') && !el.classList.contains('hidden');
  };
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      const el = r.target as HTMLElement;
      const shown = isShown(el);
      const was = visibility.get(el.id) ?? false;
      visibility.set(el.id, shown);
      if (shown && !was) fireAnimationTrigger('event', `panel:${el.id}`, 'enter');
    }
  });
  const attach = () => {
    for (const id of panelIds) {
      const el = document.getElementById(id);
      if (!el || visibility.has(id)) continue;
      visibility.set(id, isShown(el));
      observer.observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
    }
  };
  attach();
  window.setTimeout(attach, 1500);

  window.setTimeout(() => fireAnimationTrigger('event', 'app_start', 'enter'), 1800);
  window.setTimeout(() => {
    if (appState.state === 'IDLE' && players.length === 0) {
      fireAnimationTrigger('state', 'IDLE', 'enter');
    }
  }, 4500);
}
