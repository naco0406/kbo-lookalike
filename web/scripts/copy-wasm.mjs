import { cpSync, existsSync, mkdirSync, symlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'node_modules', 'onnxruntime-web', 'dist');
const dest = join(root, 'public');

if (!existsSync(src)) {
  console.log('onnxruntime-web not installed yet, skipping WASM copy');
  process.exit(0);
}

const files = [
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.jsep.wasm',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.jsep.mjs',
];
for (const f of files) {
  const s = join(src, f);
  if (existsSync(s)) {
    cpSync(s, join(dest, f));
    console.log(`Copied ${f}`);
  }
}
console.log('WASM files ready');

// Dev data symlinks
const dataDir = join(root, 'public', 'data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const scheduleLink = join(dataDir, 'schedule.json');
const scheduleTarget = join(root, '..', 'data', 'schedule', 'kbo_2026.json');
if (!existsSync(scheduleLink) && existsSync(scheduleTarget)) {
  try {
    symlinkSync(scheduleTarget, scheduleLink);
    console.log('Created schedule.json symlink');
  } catch {
    // ignore if already exists (e.g. different link type)
  }
}
