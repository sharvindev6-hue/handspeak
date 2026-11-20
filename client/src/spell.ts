/**
 * HANDSPEAK — fingerspelling state machine.
 *
 * Turns a stream of per-frame letter predictions into committed letters and
 * words, the way a human reader would: require a steady hold before accepting
 * a letter (debounce), and treat a hands-down pause as a word boundary.
 */
import type { Prediction } from './classifier';

export interface SpellState {
  candidate: string | null;
  conf: number;
  lockProgress: number;   // 0..1 toward committing the candidate
  word: string;
  gapProgress: number;    // 0..1 toward committing the word
  top2: { letter: string; conf: number }[];
}

export interface SpellEvents {
  onLetter?: (letter: string) => void;
  onWord?: (word: string) => void;
}

const HOLD_MS = 550;        // steady hold to commit a letter
const GAP_MS = 1300;        // no-hand pause to commit a word
const CONF_MIN = 0.72;      // minimum confidence to count toward a hold
const COOLDOWN_MS = 260;    // after a commit, brief pause before next hold
const WINDOW = 6;           // smoothing window of recent predictions

export class Speller {
  private recent: (Prediction | null)[] = [];
  private holdMs = 0;
  private gapMs = 0;
  private cooldown = 0;
  private word = '';
  private lastCandidate: string | null = null;
  state: SpellState = { candidate: null, conf: 0, lockProgress: 0, word: '', gapProgress: 0, top2: [] };

  constructor(private events: SpellEvents = {}) {}

  reset() {
    this.recent = []; this.holdMs = 0; this.gapMs = 0; this.cooldown = 0;
    this.word = ''; this.lastCandidate = null;
    this.state = { candidate: null, conf: 0, lockProgress: 0, word: '', gapProgress: 0, top2: [] };
  }

  clearWord() { this.word = ''; this.state.word = ''; }

  /** Manual commit (image mode / accessibility buttons). */
  commitLetter(l: string) {
    this.word += l;
    this.state.word = this.word;
    this.events.onLetter?.(l);
  }
  commitWord() {
    if (!this.word) return;
    const w = this.word;
    this.word = '';
    this.state.word = '';
    this.gapMs = 0;
    this.events.onWord?.(w);
  }
  backspace() {
    this.word = this.word.slice(0, -1);
    this.state.word = this.word;
  }

  feed(pred: Prediction | null, dtMs: number) {
    this.recent.push(pred);
    if (this.recent.length > WINDOW) this.recent.shift();
    this.cooldown = Math.max(0, this.cooldown - dtMs);

    // smoothed candidate: most frequent confident letter in the window
    const counts = new Map<string, { n: number; conf: number }>();
    for (const p of this.recent) {
      if (p && p.conf >= 0.6) {
        const e = counts.get(p.letter) ?? { n: 0, conf: 0 };
        e.n++; e.conf = Math.max(e.conf, p.conf);
        counts.set(p.letter, e);
      }
    }
    let candidate: string | null = null, conf = 0, bestN = 0;
    for (const [l, e] of counts) if (e.n > bestN) { candidate = l; conf = e.conf; bestN = e.n; }
    const top2 = pred?.top2 ?? [];

    const handPresent = pred !== null;
    if (!handPresent) {
      this.holdMs = 0;
      this.gapMs += dtMs;
      if (this.word && this.gapMs >= GAP_MS) {
        const w = this.word;
        this.word = '';
        this.gapMs = 0;
        this.events.onWord?.(w);
      }
    } else {
      this.gapMs = 0;
      if (candidate && candidate === this.lastCandidate && conf >= CONF_MIN && this.cooldown === 0) {
        this.holdMs += dtMs;
        if (this.holdMs >= HOLD_MS) {
          this.word += candidate;
          this.events.onLetter?.(candidate);
          this.holdMs = 0;
          this.cooldown = COOLDOWN_MS;
        }
      } else {
        this.holdMs = 0;
      }
      this.lastCandidate = candidate;
    }

    this.state = {
      candidate, conf,
      lockProgress: Math.min(1, this.holdMs / HOLD_MS),
      word: this.word,
      gapProgress: this.word ? Math.min(1, this.gapMs / GAP_MS) : 0,
      top2,
    };
  }
}
