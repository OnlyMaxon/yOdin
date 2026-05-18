const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// CRC32
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[i] = c;
}
const crc32 = (buf) => {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = crcTable[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
};
const makeChunk = (type, data) => {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
};
const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function makePNG(width, height, colorType, getPixel) {
  const ch = colorType === 6 ? 4 : 3;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = colorType;
  const raw = Buffer.alloc((width * ch + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * ch + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const px = getPixel(x, y, width, height);
      const o = y * (width * ch + 1) + 1 + x * ch;
      for (let c = 0; c < ch; c++) raw[o + c] = px[c];
    }
  }
  return Buffer.concat([
    PNG_SIG,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

const PRIMARY = [91, 79, 232];
const WHITE = [255, 255, 255];

function blend(a, b, t) {
  return a.map((v, i) => Math.round(v * t + b[i] * (1 - t)));
}

function ringA(x, y, cx, cy, outerR, innerR, aa = 1.5) {
  const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  return Math.min(1, Math.max(0, (outerR - d + aa) / (aa * 2)))
       * Math.min(1, Math.max(0, (d - innerR + aa) / (aa * 2)));
}

const assetsDir = path.join(__dirname, '..', 'assets');

// icon.png — 1024x1024 RGB, purple bg + white ring
process.stdout.write('Generating icon.png...');
const iconPNG = makePNG(1024, 1024, 2, (x, y, w) => {
  const cx = w / 2, cy = w / 2;
  const ra = ringA(x, y, cx, cy, w * 0.33, w * 0.20, 2);
  return ra > 0 ? blend(WHITE, PRIMARY, ra) : [...PRIMARY];
});
fs.writeFileSync(path.join(assetsDir, 'icon.png'), iconPNG);
console.log(' done');

// splash-icon.png — 512x512 RGBA, transparent + white ring (shown on #5B4FE8 bg)
process.stdout.write('Generating splash-icon.png...');
const splashPNG = makePNG(512, 512, 6, (x, y, w) => {
  const cx = w / 2, cy = w / 2;
  const ra = ringA(x, y, cx, cy, w * 0.33, w * 0.20, 2);
  return [255, 255, 255, Math.round(ra * 255)];
});
fs.writeFileSync(path.join(assetsDir, 'splash-icon.png'), splashPNG);
console.log(' done');

// adaptive-icon.png — 1024x1024 RGBA, transparent + primary ring (Android, shown on white bg)
process.stdout.write('Generating adaptive-icon.png...');
const adaptivePNG = makePNG(1024, 1024, 6, (x, y, w) => {
  const cx = w / 2, cy = w / 2;
  const ra = ringA(x, y, cx, cy, w * 0.33, w * 0.20, 2);
  return [...PRIMARY, Math.round(ra * 255)];
});
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), adaptivePNG);
console.log(' done');

// favicon.png — 32x32 RGB
process.stdout.write('Generating favicon.png...');
const faviconPNG = makePNG(32, 32, 2, (x, y, w) => {
  const cx = w / 2, cy = w / 2;
  const ra = ringA(x, y, cx, cy, w * 0.33, w * 0.20, 1);
  return ra > 0 ? blend(WHITE, PRIMARY, ra) : [...PRIMARY];
});
fs.writeFileSync(path.join(assetsDir, 'favicon.png'), faviconPNG);
console.log(' done');

console.log('\nAll assets generated successfully!');
