import { describe, it, expect } from 'vitest';
import { normalizeHand, VECTOR_LEN, type Landmark } from './normalize';

/** Synthetic 21-landmark hand (arbitrary but fixed shape). */
function makeHand(): Landmark[] {
  return Array.from({ length: 21 }, (_, i) => ({
    x: 0.3 + i * 0.013,
    y: 0.72 - i * 0.006,
    z: 0.002 * i,
  }));
}

function transform(lm: Landmark[], tx: number, ty: number, scale: number, theta: number): Landmark[] {
  const w = lm[0];
  const cos = Math.cos(theta), sin = Math.sin(theta);
  return lm.map(p => {
    const x = (p.x - w.x) * scale, y = (p.y - w.y) * scale;
    return { x: w.x + tx + x * cos - y * sin, y: w.y + ty + x * sin + y * cos, z: p.z * scale };
  });
}

describe('normalizeHand', () => {
  it('produces 63 floats with wrist at origin', () => {
    const v = normalizeHand(makeHand());
    expect(v.length).toBe(VECTOR_LEN);
    expect(v[0]).toBeCloseTo(0, 10);
    expect(v[1]).toBeCloseTo(0, 10);
    expect(v[2]).toBeCloseTo(0, 10);
  });

  it('is invariant to translation and scale', () => {
    const base = normalizeHand(makeHand());
    const moved = normalizeHand(transform(makeHand(), 0.4, -0.25, 2.7, 0));
    for (let i = 0; i < VECTOR_LEN; i++) expect(moved[i]).toBeCloseTo(base[i], 6);
  });

  it('is invariant to in-plane rotation', () => {
    const base = normalizeHand(makeHand());
    const rotated = normalizeHand(transform(makeHand(), 0, 0, 1, 0.9));
    for (let i = 0; i < VECTOR_LEN; i++) expect(rotated[i]).toBeCloseTo(base[i], 6);
  });

  it('canonicalizes wrist→MCP9 to point up', () => {
    const v = normalizeHand(makeHand());
    // landmark 9 after normalization: x≈0, y<0 (up in image coords)
    expect(Math.abs(v[27])).toBeLessThan(1e-6);
    expect(v[28]).toBeLessThan(0);
    expect(Math.abs(v[28] - -1)).toBeLessThan(1e-6); // palm length normalized to 1
  });

  it('rejects wrong landmark counts', () => {
    expect(() => normalizeHand(makeHand().slice(0, 20))).toThrow();
  });
});
