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
  result.landmarks.forEach((hand, hi) => {
    const color = COLORS[hi % COLORS.length];
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, w / 220);
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.moveTo(hand[a].x * w, hand[a].y * h);
      ctx.lineTo(hand[b].x * w, hand[b].y * h);
    }
    ctx.stroke();
    ctx.fillStyle = color;
    const r = Math.max(3, w / 160);
    for (const p of hand) {
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // wrist marker label
    ctx.font = `${Math.max(12, w / 40)}px Consolas, monospace`;
    ctx.fillText(`hand ${hi + 1}`, hand[0].x * w + 8, hand[0].y * h - 8);
  });
}
