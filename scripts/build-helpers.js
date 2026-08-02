#!/usr/bin/env node
// Builds the three Rust helper crates and places them in src-tauri/binaries/
// with the platform-triple suffix that Tauri's externalBin expects.
//
// Called by: npm run build:helpers (before tauri build)

import { execSync, spawnSync } from 'child_process';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { platform } from 'os';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TAURI_DIR = join(ROOT, 'src-tauri');
const BIN_DIR   = join(TAURI_DIR, 'binaries');

const isWindows = platform() === 'win32';
const ext = isWindows ? '.exe' : '';

// Get the host Rust triple
function getRustTriple() {
  const result = spawnSync('rustc', ['-vV'], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error('rustc not found. Make sure Rust is installed.');
  }
  const match = result.stdout.match(/^host:\s+(.+)$/m);
  if (!match) throw new Error('Could not detect Rust host triple from rustc -vV');
  return match[1].trim();
}

const triple = getRustTriple();
console.log(`Building helpers for ${triple}`);

// Build all workspace members except the main app
const buildResult = spawnSync(
  'cargo',
  ['build', '--release', '-p', 'poligame-rpc', '-p', 'poligame-overdrive', '-p', 'poligame-overlay'],
  { cwd: TAURI_DIR, stdio: 'inherit' }
);

if (buildResult.status !== 0) {
  process.exit(buildResult.status ?? 1);
}

mkdirSync(BIN_DIR, { recursive: true });

const helpers = ['poligame-rpc', 'poligame-overdrive', 'poligame-overlay'];

for (const name of helpers) {
  const src  = join(TAURI_DIR, 'target', 'release', `${name}${ext}`);
  const dest = join(BIN_DIR, `${name}-${triple}${ext}`);

  if (!existsSync(src)) {
    console.error(`Built binary not found: ${src}`);
    process.exit(1);
  }

  copyFileSync(src, dest);
  console.log(`  ${name} -> binaries/${name}-${triple}${ext}`);
}

console.log('Helper binaries ready.');
