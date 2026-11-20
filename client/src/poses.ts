/**
 * HANDSPEAK — ASL alphabet pose dictionary.
 *
 * Each letter is a set of joint angles for our procedural robot hand:
 *  - fingers[0..3] = index, middle, ring, pinky: curl per joint (MCP/PIP/DIP),
 *    spread (fan at MCP), cross (MCP z-rotation, for R).
 *  - thumb: curl, across (opposition toward palm), out (extension away).
 *  - wrist: pitch/yaw/roll orient the whole hand.
 *
 * Angles in radians. Authored from ASL manual-alphabet references; J and Z
 * add motion paths (see signs.ts). Stylized robot approximation — validated
 * visually against references during the build (see BUILD_LOG).
 */

export interface FingerPose { curl: [number, number, number]; spread?: number; cross?: number }
export interface ThumbPose { curl: number; across: number; out: number }
export interface HandPose {
  wrist: { pitch: number; yaw: number; roll: number };
  fingers: [FingerPose, FingerPose, FingerPose, FingerPose];
  thumb: ThumbPose;
}

const S = (spread = 0): FingerPose => ({ curl: [0, 0, 0], spread });
const F = (): FingerPose => ({ curl: [1.25, 1.45, 0.9], spread: 0 });
const C = (): FingerPose => ({ curl: [0.55, 0.6, 0.5], spread: 0.04 });
const H = (): FingerPose => ({ curl: [0.95, 1.15, 0.75], spread: 0 });
const TH_ACROSS: ThumbPose = { curl: 0.8, across: 0.95, out: 0.05 };
const TH_UP: ThumbPose = { curl: 0.1, across: 0.12, out: 0.4 };
const TH_OUT: ThumbPose = { curl: 0.05, across: 0.05, out: 1.0 };

const W0 = { pitch: 0, yaw: 0, roll: 0 };

export const ALPHABET: Record<string, HandPose> = {
  A: { wrist: W0, fingers: [F(), F(), F(), F()], thumb: TH_UP },
  B: { wrist: W0, fingers: [S(), S(), S(), S()], thumb: { curl: 0.9, across: 1.0, out: 0 } },
  C: { wrist: { pitch: 0, yaw: 0.55, roll: 0 }, fingers: [C(), C(), C(), C()], thumb: { curl: 0.5, across: 0.5, out: 0.3 } },
  D: { wrist: W0, fingers: [S(), H(), H(), H()], thumb: { curl: 0.45, across: 0.55, out: 0.15 } },
  E: { wrist: { pitch: 0.15, yaw: 0, roll: 0 }, fingers: [H(), H(), H(), H()], thumb: { curl: 0.8, across: 0.9, out: 0.05 } },
  F: { wrist: W0, fingers: [{ curl: [0.7, 0.9, 0.5], spread: 0 }, S(0.08), S(0.08), S(0.08)], thumb: { curl: 0.4, across: 0.6, out: 0.25 } },
  G: { wrist: { pitch: 0.2, yaw: 0, roll: 1.35 }, fingers: [S(), F(), F(), F()], thumb: { curl: 0.1, across: 0.1, out: 0.5 } },
  H: { wrist: { pitch: 0.2, yaw: 0, roll: 1.35 }, fingers: [S(), S(), F(), F()], thumb: TH_ACROSS },
  I: { wrist: W0, fingers: [F(), F(), F(), S()], thumb: TH_ACROSS },
  J: { wrist: W0, fingers: [F(), F(), F(), S()], thumb: TH_ACROSS }, // + motion
  K: { wrist: W0, fingers: [S(0.35), S(-0.15), F(), F()], thumb: { curl: 0.2, across: 0.35, out: 0.5 } },
  L: { wrist: W0, fingers: [S(), F(), F(), F()], thumb: TH_OUT },
  M: { wrist: { pitch: 0.2, yaw: 0, roll: 0 }, fingers: [{ curl: [1.0, 1.2, 0.8] }, { curl: [1.0, 1.2, 0.8] }, { curl: [1.0, 1.2, 0.8] }, F()], thumb: { curl: 0.9, across: 1.0, out: 0 } },
  N: { wrist: { pitch: 0.2, yaw: 0, roll: 0 }, fingers: [{ curl: [1.0, 1.2, 0.8] }, { curl: [1.0, 1.2, 0.8] }, F(), F()], thumb: { curl: 0.9, across: 1.0, out: 0 } },
  O: { wrist: W0, fingers: [{ curl: [0.75, 0.95, 0.7] }, { curl: [0.75, 0.95, 0.7] }, { curl: [0.75, 0.95, 0.7] }, { curl: [0.75, 0.95, 0.7] }], thumb: { curl: 0.55, across: 0.7, out: 0.2 } },
  P: { wrist: { pitch: 1.5, yaw: 0, roll: 0.3 }, fingers: [S(0.35), S(0.1), F(), F()], thumb: { curl: 0.2, across: 0.35, out: 0.5 } },
  Q: { wrist: { pitch: 1.3, yaw: 0, roll: 0.4 }, fingers: [S(), F(), F(), F()], thumb: { curl: 0.1, across: 0.1, out: 0.5 } },
  R: { wrist: W0, fingers: [S(), { curl: [0, 0, 0], spread: 0, cross: 0.45 }, F(), F()], thumb: TH_ACROSS },
  S: { wrist: W0, fingers: [F(), F(), F(), F()], thumb: { curl: 0.7, across: 1.0, out: 0 } },
  T: { wrist: W0, fingers: [F(), F(), F(), F()], thumb: { curl: 0.5, across: 0.75, out: 0.1 } },
  U: { wrist: W0, fingers: [S(), S(), F(), F()], thumb: TH_ACROSS },
  V: { wrist: W0, fingers: [S(0.4), S(-0.18), F(), F()], thumb: TH_ACROSS },
  W: { wrist: W0, fingers: [S(0.3), S(0), S(-0.28), F()], thumb: { curl: 0.6, across: 0.8, out: 0.1 } },
  X: { wrist: W0, fingers: [{ curl: [0.3, 1.3, 1.0] }, F(), F(), F()], thumb: TH_ACROSS },
  Y: { wrist: W0, fingers: [F(), F(), F(), S(0.3)], thumb: TH_OUT },
  Z: { wrist: W0, fingers: [S(), F(), F(), F()], thumb: TH_ACROSS }, // + motion
};

export const LETTERS = Object.keys(ALPHABET);

/** Neutral resting pose (relaxed open hand). */
export const REST: HandPose = {
  wrist: { pitch: 0.1, yaw: 0, roll: 0 },
  fingers: [{ curl: [0.25, 0.3, 0.2], spread: 0.06 }, { curl: [0.25, 0.3, 0.2], spread: 0.02 }, { curl: [0.25, 0.3, 0.2], spread: -0.02 }, { curl: [0.25, 0.3, 0.2], spread: -0.06 }],
  thumb: { curl: 0.2, across: 0.2, out: 0.4 },
};

/** ILY = "I love you" handshape (thumb + index + pinky out). */
export const ILY: HandPose = {
  wrist: W0,
  fingers: [S(), F(), F(), S(0.3)],
  thumb: TH_OUT,
};
