#!/usr/bin/env node
// Generates src/icon-192.png and src/icon-512.png for PWA manifest.
// Uses pure Node.js — no canvas/sharp dependency.
// Writes minimal valid PNGs with the HiCap Prep brand color (#1d1b2e bg, #f2621f "HC" text).
// These are intentionally simple; replace with real artwork later.

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function writePng(filePath, size) {
  const bg = [0x1d, 0x1b, 0x2e]; // --ink
  const fg = [0xf2, 0x62, 0x1f]; // --flare

  // Build raw RGBA pixel data (size × size × 4 bytes)
  const raw = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      raw[i] = bg[0]; raw[i+1] = bg[1]; raw[i+2] = bg[2]; raw[i+3] = 255;
    }
  }

  // Draw a simple "H" glyph — center a thick H shape in fg colour
  const u = Math.floor(size / 8);  // unit
  const cx = Math.floor(size / 2);
  const cy = Math.floor(size / 2);
  const h = u * 4;  // half-height of the glyph

  function fill(x0, y0, x1, y1) {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (x >= 0 && x < size && y >= 0 && y < size) {
          const i = (y * size + x) * 4;
          raw[i] = fg[0]; raw[i+1] = fg[1]; raw[i+2] = fg[2]; raw[i+3] = 255;
        }
      }
    }
  }

  // Left vertical bar of H
  fill(cx - u*3, cy - h, cx - u, cy + h);
  // Right vertical bar of H
  fill(cx + u, cy - h, cx + u*3, cy + h);
  // Crossbar of H
  fill(cx - u*3, cy - u, cx + u*3, cy + u);

  // Build PNG file
  function chunk(type, data) {
    const typeBuf = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcBuf = crc32(Buffer.concat([typeBuf, data]));
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  function crc32(buf) {
    let crc = 0xffffffff;
    for (const b of buf) {
      crc ^= b;
      for (let i = 0; i < 8; i++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    const result = Buffer.alloc(4);
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
    return result;
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);   // width
  ihdr.writeUInt32BE(size, 4);   // height
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB (no alpha for simplicity — but we built RGBA)
  // Actually use RGBA (color type 6) to keep the buffer as-is
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Build filtered rows (filter byte 0 = None prepended to each row)
  const rowSize = size * 4;
  const filtered = Buffer.alloc(size * (rowSize + 1));
  for (let y = 0; y < size; y++) {
    filtered[y * (rowSize + 1)] = 0; // filter type: None
    raw.copy(filtered, y * (rowSize + 1) + 1, y * rowSize, (y + 1) * rowSize);
  }

  const compressed = zlib.deflateSync(filtered);

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const png = Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);

  fs.writeFileSync(filePath, png);
  console.log("gen-icons: wrote", filePath, `(${png.length} bytes)`);
}

const src = path.join(__dirname, "..", "src");
writePng(path.join(src, "icon-192.png"), 192);
writePng(path.join(src, "icon-512.png"), 512);
