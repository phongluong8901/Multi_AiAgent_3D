import * as THREE from 'three';
import { FaceExpression } from '../../core/types';

let faceCanvas: HTMLCanvasElement | null = null;
let faceCtx: CanvasRenderingContext2D | null = null;
let faceTexture: THREE.CanvasTexture | null = null;
let currentDrawnExpression: FaceExpression | null = null;

export function initFaceCanvas(): THREE.CanvasTexture {
  faceCanvas = document.createElement('canvas');
  faceCanvas.width = 256;
  faceCanvas.height = 256;
  faceCtx = faceCanvas.getContext('2d');
  faceTexture = new THREE.CanvasTexture(faceCanvas);
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  currentDrawnExpression = null;
  updateFaceTexture('neutral');
  return faceTexture;
}

export function resetFaceCanvas(): void {
  faceCanvas = null;
  faceCtx = null;
  faceTexture = null;
  currentDrawnExpression = null;
}

export function updateFaceTexture(expression: FaceExpression): void {
  if (!faceCtx || !faceCanvas || !faceTexture || currentDrawnExpression === expression) {
    return;
  }
  currentDrawnExpression = expression;

  const w = faceCanvas.width;
  const h = faceCanvas.height;
  const ctx = faceCtx;

  ctx.fillStyle = '#ffeedd';
  ctx.fillRect(0, 0, w, h);

  const cx = w * 0.5;
  const eyeY = h * 0.53;
  const leftEyeX = cx - 26;
  const rightEyeX = cx + 26;

  ctx.fillStyle = 'rgba(244, 114, 182, 0.36)';
  ctx.beginPath();
  ctx.ellipse(leftEyeX - 6, eyeY + 18, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(rightEyeX + 6, eyeY + 18, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#312e81';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  const browOffset =
    expression === 'surprised' ? -5 : expression === 'sad' ? 3 : 0;
  ctx.beginPath();
  ctx.moveTo(leftEyeX - 10, eyeY - 18 + browOffset);
  ctx.quadraticCurveTo(leftEyeX, eyeY - 21 + browOffset, leftEyeX + 10, eyeY - 17 + browOffset);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(rightEyeX - 10, eyeY - 17 + browOffset);
  ctx.quadraticCurveTo(rightEyeX, eyeY - 21 + browOffset, rightEyeX + 10, eyeY - 18 + browOffset);
  ctx.stroke();

  const drawEye = (ex: number) => {
    if (expression === 'blink') {
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(ex - 11, eyeY + 2);
      ctx.quadraticCurveTo(ex, eyeY + 6, ex + 11, eyeY + 2);
      ctx.stroke();
      return;
    }

    if (expression === 'happy') {
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 3.8;
      ctx.beginPath();
      ctx.moveTo(ex - 11, eyeY + 3);
      ctx.quadraticCurveTo(ex, eyeY - 9, ex + 11, eyeY + 3);
      ctx.stroke();
      return;
    }

    const rX = expression === 'surprised' ? 10 : 11;
    const rY = expression === 'surprised' ? 14 : 13;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, rX, rY, 0, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createLinearGradient(ex, eyeY - rY, ex, eyeY + rY);
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(0.5, '#4f46e5');
    grad.addColorStop(1, '#38bdf8');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY + 1, rX * 0.78, rY * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY + 1, rX * 0.42, rY * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex - 3.5, eyeY - 4, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + 3.5, eyeY + 4, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(ex, eyeY + 2, rX + 1, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
  };

  drawEye(leftEyeX);
  drawEye(rightEyeX);

  ctx.fillStyle = 'rgba(225, 165, 130, 0.75)';
  ctx.beginPath();
  ctx.arc(cx, eyeY + 17, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#9f1239';
  ctx.fillStyle = '#fb7185';
  ctx.lineWidth = 2.4;
  const mouthY = eyeY + 28;

  if (expression === 'happy') {
    ctx.beginPath();
    ctx.moveTo(cx - 9, mouthY - 1);
    ctx.quadraticCurveTo(cx, mouthY + 11, cx + 9, mouthY - 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (expression === 'surprised') {
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 3, 5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (expression === 'talk') {
    ctx.beginPath();
    ctx.ellipse(cx, mouthY + 2, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (expression === 'sad') {
    ctx.beginPath();
    ctx.moveTo(cx - 8, mouthY + 3);
    ctx.quadraticCurveTo(cx, mouthY - 6, cx + 8, mouthY + 3);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(cx - 6, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + 5, cx + 6, mouthY);
    ctx.stroke();
  }

  faceTexture.needsUpdate = true;
}

