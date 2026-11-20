/**
 * HANDSPEAK — letter classifier inference ("the brain").
 *
 * Loads the MLP trained by training/train.mjs (exported as JSON weights) and
 * runs the exact same forward pass in the browser: ReLU hidden layers,
 * softmax output. No runtime dependencies, no server, no API keys.
 */

export interface LetterModel {
  labels: string[];
  input: number;
  layers: { W: number[][]; b: number[] }[];
  valAcc?: number;
  valTop2?: number;
}

export interface Prediction {
  letter: string;
  conf: number;
  top2: { letter: string; conf: number }[];
  probs: number[];
}

let model: LetterModel | null = null;

/** Inject a model directly (used by tests and hot-swap tooling). */
export function setModel(m: LetterModel | null) { model = m; }

export async function loadClassifier(url = `${import.meta.env.BASE_URL}models/letters.json`): Promise<LetterModel> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`classifier model missing (${res.status}) — train it first (training/train.mjs)`);
  model = await res.json();
  return model!;
}

export function classifierReady(): boolean { return model !== null; }
export function modelInfo(): LetterModel | null { return model; }

export function predict(v: ArrayLike<number>): Prediction {
  if (!model) throw new Error('classifier not loaded');
  let a: number[] = Array.from(v);
  for (let li = 0; li < model.layers.length; li++) {
    const { W, b } = model.layers[li];
    const z = new Array<number>(W.length);
    for (let i = 0; i < W.length; i++) {
      let s = b[i];
      const Wi = W[i];
      for (let j = 0; j < a.length; j++) s += Wi[j] * a[j];
      z[i] = li < model.layers.length - 1 ? Math.max(0, s) : s;
    }
    a = z;
  }
  const m = Math.max(...a);
  const ex = a.map(x => Math.exp(x - m));
  const sum = ex.reduce((p, c) => p + c, 0);
  const probs = ex.map(x => x / sum);
  const order = probs.map((p, i) => ({ letter: model!.labels[i], conf: p })).sort((x, y) => y.conf - x.conf);
  return { letter: order[0].letter, conf: order[0].conf, top2: order.slice(0, 2), probs };
}
