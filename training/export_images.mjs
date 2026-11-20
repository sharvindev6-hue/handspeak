/**
 * Export ASL letter images from the HF parquet → training/data/images/{A..Z}/*.jpg
 * Pure Node (hyparquet) — no Python dependency.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parquetReadObjects } from 'hyparquet';

const HERE = import.meta.dirname;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const buf = readFileSync(join(HERE, 'data', 'asl.parquet'));
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
console.log('reading parquet…');
const rows = await parquetReadObjects({ file: ab, utf8: false });
console.log('rows:', rows.length);

const counts = {};
for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  const letter = LETTERS[Number(row.label)];
  const img = row.image;
  const bytes = img?.bytes ?? img;
  const d = join(HERE, 'data', 'images', letter);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, `${String(i).padStart(6, '0')}.jpg`), Buffer.from(bytes));
  counts[letter] = (counts[letter] ?? 0) + 1;
}
console.log('per-letter:', JSON.stringify(counts));
console.log('total exported:', rows.length);
