/**
 * HANDSPEAK — hand tracking layer ("the eyes").
 *
 * Wraps MediaPipe HandLandmarker: 21 3D landmarks per hand, up to 2 hands.
 * Runs fully in-browser (WASM + WebGL), no server, no API keys.
 * The landmark vectors feed our OWN classifier (trained Day 2) — MediaPipe
 * only locates the hand; reading the letter is our model.
 */
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';

/** MediaPipe 21-landmark skeleton topology (pairs of joint indices). */
export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  // thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // middle
  [5, 9], [9, 10], [10, 11], [11, 12],
  // ring
  [9, 13], [13, 14], [14, 15], [15, 16],
  // pinky
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

const COLORS = ['#35e0ff', '#7cffb2'];

let landmarker: HandLandmarker | null = null;
let currentMode: 'IMAGE' | 'VIDEO' = 'IMAGE';

export async function initHands(runningMode: 'IMAGE' | 'VIDEO'): Promise<void> {
  if (landmarker && currentMode === runningMode) return;
  if (landmarker) { landmarker.close(); landmarker = null; }

  const fileset = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}wasm`);
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: `${import.meta.env.BASE_URL}models/hand_landmarker.task`, delegate },
    runningMode,
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  try {
    landmarker = await HandLandmarker.createFromOptions(fileset, options('GPU'));
  } catch {
    // Some iGPUs/drivers reject the WebGL delegate — fall back to CPU.
    landmarker = await HandLandmarker.createFromOptions(fileset, options('CPU'));
  }
  currentMode = runningMode;
}

export function detectImage(img: HTMLImageElement): HandLandmarkerResult {
  if (!landmarker || currentMode !== 'IMAGE') throw new Error('not in IMAGE mode');
  return landmarker.detect(img);
}

export function detectVideo(video: HTMLVideoElement, tsMs: number): HandLandmarkerResult {
  if (!landmarker || currentMode !== 'VIDEO') throw new Error('not in VIDEO mode');
  return landmarker.detectForVideo(video, tsMs);
}

/** Draw skeleton + joints over the media. Coords are normalized 0..1. */
export function drawResult(
  ctx: CanvasRenderingContext2D,
  result: HandLandmarkerResult,
  w: number,
  h: number,
): void {
  ctx.clearRect(0, 0, w, h);
  const TIPS = new Set([4, 8, 12, 16, 20]);
  result.landmarks.forEach((hand, hi) => {
    const color = COLORS[hi % COLORS.length];
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // palm frame: subtle; finger bones: bright with glow
    const FRAME = new Set(['0-5', '5-9', '9-13', '13-17', '0-17']);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = Math.max(1.2, w / 380);
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      if (!FRAME.has(`${a}-${b}`)) continue;
      ctx.moveTo(hand[a].x * w, hand[a].y * h);
      ctx.lineTo(hand[b].x * w, hand[b].y * h);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowColor = color;
    ctx.shadowBlur = 7;
    ctx.lineWidth = Math.max(1.8, w / 280);
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      if (FRAME.has(`${a}-${b}`)) continue;
      ctx.moveTo(hand[a].x * w, hand[a].y * h);
      ctx.lineTo(hand[b].x * w, hand[b].y * h);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    // joints: soft halo + bright core, fingertips emphasized
    const r = Math.max(2.5, w / 200);
    hand.forEach((p, i) => {
      const rr = TIPS.has(i) ? r * 1.4 : r;
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, rr * 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, rr, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  });
}
