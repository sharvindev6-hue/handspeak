/**
 * HANDSPEAK — train the letter classifier. From scratch. No ML framework.
 *
 * A 3-layer MLP (63 → 128 → 64 → 26) with ReLU + softmax, trained with Adam
 * on augmented canonical hand vectors. Pure JavaScript so the exact same
 * math runs in the browser at inference time (client/src/classifier.ts).
 *
 * Why from scratch: the model is small enough that a framework adds nothing,
 * and hand-writing forward/backward keeps the whole pipeline transparent —
 * every number in the exported model can be traced to this file.
 *
 * Usage: node train.mjs   (expects data/dataset.json from the extraction step)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = import.meta.dirname;
const DATA = join(HERE, 'data', 'dataset.json');
const OUT_MODEL = join(HERE, '..', 'client', 'public', 'models', 'letters.json');
const OUT_METRICS = join(HERE, 'metrics.json');
const OUT_CARD = join(HERE, '..', 'MODEL_CARD.md');

const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const IN = 63, H1 = 128, H2 = 64, OUT = 26;
const EPOCHS = 40, BATCH = 128, LR = 0.001, PATIENCE = 6;
const VAL_FRACTION = 0.15;

// ---------- deterministic RNG ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20261119);
const gauss = () => {
  const u = Math.max(rng(), 1e-9), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// ---------- data ----------
const dataset = JSON.parse(readFileSync(DATA, 'utf8'));
const samples = dataset.samples.filter(s => LABELS.includes(s.label) && s.v.length === IN);
console.log(`samples: ${samples.length}`);

// stratified shuffle split
const byLabel = LABELS.map(l => samples.filter(s => s.label === l));
const train = [], val = [];
for (const group of byLabel) {
  for (let i = group.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [group[i], group[j]] = [group[j], group[i]];
  }
  const nVal = Math.floor(group.length * VAL_FRACTION);
  val.push(...group.slice(0, nVal));
  train.push(...group.slice(nVal));
}
console.log(`train: ${train.length}, val: ${val.length}`);

// ---------- augmentation ----------
function augment(v) {
  const out = new Float64Array(IN);
  const theta = (rng() - 0.5) * 0.4;           // ±0.2 rad rotation jitter
  const scale = 0.9 + rng() * 0.2;             // ±10% scale jitter
  const cos = Math.cos(theta), sin = Math.sin(theta);
  const mirror = rng() < 0.5 ? -1 : 1;         // left/right hand variants
  for (let i = 0; i < 21; i++) {
    let x = v[i * 3] * mirror, y = v[i * 3 + 1], z = v[i * 3 + 2];
    const rx = x * cos - y * sin, ry = x * sin + y * cos;
    out[i * 3] = rx * scale + gauss() * 0.012;
    out[i * 3 + 1] = ry * scale + gauss() * 0.012;
    out[i * 3 + 2] = z * scale + gauss() * 0.012;
  }
  return out;
}

// ---------- model ----------
function xavier(rows, cols) {
  const lim = Math.sqrt(6 / (rows + cols));
  const W = Array.from({ length: rows }, () => Array.from({ length: cols }, () => (rng() * 2 - 1) * lim));
  return W;
}
const layers = [
  { W: xavier(H1, IN), b: new Array(H1).fill(0) },
  { W: xavier(H2, H1), b: new Array(H2).fill(0) },
  { W: xavier(OUT, H2), b: new Array(OUT).fill(0) },
];
// Adam state
const adam = layers.map(l => ({
  mW: l.W.map(r => r.map(() => 0)), vW: l.W.map(r => r.map(() => 0)),
  mb: l.b.map(() => 0), vb: l.b.map(() => 0),
}));
let step = 0;

function forward(x) {
  const a = [x];
  for (let li = 0; li < 3; li++) {
    const { W, b } = layers[li];
    const z = new Array(W.length);
    for (let i = 0; i < W.length; i++) {
      let s = b[i];
      const Wi = W[i], prev = a[li];
      for (let j = 0; j < prev.length; j++) s += Wi[j] * prev[j];
      z[i] = li < 2 ? Math.max(0, s) : s; // ReLU hidden, linear out
    }
    a.push(z);
  }
  // softmax
  const logits = a[3];
  const m = Math.max(...logits);
  const ex = logits.map(v => Math.exp(v - m));
  const sum = ex.reduce((p, c) => p + c, 0);
  return { acts: a, probs: ex.map(v => v / sum) };
}

function trainBatch(batch) {
  const grads = layers.map(l => ({
    W: l.W.map(r => r.map(() => 0)), b: l.b.map(() => 0),
  }));
  let loss = 0;
  for (const { x, y } of batch) {
    const { acts, probs } = forward(x);
    loss += -Math.log(Math.max(probs[y], 1e-12));
    // output delta (softmax + cross-entropy)
    let delta = probs.map((p, i) => p - (i === y ? 1 : 0));
    for (let li = 2; li >= 0; li--) {
      const prev = acts[li];
      const g = grads[li];
      for (let i = 0; i < delta.length; i++) {
        g.b[i] += delta[i];
        const gi = g.W[i];
        for (let j = 0; j < prev.length; j++) gi[j] += delta[i] * prev[j];
      }
      if (li > 0) {
        const { W } = layers[li];
        const next = new Array(prev.length).fill(0);
        for (let j = 0; j < prev.length; j++) {
          let s = 0;
          for (let i = 0; i < delta.length; i++) s += W[i][j] * delta[i];
          next[j] = acts[li][j] > 0 ? s : 0; // ReLU backprop
        }
        delta = next;
      }
    }
  }
  // Adam update
  step++;
  const n = batch.length;
  const b1 = 0.9, b2 = 0.999, eps = 1e-8;
  const c1 = 1 - Math.pow(b1, step), c2 = 1 - Math.pow(b2, step);
  for (let li = 0; li < 3; li++) {
    const l = layers[li], g = grads[li], a = adam[li];
    for (let i = 0; i < l.W.length; i++) {
      for (let j = 0; j < l.W[i].length; j++) {
        const grad = g.W[i][j] / n;
        a.mW[i][j] = b1 * a.mW[i][j] + (1 - b1) * grad;
        a.vW[i][j] = b2 * a.vW[i][j] + (1 - b2) * grad * grad;
        l.W[i][j] -= LR * (a.mW[i][j] / c1) / (Math.sqrt(a.vW[i][j] / c2) + eps);
      }
      const gb = g.b[i] / n;
      a.mb[i] = b1 * a.mb[i] + (1 - b1) * gb;
      a.vb[i] = b2 * a.vb[i] + (1 - b2) * gb * gb;
      l.b[i] -= LR * (a.mb[i] / c1) / (Math.sqrt(a.vb[i] / c2) + eps);
    }
  }
  return loss / n;
}

function evaluate(set, useAugment = false) {
  let correct = 0, top2 = 0;
  const conf = Array.from({ length: OUT }, () => new Array(OUT).fill(0));
  const perLabel = LABELS.map(() => ({ n: 0, ok: 0 }));
  for (const s of set) {
    const x = useAugment ? augment(s.v) : Float64Array.from(s.v);
    const y = LABELS.indexOf(s.label);
    const { probs } = forward(x);
    const order = probs.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0]);
    const pred = order[0][1];
    conf[y][pred]++;
    perLabel[y].n++;
    if (pred === y) { correct++; perLabel[y].ok++; }
    if (order[0][1] === y || order[1][1] === y) top2++;
  }
  return { acc: correct / set.length, top2: top2 / set.length, conf, perLabel };
}

// ---------- training loop ----------
let best = { acc: -1, epoch: -1, weights: null };
let bad = 0;
for (let epoch = 1; epoch <= EPOCHS; epoch++) {
  // shuffle train indices
  const idx = train.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  let lossSum = 0, nB = 0;
  for (let start = 0; start < idx.length; start += BATCH) {
    const batch = idx.slice(start, start + BATCH).map(i => ({
      x: augment(train[i].v), y: LABELS.indexOf(train[i].label),
    }));
    lossSum += trainBatch(batch); nB++;
  }
  const v = evaluate(val);
  console.log(`epoch ${epoch}: loss ${(lossSum / nB).toFixed(4)} · val acc ${(v.acc * 100).toFixed(2)}% · top2 ${(v.top2 * 100).toFixed(2)}%`);
  if (v.acc > best.acc) {
    best = { acc: v.acc, epoch, weights: JSON.parse(JSON.stringify(layers)) };
    bad = 0;
  } else if (++bad >= PATIENCE) {
    console.log(`early stop at epoch ${epoch}`);
    break;
  }
}

// restore best, final eval
for (let li = 0; li < 3; li++) { layers[li].W = best.weights[li].W; layers[li].b = best.weights[li].b; }
const final = evaluate(val);
const trainEval = evaluate(train.slice(0, 2000));

// ---------- export ----------
const model = {
  app: 'handspeak-letters', version: 1,
  input: IN, labels: LABELS,
  activation: 'relu', output: 'softmax',
  layers: layers.map(l => ({ W: l.W.map(r => r.map(v => +v.toFixed(6))), b: l.b.map(v => +v.toFixed(6)) })),
  trained: new Date().toISOString(),
  valAcc: +final.acc.toFixed(4), valTop2: +final.top2.toFixed(4),
  bestEpoch: best.epoch,
  source: dataset.meta?.source ?? 'unknown',
};
writeFileSync(OUT_MODEL, JSON.stringify(model));
writeFileSync(OUT_METRICS, JSON.stringify({ val: { acc: final.acc, top2: final.top2, perLabel: final.perLabel, confusion: final.conf }, trainSubset: { acc: trainEval.acc } }, null, 2));

const perLetterRows = LABELS.map((l, i) =>
  `| ${l} | ${final.perLabel[i].n} | ${(final.perLabel[i].ok / Math.max(1, final.perLabel[i].n) * 100).toFixed(1)}% |`).join('\n');
const worst = LABELS.map((l, i) => ({ l, acc: final.perLabel[i].ok / Math.max(1, final.perLabel[i].n) }))
  .sort((a, b) => a.acc - b.acc).slice(0, 5);
const card = `# HANDSPEAK Letter Classifier — Model Card

## Overview
- **Task:** ASL fingerspelling letter recognition (26 classes) from a single hand frame.
- **Input:** 63-float canonical hand vector (21 MediaPipe landmarks × xyz; wrist-centered, palm-scaled, rotation-canonical — see \`client/src/normalize.ts\`).
- **Architecture:** MLP 63 → 128 (ReLU) → 64 (ReLU) → 26 (softmax). **Trained from scratch in plain JavaScript** (\`training/train.mjs\`, Adam, no ML framework); inference is the same math in \`client/src/classifier.ts\`.
- **Training data:** ${samples.length} real ASL alphabet photos (${dataset.meta?.source ?? 'HF'}), landmarks extracted with MediaPipe HandLandmarker. Augmentation: rotation ±0.2 rad, scale ±10%, Gaussian noise σ=0.012, left/right mirroring.
- **Split:** stratified ${Math.round((1 - VAL_FRACTION) * 100)}/${Math.round(VAL_FRACTION * 100)} train/val, seed 20261119. Best epoch ${best.epoch} (early stopping, patience ${PATIENCE}).

## Results (held-out validation)
- **Top-1 accuracy: ${(final.acc * 100).toFixed(2)}%**
- **Top-2 accuracy: ${(final.top2 * 100).toFixed(2)}%**
- Train-subset accuracy: ${(trainEval.acc * 100).toFixed(2)}% (2000-sample check)

### Per-letter accuracy
| Letter | Val samples | Accuracy |
|---|---|---|
${perLetterRows}

### Known limitations (honest)
- Weakest letters: ${worst.map(w => `${w.l} (${(w.acc * 100).toFixed(0)}%)`).join(', ')} — mostly the classic ASL near-duplicates (M/N/S, A/E, U/V). The app shows top-2 candidates and requires a hold-steady before committing a letter.
- Static frames only: J and Z involve motion; v1 recognizes their static handshapes and the avatar animates the motion on output. Motion-based recognition (DTW) is roadmap.
- Dataset is photos under varied but limited conditions; live webcam accuracy depends on lighting/angle. Calibration mode + confidence threshold mitigate.
- This is fingerspelling, not full ASL (no grammar/facial markers). See OWNER_MANUAL.

## Reproduce
\`\`\`bash
cd training
npm run export     # parquet → images (utf8:false — binary-safe)
npm run manifest   # image list for the browser extractor
# open client/extract.html via the dev server → writes data/dataset.json
npm run normalize  # compile shared normalization from client source
npm run train      # → client/public/models/letters.json + MODEL_CARD.md
\`\`\`
`;
writeFileSync(OUT_CARD, card);
console.log(`\nBEST: epoch ${best.epoch}, val acc ${(final.acc * 100).toFixed(2)}%, top2 ${(final.top2 * 100).toFixed(2)}%`);
console.log('exported:', OUT_MODEL);
