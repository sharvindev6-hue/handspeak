import { describe, it, expect } from 'vitest';
import { setModel, predict, classifierReady } from './classifier';

describe('classifier inference', () => {
  it('runs the MLP forward pass + softmax correctly', () => {
    // tiny linear model: logits = [x0, x1] → softmax
    setModel({
      labels: ['A', 'B'],
      input: 2,
      layers: [{ W: [[1, 0], [0, 1]], b: [0, 0] }],
    });
    expect(classifierReady()).toBe(true);
    const p = predict([2, 0]);
    expect(p.letter).toBe('A');
    expect(p.conf).toBeGreaterThan(0.8);
    const sum = p.probs.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
    expect(p.top2[0].letter).toBe('A');
    expect(p.top2[1].letter).toBe('B');
  });

  it('applies ReLU on hidden layers', () => {
    setModel({
      labels: ['A', 'B'],
      input: 2,
      layers: [
        { W: [[1, 0], [0, 1]], b: [-1, -1] },   // hidden: relu(x-1)
        { W: [[1, -1]], b: [0] },                // out: h0 - h1 (single logit → always A)
      ],
    });
    const p = predict([5, 0]); // h = [4, 0] → logit 4
    expect(p.letter).toBe('A');
    expect(p.probs[0]).toBeCloseTo(1, 6);
  });

  it('throws before a model is loaded', () => {
    setModel(null as never);
    expect(() => predict([0, 0])).toThrow();
  });
});
