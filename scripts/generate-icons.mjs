// One-off generator for the extension icons (public/icons/icon{16,48,128}.png).
// Draws a rounded palette tile with three dots; pure Node, no image libraries.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public/icons');

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeData));
  return Buffer.concat([len, typeData, crc]);
};

const encodePng = (size, pixel) => {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const draw = (size) => (x, y) => {
  const cx = x + 0.5;
  const cy = y + 0.5;
  const radius = size * 0.22;
  const inset = size * 0.06;
  const min = inset;
  const max = size - inset;
  const dx = Math.max(min + radius - cx, 0, cx - (max - radius));
  const dy = Math.max(min + radius - cy, 0, cy - (max - radius));
  const insideTile =
    Math.hypot(dx, dy) <= radius && cx >= min && cx <= max && cy >= min && cy <= max;
  if (!insideTile) return [0, 0, 0, 0];
  const dots = [
    [0.32, 0.38, [255, 99, 71]],
    [0.68, 0.38, [255, 196, 0]],
    [0.5, 0.68, [64, 196, 255]],
  ];
  for (const [fx, fy, color] of dots) {
    if (Math.hypot(cx - fx * size, cy - fy * size) <= size * 0.12) return [...color, 255];
  }
  return [30, 30, 30, 255];
};

await mkdir(outDir, { recursive: true });
for (const size of [16, 48, 128]) {
  await writeFile(path.join(outDir, `icon${size}.png`), encodePng(size, draw(size)));
}
console.log('icons written to public/icons/');
