const VECTOR_LEN = 63;
function normalizeHand(lm) {
  if (lm.length !== 21) throw new Error(`expected 21 landmarks, got ${lm.length}`);
  const wrist = lm[0];
  const mcp9 = lm[9];
  const dx = mcp9.x - wrist.x;
  const dy = mcp9.y - wrist.y;
  const palm = Math.hypot(dx, dy) || 1e-6;
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
export {
  VECTOR_LEN,
  normalizeHand
};
