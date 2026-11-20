/** Build the image manifest consumed by client/extract.html (browser extraction). */
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = join(import.meta.dirname, 'data', 'images');
const list = [];
for (const L of readdirSync(base).sort()) {
  if (!/^[A-Z]$/.test(L)) continue;
  for (const f of readdirSync(join(base, L)).sort()) list.push(`${L}/${f}`);
}
writeFileSync(join(import.meta.dirname, 'data', 'manifest.json'), JSON.stringify(list));
console.log('manifest:', list.length, 'images');
