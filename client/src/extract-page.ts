/**
 * HANDSPEAK — bulk landmark extraction, in-browser edition.
 *
 * MediaPipe tasks-vision needs a DOM, so extraction runs in the browser
 * (GPU delegate) instead of Node. Loads the image manifest produced by
 * `training/make_manifest.mjs`, detects + normalizes every hand, and exposes
 * results on window for the build driver to collect:
 *   window.__progress  {done, total, detected, failed, finished}
 *   window.__chunk(i, size) → JSON string of samples[i*size : (i+1)*size]
 */
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { normalizeHand } from './normalize';

declare global {
  interface Window {
    __progress: { done: number; total: number; detected: number; failed: number; finished: boolean; error?: string };
    __chunk: (i: number, size: number) => string;
    __count: () => number;
    __meta: () => string;
  }
}

const log = (m: string) => { document.getElementById('log')!.textContent = m; };

const FS = '/@fs/C:/Users/chat2/handspeak/training/data';
const manifest: string[] = await (await fetch(`${FS}/manifest.json`)).json();
const startIdx = Math.max(0, Number(new URLSearchParams(location.search).get('from') ?? 0) || 0);

const fileset = await FilesetResolver.forVisionTasks('/wasm');
const landmarker = await HandLandmarker.createFromOptions(fileset, {
  baseOptions: { modelAssetPath: '/models/hand_landmarker.task', delegate: 'GPU' },
  runningMode: 'IMAGE',
  numHands: 1,
  minHandDetectionConfidence: 0.4,
});

const samples: { label: string; v: number[]; src: string }[] = [];
window.__progress = { done: startIdx, total: manifest.length, detected: 0, failed: 0, finished: false };
window.__chunk = (i, size) => JSON.stringify(samples.slice(i * size, (i + 1) * size));
window.__count = () => samples.length;
window.__meta = () => JSON.stringify({
  app: 'handspeak', created: new Date().toISOString(),
  source: 'Marxulia/asl_sign_languages_alphabets_v03 (Hugging Face)',
  features: 63, layout: '21 landmarks xyz, wrist-centered, palm-scaled, rotation-canonical',
  progress: window.__progress,
});

const img = new Image();
let li = 0;
for (const rel of manifest.slice(startIdx)) {
  const label = rel.split('/')[0];
  try {
    img.src = `${FS}/images/${rel}`;
    await img.decode();
    const res = landmarker.detect(img);
    if (res.landmarks.length) {
      samples.push({ label, v: Array.from(normalizeHand(res.landmarks[0])), src: rel, idx: startIdx + li });
      window.__progress.detected++;
    } else {
      window.__progress.failed++;
    }
  } catch (e) {
    window.__progress.failed++;
    window.__progress.error = String((e && (e as Error).message) || e);
  }
  li++;
  window.__progress.done++;
  if (window.__progress.done % 250 === 0) {
    log(`${window.__progress.done}/${manifest.length} · detected ${window.__progress.detected} · failed ${window.__progress.failed}`);
  }
}
window.__progress.finished = true;
log(`DONE: ${samples.length} samples from ${manifest.length} images`);
