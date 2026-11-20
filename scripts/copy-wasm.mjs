// Copies the MediaPipe WASM runtime from node_modules into the client's
// public dir so the app is fully self-contained (no CDN dependency at runtime).
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, '..', 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const dest = join(root, '..', 'client', 'public', 'wasm');

if (!existsSync(src)) {
  console.error('copy-wasm: MediaPipe wasm dir not found — run npm install first.');
  process.exit(1);
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('copy-wasm: MediaPipe runtime copied to client/public/wasm');
