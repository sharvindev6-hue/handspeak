import { describe, it, expect } from 'vitest';
import { Speller } from './spell';
import type { Prediction } from './classifier';

const pred = (letter: string, conf: number): Prediction => ({
  letter, conf, top2: [{ letter, conf }], probs: [],
});

describe('Speller', () => {
  it('commits a letter after a steady hold', () => {
    const letters: string[] = [];
    const s = new Speller({ onLetter: l => letters.push(l) });
    for (let i = 0; i < 10; i++) s.feed(pred('A', 0.95), 100);
    expect(letters).toEqual(['A']);
    expect(s.state.word).toBe('A');
  });

  it('does not commit low-confidence predictions', () => {
    const letters: string[] = [];
    const s = new Speller({ onLetter: l => letters.push(l) });
    for (let i = 0; i < 20; i++) s.feed(pred('A', 0.5), 100);
    expect(letters).toEqual([]);
  });

  it('does not commit a flickering candidate', () => {
    const letters: string[] = [];
    const s = new Speller({ onLetter: l => letters.push(l) });
    for (let i = 0; i < 20; i++) s.feed(pred(i % 2 ? 'A' : 'B', 0.95), 100);
    expect(letters).toEqual([]);
  });

  it('commits the word after a hands-down pause', () => {
    const words: string[] = [];
    const s = new Speller({ onWord: w => words.push(w) });
    for (let i = 0; i < 10; i++) s.feed(pred('H', 0.95), 100);
    for (let i = 0; i < 10; i++) s.feed(pred('I', 0.95), 100);
    for (let i = 0; i < 15; i++) s.feed(null, 100);
    expect(words).toEqual(['HI']);
    expect(s.state.word).toBe('');
  });

  it('manual commit / backspace work', () => {
    const words: string[] = [];
    const s = new Speller({ onWord: w => words.push(w) });
    s.commitLetter('O');
    s.commitLetter('K');
    expect(s.state.word).toBe('OK');
    s.backspace();
    expect(s.state.word).toBe('O');
    s.commitWord();
    expect(words).toEqual(['O']);
  });
});
