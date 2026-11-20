/**
 * HANDSPEAK — whole-word sign tracks.
 *
 * Stylized approximations of common ASL words, authored as keyframes of
 * hand pose + position offset in signing space. Everything not in this
 * dictionary is fingerspelled letter-by-letter (the accurate channel).
 * Two-handed signs are intentionally out of v1 scope (see OWNER_MANUAL).
 */
import { ALPHABET, ILY, type HandPose } from './poses';

export interface WordKeyframe { pose: HandPose; pos: [number, number, number]; hold: number }

const B = ALPHABET.B;
const A = ALPHABET.A;
const S = ALPHABET.S;
const U = ALPHABET.U;

const circle = (pose: HandPose, cx: number, cy: number, z: number, r: number, n = 6, hold = 110): WordKeyframe[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { pose, pos: [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z] as [number, number, number], hold };
  });

export const WORD_SIGNS: Record<string, WordKeyframe[]> = {
  HELLO: [
    { pose: B, pos: [0.05, 0.62, 0.12], hold: 240 },
    { pose: B, pos: [0.3, 0.42, 0.45], hold: 320 },
  ],
  'THANK-YOU': [
    { pose: B, pos: [0, 0.45, 0.28], hold: 240 },
    { pose: B, pos: [0.12, 0.08, 0.55], hold: 340 },
  ],
  THANKS: [
    { pose: B, pos: [0, 0.45, 0.28], hold: 240 },
    { pose: B, pos: [0.12, 0.08, 0.55], hold: 340 },
  ],
  PLEASE: circle(B, 0, 0.12, 0.4, 0.13),
  SORRY: circle(A, 0, 0.12, 0.4, 0.13),
  YES: [
    { pose: S, pos: [0, 0.15, 0.1], hold: 150 },
    { pose: { ...S, wrist: { pitch: 0.55, yaw: 0, roll: 0 } }, pos: [0, 0.1, 0.15], hold: 150 },
    { pose: S, pos: [0, 0.15, 0.1], hold: 150 },
    { pose: { ...S, wrist: { pitch: 0.55, yaw: 0, roll: 0 } }, pos: [0, 0.1, 0.15], hold: 150 },
  ],
  NO: [
    { pose: U, pos: [0, 0.2, 0.15], hold: 130 },
    { pose: { ...U, fingers: [{ curl: [0.9, 1.1, 0.7] }, { curl: [0.9, 1.1, 0.7] }, U.fingers[2], U.fingers[3]] }, pos: [0, 0.2, 0.15], hold: 130 },
    { pose: U, pos: [0, 0.2, 0.15], hold: 130 },
    { pose: { ...U, fingers: [{ curl: [0.9, 1.1, 0.7] }, { curl: [0.9, 1.1, 0.7] }, U.fingers[2], U.fingers[3]] }, pos: [0, 0.2, 0.15], hold: 130 },
  ],
  ILY: [
    { pose: ILY, pos: [0, 0.2, 0.1], hold: 260 },
    { pose: { ...ILY, wrist: { pitch: 0, yaw: 0, roll: 0.18 } }, pos: [0.05, 0.22, 0.1], hold: 200 },
    { pose: { ...ILY, wrist: { pitch: 0, yaw: 0, roll: -0.18 } }, pos: [-0.05, 0.22, 0.1], hold: 200 },
    { pose: ILY, pos: [0, 0.2, 0.1], hold: 260 },
  ],
  GOOD: [
    { pose: B, pos: [0, 0.45, 0.25], hold: 220 },
    { pose: B, pos: [0, 0.0, 0.45], hold: 300 },
  ],
  BAD: [
    { pose: B, pos: [0, 0.45, 0.25], hold: 220 },
    { pose: { ...B, wrist: { pitch: 1.2, yaw: 0, roll: 0 } }, pos: [0, -0.05, 0.45], hold: 300 },
  ],
};

export const KNOWN_WORDS = Object.keys(WORD_SIGNS);
