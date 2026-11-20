/**
 * HANDSPEAK — app shell.
 * Conversation view: sign → letters → words → speech (left), and
 * text/voice → signing robot (right), with a shared transcript.
 * Studio view: dataset recorder + model info (the training tools).
 */
import { initHands, detectImage, detectVideo, drawResult } from './hands';
import { normalizeHand, VECTOR_LEN } from './normalize';
import { loadClassifier, predict, classifierReady, type Prediction } from './classifier';
import { Speller } from './spell';
import { Avatar } from './avatar';
import { KNOWN_WORDS } from './signs';
import { speak, setVoiceEnabled, isVoiceEnabled, startListening, type ListenHandle } from './speech';

const BASE = import.meta.env.BASE_URL;
const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

// ---------- DOM ----------
const statusEl = $('status');
const stage = $('stage');
const video = $<HTMLVideoElement>('video');
const image = $<HTMLImageElement>('image');
const overlay = $<HTMLCanvasElement>('overlay');
const hint = $('stage-hint');
const ctx = overlay.getContext('2d')!;
const bigLetter = $('big-letter');
const lockRing = $('lock-ring') as unknown as SVGCircleElement;
const candidatesEl = $('candidates');
const wordBuilt = $('word-built');
const confBar = $('conf-bar');
const gapBar = $('gap-bar');
const caption = $('avatar-caption');
const transcript = $('transcript');
const textInput = $<HTMLInputElement>('text-input');

// ---------- state ----------
type Mode = 'camera' | 'image';
let mode: Mode = 'image';
let stream: MediaStream | null = null;
let raf = 0;
let lastLandmarks: { x: number; y: number; z: number }[][] = [];
let lastPred: Prediction | null = null;
let lastFrame = performance.now();
let avatar: Avatar;
let listenHandle: ListenHandle | null = null;

const speller = new Speller({
  onLetter: () => { wordBuilt.textContent = speller.state.word; },
  onWord: (w) => {
    wordBuilt.textContent = '';
    addBubble('sign', w);
    speak(w);
  },
});

function setStatus(text: string, cls: 'loading' | 'ready' | 'error') {
  statusEl.textContent = text;
  statusEl.className = `status ${cls}`;
}

function addBubble(kind: 'sign' | 'voice' | 'system', text: string) {
  const div = document.createElement('div');
  div.className = `bubble ${kind}`;
  div.textContent = text;
  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = new Date().toLocaleTimeString();
  div.appendChild(meta);
  transcript.appendChild(div);
  transcript.scrollTop = transcript.scrollHeight;
}

// ---------- HUD ----------
const RING_C = 175.9;
function updateHUD() {
  const s = speller.state;
  const shown = mode === 'camera' ? s.candidate : lastPred?.letter ?? null;
  bigLetter.textContent = shown ?? '–';
  const top2 = mode === 'camera' ? s.top2 : lastPred?.top2 ?? [];
  candidatesEl.textContent = top2.length
    ? top2.map(t => `${t.letter} ${(t.conf * 100).toFixed(0)}%`).join('   ·   ')
    : 'waiting for a hand…';
  wordBuilt.textContent = s.word;
  const conf = mode === 'camera' ? s.conf : lastPred?.conf ?? 0;
  confBar.style.width = `${(conf * 100).toFixed(1)}%`;
  gapBar.style.width = `${(s.gapProgress * 100).toFixed(1)}%`;
  lockRing.style.strokeDashoffset = String(RING_C * (1 - (mode === 'camera' ? s.lockProgress : 0)));
}

// ---------- prediction ----------
function predictFromLandmarks(): Prediction | null {
  if (!lastLandmarks.length || !classifierReady()) return null;
  return predict(normalizeHand(lastLandmarks[0]));
}

// ---------- image mode ----------
function sizeOverlay(w: number, h: number) { overlay.width = w; overlay.height = h; }

async function enterImageMode() {
  mode = 'image';
  stopCamera();
  $('btn-image').classList.add('active');
  $('btn-camera').classList.remove('active');
  stage.classList.remove('mirrored');
  video.hidden = true;
  setStatus('loading model…', 'loading');
  await initHands('IMAGE');
  setStatus(classifierReady() ? 'ready · image mode' : 'ready · classifier pending', 'ready');
  if (!image.hidden && image.complete) runImage();
}
function runImage() {
  sizeOverlay(image.naturalWidth, image.naturalHeight);
  const result = detectImage(image);
  lastLandmarks = result.landmarks;
  drawResult(ctx, result, overlay.width, overlay.height);
  lastPred = predictFromLandmarks();
  hint.hidden = true;
  updateHUD();
}
function loadImageSrc(src: string) {
  image.onload = () => { image.hidden = false; runImage(); };
  image.src = src;
}
$('btn-upload').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) loadImageSrc(URL.createObjectURL(f));
});
$('btn-test').addEventListener('click', () => loadImageSrc(`${BASE}test/hand-sample.jpg`));
$('btn-image').addEventListener('click', () => void enterImageMode());

// ---------- camera mode ----------
function stopCamera() {
  cancelAnimationFrame(raf);
  stream?.getTracks().forEach(t => t.stop());
  stream = null;
}
async function enterCameraMode() {
  mode = 'camera';
  $('btn-camera').classList.add('active');
  $('btn-image').classList.remove('active');
  stage.classList.add('mirrored');
  image.hidden = true;
  hint.hidden = true;
  setStatus('starting camera…', 'loading');
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
  } catch (err) {
    setStatus('camera unavailable', 'error');
    hint.hidden = false;
    hint.textContent = `Camera error: ${(err as Error).name}. Use image mode instead.`;
    mode = 'image';
    $('btn-image').classList.add('active');
    $('btn-camera').classList.remove('active');
    return;
  }
  video.srcObject = stream;
  video.hidden = false;
  await video.play();
  await initHands('VIDEO');
  setStatus('ready · camera mode', 'ready');
  sizeOverlay(video.videoWidth, video.videoHeight);
  lastFrame = performance.now();
  const loop = () => {
    if (mode !== 'camera') return;
    const now = performance.now();
    const dt = Math.min(now - lastFrame, 100);
    lastFrame = now;
    if (video.readyState >= 2) {
      const result = detectVideo(video, now);
      lastLandmarks = result.landmarks;
      drawResult(ctx, result, overlay.width, overlay.height);
      lastPred = predictFromLandmarks();
      speller.feed(lastPred, dt);
      if (recording && lastLandmarks.length) {
        samples.push({ label: letterSel.value, v: Array.from(normalizeHand(lastLandmarks[0])) });
        persist();
        $('rec-progress').textContent = `recording… ${samples.length}/${recordTarget}`;
        if (samples.length >= recordTarget) { recording = false; flash(`Done — 30 frames of ${letterSel.value}.`); }
      }
      updateHUD();
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}
$('btn-camera').addEventListener('click', () => void enterCameraMode());

// ---------- manual commits (image mode / accessibility) ----------
$('btn-commit-letter').addEventListener('click', () => {
  const l = mode === 'camera' ? speller.state.candidate : lastPred?.letter;
  if (l) speller.commitLetter(l);
  updateHUD();
});
$('btn-commit-word').addEventListener('click', () => { speller.commitWord(); updateHUD(); });
$('btn-backspace').addEventListener('click', () => { speller.backspace(); updateHUD(); });

// ---------- avatar / output side ----------
function signIt(text: string) {
  const clean = text.trim();
  if (!clean) return;
  if (avatar.busy) { caption.textContent = 'still signing — one moment…'; return; }
  addBubble('voice', clean);
  caption.textContent = `signing “${clean}”…`;
  avatar.signText(clean, {
    onLetter: (l) => { caption.textContent = `fingerspelling: ${l}`; },
    onWord: (w) => { caption.textContent = `signing: ${w}`; },
    onDone: () => { caption.textContent = 'ready — type or speak, and I\'ll sign it back'; },
  });
}
$('btn-sign-it').addEventListener('click', () => { signIt(textInput.value); textInput.value = ''; });
textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { signIt(textInput.value); textInput.value = ''; }
});
$('btn-voice').addEventListener('click', () => {
  setVoiceEnabled(!isVoiceEnabled());
  const b = $('btn-voice');
  b.textContent = isVoiceEnabled() ? '🔊 voice on' : '🔇 voice off';
  b.classList.toggle('active', isVoiceEnabled());
});
$('btn-mic').addEventListener('click', () => {
  const btn = $('btn-mic');
  if (listenHandle) { listenHandle.stop(); listenHandle = null; btn.classList.remove('listening'); return; }
  listenHandle = startListening(
    (text, final) => { textInput.value = text; if (final) { signIt(text); textInput.value = ''; } },
    () => { btn.classList.remove('listening'); listenHandle = null; },
  );
  if (listenHandle) btn.classList.add('listening');
  else caption.textContent = 'speech recognition not supported here — type instead (Chrome supports mic)';
});
const quick = $('quick-words');
for (const w of KNOWN_WORDS.slice(0, 9)) {
  const b = document.createElement('button');
  b.textContent = w;
  b.addEventListener('click', () => signIt(w));
  quick.appendChild(b);
}
$('btn-clear-transcript').addEventListener('click', () => { transcript.innerHTML = ''; });

// ---------- tabs ----------
function showTab(which: 'conversation' | 'studio') {
  $('view-conversation').hidden = which !== 'conversation';
  $('view-studio').hidden = which !== 'studio';
  $('tab-conversation').classList.toggle('active', which === 'conversation');
  $('tab-studio').classList.toggle('active', which === 'studio');
  if (which === 'conversation') avatar.resize();
}
$('tab-conversation').addEventListener('click', () => showTab('conversation'));
$('tab-studio').addEventListener('click', () => showTab('studio'));

// ---------- studio: dataset recorder ----------
interface Sample { label: string; v: number[] }
const STORE_KEY = 'handspeak-dataset-v1';
let samples: Sample[] = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]');
let recording = false;
let recordTarget = 0;

const letterSel = $<HTMLSelectElement>('letter');
for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
  const opt = document.createElement('option');
  opt.value = c; opt.textContent = c;
  letterSel.appendChild(opt);
}
function persist() { localStorage.setItem(STORE_KEY, JSON.stringify(samples)); renderCounts(); }
function renderCounts() {
  const counts = new Map<string, number>();
  for (const s of samples) counts.set(s.label, (counts.get(s.label) ?? 0) + 1);
  $('counts').textContent = counts.size
    ? [...counts.entries()].map(([k, n]) => `${k}:${n}`).join('  ') + `  (total ${samples.length})`
    : 'none yet';
}
function flash(msg: string) {
  const el = $('rec-progress');
  el.textContent = msg;
  setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 2500);
}
$('btn-add-sample').addEventListener('click', () => {
  if (!lastLandmarks.length) { flash('No hand detected — nothing to sample.'); return; }
  samples.push({ label: letterSel.value, v: Array.from(normalizeHand(lastLandmarks[0])) });
  persist();
  flash(`Sample added: ${letterSel.value} (${samples.length} total)`);
});
$('btn-record').addEventListener('click', () => {
  if (mode !== 'camera') { flash('Recording needs camera mode (Conversation tab).'); return; }
  recording = true; recordTarget = samples.length + 30;
  flash('Recording 30 frames — hold the letter steady…');
});
$('btn-download').addEventListener('click', () => {
  const payload = {
    meta: {
      app: 'handspeak', created: new Date().toISOString(),
      features: VECTOR_LEN,
      layout: '21 landmarks × xyz; wrist-centered, palm-scaled, rotation-canonical (see normalize.ts)',
    },
    samples,
  };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'handspeak-dataset.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
$('btn-clear').addEventListener('click', () => { samples = []; persist(); flash('Dataset cleared.'); });
renderCounts();

// ---------- boot ----------
avatar = new Avatar($('avatar') as HTMLCanvasElement);
window.addEventListener('resize', () => avatar.resize());

(async () => {
  try {
    await enterImageMode();
    loadImageSrc(`${BASE}test/hand-sample.jpg`);
  } catch (err) {
    setStatus(`init failed: ${(err as Error).message}`, 'error');
  }
  try {
    const m = await loadClassifier();
    $('model-info').innerHTML =
      `letters.json · val acc <b style="color:var(--accent2)">${((m.valAcc ?? 0) * 100).toFixed(1)}%</b>` +
      ` · top-2 ${((m.valTop2 ?? 0) * 100).toFixed(1)}%<br>MLP 63→128→64→26, trained from scratch (training/train.mjs)`;
    setStatus(`ready · classifier ${((m.valAcc ?? 0) * 100).toFixed(0)}% acc`, 'ready');
    if (!image.hidden && image.complete) runImage();
  } catch {
    $('model-info').textContent = 'classifier not trained yet — run training pipeline (see training/README.md)';
    setStatus('ready · classifier pending', 'ready');
  }
})();
