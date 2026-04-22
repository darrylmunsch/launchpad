// Zips the contents of dist/ into launchpad_<version>.zip at the repo root.
// Run via `npm run package` (which re-builds first so the zip reflects
// the current source).
//
// Version is read from dist/manifest.json so the filename always matches
// what Chrome will see after upload — no manual renaming required.

import { execSync } from 'node:child_process';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distDir = join(root, 'dist');
const manifestPath = join(distDir, 'manifest.json');

if (!existsSync(manifestPath)) {
  console.error(`dist/manifest.json not found — run \`npm run build\` first.`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const version = manifest.version;
const zipName = `launchpad_${version}.zip`;
const zipPath = join(root, zipName);

if (existsSync(zipPath)) rmSync(zipPath);

// Windows-native zipping via PowerShell. The `dist\*` wildcard zips the
// contents of dist/ (not the folder itself), so manifest.json lands at
// the zip root — which is what Chrome Web Store requires.
const psCommand = `Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipPath}' -Force`;
execSync(`powershell -NoProfile -Command "${psCommand}"`, { stdio: 'inherit' });

console.log(`Packaged v${version} → ${zipName}`);
