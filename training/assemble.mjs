/** Assemble dataset.json from collected JSONL samples (dedupe by src). */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = import.meta.dirname;
const lines = readFileSync(join(HERE, 'data', 'samples.jsonl'), 'utf8').trim().split('\n').filter(Boolean);
const seen = new Set();
const samples = [];
for (const l of lines) {
  const s = JSON.parse(l);
  if (seen.has(s.src)) continue;
  seen.add(s.src);
  samples.push({ label: s.label, v: s.v, src: s.src });
}
const counts = {};
for (const s of samples) counts[s.label] = (counts[s.label] ?? 0) + 1;
writeFileSync(join(HERE, 'data', 'dataset.json'), JSON.stringify({
  meta: {
    app: 'handspeak', created: new Date().toISOString(),
    source: 'Marxulia/asl_sign_languages_alphabets_v03 (Hugging Face)',
    features: 63,
    layout: '21 landmarks xyz, wrist-centered, palm-scaled (xyz), rotation-canonical',
    imagesProcessed: 10873,
  },
  samples,
}));
console.log('dataset:', samples.length, 'samples');
console.log(JSON.stringify(counts));
