/**
 * HANDSPEAK — landmark normalization ("making hands comparable").
 *
 * Raw MediaPipe landmarks depend on where the hand is in the frame, how far
 * from the camera it is, and how it's rotated. A letter classifier must be
 * invariant to all three, so we canonicalize every hand:
 *
 *   1. Translate: wrist (landmark 0) → origin.
 *   2. Scale: divide by palm length (wrist → middle-finger MCP, landmark 9),
 *      applied to x, y AND z so depth is scale-invariant too.
 *   3. Rotate (in image plane): align wrist→MCP9 with "up" (0, -1).
 *
 * Output: 63 floats = 21 landmarks × (x, y, z). Same letter, same vector —
 * regardless of position, distance, or rotation. This is what we train on.
 */

export interface Landmark { x: number; y: number; z: number }

export const VECTOR_LEN = 63;

export function normalizeHand(lm: Landmark[]): Float32Array {
  if (lm.length !== 21) throw new Error(`expected 21 landmarks, got ${lm.length}`);
  const wrist = lm[0];
  const mcp9 = lm[9];
  const dx = mcp9.x - wrist.x;
  const dy = mcp9.y - wrist.y;
  const palm = Math.hypot(dx, dy) || 1e-6;
  // angle of wrist→MCP9; rotate so it points up (-PI/2 in image coords)
  const theta = Math.atan2(dy, dx);
  const rot = -Math.PI / 2 - theta;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);

  const out = new Float32Array(VECTOR_LEN);
  for (let i = 0; i < 21; i++) {
    const x = (lm[i].x - wrist.x) / palm;
    const y = (lm[i].y - wrist.y) / palm;
    out[i * 3] = x * cos - y * sin;
    out[i * 3 + 1] = x * sin + y * cos;
    out[i * 3 + 2] = (lm[i].z - wrist.z) / palm;
  }
  return out;
}
