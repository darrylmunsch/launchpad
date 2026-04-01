import * as esbuild from 'esbuild';
import { cpSync, rmSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes('--watch');

// Copy static assets to dist (clean first to avoid stale files)
function copyStatic() {
  const src = resolve(__dirname, 'static');
  const dest = resolve(__dirname, 'dist');
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log('Static assets copied to dist/');
}

/** @type {import('esbuild').BuildOptions} */
const sharedOptions = {
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  minify: !isWatch,
  sourcemap: isWatch ? 'inline' : false,
  logLevel: 'info',
};

/** @type {import('esbuild').BuildOptions} */
const appOptions = {
  ...sharedOptions,
  entryPoints: [resolve(__dirname, 'src/app.ts')],
  outfile: resolve(__dirname, 'dist/app.js'),
};

/** @type {import('esbuild').BuildOptions} */
const swOptions = {
  ...sharedOptions,
  entryPoints: [resolve(__dirname, 'src/service-worker.ts')],
  outfile: resolve(__dirname, 'dist/service-worker.js'),
};

copyStatic();

if (isWatch) {
  const [appCtx, swCtx] = await Promise.all([
    esbuild.context(appOptions),
    esbuild.context(swOptions),
  ]);
  await Promise.all([appCtx.watch(), swCtx.watch()]);
  console.log('Watching for changes...');
} else {
  await Promise.all([
    esbuild.build(appOptions),
    esbuild.build(swOptions),
  ]);
}
