// Generate 32x32 icon matching the rocket design of the existing icons.
// Uses the same SVG geometry as the sidebar logo in newtab.html,
// rendered as filled shapes on an indigo rounded-rect background.

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── PNG Helpers ───

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createPngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crcData = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData));
  return Buffer.concat([length, typeBytes, data, crc]);
}

// ─── Config ───

const SIZE = 32;
const CORNER_R = 6.5;
const SAMPLES = 4; // 4×4 supersampling for anti-aliased edges

// Colors [R, G, B, A]
const TRANSPARENT = [0, 0, 0, 0];
const BG = [99, 102, 241, 255];       // #6366f1  (indigo)
const WHITE = [255, 255, 255, 255];
const FLAME = [251, 146, 60, 255];    // #fb923c  (orange)

// SVG viewBox (24×24) → icon (32×32) transform
// Rocket content spans SVG y=2..20, x=6..18, centered at (12, 11)
const SCALE = 1.15;
const SVG_CX = 12, SVG_CY = 11;
const ICON_CX = 16, ICON_CY = 16;

function toSvg(iconX, iconY) {
  return [
    (iconX - ICON_CX) / SCALE + SVG_CX,
    (iconY - ICON_CY) / SCALE + SVG_CY,
  ];
}

// ─── Rocket geometry (SVG coordinates) ───
// Body: M12 2 C12 2 8.5 7 8.5 13 a3.5 3.5 0 0 0 7 0 C15.5 7 12 2 12 2z
// Porthole: circle cx=12 cy=12.5 r=1.5
// Left fin: M8.5 13 L6 16.5   Right fin: M15.5 13 L18 16.5
// Flame: M10 16.5 L12 20 L14 16.5

// Cubic bezier from (12,2) with ctrl (12,2),(8.5,7) to (8.5,13)
function bezierY(t) {
  const u = 1 - t;
  return 2 * u * u * (1 + 2 * t) + 21 * u * t * t + 13 * t * t * t;
}

function bezierX(t) {
  const u = 1 - t;
  return 12 * u * u * (1 + 2 * t) + 8.5 * t * t * (3 - 2 * t);
}

// Binary search: find t where bezierY(t) = targetY
function findT(targetY) {
  if (targetY <= 2) return 0;
  if (targetY >= 13) return 1;
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (bezierY(mid) < targetY) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// Half-width of rocket body at a given SVG y
function rocketHW(sy) {
  if (sy < 2 || sy > 16.5) return -1;
  if (sy <= 13) {
    return 12 - bezierX(findT(sy));
  }
  // Semicircle bottom: center (12,13), r=3.5
  const dy = sy - 13;
  const sq = 3.5 * 3.5 - dy * dy;
  return sq > 0 ? Math.sqrt(sq) : -1;
}

// ─── Shape tests (SVG coordinates) ───

function isInBody(sx, sy) {
  const hw = rocketHW(sy);
  return hw > 0 && Math.abs(sx - 12) < hw;
}

function isInPorthole(sx, sy) {
  return Math.hypot(sx - 12, sy - 12.5) < 1.5;
}

function isInFlame(sx, sy) {
  if (sy < 16.5 || sy > 20) return false;
  const t = (sy - 16.5) / 3.5; // 0 at top, 1 at tip
  return Math.abs(sx - 12) < 2 * (1 - t);
}

function isOnFin(sx, sy) {
  // Left fin line: (8.5,13) → (6,16.5), direction (-2.5, 3.5)
  const dx = -2.5, dy = 3.5;
  const len = Math.hypot(dx, dy); // ~4.3

  for (const [ox, odx] of [[8.5, -2.5], [15.5, 2.5]]) {
    const vx = sx - ox, vy = sy - 13;
    const t = (vx * odx + vy * dy) / (len * len);
    if (t >= -0.02 && t <= 1.02) {
      const dist = Math.abs(vx * dy - vy * odx) / len;
      if (dist < 0.85) return true;
    }
  }
  return false;
}

// ─── Per-sub-pixel color ───

function getColor(iconX, iconY) {
  // Rounded-rect mask
  const inCorner =
    (iconX < CORNER_R && iconY < CORNER_R &&
      Math.hypot(iconX - CORNER_R, iconY - CORNER_R) > CORNER_R) ||
    (iconX > SIZE - CORNER_R && iconY < CORNER_R &&
      Math.hypot(iconX - (SIZE - CORNER_R), iconY - CORNER_R) > CORNER_R) ||
    (iconX < CORNER_R && iconY > SIZE - CORNER_R &&
      Math.hypot(iconX - CORNER_R, iconY - (SIZE - CORNER_R)) > CORNER_R) ||
    (iconX > SIZE - CORNER_R && iconY > SIZE - CORNER_R &&
      Math.hypot(iconX - (SIZE - CORNER_R), iconY - (SIZE - CORNER_R)) > CORNER_R);

  if (inCorner) return TRANSPARENT;

  const [sx, sy] = toSvg(iconX, iconY);

  if (isInBody(sx, sy)) {
    return isInPorthole(sx, sy) ? BG : WHITE;
  }
  if (isOnFin(sx, sy)) return WHITE;
  if (isInFlame(sx, sy)) return FLAME;

  return BG;
}

// ─── Render ───

const rowBytes = 1 + SIZE * 4; // filter byte + RGBA
const rawData = Buffer.alloc(rowBytes * SIZE);

for (let y = 0; y < SIZE; y++) {
  const rowStart = y * rowBytes;
  rawData[rowStart] = 0; // no filter

  for (let x = 0; x < SIZE; x++) {
    const px = rowStart + 1 + x * 4;

    // 4×4 supersampling with alpha-weighted color averaging
    let rW = 0, gW = 0, bW = 0, aSum = 0, wSum = 0;
    const total = SAMPLES * SAMPLES;

    for (let sj = 0; sj < SAMPLES; sj++) {
      for (let si = 0; si < SAMPLES; si++) {
        const subX = x + (si + 0.5) / SAMPLES;
        const subY = y + (sj + 0.5) / SAMPLES;
        const [cr, cg, cb, ca] = getColor(subX, subY);
        const w = ca / 255;
        rW += cr * w;
        gW += cg * w;
        bW += cb * w;
        aSum += ca;
        wSum += w;
      }
    }

    rawData[px + 3] = Math.round(aSum / total);
    if (wSum > 0) {
      rawData[px]     = Math.round(rW / wSum);
      rawData[px + 1] = Math.round(gW / wSum);
      rawData[px + 2] = Math.round(bW / wSum);
    }
  }
}

// ─── Encode PNG ───

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 6;   // color type: RGBA
ihdr[10] = 0;  // compression
ihdr[11] = 0;  // filter
ihdr[12] = 0;  // interlace

const png = Buffer.concat([
  signature,
  createPngChunk('IHDR', ihdr),
  createPngChunk('IDAT', deflateSync(rawData)),
  createPngChunk('IEND', Buffer.alloc(0)),
]);

writeFileSync(resolve(__dirname, 'static/icons/icon-32.png'), png);
writeFileSync(resolve(__dirname, 'dist/icons/icon-32.png'), png);
console.log(`Created icon-32.png (${png.length} bytes)`);
