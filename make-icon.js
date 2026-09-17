const fs = require('fs');
const size = 256;
const pixelBytes = size * size * 4;
const headerSize = 40;
const maskRowBytes = Math.ceil(size / 32) * 4;
const maskBytes = maskRowBytes * size;
const imageBytes = headerSize + pixelBytes + maskBytes;
const out = Buffer.alloc(6 + 16 + imageBytes);

// ICO header
out.writeUInt16LE(0, 0);
out.writeUInt16LE(1, 2);
out.writeUInt16LE(1, 4);
// Directory entry
out.writeUInt8(size, 6);
out.writeUInt8(size, 7);
out.writeUInt8(0, 8);
out.writeUInt8(0, 9);
out.writeUInt16LE(1, 10);
out.writeUInt16LE(32, 12);
out.writeUInt32LE(imageBytes, 14);
out.writeUInt32LE(22, 18);
// DIB header
let p = 22;
out.writeUInt32LE(headerSize, p); p += 4;
out.writeInt32LE(size, p); p += 4;
out.writeInt32LE(size * 2, p); p += 4;
out.writeUInt16LE(1, p); p += 2;
out.writeUInt16LE(32, p); p += 2;
out.writeUInt32LE(0, p); p += 4;
out.writeUInt32LE(pixelBytes, p); p += 4;
out.writeInt32LE(0, p); p += 4;
out.writeInt32LE(0, p); p += 4;
out.writeUInt32LE(0, p); p += 4;
out.writeUInt32LE(0, p); p += 4;

function pixel(x, y) {
  const cx = 128, cy = 128;
  const dx = x - cx, dy = y - cy;
  const d = Math.hypot(dx, dy);
  const ray = (Math.abs(dx) < 12 && Math.abs(dy) > 72) || (Math.abs(dy) < 12 && Math.abs(dx) > 72) || (Math.abs(Math.abs(dx) - Math.abs(dy)) < 10 && Math.abs(dx) > 55);
  if (d < 67 || (ray && d < 108)) return [42, 201, 255, 255];
  const rounded = x >= 18 && x < 238 && y >= 18 && y < 238;
  return rounded ? [10, 14, 24, 255] : [0, 0, 0, 0];
}
// BGRA pixels, bottom-up
for (let y = size - 1; y >= 0; y--) {
  for (let x = 0; x < size; x++) {
    const [r, g, b, a] = pixel(x, y);
    out[p++] = b; out[p++] = g; out[p++] = r; out[p++] = a;
  }
}
// Fully transparent AND mask
out.fill(0, p, p + maskBytes);
fs.writeFileSync('icon.ico', out);
console.log('Generated icon.ico');
