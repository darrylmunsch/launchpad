// Generate simple solid-color PNG icons for the Chrome extension
// Uses raw PNG binary encoding — no external dependencies needed

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

function createPng(size, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);  // width
  ihdr.writeUInt32BE(size, 4);  // height
  ihdr[8] = 8;                   // bit depth
  ihdr[9] = 2;                   // color type (RGB)
  ihdr[10] = 0;                  // compression
  ihdr[11] = 0;                  // filter
  ihdr[12] = 0;                  // interlace

  // Image data — simple solid color with bookmark shape
  const rowBytes = 1 + size * 3; // filter byte + RGB per pixel
  const rawData = Buffer.alloc(rowBytes * size);

  const cx = size / 2;
  const bookLeft = size * 0.25;
  const bookRight = size * 0.75;
  const bookTop = size * 0.15;
  const bookBottom = size * 0.85;
  const notchY = size * 0.7;

  for (let y = 0; y < size; y++) {
    const rowStart = y * rowBytes;
    rawData[rowStart] = 0; // no filter

    for (let x = 0; x < size; x++) {
      const px = rowStart + 1 + x * 3;

      // Round rect background
      const cornerRadius = size * 0.2;
      const inCorner = (
        (x < cornerRadius && y < cornerRadius && Math.hypot(x - cornerRadius, y - cornerRadius) > cornerRadius) ||
        (x > size - cornerRadius && y < cornerRadius && Math.hypot(x - (size - cornerRadius), y - cornerRadius) > cornerRadius) ||
        (x < cornerRadius && y > size - cornerRadius && Math.hypot(x - cornerRadius, y - (size - cornerRadius)) > cornerRadius) ||
        (x > size - cornerRadius && y > size - cornerRadius && Math.hypot(x - (size - cornerRadius), y - (size - cornerRadius)) > cornerRadius)
      );

      if (inCorner) {
        // Transparent-ish (white background)
        rawData[px] = 255;
        rawData[px + 1] = 255;
        rawData[px + 2] = 255;
        continue;
      }

      // Check if inside bookmark shape
      const inBookmark = (
        x >= bookLeft && x <= bookRight &&
        y >= bookTop && y <= bookBottom &&
        // Notch at bottom: triangle cut-out
        !(y > notchY && Math.abs(x - cx) < (y - notchY) * ((bookRight - bookLeft) / 2 / (bookBottom - notchY)))
      );

      if (inBookmark) {
        // White bookmark on blue background
        rawData[px] = 255;
        rawData[px + 1] = 255;
        rawData[px + 2] = 255;
      } else {
        // Blue background
        rawData[px] = r;
        rawData[px + 1] = g;
        rawData[px + 2] = b;
      }
    }
  }

  const compressed = deflateSync(rawData);

  // IEND chunk
  const iend = createPngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([
    signature,
    createPngChunk('IHDR', ihdr),
    createPngChunk('IDAT', compressed),
    iend,
  ]);
}

// Blue accent color: #3b82f6
const sizes = [16, 48, 128];
for (const size of sizes) {
  const png = createPng(size, 59, 130, 246);
  writeFileSync(resolve(__dirname, `static/icons/icon-${size}.png`), png);
  writeFileSync(resolve(__dirname, `dist/icons/icon-${size}.png`), png);
  console.log(`Created icon-${size}.png (${png.length} bytes)`);
}
